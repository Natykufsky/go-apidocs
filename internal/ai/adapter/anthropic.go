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
	"github.com/Natykufsky/go-apidocs/internal/env"
)

const (
	DefaultAnthropicModel   = "claude-3-5-sonnet-20241022"
	DefaultAnthropicBaseURL = "https://api.anthropic.com/v1"
	AnthropicVersion        = "2023-06-01"
)

// AnthropicAdapter implements port.LLMClientPort for Anthropic Claude models.
type AnthropicAdapter struct {
	apiKey      string
	baseURL     string
	model       string
	timeout     time.Duration
	temperature float64
	maxTokens   int
	httpClient  *http.Client
}

// NewAnthropicAdapter creates a new Anthropic Claude adapter.
func NewAnthropicAdapter(apiKey, baseURL, model string, timeout time.Duration) *AnthropicAdapter {
	env.LoadDotEnv()
	if apiKey == "" {
		apiKey = os.Getenv("ANTHROPIC_API_KEY")
	}
	if baseURL == "" {
		baseURL = os.Getenv("ANTHROPIC_BASE_URL")
		if baseURL == "" {
			baseURL = DefaultAnthropicBaseURL
		}
	}
	if model == "" {
		model = os.Getenv("ANTHROPIC_MODEL")
		if model == "" {
			model = DefaultAnthropicModel
		}
	}
	if timeout == 0 {
		timeout = 60 * time.Second
	}

	return &AnthropicAdapter{
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
func (a *AnthropicAdapter) ProviderName() string {
	return "anthropic"
}

// IsAvailable checks if the Anthropic adapter has configured credentials.
func (a *AnthropicAdapter) IsAvailable() bool {
	return a != nil && strings.TrimSpace(a.apiKey) != ""
}

// GenerateTests queries Anthropic Messages API.
func (a *AnthropicAdapter) GenerateTests(ctx context.Context, opts port.GenerateOptions) (*domain.TestSuite, error) {
	if !a.IsAvailable() {
		return nil, fmt.Errorf("Anthropic adapter is not configured: missing API key")
	}

	modelToUse := a.model
	if opts.Model != "" {
		modelToUse = opts.Model
	}

	prompt := a.buildPrompt(opts)

	type anthropicMessage struct {
		Role    string `json:"role"`
		Content string `json:"content"`
	}

	type anthropicRequest struct {
		Model       string             `json:"model"`
		MaxTokens   int                `json:"max_tokens"`
		Temperature float64            `json:"temperature"`
		System      string             `json:"system"`
		Messages    []anthropicMessage `json:"messages"`
	}

	payload := anthropicRequest{
		Model:       modelToUse,
		MaxTokens:   a.maxTokens,
		Temperature: a.temperature,
		System:      "You are an elite QA automation and cybersecurity test engineering engine. Output ONLY valid, parseable JSON conforming strictly to the requested schema. Do not include markdown ticks, code blocks, or conversational pleasantries.",
		Messages: []anthropicMessage{
			{
				Role:    "user",
				Content: prompt,
			},
		},
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal Anthropic request: %w", err)
	}

	apiURL := strings.TrimRight(a.baseURL, "/") + "/messages"
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, apiURL, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to build HTTP request: %w", err)
	}

	httpReq.Header.Set("x-api-key", a.apiKey)
	httpReq.Header.Set("anthropic-version", AnthropicVersion)
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/json")

	resp, err := a.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("anthropic request failed: %w", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(io.LimitReader(resp.Body, 2*1024*1024))
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("anthropic API returned error (status %d): %s", resp.StatusCode, string(respBytes))
	}

	type anthropicContentBlock struct {
		Type string `json:"type"`
		Text string `json:"text"`
	}

	type anthropicResponse struct {
		Content []anthropicContentBlock `json:"content"`
	}

	var anthropicResp anthropicResponse
	if err := json.Unmarshal(respBytes, &anthropicResp); err != nil {
		return nil, fmt.Errorf("failed to decode Anthropic response: %w", err)
	}

	var rawContent string
	for _, block := range anthropicResp.Content {
		if block.Type == "text" {
			rawContent += block.Text
		}
	}

	rawContent = domain.CleanJSONResponse(rawContent)

	var suite domain.TestSuite
	if err := json.Unmarshal([]byte(rawContent), &suite); err != nil {
		return nil, fmt.Errorf("failed to parse Claude test suite JSON: %w (raw response: %s)", err, rawContent)
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

func (a *AnthropicAdapter) buildPrompt(opts port.GenerateOptions) string {
	return domain.DefaultPromptManager.BuildTestSuitePrompt(opts.EndpointKey, opts.SpecJSON, opts.CustomPrompt)
}
