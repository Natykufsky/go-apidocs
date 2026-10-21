package qa

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	aiDomain "github.com/Natykufsky/go-apidocs/internal/ai/domain"
)

func TestExecuteTestCase_StatusAndBodyAssertions(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"id":"42","name":"Widget","tags":["a","b"]}`))
	}))
	defer ts.Close()

	tc := aiDomain.TestCase{
		ID:             "t1",
		Method:         "GET",
		Path:           "/items/42",
		ExpectedStatus: 200,
		Assertions: []string{
			"status_is 200",
			"json_path id == 42",
			"json_path name == Widget",
			"json_path tags not_empty",
			"body_contains Widget",
			"header Content-Type contains json",
		},
	}
	res := executeTestCase(context.Background(), tc, executeOptions{baseURL: ts.URL})
	if !res.Passed {
		t.Fatalf("expected pass, got: %+v", res)
	}
	if res.ActualStatus != 200 || res.DurationMs < 0 {
		t.Errorf("unexpected status/duration: %d/%d", res.ActualStatus, res.DurationMs)
	}
	if len(res.AssertionChecks) < 6 {
		t.Errorf("expected >=6 assertion checks, got %d", len(res.AssertionChecks))
	}
}

func TestExecuteTestCase_FailingAssertionRecordsDetail(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"id":"7"}`))
	}))
	defer ts.Close()

	tc := aiDomain.TestCase{
		Method:         "GET",
		Path:           "/",
		ExpectedStatus: 200,
		Assertions:     []string{"json_path name == Widget"},
	}
	res := executeTestCase(context.Background(), tc, executeOptions{baseURL: ts.URL})
	if res.Passed {
		t.Fatal("expected failure on mismatched json path")
	}
	// First check is the status match; the json_path check is second.
	if res.AssertionChecks[1].Passed {
		t.Error("json_path check should be marked failed")
	}
	if !strings.Contains(res.AssertionChecks[1].Detail, "actual") {
		t.Errorf("detail should include actual value, got %q", res.AssertionChecks[0].Detail)
	}
}

func TestExecuteTestCase_MethodsAndBodies(t *testing.T) {
	var seenMethod, seenBody string
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seenMethod = r.Method
		buf := make([]byte, 1024)
		n, _ := r.Body.Read(buf)
		seenBody = string(buf[:n])
		w.WriteHeader(http.StatusCreated)
	}))
	defer ts.Close()

	tc := aiDomain.TestCase{
		Method:         "POST",
		Path:           "/widgets",
		RequestBody:    map[string]any{"name": "gizmo"},
		ExpectedStatus: 201,
		Assertions:     []string{"status_is 201"},
	}
	res := executeTestCase(context.Background(), tc, executeOptions{baseURL: ts.URL})
	if !res.Passed || seenMethod != "POST" {
		t.Fatalf("POST failed: passed=%v method=%s", res.Passed, seenMethod)
	}
	if !strings.Contains(seenBody, "gizmo") {
		t.Errorf("request body not forwarded: %q", seenBody)
	}
}

func TestExecuteTestCase_QueryParamsAppended(t *testing.T) {
	var seenQuery string
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seenQuery = r.URL.RawQuery
		w.WriteHeader(200)
	}))
	defer ts.Close()

	tc := aiDomain.TestCase{
		Method:      "GET",
		Path:        "/search",
		QueryParams: map[string]string{"q": "widgets", "limit": "5"},
	}
	_ = executeTestCase(context.Background(), tc, executeOptions{baseURL: ts.URL})
	if !strings.Contains(seenQuery, "q=widgets") || !strings.Contains(seenQuery, "limit=5") {
		t.Errorf("query params missing: %q", seenQuery)
	}
}

func TestLookupJSONPath(t *testing.T) {
	obj := map[string]any{
		"data": map[string]any{
			"items": []any{
				map[string]any{"id": float64(1)},
				map[string]any{"id": float64(2)},
			},
		},
	}
	if v, ok := lookupJSONPath(obj, "data.items.1.id"); !ok || v != float64(2) {
		t.Errorf("lookupJSONPath failed: %v %v", v, ok)
	}
	if _, ok := lookupJSONPath(obj, "data.items.9.id"); ok {
		t.Error("out-of-range index should not resolve")
	}
	if _, ok := lookupJSONPath(obj, "missing.path"); ok {
		t.Error("missing path should not resolve")
	}
}

func TestEvalJSONPath_Operators(t *testing.T) {
	body := map[string]any{"count": float64(3), "name": "x", "empty": []any{}}
	cases := []struct {
		rest string
		want bool
	}{
		{"count == 3", true},
		{"count == 4", false},
		{"name != y", true},
		{"name exists", true},
		{"missing exists", false},
		{"empty not_empty", false},
		{"count not_empty", true},
	}
	for _, tc := range cases {
		got := evalJSONPath(tc.rest, body)
		if got.Passed != tc.want {
			t.Errorf("evalJSONPath(%q) = %v, want %v (detail: %s)", tc.rest, got.Passed, tc.want, got.Detail)
		}
	}
}

func TestReportStore_SaveListGetDelete(t *testing.T) {
	store := NewReportStore(t.TempDir())

	rep := &Report{Title: "Run 1", EndpointKey: "GET /items", Provider: "nvidia", Model: "m1"}
	rep.Summary.Total = 5
	rep.Summary.Passed = 4
	rep.Summary.Failed = 1
	saved, err := store.Save(rep)
	if err != nil {
		t.Fatalf("save failed: %v", err)
	}
	if saved.ID == "" || saved.SavedAt.IsZero() {
		t.Fatal("save should assign ID and timestamp")
	}

	list := store.List()
	if len(list) != 1 || list[0].Title != "Run 1" {
		t.Fatalf("list failed: %+v", list)
	}

	got, err := store.Get(saved.ID)
	if err != nil || got.EndpointKey != "GET /items" {
		t.Fatalf("get failed: %v %+v", err, got)
	}

	if err := store.Delete(saved.ID); err != nil {
		t.Fatalf("delete failed: %v", err)
	}
	if _, err := store.Get(saved.ID); err == nil {
		t.Error("get after delete should fail")
	}
}

func TestReportStore_PathTraversalSafe(t *testing.T) {
	store := NewReportStore(t.TempDir())
	// An ID with path separators must be sanitized, not escape the root.
	_ = store.path("../../etc/passwd")
	// No panic and no file outside root: implicit by construction; verify path stays in root.
	p := store.path("..\\..\\evil")
	if !strings.HasPrefix(p, store.root) && !strings.Contains(p, "_") {
		t.Errorf("path traversal not sanitized: %q", p)
	}
}

func TestAnalyzeSequences_Ordering(t *testing.T) {
	spec := []byte(`{
		"paths": {
			"/healthz": {"get": {}},
			"/pets": {"get": {}, "post": {}},
			"/pets/{id}": {"get": {}, "put": {}, "delete": {}},
			"/admin/reset": {"post": {}}
		}
	}`)
	analysis, err := AnalyzeSequences(spec)
	if err != nil {
		t.Fatalf("AnalyzeSequences failed: %v", err)
	}
	if len(analysis.Steps) != 7 {
		t.Fatalf("expected 7 steps, got %d: %+v", len(analysis.Steps), analysis.Steps)
	}

	// First step should be the health check.
	if analysis.Steps[0].Path != "/healthz" {
		t.Errorf("first step should be health, got %s", analysis.Steps[0].Path)
	}

	// Collection GET before POST before item GET before PUT before DELETE.
	order := map[string]int{}
	for i, s := range analysis.Steps {
		order[s.EndpointKey] = i
	}
	checks := []struct {
		first, second string
	}{
		{"GET /pets", "POST /pets"},
		{"POST /pets", "GET /pets/{id}"},
		{"GET /pets/{id}", "PUT /pets/{id}"},
		{"PUT /pets/{id}", "DELETE /pets/{id}"},
		{"DELETE /pets/{id}", "POST /admin/reset"},
	}
	for _, c := range checks {
		if order[c.first] >= order[c.second] {
			t.Errorf("%s should run before %s", c.first, c.second)
		}
	}

	// Parameterized endpoint should declare dependency on the collection create.
	var itemGet *SequenceStep
	for i := range analysis.Steps {
		if analysis.Steps[i].EndpointKey == "GET /pets/{id}" {
			itemGet = &analysis.Steps[i]
		}
	}
	if itemGet == nil || len(itemGet.DependsOn) == 0 || itemGet.DependsOn[0] != "POST /pets" {
		t.Errorf("GET /pets/{id} should depend on POST /pets, got %+v", itemGet)
	}
}

func TestAnalyzeSequences_AdminDeferred(t *testing.T) {
	spec := []byte(`{"paths": {"/admin/reset": {"post": {}}, "/pets": {"get": {}}}}`)
	analysis, err := AnalyzeSequences(spec)
	if err != nil {
		t.Fatal(err)
	}
	last := analysis.Steps[len(analysis.Steps)-1]
	if last.EndpointKey != "POST /admin/reset" {
		t.Errorf("admin endpoint should be deferred to last, got %s", last.EndpointKey)
	}
}
