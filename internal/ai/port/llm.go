package port

import (
	"context"

	"github.com/Natykufsky/go-apidocs/internal/ai/domain"
)

// GenerateOptions contains input parameters for LLM test synthesis.
type GenerateOptions struct {
	EndpointKey  string
	SpecJSON     string
	CustomPrompt string
}

// LLMClientPort defines the outbound port for interacting with AI inference providers.
type LLMClientPort interface {
	IsAvailable() bool
	GenerateTests(ctx context.Context, opts GenerateOptions) (*domain.TestSuite, error)
}
