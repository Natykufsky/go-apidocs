package apidocs_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/go-chi/chi/v5"
	"github.com/gofiber/fiber/v2"

	"github.com/Natykufsky/go-apidocs"
	chiadapter "github.com/Natykufsky/go-apidocs/chi"
	ginadapter "github.com/Natykufsky/go-apidocs/gin"
)

func createTestSpecFile(t *testing.T) string {
	spec := map[string]interface{}{
		"openapi": "3.0.0",
		"info": map[string]interface{}{
			"title":   "Test Service API",
			"version": "1.0.0",
		},
		"tags": []map[string]interface{}{
			{"name": "Auth", "description": "Authentication"},
			{"name": "Users", "description": "User operations"},
		},
		"paths": map[string]interface{}{
			"/api/v1/auth/login": map[string]interface{}{
				"post": map[string]interface{}{
					"tags":        []interface{}{"Auth"},
					"summary":     "Login endpoint",
					"description": "Performs user login",
				},
			},
			"/api/v1/users": map[string]interface{}{
				"get": map[string]interface{}{
					"tags":        []interface{}{"Users"},
					"summary":     "Get users",
					"description": "Retrieves all users",
				},
			},
		},
	}

	data, err := json.Marshal(spec)
	if err != nil {
		t.Fatalf("failed to marshal spec: %v", err)
	}

	tmpFile, err := os.CreateTemp("", "test_swagger_*.json")
	if err != nil {
		t.Fatalf("failed to create temp file: %v", err)
	}
	if _, err := tmpFile.Write(data); err != nil {
		t.Fatalf("failed to write temp spec: %v", err)
	}
	_ = tmpFile.Close()

	t.Cleanup(func() {
		_ = os.Remove(tmpFile.Name())
	})

	return tmpFile.Name()
}

func TestAuthTokens(t *testing.T) {
	username := "testadmin"
	secret := "test_secret_key"

	token := apidocs.GenerateDocsSessionToken(username, secret)
	if token == "" {
		t.Fatal("expected non-empty token")
	}

	if !apidocs.VerifyDocsSessionToken(token, username, secret) {
		t.Fatal("token verification should succeed")
	}

	if apidocs.VerifyDocsSessionToken(token, "wronguser", secret) {
		t.Fatal("token verification should fail for mismatched username")
	}

	if apidocs.VerifyDocsSessionToken(token, username, "wrong_secret") {
		t.Fatal("token verification should fail for mismatched secret")
	}

	if apidocs.VerifyDocsSessionToken("invalid:token:format", username, secret) {
		t.Fatal("token verification should fail for corrupted token")
	}
}

func TestChiMount(t *testing.T) {
	specPath := createTestSpecFile(t)
	qaPath := os.TempDir() + "/chi_qa_tracker.json"
	defer os.Remove(qaPath)

	authEnabled := true
	cfg := apidocs.Config{
		SpecFilePath:  specPath,
		Title:         "Chi Test API",
		AuthUser:      "chiadmin",
		AuthPassword:  "chipassword",
		AuthEnabled:   &authEnabled,
		JWTSecret:     "chisecret123",
		QAStoragePath: qaPath,
		ModuleTagMap: map[string][]string{
			"auth": {"Auth"},
		},
	}

	r := chi.NewRouter()
	chiadapter.Mount(r, cfg)

	// 1. Test Swagger JSON unfiltered
	req := httptest.NewRequest(http.MethodGet, "/docs/swagger.json", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 for swagger.json, got %d", rec.Code)
	}
	var spec map[string]interface{}
	if err := json.Unmarshal(rec.Body.Bytes(), &spec); err != nil {
		t.Fatalf("failed to decode swagger spec: %v", err)
	}
	paths := spec["paths"].(map[string]interface{})
	if len(paths) != 2 {
		t.Fatalf("expected 2 paths unfiltered, got %d", len(paths))
	}

	// 2. Test Swagger JSON filtered by module=auth
	req = httptest.NewRequest(http.MethodGet, "/docs/swagger.json?module=auth", nil)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 for filtered swagger.json, got %d", rec.Code)
	}
	var filteredSpec map[string]interface{}
	if err := json.Unmarshal(rec.Body.Bytes(), &filteredSpec); err != nil {
		t.Fatalf("failed to decode filtered swagger spec: %v", err)
	}
	filteredPaths := filteredSpec["paths"].(map[string]interface{})
	if len(filteredPaths) != 1 || filteredPaths["/api/v1/auth/login"] == nil {
		t.Fatalf("expected only auth path, got %+v", filteredPaths)
	}

	// 3. Test Navigation API
	req = httptest.NewRequest(http.MethodGet, "/docs/nav", nil)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 for nav, got %d", rec.Code)
	}
	var nav map[string]interface{}
	if err := json.Unmarshal(rec.Body.Bytes(), &nav); err != nil {
		t.Fatalf("failed to decode nav json: %v", err)
	}
	if nav["title"] != "Chi Test API" {
		t.Fatalf("expected title 'Chi Test API', got %v", nav["title"])
	}

	// 4. Test QA Record save and get
	qaPayload := map[string]string{
		"endpoint_key": "POST /api/v1/auth/login",
		"status":       "passed",
		"comment":      "Login works as expected",
		"tester":       "ChiTester",
	}
	bodyBytes, _ := json.Marshal(qaPayload)
	req = httptest.NewRequest(http.MethodPost, "/docs/qa/record", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 for qa record save, got %d", rec.Code)
	}

	req = httptest.NewRequest(http.MethodGet, "/docs/qa/data", nil)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 for qa data get, got %d", rec.Code)
	}
	var qaData map[string]apidocs.EndpointRecord
	if err := json.Unmarshal(rec.Body.Bytes(), &qaData); err != nil {
		t.Fatalf("failed to decode qa data: %v", err)
	}
	if qaData["POST /api/v1/auth/login"].Status != "passed" {
		t.Fatalf("expected qa status 'passed', got %s", qaData["POST /api/v1/auth/login"].Status)
	}

	// 5. Test QA Report
	req = httptest.NewRequest(http.MethodGet, "/docs/qa/report", nil)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 for qa report, got %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "Chi Test API") {
		t.Fatalf("expected report to contain title, got %s", rec.Body.String())
	}

	// 6. Test Auth Protection on /docs
	req = httptest.NewRequest(http.MethodGet, "/docs", nil)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusFound {
		t.Fatalf("expected 302 redirect for unauthenticated /docs, got %d", rec.Code)
	}

	// 7. Test Login POST with valid credentials
	loginBody, _ := json.Marshal(map[string]string{
		"username": "chiadmin",
		"password": "chipassword",
	})
	req = httptest.NewRequest(http.MethodPost, "/docs/login", bytes.NewReader(loginBody))
	req.Header.Set("Content-Type", "application/json")
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 for valid login, got %d", rec.Code)
	}
	cookies := rec.Result().Cookies()
	var sessionCookie *http.Cookie
	for _, c := range cookies {
		if c.Name == apidocs.DocsSessionCookieName {
			sessionCookie = c
			break
		}
	}
	if sessionCookie == nil || sessionCookie.Value == "" {
		t.Fatal("expected session cookie to be set")
	}

	// 8. Test /docs with valid cookie
	req = httptest.NewRequest(http.MethodGet, "/docs", nil)
	req.AddCookie(sessionCookie)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 for authenticated /docs, got %d", rec.Code)
	}
}

func TestGinMount(t *testing.T) {
	gin.SetMode(gin.TestMode)
	specPath := createTestSpecFile(t)
	qaPath := os.TempDir() + "/gin_qa_tracker.json"
	defer os.Remove(qaPath)

	authEnabled := true
	cfg := apidocs.Config{
		SpecFilePath:  specPath,
		Title:         "Gin Test API",
		AuthUser:      "ginadmin",
		AuthPassword:  "ginpassword",
		AuthEnabled:   &authEnabled,
		JWTSecret:     "ginsecret123",
		QAStoragePath: qaPath,
	}

	g := gin.New()
	ginadapter.Mount(g, cfg)

	// 1. Test Swagger JSON
	req := httptest.NewRequest(http.MethodGet, "/docs/swagger.json", nil)
	rec := httptest.NewRecorder()
	g.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 for swagger.json in Gin, got %d", rec.Code)
	}

	// 2. Test Nav API
	req = httptest.NewRequest(http.MethodGet, "/docs/nav", nil)
	rec = httptest.NewRecorder()
	g.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 for nav in Gin, got %d", rec.Code)
	}

	// 3. Test Unauthenticated gate
	req = httptest.NewRequest(http.MethodGet, "/docs", nil)
	rec = httptest.NewRecorder()
	g.ServeHTTP(rec, req)
	if rec.Code != http.StatusFound {
		t.Fatalf("expected 302 redirect for unauthenticated /docs in Gin, got %d", rec.Code)
	}

	// 4. Test Login
	loginBody, _ := json.Marshal(map[string]string{
		"username": "ginadmin",
		"password": "ginpassword",
	})
	req = httptest.NewRequest(http.MethodPost, "/docs/login", bytes.NewReader(loginBody))
	req.Header.Set("Content-Type", "application/json")
	rec = httptest.NewRecorder()
	g.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 for login in Gin, got %d", rec.Code)
	}
	cookies := rec.Result().Cookies()
	var sessionCookie *http.Cookie
	for _, c := range cookies {
		if c.Name == apidocs.DocsSessionCookieName {
			sessionCookie = c
			break
		}
	}
	if sessionCookie == nil {
		t.Fatal("expected session cookie in Gin login")
	}

	// 5. Test Authenticated access
	req = httptest.NewRequest(http.MethodGet, "/docs", nil)
	req.AddCookie(sessionCookie)
	rec = httptest.NewRecorder()
	g.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 for authenticated /docs in Gin, got %d", rec.Code)
	}
}

func TestFiberMount(t *testing.T) {
	specPath := createTestSpecFile(t)
	qaPath := os.TempDir() + "/fiber_qa_tracker.json"
	defer os.Remove(qaPath)

	authEnabled := false
	cfg := apidocs.Config{
		SpecFilePath:  specPath,
		Title:         "Fiber Test API",
		AuthEnabled:   &authEnabled,
		QAStoragePath: qaPath,
	}

	app := fiber.New()
	apidocs.Mount(app, cfg)

	req := httptest.NewRequest(http.MethodGet, "/docs/swagger.json", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("failed testing fiber app: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 for fiber swagger.json, got %d", resp.StatusCode)
	}

	req = httptest.NewRequest(http.MethodGet, "/docs/nav", nil)
	resp, err = app.Test(req)
	if err != nil {
		t.Fatalf("failed testing fiber nav: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 for fiber nav, got %d", resp.StatusCode)
	}
}

func TestNetHTTPMount(t *testing.T) {
	specPath := createTestSpecFile(t)
	qaPath := os.TempDir() + "/nethttp_qa_tracker.json"
	defer os.Remove(qaPath)

	authEnabled := false
	cfg := apidocs.Config{
		SpecFilePath:  specPath,
		Title:         "NetHTTP Test API",
		AuthEnabled:   &authEnabled,
		QAStoragePath: qaPath,
	}

	handler := apidocs.Handler(cfg)

	req := httptest.NewRequest(http.MethodGet, "/docs/swagger.json", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 for net/http swagger.json, got %d", rec.Code)
	}

	req = httptest.NewRequest(http.MethodGet, "/docs/nav", nil)
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 for net/http nav, got %d", rec.Code)
	}
}

func TestRootMountHelpers(t *testing.T) {
	specPath := createTestSpecFile(t)
	qaPath := os.TempDir() + "/root_qa_tracker.json"
	defer os.Remove(qaPath)

	cfg := apidocs.Config{
		SpecFilePath:  specPath,
		Title:         "Root Helpers Test API",
		QAStoragePath: qaPath,
	}

	// Test apidocs.MountChi
	r := chi.NewRouter()
	apidocs.MountChi(r, cfg)
	req := httptest.NewRequest(http.MethodGet, "/docs/swagger.json", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 for apidocs.MountChi, got %d", rec.Code)
	}

	// Test apidocs.MountGin
	gin.SetMode(gin.TestMode)
	g := gin.New()
	apidocs.MountGin(g, cfg)
	req = httptest.NewRequest(http.MethodGet, "/docs/swagger.json", nil)
	rec = httptest.NewRecorder()
	g.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 for apidocs.MountGin, got %d", rec.Code)
	}
}

func TestWorkspace_LockUnlockInvite(t *testing.T) {
	specPath := createTestSpecFile(t)
	storageDir := t.TempDir()

	cfg := apidocs.Config{
		SpecFilePath:     specPath,
		Title:            "Locked Workspace Test",
		StorageRoot:      storageDir,
		EnableWorkspaces: true,
		JWTSecret:        "test-crypto-key-12345",
		Workspaces: []apidocs.Workspace{
			{
				ID:         "finance",
				Name:       "Finance Services",
				Visibility: "locked",
				Passcode:   "pin9988",
				Services: []apidocs.APIService{
					{
						ID:           "billing",
						Title:        "Billing API",
						SpecFilePath: specPath,
					},
				},
			},
		},
	}

	r := chi.NewRouter()
	apidocs.MountChi(r, cfg)

	// 1. Verify list workspaces masks passcode and exposes is_locked
	req := httptest.NewRequest(http.MethodGet, "/docs/workspaces", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 for workspaces list, got %d", rec.Code)
	}
	var wsList []apidocs.Workspace
	_ = json.Unmarshal(rec.Body.Bytes(), &wsList)
	if len(wsList) != 1 || !wsList[0].IsLocked || wsList[0].Passcode != "" {
		t.Fatalf("expected locked workspace with masked passcode, got: %+v", wsList[0])
	}

	// 2. Test unlock with invalid passcode -> 401
	unlockPayload, _ := json.Marshal(map[string]string{
		"workspace_id": "finance",
		"passcode":     "wrongpass",
	})
	req = httptest.NewRequest(http.MethodPost, "/docs/workspaces/unlock", bytes.NewReader(unlockPayload))
	req.Header.Set("Content-Type", "application/json")
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for wrong passcode, got %d", rec.Code)
	}

	// 3. Test unlock with valid passcode -> 200 and session cookie
	unlockPayload, _ = json.Marshal(map[string]string{
		"workspace_id": "finance",
		"passcode":     "pin9988",
	})
	req = httptest.NewRequest(http.MethodPost, "/docs/workspaces/unlock", bytes.NewReader(unlockPayload))
	req.Header.Set("Content-Type", "application/json")
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 for correct passcode, got %d", rec.Code)
	}
	var sessCookie *http.Cookie
	for _, c := range rec.Result().Cookies() {
		if c.Name == apidocs.DocsSessionCookieName {
			sessCookie = c
			break
		}
	}
	if sessCookie == nil {
		t.Fatal("expected session cookie upon unlocking workspace")
	}

	// 4. Test generate invitation link
	invitePayload, _ := json.Marshal(map[string]any{
		"workspace_id": "finance",
		"duration_sec": 3600,
	})
	req = httptest.NewRequest(http.MethodPost, "/docs/workspaces/invite", bytes.NewReader(invitePayload))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Apidocs-CSRF", "1")
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 for invite generation, got %d", rec.Code)
	}
	var inviteResp map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &inviteResp)
	tokenStr, _ := inviteResp["token"].(string)
	if tokenStr == "" {
		t.Fatal("expected invite token in response")
	}

	// 5. Test accept invitation link
	req = httptest.NewRequest(http.MethodGet, "/docs/workspaces/accept-invite?token="+tokenStr, nil)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusFound {
		t.Fatalf("expected 302 redirect for accepted invite, got %d", rec.Code)
	}
}

func TestWorkspace_LiveSpecEditing(t *testing.T) {
	specPath := createTestSpecFile(t)
	storageDir := t.TempDir()

	cfg := apidocs.Config{
		SpecFilePath:          specPath,
		Title:                 "Live Spec Test",
		StorageRoot:           storageDir,
		EnableWorkspaces:      true,
		EnableLiveSpecEditing: true,
		Workspaces: []apidocs.Workspace{
			{
				ID:   "core",
				Name: "Core API",
				Services: []apidocs.APIService{
					{
						ID:           "user-service",
						Title:        "User Service",
						SpecFilePath: specPath,
					},
				},
			},
		},
	}

	r := chi.NewRouter()
	apidocs.MountChi(r, cfg)

	// 1. Get raw spec
	req := httptest.NewRequest(http.MethodGet, "/docs/workspaces/spec/raw?ws=core&svc=user-service", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 for spec/raw, got %d", rec.Code)
	}

	// 2. Put mutated spec
	mutatedSpec := `{
		"openapi": "3.0.0",
		"info": {
			"title": "Live Mutated User Service",
			"version": "2.5.0"
		},
		"paths": {
			"/users/v2": {
				"get": {
					"summary": "List Users V2",
					"responses": {
						"200": { "description": "OK" }
					}
				}
			}
		}
	}`

	savePayload, _ := json.Marshal(map[string]string{
		"workspace_id": "core",
		"service_id":   "user-service",
		"content":      mutatedSpec,
	})
	req = httptest.NewRequest(http.MethodPut, "/docs/workspaces/spec", bytes.NewReader(savePayload))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Apidocs-CSRF", "1")
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 for spec save, got %d (%s)", rec.Code, rec.Body.String())
	}

	// 3. Verify swagger.json serves updated live spec
	req = httptest.NewRequest(http.MethodGet, "/docs/swagger.json?ws=core&svc=user-service", nil)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 for swagger.json, got %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "Live Mutated User Service") || !strings.Contains(rec.Body.String(), "/users/v2") {
		t.Fatalf("expected updated live spec content, got: %s", rec.Body.String())
	}
}


