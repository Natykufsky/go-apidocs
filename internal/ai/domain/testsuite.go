package domain

import "time"

// Category defines the test case classification.
type Category string

const (
	CategoryHappyPath  Category = "Happy Path"
	CategoryBoundary   Category = "Boundary & Edge"
	CategoryNegative   Category = "Negative & Error"
	CategorySecurity   Category = "Security & Abuse"
	CategoryAuthRBAC   Category = "Auth & RBAC"
)

// TestCase represents an individual synthesized test scenario.
type TestCase struct {
	ID               string            `json:"id"`
	Name             string            `json:"name"`
	Category         Category          `json:"category"`
	Description      string            `json:"description"`
	Method           string            `json:"method"`
	Path             string            `json:"path"`
	Headers          map[string]string `json:"headers,omitempty"`
	QueryParams      map[string]string `json:"query_params,omitempty"`
	RequestBody      any               `json:"request_body,omitempty"`
	ExpectedStatus   int               `json:"expected_status"`
	ExpectedResponse any               `json:"expected_response_schema,omitempty"`
	Assertions       []string          `json:"assertions"`
}

// TestSuite represents the aggregate collection of AI generated test cases for an endpoint.
type TestSuite struct {
	EndpointKey string     `json:"endpoint_key"`
	Summary     string     `json:"summary"`
	ModelUsed   string     `json:"model_used"`
	GeneratedAt time.Time  `json:"generated_at"`
	TestCases   []TestCase `json:"test_cases"`
}

// TestResult represents the outcome of executing a synthesized test case against the target API.
type TestResult struct {
	TestCaseID      string            `json:"test_case_id"`
	Passed          bool              `json:"passed"`
	ActualStatus    int               `json:"actual_status"`
	DurationMs      int64             `json:"duration_ms"`
	ResponseBody    string            `json:"response_body,omitempty"`
	ResponseHeaders map[string]string `json:"response_headers,omitempty"`
	AssertionChecks []AssertionCheck  `json:"assertion_checks"`
	ErrorMessage    string            `json:"error_message,omitempty"`
	ExecutedAt      time.Time         `json:"executed_at"`
}

// AssertionCheck represents an individual assertion evaluation.
type AssertionCheck struct {
	Rule   string `json:"rule"`
	Passed bool   `json:"passed"`
	Detail string `json:"detail,omitempty"`
}

