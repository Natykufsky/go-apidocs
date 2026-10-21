package port

import (
	"context"

	"github.com/Natykufsky/go-apidocs/internal/ai/domain"
)

// GenerateOptions contains input parameters for LLM test synthesis.
type GenerateOptions struct {
	Provider     string `json:"provider,omitempty"` // "nvidia", "openai", "anthropic", "ollama"
	Model        string `json:"model,omitempty"`
	BaseURL      string `json:"base_url,omitempty"`
	APIKey       string `json:"api_key,omitempty"`
	EndpointKey  string `json:"endpoint_key"`
	SpecJSON     string `json:"spec_json"`
	CustomPrompt string `json:"custom_prompt"`
}

// LLMClientPort defines the outbound port for interacting with AI inference providers.
type LLMClientPort interface {
	IsAvailable() bool
	ProviderName() string
	GenerateTests(ctx context.Context, opts GenerateOptions) (*domain.TestSuite, error)
}

// CompleteOptions carries a generic single-shot completion request.
type CompleteOptions struct {
	SystemPrompt string `json:"system_prompt"`
	UserPrompt   string `json:"user_prompt"`
	JSONMode     bool   `json:"json_mode,omitempty"` // request strict-JSON output
	Provider     string `json:"provider,omitempty"`
	Model        string `json:"model,omitempty"`
	BaseURL      string `json:"base_url,omitempty"`
	APIKey       string `json:"api_key,omitempty"`
}

// Completer is an optional capability some LLM adapters expose: generic
// single-shot completions beyond structured test synthesis. Callers should
// type-assert and degrade gracefully when unsupported.
type Completer interface {
	Complete(ctx context.Context, opts CompleteOptions) (string, error)
}

