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

