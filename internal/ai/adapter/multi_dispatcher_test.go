package adapter_test

import (
	"context"
	"testing"
	"time"

	aiAdapter "github.com/Natykufsky/go-apidocs/internal/ai/adapter"
	aiDomain "github.com/Natykufsky/go-apidocs/internal/ai/domain"
	aiPort "github.com/Natykufsky/go-apidocs/internal/ai/port"
)

type mockLLMAdapter struct {
	name      string
	available bool
}

func (m *mockLLMAdapter) ProviderName() string { return m.name }
func (m *mockLLMAdapter) IsAvailable() bool     { return m.available }
func (m *mockLLMAdapter) GenerateTests(ctx context.Context, opts aiPort.GenerateOptions) (*aiDomain.TestSuite, error) {
	return &aiDomain.TestSuite{
		EndpointKey: opts.EndpointKey,
		ModelUsed:   m.name + "-mock-model",
		Summary:     "Synthesized test cases",
		TestCases: []aiDomain.TestCase{
			{
				ID:             "tc-1",
				Name:           "Happy Path Test",
				Category:       aiDomain.CategoryHappyPath,
				ExpectedStatus: 200,
			},
		},
	}, nil
}

func TestMultiProviderDispatcher(t *testing.T) {
	dispatcher := aiAdapter.NewMultiProviderDispatcher("nvidia")

	nvidiaMock := &mockLLMAdapter{name: "nvidia", available: true}
	openaiMock := &mockLLMAdapter{name: "openai", available: true}
	anthropicMock := &mockLLMAdapter{name: "anthropic", available: true}
	ollamaMock := &mockLLMAdapter{name: "ollama", available: true}

	dispatcher.RegisterProvider(nvidiaMock)
	dispatcher.RegisterProvider(openaiMock)
	dispatcher.RegisterProvider(anthropicMock)
	dispatcher.RegisterProvider(ollamaMock)

	if !dispatcher.IsAvailable() {
		t.Fatal("expected dispatcher to be available")
	}

	providers := dispatcher.AvailableProviders()
	if len(providers) != 4 {
		t.Fatalf("expected 4 available providers, got %d", len(providers))
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// 1. Explicit OpenAI dispatch
	suite, err := dispatcher.GenerateTests(ctx, aiPort.GenerateOptions{
		Provider:    "openai",
		EndpointKey: "POST /api/v1/auth/login",
	})
	if err != nil {
		t.Fatalf("failed generating tests via openai: %v", err)
	}
	if suite.ModelUsed != "openai-mock-model" {
		t.Fatalf("expected openai-mock-model, got %s", suite.ModelUsed)
	}

	// 2. Default (NVIDIA) dispatch
	suite, err = dispatcher.GenerateTests(ctx, aiPort.GenerateOptions{
		EndpointKey: "GET /api/v1/users",
	})
	if err != nil {
		t.Fatalf("failed generating tests via default: %v", err)
	}
	if suite.ModelUsed != "nvidia-mock-model" {
		t.Fatalf("expected nvidia-mock-model, got %s", suite.ModelUsed)
	}
}
