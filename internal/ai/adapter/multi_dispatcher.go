package adapter

import (
	"context"
	"fmt"
	"os"
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
	p, exists := d.providers[targetProvider]
	if !exists {
		// Provider aliases or OpenAI-compatible backends (groq, gemini, mistral, deepseek, custom)
		switch targetProvider {
		case "groq":
			if opts.BaseURL == "" {
				opts.BaseURL = "https://api.groq.com/openai/v1"
			}
			if opts.APIKey == "" {
				opts.APIKey = os.Getenv("GROQ_API_KEY")
			}
			// Map or normalize requested model to active Groq models
			switch strings.ToLower(opts.Model) {
			case "openai/gpt-oss-120b", "gpt-oss-120b":
				opts.Model = "openai/gpt-oss-120b"
			case "openai/gpt-oss-20b", "gpt-oss-20b":
				opts.Model = "openai/gpt-oss-20b"
			case "qwen/qwen3.8-27b", "qwen3.8-27b", "qwen":
				opts.Model = "qwen/qwen3.8-27b"
			default:
				// Map legacy/retired Llama models (llama-3.3-70b-versatile, llama-3.1-8b-instant, etc.) to the live high-performance flagship
				opts.Model = "openai/gpt-oss-120b"
			}
			p = d.providers["openai"]
		case "gemini", "google":
			if opts.BaseURL == "" {
				opts.BaseURL = "https://generativelanguage.googleapis.com/v1beta/openai"
			}
			if opts.APIKey == "" {
				opts.APIKey = os.Getenv("GEMINI_API_KEY")
				if opts.APIKey == "" {
					opts.APIKey = os.Getenv("GOOGLE_API_KEY")
				}
			}
			// Map or normalize requested model to active Google Gemini models
			switch strings.ToLower(opts.Model) {
			case "gemini-3.8-flash", "gemini-flash":
				opts.Model = "gemini-3.8-flash"
			case "gemini-3.1-pro", "gemini-4-argon", "gemini-pro":
				opts.Model = "gemini-3.1-pro"
			default:
				// Automatically upgrade retired model strings (gemini-2.5-flash, gemini-1.5-flash, gemini-1.5-pro, etc.)
				opts.Model = "gemini-3.8-flash"
			}
			p = d.providers["openai"]
		case "mistral", "codestral":
			if opts.BaseURL == "" {
				opts.BaseURL = "https://api.mistral.ai/v1"
			}
			if opts.APIKey == "" {
				opts.APIKey = os.Getenv("MISTRAL_API_KEY")
			}
			p = d.providers["openai"]
		case "deepseek":
			// Route to native DeepSeek API
			if opts.BaseURL == "" {
				opts.BaseURL = "https://api.deepseek.com/v1"
			}
			if opts.APIKey == "" {
				opts.APIKey = os.Getenv("DEEPSEEK_API_KEY")
			}
			// Map model to exact live DeepSeek identifiers
			switch strings.ToLower(opts.Model) {
			case "deepseek-v4-pro", "deepseek-reasoner", "deepseek-r1":
				opts.Model = "deepseek-v4-pro"
			default:
				opts.Model = "deepseek-flash"
			}
			p = d.providers["openai"]
		case "huggingface", "hf":
			if opts.BaseURL == "" {
				opts.BaseURL = "https://router.huggingface.co/v1"
			}
			if opts.APIKey == "" {
				opts.APIKey = os.Getenv("HUGGINGFACE_API_KEY")
				if opts.APIKey == "" {
					opts.APIKey = os.Getenv("HF_TOKEN")
				}
			}
			p = d.providers["openai"]
		case "github", "github-models":
			if opts.BaseURL == "" {
				opts.BaseURL = "https://models.inference.ai.azure.com"
			}
			if opts.APIKey == "" {
				opts.APIKey = os.Getenv("GITHUB_TOKEN")
				if opts.APIKey == "" {
					opts.APIKey = os.Getenv("GITHUB_MODELS_KEY")
				}
			}
			p = d.providers["openai"]
		case "custom":
			p = d.providers["openai"]
		}
	}

	if p != nil {
		if !p.IsAvailable() && strings.TrimSpace(opts.APIKey) == "" && targetProvider != "ollama" {
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
	// Only trigger fallback if the user did NOT supply a custom endpoint or custom key for a specific provider
	if strings.TrimSpace(opts.BaseURL) == "" {
		fallbackOrder := []string{"nvidia", "openai", "anthropic", "ollama"}
		for _, name := range fallbackOrder {
			if name == targetProvider {
				continue // Already attempted
			}
			if p, exists := d.providers[name]; exists && p.IsAvailable() {
				fallbackOpts := opts
				fallbackOpts.Provider = name
				fallbackOpts.Model = ""   // Use provider default model on fallback
				fallbackOpts.BaseURL = "" // Use provider default base URL
				fallbackOpts.APIKey = ""  // Use provider env credentials
				suite, err := p.GenerateTests(ctx, fallbackOpts)
				if err == nil {
					return suite, nil
				}
				attemptedErrors = append(attemptedErrors, fmt.Sprintf("%s error: %v", name, err))
			}
		}
	}

	if len(attemptedErrors) > 0 {
		return nil, fmt.Errorf("no AI providers succeeded: %s", strings.Join(attemptedErrors, "; "))
	}
	return nil, fmt.Errorf("no available AI providers configured. Please check your API keys in .env")
}
