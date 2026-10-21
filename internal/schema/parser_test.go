package schema

import (
	"errors"
	"strings"
	"testing"
)

const validJSONSpec = `{
  "openapi": "3.0.0",
  "info": {"title": "Petstore", "version": "2.1.0", "description": "A sample API"},
  "tags": [{"name": "pets"}, {"name": "users"}, {"name": ""}],
  "paths": {
    "/pets": {
      "get": {"summary": "List pets"},
      "post": {"summary": "Create pet"}
    },
    "/pets/{id}": {
      "get": {"summary": "Get pet"},
      "delete": {"summary": "Delete pet"}
    },
    "/users": {
      "parameters": [{"name": "limit", "in": "query"}],
      "get": {"summary": "List users"}
    }
  }
}`

const validYAMLSpec = `
openapi: 3.0.0
info:
  title: YAML API
  version: 0.9.1
paths:
  /health:
    get:
      summary: Health check
`

func TestParseSpec_ValidJSON(t *testing.T) {
	spec, raw, err := ParseSpec(strings.NewReader(validJSONSpec), 0)
	if err != nil {
		t.Fatalf("ParseSpec failed: %v", err)
	}
	if spec.OpenAPIVer != "3.0.0" {
		t.Errorf("OpenAPIVer = %q, want 3.0.0", spec.OpenAPIVer)
	}
	if spec.Title != "Petstore" {
		t.Errorf("Title = %q, want Petstore", spec.Title)
	}
	if spec.Version != "2.1.0" {
		t.Errorf("Version = %q, want 2.1.0", spec.Version)
	}
	if spec.PathCount != 3 {
		t.Errorf("PathCount = %d, want 3", spec.PathCount)
	}
	// get(3) + post(1) + delete(1) = 5 operations; "parameters" is not an operation
	if spec.TotalOps != 5 {
		t.Errorf("TotalOps = %d, want 5", spec.TotalOps)
	}
	if spec.Methods["GET"] != 3 {
		t.Errorf("Methods[GET] = %d, want 3", spec.Methods["GET"])
	}
	if spec.Methods["POST"] != 1 {
		t.Errorf("Methods[POST] = %d, want 1", spec.Methods["POST"])
	}
	// Empty-name tag should be skipped
	if len(spec.Tags) != 2 {
		t.Errorf("Tags = %v, want 2 named tags", spec.Tags)
	}
	if len(raw) == 0 {
		t.Error("raw spec bytes should be returned")
	}
}

func TestParseSpec_ValidYAML(t *testing.T) {
	spec, _, err := ParseSpec(strings.NewReader(validYAMLSpec), 0)
	if err != nil {
		t.Fatalf("ParseSpec YAML failed: %v", err)
	}
	if spec.Title != "YAML API" {
		t.Errorf("Title = %q, want YAML API", spec.Title)
	}
	if spec.TotalOps != 1 {
		t.Errorf("TotalOps = %d, want 1", spec.TotalOps)
	}
}

func TestParseSpec_RejectsInvalidStructure(t *testing.T) {
	cases := []struct {
		name string
		body string
	}{
		{"missing version tag", `{"info": {"title": "x"}, "paths": {}}`},
		{"missing paths", `{"openapi": "3.0.0", "info": {"title": "x"}}`},
		{"paths not object", `{"openapi": "3.0.0", "paths": []}`},
		{"empty payload", `   `},
		{"garbage", `not-json-or-yaml-at-all: [[[[`},
	}
	for _, tc := range cases {
		if _, _, err := ParseSpec(strings.NewReader(tc.body), 0); err == nil {
			t.Errorf("%s: expected error, got nil", tc.name)
		}
	}
}

func TestParseSpec_SizeLimitEnforced(t *testing.T) {
	big := `{"openapi":"3.0.0","paths":{},"pad":"` + strings.Repeat("x", 4096) + `"}`
	_, _, err := ParseSpec(strings.NewReader(big), 1024)
	if err == nil || !errors.Is(err, ErrSpecTooLarge) {
		t.Errorf("expected ErrSpecTooLarge, got %v", err)
	}
}

func TestParseSpec_RejectsYAMLBombDepth(t *testing.T) {
	// Deeply nested YAML exceeding the 64-level depth guard.
	deep := strings.Repeat("- ", 200) + "1\n"
	_, _, err := ParseSpec(strings.NewReader(deep), 0)
	if err == nil {
		t.Error("expected depth bomb to be rejected")
	}
}
