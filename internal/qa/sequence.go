package qa

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"
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
