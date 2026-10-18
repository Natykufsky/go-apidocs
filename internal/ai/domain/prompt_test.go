package domain

import (
	"testing"
)

func TestCleanJSONResponse_SanitizeJSRepeat(t *testing.T) {
	raw := `{
		"summary": "Boundary tests",
		"test_cases": [
			{
				"id": "tc-1",
				"name": "Oversized Header",
				"headers": {
					"X-Large-Header": "A".repeat(8192)
				},
				"expected_status": 400,
			}
		]
	}`

	cleaned := CleanJSONResponse(raw)

	if testing.Verbose() {
		t.Logf("Cleaned JSON: %s", cleaned)
	}

	// Trailing comma before } should be removed
	if stringContains(cleaned, `400,`) {
		t.Errorf("Expected trailing comma after 400 to be cleaned, got: %s", cleaned)
	}

	// .repeat(8192) should be replaced with valid literal string
	if stringContains(cleaned, `.repeat(`) {
		t.Errorf("Expected .repeat to be sanitized away, got: %s", cleaned)
	}
}

func stringContains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(substr) == 0 || (len(s) > 0 && len(substr) > 0 && (func() bool {
		for i := 0; i+len(substr) <= len(s); i++ {
			if s[i:i+len(substr)] == substr {
				return true
			}
		}
		return false
	})()))
}
