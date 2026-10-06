package domain

import (
	"fmt"
	"strings"
)

// PromptTemplateManager centralizes prompt engineering, schema definitions, and system instructions across all LLM inference providers.
type PromptTemplateManager struct {
	DefaultSystemPrompt string
}

// NewPromptTemplateManager creates a new prompt manager with production QA & security defaults.
func NewPromptTemplateManager() *PromptTemplateManager {
	return &PromptTemplateManager{
		DefaultSystemPrompt: "You are an elite QA automation and cybersecurity test engineering engine. Output strict, valid JSON conforming to the requested schema with no markdown decoration or extra commentary.",
	}
}

// BuildTestSuitePrompt constructs a standardized, structured prompt for any LLM provider.
func (pm *PromptTemplateManager) BuildTestSuitePrompt(endpointKey, specJSON, customPrompt string) string {
	specContent := specJSON
	if strings.TrimSpace(specContent) == "" {
		specContent = "Endpoint: " + endpointKey
	}

	customInstruction := ""
	if strings.TrimSpace(customPrompt) != "" {
		customInstruction = fmt.Sprintf("\nAdditional User Focus & Instructions:\n%s\n", customPrompt)
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
      "category": "Happy Path | Boundary & Edge | Negative & Error | Security & Abuse | Auth & RBAC",
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
}`, endpointKey, specContent, customInstruction)
}

// CleanJSONResponse strips markdown backticks and whitespace from LLM raw completions.
func CleanJSONResponse(raw string) string {
	cleaned := strings.TrimSpace(raw)
	if strings.HasPrefix(cleaned, "```json") {
		cleaned = strings.TrimPrefix(cleaned, "```json")
		cleaned = strings.TrimSuffix(cleaned, "```")
	} else if strings.HasPrefix(cleaned, "```") {
		cleaned = strings.TrimPrefix(cleaned, "```")
		cleaned = strings.TrimSuffix(cleaned, "```")
	}
	return strings.TrimSpace(cleaned)
}

// DefaultPromptManager is the global singleton prompt manager instance.
var DefaultPromptManager = NewPromptTemplateManager()
