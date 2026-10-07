package schema

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// MockServer provides live dynamic HTTP mock execution directly synthesized from OpenAPI specifications.
type MockServer struct {
	specFilter *SpecFilter
	rnd        *rand.Rand
}

// NewMockServer creates a new mock engine from a SpecFilter.
func NewMockServer(sf *SpecFilter) *MockServer {
	return &MockServer{
		specFilter: sf,
		rnd:        rand.New(rand.NewSource(time.Now().UnixNano())),
	}
}

// MockResponse represents the generated mock payload and metadata.
type MockResponse struct {
	StatusCode int               `json:"status_code"`
	Headers    map[string]string `json:"headers"`
	Body       any               `json:"body"`
	DynamicAI  bool              `json:"dynamic_ai"`
	GeneratedAt time.Time        `json:"generated_at"`
}

// ServeHTTP intercepts mock requests under /docs/mock/* and generates mock responses conforming to OpenAPI schema.
func (m *MockServer) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("X-Mock-Engine", "go-apidocs-v2-mock")

	spec, err := m.specFilter.loadSpec()
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "unable to load openapi spec for mocking: " + err.Error()})
		return
	}

	rawPath := r.URL.Path
	mockPrefix := "/docs/mock"
	if strings.HasPrefix(rawPath, mockPrefix) {
		rawPath = strings.TrimPrefix(rawPath, mockPrefix)
	}
	if rawPath == "" {
		rawPath = "/"
	}

	method := strings.ToLower(r.Method)
	paths, _ := spec["paths"].(map[string]any)

	// 1. Check for explicit Mock Scenario Overrides (X-Mock-Scenario, X-Mock-Status, X-Mock-Latency, query ?mock_scenario=)
	scenario := r.Header.Get("X-Mock-Scenario")
	if scenario == "" {
		scenario = r.URL.Query().Get("mock_scenario")
	}

	// Handle standard error scenarios
	switch strings.ToLower(scenario) {
	case "401", "unauthorized":
		w.WriteHeader(http.StatusUnauthorized)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"error":       "Unauthorized",
			"message":     "Simulated 401 Unauthorized mock scenario: missing or invalid bearer token",
			"status_code": 401,
		})
		return
	case "403", "forbidden":
		w.WriteHeader(http.StatusForbidden)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"error":       "Forbidden",
			"message":     "Simulated 403 Forbidden mock scenario: insufficient scope or permissions",
			"status_code": 403,
		})
		return
	case "429", "rate_limit":
		w.Header().Set("Retry-After", "30")
		w.WriteHeader(http.StatusTooManyRequests)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"error":       "Too Many Requests",
			"message":     "Simulated 429 Rate Limit scenario: quota exceeded, retry after 30 seconds",
			"retry_after": 30,
			"status_code": 429,
		})
		return
	case "500", "server_error":
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"error":       "Internal Server Error",
			"message":     "Simulated 500 Internal Server Error mock scenario",
			"status_code": 500,
		})
		return
	case "503", "unavailable":
		w.WriteHeader(http.StatusServiceUnavailable)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"error":       "Service Unavailable",
			"message":     "Simulated 503 Service Unavailable scenario: upstream microservice timeout",
			"status_code": 503,
		})
		return
	}

	// 2. Locate matching path item (direct or parameterized e.g. /users/{id})
	matchedPath, pathItem := m.matchPath(paths, rawPath)
	if pathItem == nil {
		w.WriteHeader(http.StatusNotFound)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"error":        fmt.Sprintf("no mock endpoint found for path '%s'", rawPath),
			"matched_path": matchedPath,
			"method":       strings.ToUpper(method),
			"hint":         "Ensure the route exists in your OpenAPI swagger.json spec.",
		})
		return
	}

	op, ok := pathItem[method].(map[string]any)
	if !ok {
		w.WriteHeader(http.StatusMethodNotAllowed)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"error":  fmt.Sprintf("method '%s' not defined for path '%s'", strings.ToUpper(method), matchedPath),
			"method": strings.ToUpper(method),
		})
		return
	}

	// 3. Synthesize response payload based on declared responses or explicit scenario status
	responses, _ := op["responses"].(map[string]any)

	var status int
	var respSchema map[string]any

	if customStatus := r.Header.Get("X-Mock-Status"); customStatus != "" {
		if c, err := strconv.Atoi(customStatus); err == nil && c >= 100 && c <= 599 {
			status = c
			if rMap, ok := responses[customStatus].(map[string]any); ok {
				respSchema = rMap
			}
		}
	}

	if status == 0 {
		status, respSchema = m.findBestResponse(responses)
	}

	mockBody := m.synthesizePayload(respSchema, spec)

	// Simulate latency (header or query or scenario)
	latHeader := r.Header.Get("X-Mock-Latency")
	if latHeader == "" {
		latHeader = r.URL.Query().Get("mock_latency")
	}
	if scenario == "slow" || scenario == "slow_network" {
		latHeader = "2s"
	}
	if latHeader != "" {
		if dur, err := time.ParseDuration(latHeader); err == nil && dur <= 10*time.Second {
			time.Sleep(dur)
		}
	}

	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(mockBody)
}

func (m *MockServer) matchPath(paths map[string]any, target string) (string, map[string]any) {
	if item, ok := paths[target].(map[string]any); ok {
		return target, item
	}

	targetParts := strings.Split(strings.Trim(target, "/"), "/")

	for pattern, val := range paths {
		patParts := strings.Split(strings.Trim(pattern, "/"), "/")
		if len(patParts) != len(targetParts) {
			continue
		}
		match := true
		for i := range patParts {
			if strings.HasPrefix(patParts[i], "{") && strings.HasSuffix(patParts[i], "}") {
				continue // wildcard segment
			}
			if patParts[i] != targetParts[i] {
				match = false
				break
			}
		}
		if match {
			if item, ok := val.(map[string]any); ok {
				return pattern, item
			}
		}
	}

	return "", nil
}

func (m *MockServer) findBestResponse(responses map[string]any) (int, map[string]any) {
	if responses == nil {
		return http.StatusOK, nil
	}

	// Prefer 200 OK or 201 Created
	for _, codeStr := range []string{"200", "201", "202", "204", "default"} {
		if resp, ok := responses[codeStr].(map[string]any); ok {
			code, _ := strconv.Atoi(codeStr)
			if code == 0 {
				code = http.StatusOK
			}
			return code, resp
		}
	}

	// Fallback to first available response
	for codeStr, resp := range responses {
		code, err := strconv.Atoi(codeStr)
		if err != nil {
			code = http.StatusOK
		}
		if respMap, ok := resp.(map[string]any); ok {
			return code, respMap
		}
	}

	return http.StatusOK, nil
}

func (m *MockServer) synthesizePayload(resp map[string]any, spec map[string]any) any {
	if resp == nil {
		return map[string]any{"success": true, "message": "mock operation succeeded"}
	}

	// Check for explicit OpenAPI 3.0 examples or content schemas
	if content, ok := resp["content"].(map[string]any); ok {
		if appJSON, ok := content["application/json"].(map[string]any); ok {
			if example, ok := appJSON["example"]; ok {
				return example
			}
			if schema, ok := appJSON["schema"].(map[string]any); ok {
				return m.generateFromSchema(schema, spec, 0)
			}
		}
	}

	// OpenAPI 2.0 (Swagger) schema in response
	if schema, ok := resp["schema"].(map[string]any); ok {
		return m.generateFromSchema(schema, spec, 0)
	}

	// Direct example
	if example, ok := resp["examples"].(map[string]any); ok {
		if jsonEx, ok := example["application/json"]; ok {
			return jsonEx
		}
	}

	return map[string]any{
		"success":   true,
		"message":   "Auto-synthesized dynamic mock response",
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	}
}

func (m *MockServer) generateFromSchema(schema map[string]any, spec map[string]any, depth int) any {
	if depth > 8 || schema == nil {
		return map[string]any{"id": "mock_123"}
	}

	// Resolve $ref if present (e.g. #/components/schemas/User or #/definitions/User)
	if ref, ok := schema["$ref"].(string); ok && ref != "" {
		resolved := m.resolveRef(ref, spec)
		if resolved != nil {
			return m.generateFromSchema(resolved, spec, depth+1)
		}
	}

	sType, _ := schema["type"].(string)

	switch sType {
	case "string":
		if format, ok := schema["format"].(string); ok {
			switch format {
			case "date-time":
				return time.Now().UTC().Format(time.RFC3339)
			case "email":
				return "developer@acme.corp"
			case "uuid":
				return "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
			case "uri", "url":
				return "https://api.acme.org/v1/resource"
			}
		}
		if enum, ok := schema["enum"].([]any); ok && len(enum) > 0 {
			return enum[0]
		}
		if ex, ok := schema["example"].(string); ok && ex != "" {
			return ex
		}
		return "sample_value"

	case "integer", "int":
		if ex, ok := schema["example"]; ok {
			return ex
		}
		return 42

	case "number", "float":
		return 99.95

	case "boolean", "bool":
		return true

	case "array":
		items, ok := schema["items"].(map[string]any)
		if !ok {
			return []any{"sample_item_1", "sample_item_2"}
		}
		return []any{
			m.generateFromSchema(items, spec, depth+1),
			m.generateFromSchema(items, spec, depth+1),
		}

	case "object", "":
		props, ok := schema["properties"].(map[string]any)
		if !ok || len(props) == 0 {
			return map[string]any{
				"id":        "rec_" + strconv.Itoa(1000+m.rnd.Intn(9000)),
				"status":    "active",
				"created_at": time.Now().UTC().Format(time.RFC3339),
			}
		}

		result := make(map[string]any)
		for propName, propVal := range props {
			if propSchema, ok := propVal.(map[string]any); ok {
				result[propName] = m.generateFromSchema(propSchema, spec, depth+1)
			}
		}
		return result
	}

	return "mock_data"
}

func (m *MockServer) resolveRef(ref string, spec map[string]any) map[string]any {
	parts := strings.Split(strings.TrimPrefix(ref, "#/"), "/")
	var current any = spec
	for _, p := range parts {
		mCurrent, ok := current.(map[string]any)
		if !ok {
			return nil
		}
		current = mCurrent[p]
	}
	resMap, _ := current.(map[string]any)
	return resMap
}
