package domain

import (
	"fmt"
	"regexp"
	"strconv"
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

IMPORTANT RULES:
- Output ONLY a raw, RFC-8259 compliant JSON document.
- Never use JavaScript/programming expressions, functions, template strings, or concatenations (e.g. NEVER use .repeat(), String(), etc.). Every string value must be an explicit literal string.
- Never include trailing commas before closing braces '}' or brackets ']'.
- Never include markdown ticks, comments (// or /* */), or explanatory text outside the JSON.

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

// CleanJSONResponse strips markdown backticks, leading/trailing non-JSON commentary,
// JS expressions like .repeat(), and trailing commas from LLM raw completions.
func CleanJSONResponse(raw string) string {
	cleaned := strings.TrimSpace(raw)

	// Strip markdown blocks if present
	if strings.HasPrefix(cleaned, "```json") {
		cleaned = strings.TrimPrefix(cleaned, "```json")
		cleaned = strings.TrimSuffix(cleaned, "```")
	} else if strings.HasPrefix(cleaned, "```") {
		cleaned = strings.TrimPrefix(cleaned, "```")
		cleaned = strings.TrimSuffix(cleaned, "```")
	}
	cleaned = strings.TrimSpace(cleaned)

	// Extract substring between first '{' and last '}' if model wrapped JSON in conversational text
	firstBrace := strings.Index(cleaned, "{")
	lastBrace := strings.LastIndex(cleaned, "}")
	if firstBrace != -1 && lastBrace != -1 && lastBrace > firstBrace {
		cleaned = cleaned[firstBrace : lastBrace+1]
	}

	// Sanitize JS expressions like "A".repeat(8192) or 'x'.repeat(100) or .repeat(...)
	repeatRegex := regexp.MustCompile(`"([^"\\]*)"\.repeat\(\s*(\d+)\s*\)`)
	cleaned = repeatRegex.ReplaceAllStringFunc(cleaned, func(m string) string {
		sub := repeatRegex.FindStringSubmatch(m)
		if len(sub) == 3 {
			char := sub[1]
			count, _ := strconv.Atoi(sub[2])
			if count > 256 {
				count = 256 // Cap length to avoid bloating test payload in JSON
			}
			return `"` + strings.Repeat(char, count) + `"`
		}
		return `"repeated_boundary_string"`
	})

	// Also catch any generic .repeat(\d+) that wasn't preceded by valid double quotes
	genericRepeat := regexp.MustCompile(`[^\s"]+\.repeat\(\s*\d+\s*\)`)
	cleaned = genericRepeat.ReplaceAllString(cleaned, `"repeated_boundary_string"`)

	// Clean trailing commas before closing braces or brackets (e.g. `, }` -> ` }`, `, ]` -> ` ]`)
	trailingCommaRegex := regexp.MustCompile(`,(\s*[}\]])`)
	cleaned = trailingCommaRegex.ReplaceAllString(cleaned, "$1")

	return strings.TrimSpace(cleaned)
}

// DefaultPromptManager is the global singleton prompt manager instance.
var DefaultPromptManager = NewPromptTemplateManager()
