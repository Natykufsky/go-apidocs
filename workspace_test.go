package apidocs

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

type mockAuthorizer struct {
	allowAll bool
}

func (m *mockAuthorizer) Authorize(r *http.Request, action string) (bool, string) {
	return m.allowAll, "test-user"
}

func TestNormalizeConfig_DefaultWorkspace(t *testing.T) {
	cfg := Config{
		Title:        "Test API",
		SpecFilePath: "./test_swagger.json",
	}

	normCfg, wm, _, err := NormalizeConfig(cfg)
	if err != nil {
		t.Fatalf("NormalizeConfig failed: %v", err)
	}

	if wm == nil {
		t.Fatal("expected non-nil WorkspaceManager")
	}

	workspaces := wm.ListWorkspaces()
	if len(workspaces) != 1 {
		t.Fatalf("expected 1 default workspace, got %d", len(workspaces))
	}

	ws := workspaces[0]
	if ws.ID != "default" {
		t.Errorf("expected workspace ID 'default', got '%s'", ws.ID)
	}
	if len(ws.Services) != 1 {
		t.Fatalf("expected 1 default service, got %d", len(ws.Services))
	}
	if ws.Services[0].SpecFilePath != normCfg.SpecFilePath {
		t.Errorf("expected spec file path '%s', got '%s'", normCfg.SpecFilePath, ws.Services[0].SpecFilePath)
	}
}

func TestSecurity_FailClosedOnStartup(t *testing.T) {
	cfg := Config{
		Title:                 "Test API",
		EnableWorkspaceWrites: true,
		Authorizer:            nil, // Deliberately nil
	}

	err := ValidateConfig(cfg)
	if err == nil {
		t.Fatal("expected startup error when EnableWorkspaceWrites=true and Authorizer=nil")
	}
}

func TestWorkspaceManager_SafeJoin(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "apidocs_test_*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tempDir)

	wm, err := NewWorkspaceManager(nil, tempDir, 5<<20, 64<<20, &mockAuthorizer{allowAll: true}, RateLimitConfig{}, nil)
	if err != nil {
		t.Fatal(err)
	}

	// Normal valid join
	path, err := wm.SafeJoin("valid_file.json")
	if err != nil {
		t.Fatalf("expected valid join, got: %v", err)
	}
	expected := filepath.Join(tempDir, "valid_file.json")
	if path != expected {
		t.Errorf("expected '%s', got '%s'", expected, path)
	}

	// Traversal attempt
	_, err = wm.SafeJoin("../../etc/passwd")
	if err == nil {
		t.Fatal("expected ErrPathEscape on path traversal, got nil")
	}
}

func TestWorkspaceManager_SaveAndGetSpec(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "apidocs_test_save_*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tempDir)

	wm, err := NewWorkspaceManager(nil, tempDir, 5<<20, 64<<20, &mockAuthorizer{allowAll: true}, RateLimitConfig{}, nil)
	if err != nil {
		t.Fatal(err)
	}

	specJSON := `{"openapi":"3.0.0","info":{"title":"Saved API","version":"1.0.0"},"paths":{}}`
	svc := APIService{
		ID:    "saved-svc",
		Title: "Saved API",
	}

	savedSvc, err := wm.SaveImportedSpec("billing", svc, []byte(specJSON))
	if err != nil {
		t.Fatalf("SaveImportedSpec failed: %v", err)
	}
	if savedSvc.StoredFilename == "" {
		t.Fatal("expected stored filename to be generated")
	}

	data, err := wm.GetSpecData("billing", "saved-svc")
	if err != nil {
		t.Fatalf("GetSpecData failed: %v", err)
	}
	if string(data) != specJSON {
		t.Errorf("expected spec data '%s', got '%s'", specJSON, string(data))
	}
}

func TestParseSpec_ValidJSONAndYAML(t *testing.T) {
	jsonSpec := `{"openapi":"3.0.0","info":{"title":"Pet Store","version":"2.0.0"},"paths":{"/pets":{"get":{"tags":["pets"],"responses":{"200":{"description":"ok"}}}}}}`
	parsed, stdJSON, err := ParseSpec(bytes.NewReader([]byte(jsonSpec)), 5<<20)
	if err != nil {
		t.Fatalf("ParseSpec JSON failed: %v", err)
	}
	if parsed.Title != "Pet Store" {
		t.Errorf("expected title 'Pet Store', got '%s'", parsed.Title)
	}
	if parsed.TotalOps != 1 {
		t.Errorf("expected 1 operation, got %d", parsed.TotalOps)
	}
	if len(stdJSON) == 0 {
		t.Fatal("expected non-empty standardized JSON")
	}

	yamlSpec := `
openapi: 3.0.0
info:
  title: YAML Pet Store
  version: 1.0.0
paths:
  /orders:
    post:
      tags:
        - orders
      responses:
        '201':
          description: created
`
	parsedYAML, _, err := ParseSpec(bytes.NewReader([]byte(yamlSpec)), 5<<20)
	if err != nil {
		t.Fatalf("ParseSpec YAML failed: %v", err)
	}
	if parsedYAML.Title != "YAML Pet Store" {
		t.Errorf("expected title 'YAML Pet Store', got '%s'", parsedYAML.Title)
	}
	if parsedYAML.TotalOps != 1 {
		t.Errorf("expected 1 operation, got %d", parsedYAML.TotalOps)
	}
}

func TestParseSpec_RejectTooLarge(t *testing.T) {
	largeData := make([]byte, 1024*1024) // 1MB
	_, _, err := ParseSpec(bytes.NewReader(largeData), 1024) // Limit 1KB
	if err == nil {
		t.Fatal("expected ErrSpecTooLarge, got nil")
	}
}

func TestWorkspaceRoutes_CapabilitiesEndpoint(t *testing.T) {
	cfg := Config{
		Title:            "Test API",
		EnableWorkspaces: true,
	}

	handler := Handler(cfg)
	req := httptest.NewRequest(http.MethodGet, "/docs/capabilities", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}
	if !bytes.Contains(rec.Body.Bytes(), []byte(`"workspaces_enabled":true`)) {
		t.Errorf("expected capabilities json to contain workspaces_enabled:true, got %s", rec.Body.String())
	}
}
