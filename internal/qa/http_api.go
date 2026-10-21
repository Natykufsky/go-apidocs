package qa

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	aiDomain "github.com/Natykufsky/go-apidocs/internal/ai/domain"
)

// ---- Execute suites server-side ----

// ExecuteRequest asks the backend to run one or more AI test suites live.
type ExecuteRequest struct {
	// Suites to run, keyed by endpoint key.
	Suites map[string]*aiDomain.TestSuite `json:"suites"`
	// BaseURL prepended to relative paths (defaults to the portal's own origin
	// semantics: paths are used as-is, so usually empty for same-host APIs).
	BaseURL     string            `json:"base_url,omitempty"`
	ExtraHeader map[string]string `json:"extra_headers,omitempty"`
	TimeoutSecs int               `json:"timeout_secs,omitempty"`
}

// ExecuteResponse returns per-endpoint execution results.
type ExecuteResponse struct {
	Results    map[string][]aiDomain.TestResult `json:"results"`
	Summary    map[string]EndpointRunSummary    `json:"summary"`
	DurationMs int64                            `json:"duration_ms"`
}

// EndpointRunSummary aggregates one endpoint's run.
type EndpointRunSummary struct {
	Total  int   `json:"total"`
	Passed int   `json:"passed"`
	Failed int   `json:"failed"`
	AvgMs  int64 `json:"avg_latency_ms"`
}

// HandleExecuteHTTP runs AI suites server-side with real assertion evaluation.
func (q *QATracker) HandleExecuteHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "use POST"})
		return
	}

	var req ExecuteRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 10<<20)).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid request body: " + err.Error()})
		return
	}
	if len(req.Suites) == 0 {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "no suites provided"})
		return
	}

	timeout := time.Duration(req.TimeoutSecs) * time.Second
	if timeout <= 0 {
		timeout = 30 * time.Second
	}
	opts := executeOptions{
		baseURL:     strings.TrimSuffix(req.BaseURL, "/"),
		extraHeader: req.ExtraHeader,
		timeout:     timeout,
		httpClient:  &http.Client{Timeout: timeout},
	}

	start := time.Now()
	resp := ExecuteResponse{
		Results: make(map[string][]aiDomain.TestResult, len(req.Suites)),
		Summary: make(map[string]EndpointRunSummary, len(req.Suites)),
	}

	for epKey, suite := range req.Suites {
		if suite == nil {
			continue
		}
		var results []aiDomain.TestResult
		var totalLatency int64
		summary := EndpointRunSummary{Total: len(suite.TestCases)}
		for _, tc := range suite.TestCases {
			res := executeTestCase(r.Context(), tc, opts)
			results = append(results, res)
			totalLatency += res.DurationMs
			if res.Passed {
				summary.Passed++
			} else {
				summary.Failed++
			}
		}
		if summary.Total > 0 {
			summary.AvgMs = totalLatency / int64(summary.Total)
		}
		resp.Results[epKey] = results
		resp.Summary[epKey] = summary
	}
	resp.DurationMs = time.Since(start).Milliseconds()

	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(resp)
}

// ---- Persisted report management ----

// reportsStore is created lazily on first use, next to the QA tracker file.
func (q *QATracker) reports() *ReportStore {
	q.mu.Lock()
	defer q.mu.Unlock()
	if q.reportsStore == nil {
		dir := q.storagePath
		if dir == "" {
			dir = "./docs/qa_tracker.json"
		}
		// Place reports alongside the tracker: <dir of tracker>/qa_reports
		q.reportsStore = NewReportStore(strings.TrimSuffix(dir, "/qa_tracker.json") + "/qa_reports")
	}
	return q.reportsStore
}

// HandleReportsHTTP manages saved execution reports:
//
//	GET    /docs/qa/reports          list saved reports
//	POST   /docs/qa/reports          save a new report
//	GET    /docs/qa/reports?id=...   fetch one report
//	DELETE /docs/qa/reports?id=...   delete a report
func (q *QATracker) HandleReportsHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	store := q.reports()

	switch r.Method {
	case http.MethodGet:
		id := r.URL.Query().Get("id")
		if id != "" {
			rep, err := store.Get(id)
			if err != nil {
				w.WriteHeader(http.StatusNotFound)
				_ = json.NewEncoder(w).Encode(map[string]string{"error": "report not found"})
				return
			}
			_ = json.NewEncoder(w).Encode(rep)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"reports": store.List()})

	case http.MethodPost:
		var rep Report
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 10<<20)).Decode(&rep); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid report payload: " + err.Error()})
			return
		}
		saved, err := store.Save(&rep)
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "failed to save report: " + err.Error()})
			return
		}
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(saved)

	case http.MethodDelete:
		id := r.URL.Query().Get("id")
		if id == "" {
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "id query param required"})
			return
		}
		if err := store.Delete(id); err != nil {
			w.WriteHeader(http.StatusNotFound)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "report not found"})
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]bool{"deleted": true})

	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "method not allowed"})
	}
}

// HandleSequenceHTTP analyzes the OpenAPI spec and returns the recommended
// endpoint testing sequence with dependency chains.
func (q *QATracker) HandleSequenceHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "use POST with the raw OpenAPI spec body"})
		return
	}

	specData := make([]byte, 0, 1<<20)
	buf := make([]byte, 32*1024)
	for {
		n, err := r.Body.Read(buf)
		specData = append(specData, buf[:n]...)
		if err != nil || len(specData) > 5<<20 {
			break
		}
	}

	analysis, err := AnalyzeSequences(specData)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	_ = json.NewEncoder(w).Encode(analysis)
}
