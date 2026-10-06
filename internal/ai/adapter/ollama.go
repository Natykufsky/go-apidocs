package adapter

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/Natykufsky/go-apidocs/internal/ai/domain"
	"github.com/Natykufsky/go-apidocs/internal/ai/port"
)

const (
	DefaultOllamaModel   = "llama3.1:latest"
	DefaultOllamaBaseURL = "http://localhost:11434"
)

// OllamaAdapter implements port.LLMClientPort targeting local self-hosted Ollama instances.
type OllamaAdapter struct {
	baseURL    string
	model      string
	timeout    time.Duration
	httpClient *http.Client
}

// NewOllamaAdapter creates a new Ollama local adapter.
func NewOllamaAdapter(baseURL, model string, timeout time.Duration) *OllamaAdapter {
	if baseURL == "" {
		baseURL = os.Getenv("OLLAMA_BASE_URL")
		if baseURL == "" {
			baseURL = DefaultOllamaBaseURL
		}
	}
	if model == "" {
		model = os.Getenv("OLLAMA_MODEL")
		if model == "" {
			model = DefaultOllamaModel
		}
	}
	if timeout == 0 {
		timeout = 120 * time.Second // Local models may need longer inference windows
	}

	return &OllamaAdapter{
		baseURL:    baseURL,
		model:      model,
		timeout:    timeout,
		httpClient: &http.Client{Timeout: timeout},
	}
}

// ProviderName returns the adapter identifier.
func (a *OllamaAdapter) ProviderName() string {
	return "ollama"
}

// IsAvailable checks if Ollama service is reachable.
func (a *OllamaAdapter) IsAvailable() bool {
	if a == nil || a.baseURL == "" {
		return false
	}
	// Permissive in local dev
	return true
}

// GenerateTests queries Ollama /api/generate or /api/chat.
func (a *OllamaAdapter) GenerateTests(ctx context.Context, opts port.GenerateOptions) (*domain.TestSuite, error) {
	modelToUse := a.model
	if opts.Model != "" {
		modelToUse = opts.Model
	}

	prompt := a.buildPrompt(opts)

	type ollamaRequest struct {
		Model  string `json:"model"`
		Prompt string `json:"prompt"`
		Stream bool   `json:"stream"`
		Format string `json:"format"`
	}

	payload := ollamaRequest{
		Model:  modelToUse,
		Prompt: prompt,
		Stream: false,
		Format: "json",
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal Ollama request: %w", err)
	}

	baseURL := a.baseURL
	if opts.BaseURL != "" {
		baseURL = opts.BaseURL
	}
	apiURL := strings.TrimRight(baseURL, "/") + "/api/generate"
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, apiURL, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to build HTTP request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := a.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("ollama connection failed (%s): %w", apiURL, err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(io.LimitReader(resp.Body, 5*1024*1024))
	if err != nil {
		return nil, fmt.Errorf("failed to read Ollama response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("ollama error (status %d): %s", resp.StatusCode, string(respBytes))
	}

	type ollamaResponse struct {
		Response string `json:"response"`
		Error    string `json:"error,omitempty"`
	}

	var oResp ollamaResponse
	if err := json.Unmarshal(respBytes, &oResp); err != nil {
		return nil, fmt.Errorf("failed to decode Ollama response envelope: %w", err)
	}

	if oResp.Error != "" {
		return nil, fmt.Errorf("ollama model error: %s", oResp.Error)
	}

	rawContent := strings.TrimSpace(oResp.Response)
	if strings.HasPrefix(rawContent, "```json") {
		rawContent = strings.TrimPrefix(rawContent, "```json")
		rawContent = strings.TrimSuffix(rawContent, "```")
	} else if strings.HasPrefix(rawContent, "```") {
		rawContent = strings.TrimPrefix(rawContent, "```")
		rawContent = strings.TrimSuffix(rawContent, "```")
	}
	rawContent = strings.TrimSpace(rawContent)

	var suite domain.TestSuite
	if err := json.Unmarshal([]byte(rawContent), &suite); err != nil {
		return nil, fmt.Errorf("failed to parse Ollama test suite JSON: %w (raw response: %s)", err, rawContent)
	}

	suite.EndpointKey = opts.EndpointKey
	suite.ModelUsed = modelToUse
	suite.GeneratedAt = time.Now().UTC()

	for i := range suite.TestCases {
		if suite.TestCases[i].ID == "" {
			suite.TestCases[i].ID = fmt.Sprintf("tc-%d", i+1)
		}
	}

	return &suite, nil
}

func (a *OllamaAdapter) buildPrompt(opts port.GenerateOptions) string {
	specContent := opts.SpecJSON
	if specContent == "" {
		specContent = "Endpoint: " + opts.EndpointKey
	}

	custom := ""
	if opts.CustomPrompt != "" {
		custom = fmt.Sprintf("\nAdditional User Instructions:\n%s\n", opts.CustomPrompt)
	}

	return fmt.Sprintf(`You are an elite QA automation and cybersecurity test engineering engine. Output strict JSON with no commentary or markdown formatting.
Analyze the following API endpoint specification and generate a comprehensive QA & Security test suite.

Target Endpoint: %s
OpenAPI Spec / Schema Extract:
%s
%s
Your goal is to generate test cases covering:
1. Happy Path / Positive Scenarios (standard successful invocation, standard payload)
2. Boundary & Edge Cases (min/max string lengths, 0/negative numbers, boundary dates, large arrays)
3. Negative & Error Handling (missing required fields, invalid datatypes, malformed JSON, enum violations)
4. Security & Abuse Resistance (SQL injection probe, XSS tag payload, Auth bypass/missing token, IDOR check)

Output strict JSON with the following structure:
{
  "summary": "Executive overview of the test coverage and edge cases identified",
  "test_cases": [
    {
      "id": "tc-1",
      "name": "Descriptive test case title",
      "category": "Happy Path | Boundary & Edge | Negative & Error | Security & Abuse",
      "description": "Clear explanation of what is tested and why",
      "method": "GET | POST | PUT | DELETE | PATCH",
      "path": "/api/v1/...",
      "headers": {
        "Content-Type": "application/json"
      },
      "query_params": {
        "page": "1"
      },
      "request_body": { ... },
      "expected_status": 200,
      "assertions": [
        "Status code equals 200",
        "Response header Content-Type is application/json",
        "Body field id is non-empty string"
      ]
    }
  ]
}`, opts.EndpointKey, specContent, custom)
}
