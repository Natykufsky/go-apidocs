package qa

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"

	aiDomain "github.com/Natykufsky/go-apidocs/internal/ai/domain"
	aiPort "github.com/Natykufsky/go-apidocs/internal/ai/port"
)

// SequenceStep is one ordered operation in a recommended test workflow.
type SequenceStep struct {
	Order       int      `json:"order"`
	EndpointKey string   `json:"endpoint_key"`
	Method      string   `json:"method"`
	Path        string   `json:"path"`
	Reason      string   `json:"reason"`
	DependsOn   []string `json:"depends_on,omitempty"` // endpoint keys that must run first
}

// SequenceAnalysis is the recommended testing order for a set of endpoints,
// derived from OpenAPI structure using REST convention & dependency heuristics.
type SequenceAnalysis struct {
	Summary string         `json:"summary"`
	Phases  []string       `json:"phases"`
	Steps   []SequenceStep `json:"steps"`
	Notes   []string       `json:"notes,omitempty"`
}

// AnalyzeSequences orders endpoints into a pragmatic test execution sequence
// using REST & API-testing standards:
//
//  1. Health/metadata endpoints first (cheap smoke validation)
//  2. Read-only GETs before mutations (establish baseline state)
//  3. POST (create) before PUT/PATCH (modify) before DELETE (cleanup) —
//     so destructive tests never run before the resources they need exist
//  4. Parameterized paths (/items/{id}) depend on the collection endpoint
//     that creates the resource
//  5. Admin/auth endpoints last (they mutate global state)
func AnalyzeSequences(specJSON []byte) (*SequenceAnalysis, error) {
	var spec struct {
		Paths map[string]map[string]struct {
			Tags        []string              `json:"tags"`
			Summary     string                `json:"summary"`
			Description string                `json:"description"`
			OperationID string                `json:"operationId"`
			Security    []map[string][]string `json:"security"`
		} `json:"paths"`
	}
	if err := json.Unmarshal(specJSON, &spec); err != nil {
		return nil, fmt.Errorf("invalid spec: %w", err)
	}

	type epInfo struct {
		key, method, path string
		weight            int // lower runs first
		dependsOn         []string
		reason            string
	}

	var eps []epInfo
	for path, ops := range spec.Paths {
		for method := range ops {
			m := strings.ToUpper(method)
			switch m {
			case "GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS":
			default:
				continue
			}

			ep := epInfo{key: m + " " + path, method: m, path: path}

			switch {
			case isHealthOrMeta(path, m):
				ep.weight = 0
				ep.reason = "Health/metadata smoke check — validates the service is up before deeper tests"
			case m == "GET" && !strings.Contains(path, "{"):
				ep.weight = 10
				ep.reason = "Collection read — establishes baseline data with zero side effects"
			case m == "GET":
				ep.weight = 35
				ep.reason = "Item read — depends on resources created by the collection POST; run after create"
				ep.dependsOn = append(ep.dependsOn, collectionCreateKey(path))
			case m == "POST" && !strings.Contains(path, "{"):
				ep.weight = 30
				ep.reason = "Create — produces the resources later read/modify/delete tests depend on"
			case m == "POST":
				ep.weight = 40
				ep.reason = "Action/sub-resource POST — modifies state of an existing resource"
				ep.dependsOn = append(ep.dependsOn, collectionCreateKey(path))
			case m == "PUT" || m == "PATCH":
				ep.weight = 50
				ep.reason = "Update — requires an existing resource; run after create/read checks"
				ep.dependsOn = append(ep.dependsOn, collectionCreateKey(path))
			case m == "DELETE":
				ep.weight = 60
				ep.reason = "Delete (destructive) — run last within the resource lifecycle"
				ep.dependsOn = append(ep.dependsOn, collectionCreateKey(path))
			}

			// Auth/admin endpoints are deferred: they usually mutate global state.
			lower := strings.ToLower(path)
			if strings.Contains(lower, "admin") || strings.Contains(lower, "/auth/") ||
				strings.Contains(lower, "password") || strings.Contains(lower, "role") {
				ep.weight += 80
				ep.reason += "; deferred (auth/admin surface mutates global state)"
			}

			eps = append(eps, ep)
		}
	}

	sort.SliceStable(eps, func(i, j int) bool { return eps[i].weight < eps[j].weight })

	analysis := &SequenceAnalysis{
		Summary: fmt.Sprintf("Recommended sequence for %d operations based on REST testing standards: smoke → baseline reads → create → modify → delete, with destructive/auth surfaces last.", len(eps)),
		Phases: []string{
			"Phase 0 — Smoke & Health",
			"Phase 1 — Baseline Reads (GET collections)",
			"Phase 2 — Create (POST)",
			"Phase 3 — Reads of created resources",
			"Phase 4 — Updates (PUT/PATCH)",
			"Phase 5 — Deletes & cleanup",
			"Phase 6 — Auth/Admin & global-state surfaces",
		},
		Notes: []string{
			"Dependencies assume standard REST resource modeling (POST /collection → /collection/{id}).",
			"Parameterized endpoints should reuse IDs returned from the create step (chain execution).",
			"Run security/abuse suites per endpoint after the functional sequence passes.",
		},
	}

	for i, ep := range eps {
		analysis.Steps = append(analysis.Steps, SequenceStep{
			Order:       i + 1,
			EndpointKey: ep.key,
			Method:      ep.method,
			Path:        ep.path,
			Reason:      ep.reason,
			DependsOn:   ep.dependsOn,
		})
	}
	return analysis, nil
}

// isHealthOrMeta detects health/readiness/openapi/meta style endpoints.
func isHealthOrMeta(path, method string) bool {
	if method != "GET" {
		return false
	}
	lower := strings.ToLower(path)
	for _, kw := range []string{"health", "ready", "live", "status", "ping", "info", "swagger", "openapi", "metrics"} {
		if strings.Contains(lower, kw) {
			return true
		}
	}
	return false
}

// collectionCreateKey returns the endpoint key of the collection POST that
// creates resources for a parameterized path (e.g. "/pets/{id}" → "POST /pets").
func collectionCreateKey(paramPath string) string {
	segments := strings.Split(paramPath, "/")
	var concrete []string
	for _, seg := range segments {
		if strings.HasPrefix(seg, "{") && strings.HasSuffix(seg, "}") {
			break
		}
		if seg != "" {
			concrete = append(concrete, seg)
		}
	}
	if len(concrete) == 0 {
		return ""
	}
	return "POST /" + strings.Join(concrete, "/")
}

// ---------- AI-Suggested Sequence ----------

// AISequenceRequest carries the context the LLM needs plus routing overrides.
type AISequenceRequest struct {
	SpecJSON     string `json:"spec_json,omitempty"`
	Provider     string `json:"provider,omitempty"`
	Model        string `json:"model,omitempty"`
	BaseURL      string `json:"base_url,omitempty"`
	APIKey       string `json:"api_key,omitempty"`
	CustomPrompt string `json:"custom_prompt,omitempty"`
}

// AISequenceResponse is the LLM-ordered workflow.
type AISequenceResponse struct {
	Summary     string         `json:"summary"`
	Phases      []string       `json:"phases,omitempty"`
	Steps       []SequenceStep `json:"steps"`
	Notes       []string       `json:"notes,omitempty"`
	ModelUsed   string         `json:"model_used"`
	GeneratedAt string         `json:"generated_at"`
}

// aiSequencePrompt builds the system + user prompts for workflow reasoning.
func aiSequencePrompt(endpoints []string, heuristic *SequenceAnalysis, custom string) (system, user string) {
	system = "You are a senior API test architect. You design realistic, dependency-aware " +
		"test execution sequences for REST APIs based on business workflows (e.g. register -> " +
		"verify -> login -> operate -> logout), not just HTTP verb conventions. " +
		"Respond with STRICT JSON only, no markdown, matching this schema: " +
		`{"summary": string, "phases": [string], "steps": [{"endpoint_key": string, "reason": string, "depends_on": [string]}], "notes": [string]}. ` +
		"Every endpoint_key MUST be copied verbatim from the provided list — never invent, merge, or rename endpoints. " +
		"Include every provided endpoint exactly once."

	var b strings.Builder
	b.WriteString("Endpoint catalog (use endpoint_key values EXACTLY as written):\n")
	for _, ep := range endpoints {
		b.WriteString("  - " + ep + "\n")
	}
	b.WriteString("\nA structural (REST-convention) draft ordering for reference — improve on it " +
		"using business logic, data dependencies, and workflow realism:\n")
	for _, s := range heuristic.Steps {
		b.WriteString(fmt.Sprintf("  %d. %s — %s\n", s.Order, s.EndpointKey, s.Reason))
	}
	if custom != "" {
		b.WriteString("\nAdditional operator instructions (highest priority):\n" + custom + "\n")
	}
	b.WriteString("\nOrder ALL endpoints into the most realistic end-to-end test workflow. " +
		"Group steps into named phases (e.g. \"Setup & Auth\", \"Core CRUD\", \"Cleanup\"). " +
		"For each step explain the business reason and list which earlier steps it depends on.")
	return system, b.String()
}

// GenerateAISequence asks the LLM for a business-logic test workflow and
// validates that every endpoint from the catalog appears exactly once.
// The llm client must implement port.Completer; unsupported clients or empty
// catalogs return an error so callers can fall back to the heuristic analysis.
func GenerateAISequence(ctx context.Context, llm aiPort.LLMClientPort, req AISequenceRequest, endpoints []string) (*AISequenceResponse, error) {
	if llm == nil {
		return nil, fmt.Errorf("AI client not configured")
	}
	completer, ok := llm.(aiPort.Completer)
	if !ok {
		return nil, fmt.Errorf("provider %q does not support generic completions", llm.ProviderName())
	}
	if len(endpoints) == 0 {
		return nil, fmt.Errorf("no endpoints provided")
	}

	// Heuristic draft gives the model a structural starting point.
	var specHeuristic []byte
	if req.SpecJSON != "" {
		specHeuristic = []byte(req.SpecJSON)
	} else {
		// Synthesize a minimal spec-shaped payload from the catalog so the
		// heuristic analyzer has something to order.
		var sb strings.Builder
		sb.WriteString(`{"paths":{`)
		for i, ep := range endpoints {
			sp := strings.IndexByte(ep, ' ')
			if sp < 0 {
				continue
			}
			if i > 0 {
				sb.WriteString(",")
			}
			method := strings.ToLower(ep[:sp])
			path := ep[sp+1:]
			sb.WriteString(fmt.Sprintf(`%q:{%q:{}}`, path, method))
		}
		sb.WriteString(`}}`)
		specHeuristic = []byte(sb.String())
	}
	heuristic, err := AnalyzeSequences(specHeuristic)
	if err != nil {
		heuristic = &SequenceAnalysis{}
	}

	system, user := aiSequencePrompt(endpoints, heuristic, req.CustomPrompt)

	ctx, cancel := context.WithTimeout(ctx, 90*time.Second)
	defer cancel()

	raw, err := completer.Complete(ctx, aiPort.CompleteOptions{
		SystemPrompt: system,
		UserPrompt:   user,
		JSONMode:     true,
		Provider:     req.Provider,
		Model:        req.Model,
		BaseURL:      req.BaseURL,
		APIKey:       req.APIKey,
	})
	if err != nil {
		return nil, fmt.Errorf("AI sequence generation failed: %w", err)
	}

	var parsed struct {
		Summary string   `json:"summary"`
		Phases  []string `json:"phases"`
		Steps   []struct {
			EndpointKey string   `json:"endpoint_key"`
			Reason      string   `json:"reason"`
			DependsOn   []string `json:"depends_on"`
		} `json:"steps"`
		Notes []string `json:"notes"`
	}
	if err := json.Unmarshal([]byte(aiDomain.CleanJSONResponse(raw)), &parsed); err != nil {
		return nil, fmt.Errorf("AI sequence JSON invalid: %w", err)
	}

	// Validate: every catalog endpoint must appear exactly once; unknown keys dropped.
	seen := make(map[string]bool, len(endpoints))
	valid := make(map[string]bool, len(endpoints))
	for _, ep := range endpoints {
		valid[ep] = true
	}
	steps := make([]SequenceStep, 0, len(endpoints))
	order := 0
	for _, s := range parsed.Steps {
		if !valid[s.EndpointKey] || seen[s.EndpointKey] {
			continue
		}
		seen[s.EndpointKey] = true
		order++
		step := SequenceStep{
			Order:       order,
			EndpointKey: s.EndpointKey,
			Method:      methodOf(s.EndpointKey),
			Path:        pathOf(s.EndpointKey),
			Reason:      s.Reason,
			DependsOn:   s.DependsOn,
		}
		steps = append(steps, step)
	}
	// Any endpoint the model dropped gets appended in heuristic order.
	for _, h := range heuristic.Steps {
		if !seen[h.EndpointKey] {
			order++
			steps = append(steps, SequenceStep{
				Order: order, EndpointKey: h.EndpointKey, Method: h.Method, Path: h.Path,
				Reason: h.Reason + " (appended: not covered by AI sequence)",
			})
		}
	}

	return &AISequenceResponse{
		Summary:     parsed.Summary,
		Phases:      parsed.Phases,
		Steps:       steps,
		Notes:       parsed.Notes,
		ModelUsed:   req.Model,
		GeneratedAt: time.Now().UTC().Format(time.RFC3339),
	}, nil
}

func methodOf(endpointKey string) string {
	if i := strings.Index(endpointKey, " "); i > 0 {
		return endpointKey[:i]
	}
	return ""
}

func pathOf(endpointKey string) string {
	if i := strings.Index(endpointKey, " "); i >= 0 {
		return endpointKey[i+1:]
	}
	return endpointKey
}

// HandleAISequenceHTTP handles POST /docs/qa/sequence/ai:
//
//	Body: {"endpoints": ["GET /pets", ...], spec_json?, provider?, model?, ...}
//	Returns the AI-ordered workflow or an error for heuristic fallback.
func (q *QATracker) HandleAISequenceHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "use POST"})
		return
	}
	if q.llmClient == nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "AI service not configured — configure a provider key to use AI sequencing"})
		return
	}

	var req struct {
		AISequenceRequest
		Endpoints []string `json:"endpoints"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 10<<20)).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid request body: " + err.Error()})
		return
	}
	if len(req.Endpoints) == 0 {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "endpoints list is required"})
		return
	}

	analysis, err := GenerateAISequence(r.Context(), q.llmClient, req.AISequenceRequest, req.Endpoints)
	if err != nil {
		w.WriteHeader(http.StatusBadGateway)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	_ = json.NewEncoder(w).Encode(analysis)
}
