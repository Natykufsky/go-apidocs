package adapter

import (
	"context"
	"fmt"
	"strings"

	"github.com/Natykufsky/go-apidocs/internal/ai/domain"
	"github.com/Natykufsky/go-apidocs/internal/ai/port"
)

// MultiProviderDispatcher routes AI test synthesis to available LLM adapters based on request options or fallback priority.
type MultiProviderDispatcher struct {
	providers map[string]port.LLMClientPort
	defaultP  string
}

// NewMultiProviderDispatcher creates a new dispatcher with registered providers.
func NewMultiProviderDispatcher(defaultProvider string) *MultiProviderDispatcher {
	if defaultProvider == "" {
		defaultProvider = "nvidia"
	}
	return &MultiProviderDispatcher{
		providers: make(map[string]port.LLMClientPort),
		defaultP:  defaultProvider,
	}
}

// RegisterProvider registers an LLM client port.
func (d *MultiProviderDispatcher) RegisterProvider(provider port.LLMClientPort) {
	if provider != nil {
		d.providers[strings.ToLower(provider.ProviderName())] = provider
	}
}

// ProviderName returns the dispatcher identifier.
func (d *MultiProviderDispatcher) ProviderName() string {
	return "multi"
}

// IsAvailable checks if at least one registered provider is available.
func (d *MultiProviderDispatcher) IsAvailable() bool {
	for _, p := range d.providers {
		if p.IsAvailable() {
			return true
		}
	}
	return false
}

// AvailableProviders returns list of registered provider IDs.
func (d *MultiProviderDispatcher) AvailableProviders() []string {
	var list []string
	for k, v := range d.providers {
		if v.IsAvailable() {
			list = append(list, k)
		}
	}
	return list
}

// GenerateTests dispatches the generation request to the selected provider with automatic fallback.
func (d *MultiProviderDispatcher) GenerateTests(ctx context.Context, opts port.GenerateOptions) (*domain.TestSuite, error) {
	targetProvider := strings.ToLower(opts.Provider)
	if targetProvider == "" {
		targetProvider = d.defaultP
	}

	var attemptedErrors []string

	// 1. Try explicitly requested provider
	if p, exists := d.providers[targetProvider]; exists {
		if !p.IsAvailable() {
			attemptedErrors = append(attemptedErrors, fmt.Sprintf("%s (not configured / missing credentials)", targetProvider))
		} else {
			suite, err := p.GenerateTests(ctx, opts)
			if err == nil {
				return suite, nil
			}
			attemptedErrors = append(attemptedErrors, fmt.Sprintf("%s error: %v", targetProvider, err))
		}
	} else {
		attemptedErrors = append(attemptedErrors, fmt.Sprintf("%s (unknown provider)", targetProvider))
	}

	// 2. Fallback cascade: nvidia -> openai -> anthropic -> ollama
	fallbackOrder := []string{"nvidia", "openai", "anthropic", "ollama"}
	for _, name := range fallbackOrder {
		if name == targetProvider {
			continue // Already attempted
		}
		if p, exists := d.providers[name]; exists && p.IsAvailable() {
			opts.Provider = name
			opts.Model = "" // Use provider default model on fallback
			suite, err := p.GenerateTests(ctx, opts)
			if err == nil {
				return suite, nil
			}
			attemptedErrors = append(attemptedErrors, fmt.Sprintf("%s error: %v", name, err))
		}
	}

	if len(attemptedErrors) > 0 {
		return nil, fmt.Errorf("no AI providers succeeded: %s", strings.Join(attemptedErrors, "; "))
	}
	return nil, fmt.Errorf("no available AI providers configured. Please check your API keys in .env")
}
