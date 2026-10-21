package qa

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"

	aiDomain "github.com/Natykufsky/go-apidocs/internal/ai/domain"
	aiPort "github.com/Natykufsky/go-apidocs/internal/ai/port"
)

// fakeCompleterLLM implements both LLMClientPort and port.Completer.
type fakeCompleterLLM struct {
	content string
	gotSys  string
	gotUser string
}

func (f *fakeCompleterLLM) ProviderName() string { return "fake" }
func (f *fakeCompleterLLM) IsAvailable() bool    { return true }
func (f *fakeCompleterLLM) GenerateTests(_ context.Context, _ aiPort.GenerateOptions) (*aiDomain.TestSuite, error) {
	return &aiDomain.TestSuite{}, nil
}
func (f *fakeCompleterLLM) Complete(_ context.Context, opts aiPort.CompleteOptions) (string, error) {
	f.gotSys = opts.SystemPrompt
	f.gotUser = opts.UserPrompt
	return f.content, nil
}

const fakeAIResponse = `{
  "summary": "Register -> login -> operate workflow",
  "phases": ["Setup & Auth", "Core CRUD", "Cleanup"],
  "steps": [
    {"endpoint_key": "POST /auth/register", "reason": "create test identity first", "depends_on": []},
    {"endpoint_key": "POST /auth/login", "reason": "obtain session for later calls", "depends_on": ["POST /auth/register"]},
    {"endpoint_key": "GET /pets", "reason": "baseline collection read", "depends_on": ["POST /auth/login"]},
    {"endpoint_key": "POST /pets", "reason": "create pet resources", "depends_on": ["POST /auth/login"]},
    {"endpoint_key": "DELETE /pets/{id}", "reason": "cleanup resources last", "depends_on": ["POST /pets"]}
  ],
  "notes": ["Reuse session token across steps."]
}`

func TestGenerateAISequence_ValidWorkflow(t *testing.T) {
	llm := &fakeCompleterLLM{content: fakeAIResponse}
	endpoints := []string{
		"POST /auth/register",
		"POST /auth/login",
		"GET /pets",
		"POST /pets",
		"DELETE /pets/{id}",
	}

	resp, err := GenerateAISequence(context.Background(), llm, AISequenceRequest{}, endpoints)
	if err != nil {
		t.Fatalf("GenerateAISequence failed: %v", err)
	}

	if len(resp.Steps) != len(endpoints) {
		t.Fatalf("expected %d steps, got %d", len(endpoints), len(resp.Steps))
	}
	// Every step renumbered contiguously in AI's business order.
	if resp.Steps[0].EndpointKey != "POST /auth/register" {
		t.Errorf("AI workflow should start with register, got %s", resp.Steps[0].EndpointKey)
	}
	if resp.Steps[0].Order != 1 || resp.Steps[len(resp.Steps)-1].Order != len(endpoints) {
		t.Error("steps should be renumbered 1..N in AI order")
	}
	// Business dependency preserved from the AI payload.
	if resp.Steps[1].DependsOn[0] != "POST /auth/register" {
		t.Errorf("login should depend on register, got %v", resp.Steps[1].DependsOn)
	}
	if resp.Summary == "" || len(resp.Phases) != 3 {
		t.Errorf("summary/phases missing: %q %v", resp.Summary, resp.Phases)
	}
	// Prompt contained the catalog and the heuristic draft.
	if !strings.Contains(llm.gotUser, "POST /auth/register") {
		t.Error("prompt should include the endpoint catalog")
	}
}

func TestGenerateAISequence_DropsUnknownAndDuplicates(t *testing.T) {
	// Model hallucinates an endpoint and duplicates another.
	bad := `{"steps": [
		{"endpoint_key": "GET /pets", "reason": "ok", "depends_on": []},
		{"endpoint_key": "GET /nonexistent", "reason": "hallucinated", "depends_on": []},
		{"endpoint_key": "GET /pets", "reason": "duplicate", "depends_on": []}
	]}`
	llm := &fakeCompleterLLM{content: bad}
	endpoints := []string{"GET /pets", "POST /pets"}

	resp, err := GenerateAISequence(context.Background(), llm, AISequenceRequest{}, endpoints)
	if err != nil {
		t.Fatal(err)
	}
	if len(resp.Steps) != 2 {
		t.Fatalf("unknown + duplicate should be dropped/appended, got %d steps", len(resp.Steps))
	}
	counts := map[string]int{}
	for _, s := range resp.Steps {
		counts[s.EndpointKey]++
	}
	for ep, n := range counts {
		if n != 1 {
			t.Errorf("endpoint %s appears %d times", ep, n)
		}
	}
}

func TestGenerateAISequence_AppendsMissingEndpoints(t *testing.T) {
	// Model omits one endpoint; it must be appended (never silently lost).
	bad := `{"steps": [{"endpoint_key": "GET /pets", "reason": "ok", "depends_on": []}]}`
	llm := &fakeCompleterLLM{content: bad}
	endpoints := []string{"GET /pets", "POST /pets"}

	resp, err := GenerateAISequence(context.Background(), llm, AISequenceRequest{}, endpoints)
	if err != nil {
		t.Fatal(err)
	}
	if len(resp.Steps) != 2 {
		t.Fatalf("missing endpoint must be appended, got %d", len(resp.Steps))
	}
	if !strings.Contains(resp.Steps[1].Reason, "appended") {
		t.Errorf("appended step should be flagged: %q", resp.Steps[1].Reason)
	}
}

func TestGenerateAISequence_CleansMarkdownFences(t *testing.T) {
	// Some models wrap JSON in ```json fences despite instructions.
	wrapped := "```json\n" + fakeAIResponse + "\n```"
	llm := &fakeCompleterLLM{content: wrapped}
	endpoints := []string{"POST /auth/register", "POST /auth/login", "GET /pets", "POST /pets", "DELETE /pets/{id}"}

	resp, err := GenerateAISequence(context.Background(), llm, AISequenceRequest{}, endpoints)
	if err != nil {
		t.Fatalf("fenced JSON should be cleaned: %v", err)
	}
	if len(resp.Steps) != len(endpoints) {
		t.Fatalf("expected %d steps, got %d", len(endpoints), len(resp.Steps))
	}
}

func TestGenerateAISequence_EmptyEndpointsRejected(t *testing.T) {
	llm := &fakeCompleterLLM{content: fakeAIResponse}
	if _, err := GenerateAISequence(context.Background(), llm, AISequenceRequest{}, nil); err == nil {
		t.Error("empty catalog should be rejected")
	}
}

func TestGenerateAISequence_NonCompleterRejected(t *testing.T) {
	// A bare LLMClientPort without Complete capability.
	if _, err := GenerateAISequence(context.Background(), &fakeBasicLLM{}, AISequenceRequest{}, []string{"GET /x"}); err == nil {
		t.Error("non-completer client should be rejected with fallback hint")
	}
}

type fakeBasicLLM struct{}

func (f *fakeBasicLLM) ProviderName() string { return "basic" }
func (f *fakeBasicLLM) IsAvailable() bool    { return true }
func (f *fakeBasicLLM) GenerateTests(_ context.Context, _ aiPort.GenerateOptions) (*aiDomain.TestSuite, error) {
	return &aiDomain.TestSuite{}, nil
}

func TestHandleAISequenceHTTP_MissingLLM(t *testing.T) {
	q := NewQATracker("", "test", nil)
	body := `{"endpoints": ["GET /healthz"]}`
	req := httptest.NewRequest("POST", "/docs/qa/sequence/ai", strings.NewReader(body))
	rec := httptest.NewRecorder()

	q.HandleAISequenceHTTP(rec, req)
	if rec.Code != 503 {
		t.Errorf("expected 503 without LLM, got %d", rec.Code)
	}
}

func TestHandleAISequenceHTTP_EmptyEndpoints(t *testing.T) {
	q := NewQATracker("", "test", &fakeCompleterLLM{content: fakeAIResponse})
	req := httptest.NewRequest("POST", "/docs/qa/sequence/ai", strings.NewReader(`{}`))
	rec := httptest.NewRecorder()

	q.HandleAISequenceHTTP(rec, req)
	if rec.Code != 400 {
		t.Errorf("expected 400 for empty endpoints, got %d", rec.Code)
	}
}

func TestHandleAISequenceHTTP_Success(t *testing.T) {
	q := NewQATracker("", "test", &fakeCompleterLLM{content: fakeAIResponse})
	body := `{"endpoints": ["POST /auth/register", "POST /auth/login", "GET /pets", "POST /pets", "DELETE /pets/{id}"]}`
	req := httptest.NewRequest("POST", "/docs/qa/sequence/ai", strings.NewReader(body))
	rec := httptest.NewRecorder()

	q.HandleAISequenceHTTP(rec, req)
	if rec.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var resp AISequenceResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if len(resp.Steps) != 5 {
		t.Errorf("expected 5 steps, got %d", len(resp.Steps))
	}
}

func TestHandleAISequenceHTTP_MethodNotAllowed(t *testing.T) {
	q := NewQATracker("", "test", &fakeCompleterLLM{content: fakeAIResponse})
	req := httptest.NewRequest("GET", "/docs/qa/sequence/ai", nil)
	rec := httptest.NewRecorder()

	q.HandleAISequenceHTTP(rec, req)
	if rec.Code != 405 {
		t.Errorf("expected 405, got %d", rec.Code)
	}
}
