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
	DefaultOpenAIModel   = "gpt-4o-mini"
	DefaultOpenAIBaseURL = "https://api.openai.com/v1"
)

// OpenAIAdapter implements port.LLMClientPort for OpenAI API (GPT-4o, GPT-4o-mini, o1).
type OpenAIAdapter struct {
	apiKey      string
	baseURL     string
	model       string
	timeout     time.Duration
	temperature float64
	maxTokens   int
	httpClient  *http.Client
}

// NewOpenAIAdapter creates a new OpenAI LLM adapter.
func NewOpenAIAdapter(apiKey, baseURL, model string, timeout time.Duration) *OpenAIAdapter {
	if apiKey == "" {
		apiKey = os.Getenv("OPENAI_API_KEY")
	}
	if baseURL == "" {
		baseURL = os.Getenv("OPENAI_BASE_URL")
		if baseURL == "" {
			baseURL = DefaultOpenAIBaseURL
		}
	}
	if model == "" {
		model = os.Getenv("OPENAI_MODEL")
		if model == "" {
			model = DefaultOpenAIModel
		}
	}
	if timeout == 0 {
		timeout = 60 * time.Second
	}

	return &OpenAIAdapter{
		apiKey:      apiKey,
		baseURL:     baseURL,
		model:       model,
		timeout:     timeout,
		temperature: 0.2,
		maxTokens:   4096,
		httpClient:  &http.Client{Timeout: timeout},
	}
}

// ProviderName returns the adapter identifier.
func (a *OpenAIAdapter) ProviderName() string {
	return "openai"
}

// IsAvailable checks if the OpenAI adapter has configured credentials.
func (a *OpenAIAdapter) IsAvailable() bool {
	return a != nil && strings.TrimSpace(a.apiKey) != ""
}

// GenerateTests queries OpenAI chat completions.
func (a *OpenAIAdapter) GenerateTests(ctx context.Context, opts port.GenerateOptions) (*domain.TestSuite, error) {
	if !a.IsAvailable() {
		return nil, fmt.Errorf("OpenAI adapter is not configured: missing API key")
	}

	modelToUse := a.model
	if opts.Model != "" {
		modelToUse = opts.Model
	}

	prompt := a.buildPrompt(opts)

	type chatMessage struct {
		Role    string `json:"role"`
		Content string `json:"content"`
	}

	type chatRequest struct {
		Model          string                 `json:"model"`
		Messages       []chatMessage          `json:"messages"`
		Temperature    float64                `json:"temperature"`
		MaxTokens      int                    `json:"max_tokens"`
		ResponseFormat map[string]interface{} `json:"response_format,omitempty"`
	}

	payload := chatRequest{
		Model: modelToUse,
		Messages: []chatMessage{
			{
				Role:    "system",
				Content: "You are an elite QA automation and cybersecurity test engineering engine. Output strict, valid JSON conforming to the requested schema with no markdown decoration or extra commentary.",
			},
			{
				Role:    "user",
				Content: prompt,
			},
		},
		Temperature: a.temperature,
		MaxTokens:   a.maxTokens,
		ResponseFormat: map[string]interface{}{
			"type": "json_object",
		},
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal OpenAI request: %w", err)
	}

	apiURL := strings.TrimRight(a.baseURL, "/") + "/chat/completions"
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, apiURL, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to build HTTP request: %w", err)
	}

	httpReq.Header.Set("Authorization", "Bearer "+a.apiKey)
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/json")

	resp, err := a.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("openai request failed: %w", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(io.LimitReader(resp.Body, 2*1024*1024))
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("openai API returned error (status %d): %s", resp.StatusCode, string(respBytes))
	}

	type openAIChoice struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	}

	type openAIResponse struct {
		Choices []openAIChoice `json:"choices"`
		Error   *struct {
			Message string `json:"message"`
		} `json:"error,omitempty"`
	}

	var chatResp openAIResponse
	if err := json.Unmarshal(respBytes, &chatResp); err != nil {
		return nil, fmt.Errorf("failed to decode OpenAI API response: %w", err)
	}

	if len(chatResp.Choices) == 0 || chatResp.Choices[0].Message.Content == "" {
		return nil, fmt.Errorf("received empty completion from OpenAI model")
	}

	rawContent := strings.TrimSpace(chatResp.Choices[0].Message.Content)
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
		return nil, fmt.Errorf("failed to parse OpenAI test suite JSON: %w (raw response: %s)", err, rawContent)
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

func (a *OpenAIAdapter) buildPrompt(opts port.GenerateOptions) string {
	specContent := opts.SpecJSON
	if specContent == "" {
		specContent = "Endpoint: " + opts.EndpointKey
	}

	custom := ""
	if opts.CustomPrompt != "" {
		custom = fmt.Sprintf("\nAdditional User Instructions:\n%s\n", opts.CustomPrompt)
	}

	return fmt.Sprintf(`Analyze the following API endpoint specification and generate a comprehensive QA & Security test suite.

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
