package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"time"

	"github.com/Natykufsky/go-apidocs/internal/ai/adapter"
	aiPort "github.com/Natykufsky/go-apidocs/internal/ai/port"
	"github.com/Natykufsky/go-apidocs/internal/ai/usecase"
	coreDomain "github.com/Natykufsky/go-apidocs/internal/core/domain"
)

func main() {
	specPath := flag.String("spec", "", "Path to OpenAPI spec file (JSON/YAML)")
	endpoint := flag.String("endpoint", "", "Specific endpoint to generate tests for (e.g., 'POST /api/v1/auth')")
	prompt := flag.String("prompt", "", "Custom LLM prompt instructions")
	apiKey := flag.String("nvidia-key", "", "NVIDIA API Key (or set NVIDIA_API_KEY env)")
	model := flag.String("model", "deepseek-ai/deepseek-v4.1-flash", "NVIDIA NIM model identifier")
	output := flag.String("out", "", "Optional output path to save JSON test suite")

	flag.Usage = func() {
		fmt.Fprintf(os.Stderr, "⚡ apidocs-cli — Enterprise CI/CD & AI Test Generation Tool\n\n")
		fmt.Fprintf(os.Stderr, "Usage:\n")
		fmt.Fprintf(os.Stderr, "  apidocs-cli [options]\n\n")
		fmt.Fprintf(os.Stderr, "Options:\n")
		flag.PrintDefaults()
	}

	flag.Parse()

	if *endpoint == "" {
		fmt.Fprintln(os.Stderr, "❌ Error: --endpoint is required (e.g. --endpoint='POST /api/v1/users')")
		os.Exit(1)
	}

	var specJSON string
	if *specPath != "" {
		data, err := os.ReadFile(*specPath)
		if err != nil {
			fmt.Fprintf(os.Stderr, "❌ Error reading spec file: %v\n", err)
			os.Exit(1)
		}
		specJSON = string(data)
	}

	llmAdapter := adapter.NewNVIDIAAdapter(*apiKey, "", *model, 90*time.Second)
	if !llmAdapter.IsAvailable() {
		fmt.Fprintln(os.Stderr, "❌ Error: NVIDIA API Key is missing. Set NVIDIA_API_KEY environment variable or pass --nvidia-key.")
		os.Exit(1)
	}

	generateUC := usecase.NewGenerateAITestsUseCase(llmAdapter, nil)

	fmt.Printf("🤖 Synthesizing AI test suite for '%s' using %s...\n", *endpoint, *model)
	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()

	suite, err := generateUC.Execute(ctx, coreDomain.TenantID("default"), aiPort.GenerateOptions{
		EndpointKey:  *endpoint,
		SpecJSON:     specJSON,
		CustomPrompt: *prompt,
	})

	if err != nil {
		fmt.Fprintf(os.Stderr, "❌ AI Generation Failed: %v\n", err)
		os.Exit(1)
	}

	outBytes, _ := json.MarshalIndent(suite, "", "  ")

	if *output != "" {
		if err := os.WriteFile(*output, outBytes, 0644); err != nil {
			fmt.Fprintf(os.Stderr, "❌ Failed to save output file: %v\n", err)
			os.Exit(1)
		}
		fmt.Printf("✅ Generated %d test cases successfully saved to %s\n", len(suite.TestCases), *output)
	} else {
		fmt.Println(string(outBytes))
	}
}
