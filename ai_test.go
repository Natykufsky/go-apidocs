package apidocs

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	aiAdapter "github.com/Natykufsky/go-apidocs/internal/ai/adapter"
	aiPort "github.com/Natykufsky/go-apidocs/internal/ai/port"
)

func TestNVIDIAAdapter_Config(t *testing.T) {
	adapter := aiAdapter.NewNVIDIAAdapter("test-key", "https://integrate.api.nvidia.com/v1", "deepseek-ai/deepseek-v4.1-flash", 10*time.Second)

	if !adapter.IsAvailable() {
		t.Fatalf("expected adapter to be available")
	}
}

func TestNVIDIAAdapter_GenerateTestsMock(t *testing.T) {
	mockResponse := `{
		"choices": [
			{
				"message": {
					"content": "{\"summary\":\"Test plan for auth login\",\"test_cases\":[{\"id\":\"tc-1\",\"name\":\"Valid Login\",\"category\":\"Happy Path\",\"description\":\"Successful login returns 200 and token\",\"method\":\"POST\",\"path\":\"/api/v1/auth/login\",\"request_body\":{\"username\":\"test\",\"password\":\"pass123\"},\"expected_status\":200,\"assertions\":[\"Status is 200\",\"Token returned\"]}]}"
				}
			}
		]
	}`

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer test-key" {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(mockResponse))
	}))
	defer ts.Close()

	adapter := aiAdapter.NewNVIDIAAdapter("test-key", ts.URL, "deepseek-ai/deepseek-v4.1-flash", 5*time.Second)

	suite, err := adapter.GenerateTests(context.Background(), aiPort.GenerateOptions{
		EndpointKey: "POST /api/v1/auth/login",
		SpecJSON:    `{"summary":"Login endpoint"}`,
	})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if suite == nil {
		t.Fatal("expected test suite to be non-nil")
	}

	if len(suite.TestCases) != 1 {
		t.Fatalf("expected 1 test case, got %d", len(suite.TestCases))
	}

	tc := suite.TestCases[0]
	if tc.Name != "Valid Login" {
		t.Errorf("expected test name 'Valid Login', got '%s'", tc.Name)
	}
	if tc.ExpectedStatus != 200 {
		t.Errorf("expected status 200, got %d", tc.ExpectedStatus)
	}
}
