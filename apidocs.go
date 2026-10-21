package apidocs

import (
	"bytes"
	"context"
	"crypto/subtle"
	"embed"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"mime"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-chi/chi/v5"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/adaptor"
	"github.com/gofiber/fiber/v2/middleware/filesystem"

	"github.com/Natykufsky/go-apidocs/assets"
	aiAdapter "github.com/Natykufsky/go-apidocs/internal/ai/adapter"
	aiDomain "github.com/Natykufsky/go-apidocs/internal/ai/domain"
	aiPort "github.com/Natykufsky/go-apidocs/internal/ai/port"
	"github.com/Natykufsky/go-apidocs/internal/auth"
	"github.com/Natykufsky/go-apidocs/internal/env"
	"github.com/Natykufsky/go-apidocs/internal/qa"
	"github.com/Natykufsky/go-apidocs/internal/schema"
	"github.com/Natykufsky/go-apidocs/internal/security"
	"github.com/Natykufsky/go-apidocs/internal/workspace"
)

// DocsSessionCookieName is the cookie name used for session authentication tokens.
const DocsSessionCookieName = auth.DocsSessionCookieName

// Re-export core types for backwards compatibility and clean public API
type (
	NavItem             = NavItemConfig
	Authorizer          = workspace.Authorizer
	AuthorizerFunc      = workspace.AuthorizerFunc
	AllowAllAuthorizer  = workspace.AllowAllAuthorizer
	RateLimitConfig     = workspace.RateLimitConfig
	AuditEvent          = workspace.AuditEvent
	APIService          = workspace.APIService
	MarkdownDoc         = workspace.MarkdownDoc
	Workspace           = workspace.Workspace
	Capabilities        = workspace.Capabilities
	WorkspaceManager    = workspace.WorkspaceManager
	RemoteFetchPolicy   = security.RemoteFetchPolicy
	SecurityAuditResult = security.SecurityAuditResult
	SecurityFinding     = security.SecurityFinding
	HeaderAuditResult   = security.HeaderAuditResult
	FuzzingPresetGroup  = security.FuzzingPresetGroup
	FuzzPayload         = security.FuzzPayload
	ParsedSpec          = schema.ParsedSpec
	SpecFilter          = schema.SpecFilter
	EndpointRecord      = qa.EndpointRecord
	QATracker           = qa.QATracker
	AITestCase          = aiDomain.TestCase
	AITestSuite         = aiDomain.TestSuite
	LLMClientPort       = aiPort.LLMClientPort
)

// AIProviderConfig configures an individual LLM inference provider.
type AIProviderConfig struct {
	APIKey      string        `json:"api_key"`
	BaseURL     string        `json:"base_url"`
	Model       string        `json:"model"`
	Timeout     time.Duration `json:"timeout"`
	Temperature float64       `json:"temperature"`
	MaxTokens   int           `json:"max_tokens"`
}

// NVIDIAConfig configures the NVIDIA NIM DeepSeek LLM for QA test generation.
type NVIDIAConfig = AIProviderConfig

// OpenAIConfig configures OpenAI GPT-4o / GPT-4o-mini.
type OpenAIConfig = AIProviderConfig

// AnthropicConfig configures Anthropic Claude 3.5 Sonnet.
type AnthropicConfig = AIProviderConfig

// OllamaConfig configures local / self-hosted Ollama inference.
type OllamaConfig struct {
	BaseURL string        `json:"base_url"`
	Model   string        `json:"model"`
	Timeout time.Duration `json:"timeout"`
}

// Public session and auth function re-exports delegating to internal/auth
func GenerateDocsSessionToken(username, secret string) string {
	return auth.GenerateDocsSessionToken(username, secret)
}

func VerifyDocsSessionToken(tokenStr, expectedUsername, secret string) bool {
	return auth.VerifyDocsSessionToken(tokenStr, expectedUsername, secret)
}

func WebAuthMiddleware(authEnabled bool, authUser, authPass, jwtSecret string) fiber.Handler {
	return auth.WebAuthMiddleware(authEnabled, authUser, authPass, jwtSecret)
}

func HTTPAuthMiddleware(authEnabled bool, authUser, authPass, jwtSecret string) func(http.Handler) http.Handler {
	return auth.HTTPAuthMiddleware(authEnabled, authUser, authPass, jwtSecret)
}

func GinAuthMiddleware(authEnabled bool, authUser, authPass, jwtSecret string) gin.HandlerFunc {
	return auth.GinAuthMiddleware(authEnabled, authUser, authPass, jwtSecret)
}

// Public schema and security function re-exports delegating to internal packages
func ParseSpec(r io.Reader, maxBytes int64) (*ParsedSpec, []byte, error) {
	return schema.ParseSpec(r, maxBytes)
}

func AnalyzeSpecSecurity(spec map[string]any) SecurityAuditResult {
	return security.AnalyzeSpecSecurity(spec)
}

func AuditLiveHeaders(ctx context.Context, client *http.Client, targetURL string) (*HeaderAuditResult, error) {
	return security.AuditLiveHeaders(ctx, client, targetURL)
}

func NewSafeHTTPClient(policy RemoteFetchPolicy) *http.Client {
	return security.NewSafeHTTPClient(policy)
}

func NewWorkspaceManager(
	workspaces []Workspace,
	storageRoot string,
	maxSpecBytes int64,
	maxCacheBytes int64,
	authorizer Authorizer,
	rateLimit RateLimitConfig,
	auditLogger func(AuditEvent),
) (*WorkspaceManager, error) {
	return workspace.NewWorkspaceManager(
		workspaces,
		storageRoot,
		maxSpecBytes,
		maxCacheBytes,
		authorizer,
		rateLimit,
		auditLogger,
	)
}

// NavItemConfig represents a link in the unified navigation header.
type NavItemConfig struct {
	Label    string `json:"label"`
	URL      string `json:"url"`
	Icon     string `json:"icon,omitempty"`
	Badge    string `json:"badge,omitempty"`
	IsButton bool   `json:"is_button,omitempty"`
	External bool   `json:"external,omitempty"`
}

// Config defines the options for the API Docs, Workspace Hub, and QA/Cybersecurity Suite.
type Config struct {
	// SpecFilePath is the path to swagger.json (default: "./docs/swagger.json")
	SpecFilePath string

	// Title is the project title displayed on Swagger UI and QA reports
	Title string

	// Subtitle is an optional subtitle for the header/brand
	Subtitle string

	// BrandIcon is the emoji or SVG for the topbar (default: "⚡")
	BrandIcon string

	// NavItems allows configuring custom topbar navigation items via Go or JSON
	NavItems []NavItem

	// AuthUser configures the HTTP username for docs protection (reads from DOCS_AUTH_USER if empty)
	AuthUser string

	// AuthPassword configures the HTTP password for docs protection (reads from DOCS_AUTH_PASS if empty)
	AuthPassword string

	// AuthPasswordHash configures the bcrypt hash of password (reads from DOCS_AUTH_PASS_HASH if empty)
	AuthPasswordHash string

	// AuthEnabled explicitly turns on/off authentication protection (defaults to true if AuthUser is set)
	AuthEnabled *bool

	// JWTSecret is used to cryptographically sign docs session cookies (reads from DOCS_JWT_SECRET if empty)
	JWTSecret string

	// EnableLiveSpecEditing allows modifying and committing OpenAPI JSON/YAML from the portal UI
	EnableLiveSpecEditing bool

	// QAStoragePath is where QA test reviews and bug notes are persisted (default: "./docs/qa_tracker.json")
	QAStoragePath string

	// DocsDir is the base directory containing docs files like schemas.json, swagger_base.json (default: "./docs")
	DocsDir string

	// ReadmePath is the path to README.md (default: "<DocsDir>/README.md" or "./README.md")
	ReadmePath string

	// MarkdownFiles optionally configures explicit markdown files for documentation
	MarkdownFiles []MarkdownDoc

	// PathsDir is the directory containing modular endpoint definitions (default: "<DocsDir>/paths")
	PathsDir string

	// ModuleTagMap maps custom module shorthand queries (?module=auth) to OpenAPI tag names
	ModuleTagMap map[string][]string

	// EmbeddedFS optionally provides an embedded filesystem of HTML/CSS/JS assets
	EmbeddedFS *embed.FS

	// ---- Production-Hardened Workspace & Cybersecurity Feature Gates ----

	// EnableWorkspaces mounts multi-workspace read endpoints (GET /docs/workspaces, /docs/swagger.json?ws=...&svc=...)
	EnableWorkspaces bool

	// EnableWorkspaceWrites mounts mutating routes (POST /docs/workspaces, /docs/workspaces/import). Requires Authorizer.
	EnableWorkspaceWrites bool

	// EnableSecurityAudit mounts the cybersecurity static & live header audit endpoints. Requires Authorizer.
	EnableSecurityAudit bool

	// Authorizer supplies the authorization check for write and security actions.
	// Required when EnableWorkspaceWrites or EnableSecurityAudit is true.
	Authorizer Authorizer

	// StorageRoot is the sandboxed directory where uploaded/imported specs are persisted. Default: "./apidocs-data"
	StorageRoot string

	// MaxSpecBytes is the max upload size for OpenAPI specs in bytes. Default: 5 MiB
	MaxSpecBytes int64

	// MaxCacheBytes is the max in-memory cache size for specs. Default: 64 MiB
	MaxCacheBytes int64

	// RemoteFetch configures SSRF policy for fetching remote OpenAPI URLs.
	RemoteFetch RemoteFetchPolicy

	// RateLimit configures throttling on mutating routes.
	RateLimit RateLimitConfig

	// AuditLogger is a custom structured audit log sink.
	AuditLogger func(AuditEvent)

	// Workspaces allows configuring static/in-code workspaces and services.
	Workspaces []Workspace

	// WorkspacesDir is the directory to scan for workspace folders. Default: "<DocsDir>/workspaces"
	WorkspacesDir string

	// NVIDIA configures NVIDIA NIM DeepSeek LLM for automated QA test case generation.
	NVIDIA NVIDIAConfig

	// OpenAI configures OpenAI GPT-4o test synthesis.
	OpenAI OpenAIConfig

	// Anthropic configures Claude 3.5 Sonnet test synthesis.
	Anthropic AnthropicConfig

	// Ollama configures local self-hosted test synthesis.
	Ollama OllamaConfig

	// DefaultAIProvider specifies default provider ("nvidia" | "openai" | "anthropic" | "ollama").
	DefaultAIProvider string
}

// buildAIDispatcher initializes registered AI LLM clients into a multi-provider dispatcher.
func buildAIDispatcher(cfg Config) aiPort.LLMClientPort {
	dispatcher := aiAdapter.NewMultiProviderDispatcher(cfg.DefaultAIProvider)

	// 1. NVIDIA NIM (DeepSeek v4.1)
	nvidia := aiAdapter.NewNVIDIAAdapter(cfg.NVIDIA.APIKey, cfg.NVIDIA.BaseURL, cfg.NVIDIA.Model, cfg.NVIDIA.Timeout)
	dispatcher.RegisterProvider(nvidia)

	// 2. OpenAI (GPT-4o)
	openai := aiAdapter.NewOpenAIAdapter(cfg.OpenAI.APIKey, cfg.OpenAI.BaseURL, cfg.OpenAI.Model, cfg.OpenAI.Timeout)
	dispatcher.RegisterProvider(openai)

	// 3. Anthropic (Claude 3.5)
	anthropic := aiAdapter.NewAnthropicAdapter(cfg.Anthropic.APIKey, cfg.Anthropic.BaseURL, cfg.Anthropic.Model, cfg.Anthropic.Timeout)
	dispatcher.RegisterProvider(anthropic)

	// 4. Local Ollama
	ollama := aiAdapter.NewOllamaAdapter(cfg.Ollama.BaseURL, cfg.Ollama.Model, cfg.Ollama.Timeout)
	dispatcher.RegisterProvider(ollama)

	return dispatcher
}

// ValidateConfig checks for configuration consistency.
func ValidateConfig(cfg Config) error {
	return nil
}

// isProduction reports whether the process is running in a production environment.
func isProduction() bool {
	switch strings.ToLower(os.Getenv("APP_ENV")) {
	case "production", "prod":
		return true
	}
	return false
}

// NormalizeConfig applies default configuration values and constructs a WorkspaceManager.
func NormalizeConfig(cfg Config) (Config, *WorkspaceManager, bool, error) {
	// Automatically auto-discover and load .env / .env.local if present
	env.LoadDotEnv()

	// If workspace writes or security audits are enabled but no Authorizer was provided, default to AllowAllAuthorizer
	if (cfg.EnableWorkspaceWrites || cfg.EnableSecurityAudit) && cfg.Authorizer == nil {
		cfg.Authorizer = AllowAllAuthorizer{}
	}

	if err := ValidateConfig(cfg); err != nil {
		return cfg, nil, false, err
	}

	if cfg.DocsDir == "" {
		cfg.DocsDir = "./docs"
	}
	if cfg.PathsDir == "" {
		cfg.PathsDir = filepath.Join(cfg.DocsDir, "paths")
	}
	if cfg.ReadmePath == "" {
		cfg.ReadmePath = filepath.Join(cfg.DocsDir, "README.md")
	}
	if cfg.SpecFilePath == "" {
		cfg.SpecFilePath = filepath.Join(cfg.DocsDir, "swagger.json")
	}
	if cfg.Title == "" {
		cfg.Title = "API Documentation & QA Portal"
	}
	if cfg.BrandIcon == "" {
		cfg.BrandIcon = "⚡"
	}
	if cfg.StorageRoot == "" {
		cfg.StorageRoot = "./apidocs-data"
	}
	if cfg.MaxSpecBytes <= 0 {
		cfg.MaxSpecBytes = 5 << 20 // 5 MiB
	}
	if cfg.MaxCacheBytes <= 0 {
		cfg.MaxCacheBytes = 64 << 20 // 64 MiB
	}
	cfg.RemoteFetch = cfg.RemoteFetch.Normalize()

	if len(cfg.NavItems) == 0 {
		cfg.NavItems = []NavItem{
			{Label: "Home", URL: "/", Icon: "🏠"},
			{Label: "Guide", URL: "/guide", Icon: "📖"},
			{Label: "API Sandbox", URL: "/docs", Icon: "⚡"},
			{Label: "Health", URL: "/dashboard", Icon: "📊"},
			{Label: "OpenAPI Spec", URL: "/docs/swagger.json", Icon: "📄", IsButton: true},
		}
	}
	if cfg.AuthUser == "" {
		cfg.AuthUser = os.Getenv("DOCS_AUTH_USER")
	}
	if cfg.AuthPassword == "" {
		cfg.AuthPassword = os.Getenv("DOCS_AUTH_PASS")
	}
	if cfg.AuthPasswordHash == "" {
		cfg.AuthPasswordHash = os.Getenv("DOCS_AUTH_PASS_HASH")
	}
	if cfg.JWTSecret == "" {
		cfg.JWTSecret = os.Getenv("DOCS_JWT_SECRET")
		if cfg.JWTSecret == "" {
			cfg.JWTSecret = os.Getenv("JWT_SECRET")
		}
	}
	if cfg.JWTSecret == "" && isProduction() {
		// Fail fast: never run a production deployment with forgeable session tokens.
		return cfg, nil, false, fmt.Errorf("go-apidocs: DOCS_JWT_SECRET (or JWTSecret) must be set in production (APP_ENV=production)")
	}
	if cfg.QAStoragePath == "" {
		cfg.QAStoragePath = "./docs/qa_tracker.json"
	}
	if cfg.EmbeddedFS == nil {
		cfg.EmbeddedFS = &assets.DefaultFS
	}

	authEnabled := false
	if cfg.AuthEnabled != nil {
		authEnabled = *cfg.AuthEnabled
	} else {
		authEnabled = os.Getenv("DOCS_AUTH_ENABLED") == "true" || (cfg.AuthUser != "" && (cfg.AuthPassword != "" || cfg.AuthPasswordHash != ""))
	}

	// Construct default workspace for seamless backward compatibility if none provided
	workspaces := cfg.Workspaces
	if len(workspaces) == 0 {
		workspaces = []Workspace{
			{
				ID:          "default",
				Name:        cfg.Title,
				Description: "Default Workspace",
				Icon:        cfg.BrandIcon,
				Services: []APIService{
					{
						ID:            "default",
						Title:         cfg.Title,
						Version:       "1.0.0",
						SpecFilePath:  cfg.SpecFilePath,
						DocsDir:       cfg.DocsDir,
						PathsDir:      cfg.PathsDir,
						ReadmePath:    cfg.ReadmePath,
						MarkdownFiles: cfg.MarkdownFiles,
						QAStoragePath: cfg.QAStoragePath,
						ModuleTagMap:  cfg.ModuleTagMap,
						Environments: map[string]string{
							"Default": "/",
						},
					},
				},
			},
		}
	}

	wm, err := workspace.NewWorkspaceManager(
		workspaces,
		cfg.StorageRoot,
		cfg.MaxSpecBytes,
		cfg.MaxCacheBytes,
		cfg.Authorizer,
		cfg.RateLimit,
		cfg.AuditLogger,
	)
	if err != nil {
		return cfg, nil, false, err
	}

	return cfg, wm, authEnabled, nil
}

// setSecurityHeaders applies defensive headers to HTTP responses for the docs SPA.
func setSecurityHeaders(w http.ResponseWriter) {
	w.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("X-Frame-Options", "DENY")
	w.Header().Set("Referrer-Policy", "no-referrer")
	w.Header().Set("Cross-Origin-Opener-Policy", "same-origin")
}

func setFiberSecurityHeaders(c *fiber.Ctx) {
	c.Set("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
	c.Set("X-Content-Type-Options", "nosniff")
	c.Set("X-Frame-Options", "DENY")
	c.Set("Referrer-Policy", "no-referrer")
	c.Set("Cross-Origin-Opener-Policy", "same-origin")
}

// Mount attaches all documentation, login, QA tracker, Workspace Hub, and Swagger UI routes to a Fiber app.
func Mount(app *fiber.App, cfg Config) {
	MountFiber(app, cfg)
}

// MountFiber attaches all documentation, login, QA tracker, Workspace Hub, and Swagger UI routes to a Fiber app.
func MountFiber(app *fiber.App, cfg Config) {
	cfg, wm, authEnabled, err := NormalizeConfig(cfg)
	if err != nil {
		panic(fmt.Sprintf("go-apidocs initialization failed: %v", err))
	}

	aiClient := buildAIDispatcher(cfg)
	defaultFilter := schema.NewSpecFilter(cfg.SpecFilePath, cfg.DocsDir, cfg.PathsDir, cfg.ModuleTagMap, nil)
	defaultQA := qa.NewQATracker(cfg.QAStoragePath, cfg.Title, aiClient)

	// Capabilities API
	app.Get("/docs/capabilities", func(c *fiber.Ctx) error {
		setFiberSecurityHeaders(c)
		caps := Capabilities{
			WorkspacesEnabled:      cfg.EnableWorkspaces,
			WorkspaceWritesEnabled: cfg.EnableWorkspaceWrites,
			SecurityAuditEnabled:   cfg.EnableSecurityAudit,
			LiveSpecEditingEnabled: cfg.EnableLiveSpecEditing,
			RemoteFetchEnabled:     cfg.RemoteFetch.Enabled,
			RemoteFetchPolicy:      cfg.RemoteFetch,
			MaxSpecBytes:           cfg.MaxSpecBytes,
		}
		return c.JSON(caps)
	})

	// Workspace Unlock & Invitation APIs
	app.Post("/docs/workspaces/unlock", func(c *fiber.Ctx) error {
		setFiberSecurityHeaders(c)
		var req struct {
			WorkspaceID string `json:"workspace_id"`
			Passcode    string `json:"passcode"`
		}
		if err := c.BodyParser(&req); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid payload"})
		}
		if req.WorkspaceID == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "workspace_id is required"})
		}
		unlocked, err := wm.UnlockWorkspace(req.WorkspaceID, req.Passcode)
		if err != nil {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": err.Error()})
		}
		if !unlocked {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"success": false, "message": "Invalid passcode"})
		}

		var unlockedList []string
		username := cfg.AuthUser
		cookieVal := c.Cookies(DocsSessionCookieName)
		if cookieVal != "" {
			if sess, ok := auth.ParseAndVerifySessionToken(cookieVal, "", cfg.JWTSecret); ok && sess != nil {
				unlockedList = sess.UnlockedWorkspaces
				if sess.Username != "" {
					username = sess.Username
				}
			}
		}

		already := false
		for _, u := range unlockedList {
			if u == req.WorkspaceID {
				already = true
				break
			}
		}
		if !already {
			unlockedList = append(unlockedList, req.WorkspaceID)
		}

		newToken := auth.GenerateDocsSessionToken(username, cfg.JWTSecret, unlockedList...)
		c.Cookie(&fiber.Cookie{
			Name:     DocsSessionCookieName,
			Value:    newToken,
			Path:     "/",
			Expires:  time.Now().Add(24 * time.Hour),
			HTTPOnly: true,
			SameSite: "Lax",
		})
		return c.JSON(fiber.Map{"success": true, "message": "Workspace unlocked successfully", "workspace": req.WorkspaceID})
	})

	app.Post("/docs/workspaces/invite", func(c *fiber.Ctx) error {
		setFiberSecurityHeaders(c)
		if !checkCSRFHeaderFiber(c) {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "missing or invalid CSRF header"})
		}
		var req struct {
			WorkspaceID string `json:"workspace_id"`
			DurationSec int64  `json:"duration_sec"`
		}
		if err := c.BodyParser(&req); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid payload"})
		}
		if req.WorkspaceID == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "workspace_id is required"})
		}
		if _, err := wm.GetWorkspace(req.WorkspaceID); err != nil {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "workspace not found"})
		}

		dur := time.Duration(req.DurationSec) * time.Second
		if dur <= 0 {
			dur = 7 * 24 * time.Hour
		}

		inviteToken := auth.GenerateInviteToken(req.WorkspaceID, cfg.JWTSecret, dur)
		inviteLink := fmt.Sprintf("/docs/workspaces/accept-invite?token=%s", inviteToken)

		return c.JSON(fiber.Map{
			"success":      true,
			"token":        inviteToken,
			"invite_link":  inviteLink,
			"expires_in":   int64(dur.Seconds()),
			"workspace_id": req.WorkspaceID,
		})
	})

	app.Get("/docs/workspaces/accept-invite", func(c *fiber.Ctx) error {
		setFiberSecurityHeaders(c)
		token := c.Query("token")
		if token == "" {
			return c.Status(fiber.StatusBadRequest).SendString("token is required")
		}

		wsID, valid := auth.VerifyInviteToken(token, cfg.JWTSecret)
		if !valid || wsID == "" {
			return c.Status(fiber.StatusUnauthorized).SendString("invalid or expired invitation token")
		}

		var unlockedList []string
		username := cfg.AuthUser
		cookieVal := c.Cookies(DocsSessionCookieName)
		if cookieVal != "" {
			if sess, ok := auth.ParseAndVerifySessionToken(cookieVal, "", cfg.JWTSecret); ok && sess != nil {
				unlockedList = sess.UnlockedWorkspaces
				if sess.Username != "" {
					username = sess.Username
				}
			}
		}

		already := false
		for _, u := range unlockedList {
			if u == wsID {
				already = true
				break
			}
		}
		if !already {
			unlockedList = append(unlockedList, wsID)
		}

		newToken := auth.GenerateDocsSessionToken(username, cfg.JWTSecret, unlockedList...)
		c.Cookie(&fiber.Cookie{
			Name:     DocsSessionCookieName,
			Value:    newToken,
			Path:     "/",
			Expires:  time.Now().Add(24 * time.Hour),
			HTTPOnly: true,
			SameSite: "Lax",
		})

		return c.Redirect(fmt.Sprintf("/docs?ws=%s", wsID))
	})

	// Live Spec Editing APIs
	app.Get("/docs/workspaces/spec/raw", func(c *fiber.Ctx) error {
		setFiberSecurityHeaders(c)
		wsID := c.Query("ws", "default")
		svcID := c.Query("svc", "default")

		var specBytes []byte
		var err error
		if wm != nil {
			specBytes, err = wm.GetSpecData(wsID, svcID)
		}
		if err != nil || len(specBytes) == 0 {
			specBytes, err = os.ReadFile(cfg.SpecFilePath)
		}
		if err != nil || len(specBytes) == 0 {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "spec not found"})
		}

		c.Set("Content-Type", "application/json; charset=utf-8")
		return c.Send(specBytes)
	})

	app.Put("/docs/workspaces/spec", func(c *fiber.Ctx) error {
		setFiberSecurityHeaders(c)
		if !checkCSRFHeaderFiber(c) {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "missing or invalid CSRF header"})
		}
		if !cfg.EnableLiveSpecEditing {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "live spec editing is disabled"})
		}

		var req struct {
			WorkspaceID string `json:"workspace_id"`
			ServiceID   string `json:"service_id"`
			Content     string `json:"content"`
		}
		if err := c.BodyParser(&req); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid payload"})
		}
		if req.WorkspaceID == "" {
			req.WorkspaceID = "default"
		}
		if req.ServiceID == "" {
			req.ServiceID = "default"
		}
		if strings.TrimSpace(req.Content) == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "spec content cannot be empty"})
		}

		parsed, standardizedJSON, err := ParseSpec(strings.NewReader(req.Content), cfg.MaxSpecBytes)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": fmt.Sprintf("spec validation failed: %v", err)})
		}

		if err := wm.SaveLiveSpec(req.WorkspaceID, req.ServiceID, standardizedJSON); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": fmt.Sprintf("failed saving live spec: %v", err)})
		}

		wm.LogAudit(AuditEvent{
			Action:    "spec:live_edit",
			Workspace: req.WorkspaceID,
			Service:   req.ServiceID,
			RemoteIP:  c.IP(),
			Status:    "SUCCESS",
			Details:   fmt.Sprintf("Saved live spec: %s (v%s)", parsed.Title, parsed.Version),
		})

		return c.JSON(fiber.Map{
			"success": true,
			"message": "Spec saved successfully",
			"summary": parsed,
		})
	})

	// Dynamic/Workspace-aware Swagger JSON handler
	swaggerHandler := func(c *fiber.Ctx) error {
		setFiberSecurityHeaders(c)
		wsID := c.Query("ws")
		svcID := c.Query("svc")

		if wsID != "" && svcID != "" && cfg.EnableWorkspaces {
			data, err := wm.GetSpecData(wsID, svcID)
			if err == nil && len(data) > 0 {
				c.Set("Content-Type", "application/json; charset=utf-8")
				return c.Send(data)
			}
		}
		return defaultFilter.ServeFilteredSwagger(c)
	}

	app.Get("/docs/swagger.json", swaggerHandler)
	app.Get("/swagger/swagger.json", swaggerHandler)
	app.Get("/swagger.json", swaggerHandler)

	// Navigation & Branding Configuration API
	app.Get("/docs/nav", func(c *fiber.Ctx) error {
		setFiberSecurityHeaders(c)
		return c.JSON(fiber.Map{
			"title":     cfg.Title,
			"subtitle":  cfg.Subtitle,
			"icon":      cfg.BrandIcon,
			"nav_items": cfg.NavItems,
		})
	})

	// Markdown Documents Catalog API
	app.Get("/docs/markdown-docs", func(c *fiber.Ctx) error {
		setFiberSecurityHeaders(c)
		wsID := c.Query("ws", "default")
		svcID := c.Query("svc", "default")
		docs := wm.ListMarkdownDocs(wsID, svcID)
		return c.JSON(docs)
	})

	// Markdown README / document content API
	app.Get("/docs/readme", func(c *fiber.Ctx) error {
		setFiberSecurityHeaders(c)
		wsID := c.Query("ws", "default")
		svcID := c.Query("svc", "default")
		fileQuery := c.Query("file", "")

		// If a specific file or custom markdown document is requested
		if fileQuery != "" {
			if b, err := wm.GetMarkdownDocContent(wsID, svcID, fileQuery); err == nil && len(b) > 0 {
				c.Set("Content-Type", "text/markdown; charset=utf-8")
				return c.Send(b)
			}
		}

		// Check service-specific discovered markdown documents first
		if b, err := wm.GetMarkdownDocContent(wsID, svcID, "README.md"); err == nil && len(b) > 0 {
			c.Set("Content-Type", "text/markdown; charset=utf-8")
			return c.Send(b)
		}

		candidates := []string{
			cfg.ReadmePath,
			filepath.Join(cfg.DocsDir, "README.md"),
			filepath.Join(cfg.DocsDir, "readme.md"),
			"./README.md",
			"./readme.md",
			"README.md",
		}
		for _, p := range candidates {
			if p == "" {
				continue
			}
			if b, err := os.ReadFile(p); err == nil && len(b) > 0 {
				c.Set("Content-Type", "text/markdown; charset=utf-8")
				return c.Send(b)
			}
		}
		if cfg.EmbeddedFS != nil {
			if b, err := LoadAsset(cfg.EmbeddedFS, "README.md"); err == nil && len(b) > 0 {
				c.Set("Content-Type", "text/markdown; charset=utf-8")
				return c.Send(b)
			}
		}
		c.Set("Content-Type", "text/markdown; charset=utf-8")
		return c.SendString("# " + cfg.Title + "\n\nWelcome to the API Documentation & Developer Portal.")
	})

	// Workspace Management APIs
	if cfg.EnableWorkspaces {
		app.Get("/docs/workspaces", func(c *fiber.Ctx) error {
			setFiberSecurityHeaders(c)
			list := wm.ListWorkspaces()
			return c.JSON(list)
		})
	}

	// Workspace Writes / Spec Import APIs (Gated by Authorizer + CSRF check)
	if cfg.EnableWorkspaceWrites {
		app.Post("/docs/workspaces", func(c *fiber.Ctx) error {
			setFiberSecurityHeaders(c)
			if !checkCSRFHeaderFiber(c) {
				return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "missing or invalid CSRF header"})
			}
			var ws Workspace
			if err := c.BodyParser(&ws); err != nil {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid workspace json payload"})
			}
			if err := wm.AddWorkspace(ws); err != nil {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
			}
			wm.LogAudit(AuditEvent{
				Action:    "workspace:create",
				Workspace: ws.ID,
				RemoteIP:  c.IP(),
				Status:    "SUCCESS",
			})
			return c.JSON(fiber.Map{"success": true, "workspace": ws})
		})

		app.Put("/docs/workspaces", func(c *fiber.Ctx) error {
			setFiberSecurityHeaders(c)
			if !checkCSRFHeaderFiber(c) {
				return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "missing or invalid CSRF header"})
			}
			var ws Workspace
			if err := c.BodyParser(&ws); err != nil {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid workspace json payload"})
			}
			if id := c.Query("id"); id != "" {
				ws.ID = id
			}
			if err := wm.UpdateWorkspace(ws); err != nil {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
			}
			wm.LogAudit(AuditEvent{
				Action:    "workspace:update",
				Workspace: ws.ID,
				RemoteIP:  c.IP(),
				Status:    "SUCCESS",
			})
			return c.JSON(fiber.Map{"success": true, "workspace": ws})
		})

		app.Delete("/docs/workspaces", func(c *fiber.Ctx) error {
			setFiberSecurityHeaders(c)
			if !checkCSRFHeaderFiber(c) {
				return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "missing or invalid CSRF header"})
			}
			wsID := c.Query("id")
			if wsID == "" {
				var body struct {
					ID string `json:"id"`
				}
				if err := c.BodyParser(&body); err == nil && body.ID != "" {
					wsID = body.ID
				}
			}
			if wsID == "" {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "workspace id is required"})
			}
			if err := wm.DeleteWorkspace(wsID); err != nil {
				return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": err.Error()})
			}
			wm.LogAudit(AuditEvent{
				Action:    "workspace:delete",
				Workspace: wsID,
				RemoteIP:  c.IP(),
				Status:    "SUCCESS",
			})
			return c.JSON(fiber.Map{"success": true, "message": "workspace deleted", "id": wsID})
		})

		app.Post("/docs/workspaces/import", func(c *fiber.Ctx) error {
			setFiberSecurityHeaders(c)
			if !checkCSRFHeaderFiber(c) {
				return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "missing or invalid CSRF header"})
			}

			bodyBytes := c.Body()
			if len(bodyBytes) == 0 {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "empty upload payload"})
			}

			parsed, standardizedJSON, err := ParseSpec(bytes.NewReader(bodyBytes), cfg.MaxSpecBytes)
			if err != nil {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": fmt.Sprintf("spec validation failed: %v", err)})
			}

			wsID := c.Query("ws", "default")
			svcID := c.Query("svc", sanitizeID(parsed.Title))
			if svcID == "" {
				svcID = fmt.Sprintf("api-%d", time.Now().Unix())
			}

			svc := APIService{
				ID:          svcID,
				Title:       parsed.Title,
				Version:     parsed.Version,
				Description: parsed.Description,
				Icon:        "⚡",
				Environments: map[string]string{
					"Local": "http://localhost:8080",
				},
			}

			savedSvc, err := wm.SaveImportedSpec(wsID, svc, standardizedJSON)
			if err != nil {
				return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
			}

			wm.LogAudit(AuditEvent{
				Action:    "workspace:import",
				Workspace: wsID,
				Service:   svcID,
				RemoteIP:  c.IP(),
				Status:    "SUCCESS",
			})

			return c.JSON(fiber.Map{
				"success": true,
				"service": savedSvc,
				"summary": parsed,
			})
		})
	}

	// QA Tracking & AI Test Generation APIs
	app.Get("/docs/qa/data", defaultQA.HandleGetData)
	app.Post("/docs/qa/record", defaultQA.HandleSaveRecord)
	app.Post("/docs/qa/reset", defaultQA.HandleResetData)
	app.Get("/docs/qa/report", defaultQA.HandleGetReport)
	app.Post("/docs/qa/ai-generate", defaultQA.HandleGenerateAITests)
	qaAdaptor := adaptor.HTTPHandlerFunc
	app.Post("/docs/qa/execute", qaAdaptor(defaultQA.HandleExecuteHTTP))
	app.Get("/docs/qa/reports", qaAdaptor(defaultQA.HandleReportsHTTP))
	app.Post("/docs/qa/reports", qaAdaptor(defaultQA.HandleReportsHTTP))
	app.Delete("/docs/qa/reports", qaAdaptor(defaultQA.HandleReportsHTTP))
	app.Post("/docs/qa/sequence", qaAdaptor(defaultQA.HandleSequenceHTTP))
	app.Post("/docs/qa/sequence/ai", qaAdaptor(defaultQA.HandleAISequenceHTTP))

	// Cybersecurity Audit Engine APIs
	if cfg.EnableSecurityAudit {
		app.Get("/docs/security/audit", func(c *fiber.Ctx) error {
			setFiberSecurityHeaders(c)
			wsID := c.Query("ws", "default")
			svcID := c.Query("svc", "default")

			var specMap map[string]any
			specBytes, err := wm.GetSpecData(wsID, svcID)
			if err == nil && len(specBytes) > 0 {
				_ = json.Unmarshal(specBytes, &specMap)
			}
			if specMap == nil {
				// Fallback to default spec file
				if defaultBytes, err := os.ReadFile(cfg.SpecFilePath); err == nil {
					_ = json.Unmarshal(defaultBytes, &specMap)
				}
			}

			if specMap == nil {
				return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "no valid spec found for security audit"})
			}

			auditResult := AnalyzeSpecSecurity(specMap)

			// Live header audit against configured environment if requested
			targetEnvURL := c.Query("target_url")
			if targetEnvURL != "" {
				// Verify target URL is in configured environments or allowed by policy
				safeClient := security.NewSafeHTTPClient(cfg.RemoteFetch)
				headerAudit, err := AuditLiveHeaders(c.Context(), safeClient, targetEnvURL)
				if err == nil {
					auditResult.HeaderAudit = headerAudit
				}
			}

			wm.LogAudit(AuditEvent{
				Action:    "security:audit",
				Workspace: wsID,
				Service:   svcID,
				RemoteIP:  c.IP(),
				Status:    "SUCCESS",
			})

			return c.JSON(auditResult)
		})
	}

	// Auth Guard & Session Routes
	docsGuard := WebAuthMiddleware(authEnabled, cfg.AuthUser, cfg.AuthPassword, cfg.JWTSecret)

	app.Get("/docs/login", func(c *fiber.Ctx) error {
		setFiberSecurityHeaders(c)
		if !authEnabled || cfg.AuthUser == "" {
			return c.Redirect("/docs")
		}
		cookieVal := c.Cookies(DocsSessionCookieName)
		if cookieVal != "" && VerifyDocsSessionToken(cookieVal, cfg.AuthUser, cfg.JWTSecret) {
			redirect := c.Query("redirect", "/docs")
			return c.Redirect(redirect)
		}
		return serveAsset(c, cfg.EmbeddedFS, "index.html")
	})

	app.Post("/docs/login", func(c *fiber.Ctx) error {
		setFiberSecurityHeaders(c)
		if !authEnabled || cfg.AuthUser == "" {
			return c.JSON(fiber.Map{"success": true, "message": "Authentication disabled"})
		}
		var req struct {
			Username string `json:"username"`
			Password string `json:"password"`
		}
		if err := c.BodyParser(&req); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"success": false, "message": "Invalid payload"})
		}
		if subtle.ConstantTimeCompare([]byte(req.Username), []byte(cfg.AuthUser)) != 1 ||
			!auth.CheckPassword(req.Password, cfg.AuthPassword, cfg.AuthPasswordHash) {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"success": false, "message": "Invalid username or password"})
		}

		token := GenerateDocsSessionToken(cfg.AuthUser, cfg.JWTSecret)
		c.Cookie(&fiber.Cookie{
			Name:     DocsSessionCookieName,
			Value:    token,
			Path:     "/",
			Expires:  time.Now().Add(24 * time.Hour),
			HTTPOnly: true,
			SameSite: "Lax",
		})
		return c.JSON(fiber.Map{"success": true, "message": "Authenticated successfully"})
	})

	app.Get("/docs/logout", func(c *fiber.Ctx) error {
		c.Cookie(&fiber.Cookie{
			Name:     DocsSessionCookieName,
			Value:    "",
			Path:     "/",
			Expires:  time.Now().Add(-1 * time.Hour),
			HTTPOnly: true,
		})
		return c.Redirect("/docs/login")
	})

	// React SPA Portal Routes
	spaHandler := func(c *fiber.Ctx) error {
		setFiberSecurityHeaders(c)
		return serveAsset(c, cfg.EmbeddedFS, "index.html")
	}

	app.Get("/", docsGuard, spaHandler)
	app.Get("/docs", docsGuard, spaHandler)
	app.Get("/docs/index.html", docsGuard, spaHandler)
	app.Get("/guide", docsGuard, spaHandler)
	app.Get("/pricing", docsGuard, spaHandler)
	app.Get("/dashboard", docsGuard, spaHandler)

	app.Get("/swagger", func(c *fiber.Ctx) error {
		return c.Redirect("/docs?" + string(c.Request().URI().QueryString()))
	})

	// Static Assets (Serving React bundle)
	if cfg.EmbeddedFS != nil {
		app.Use("/docs", filesystem.New(filesystem.Config{
			Root:       http.FS(cfg.EmbeddedFS),
			PathPrefix: "dist",
			Browse:     false,
		}))
		app.Use("/assets", filesystem.New(filesystem.Config{
			Root:       http.FS(cfg.EmbeddedFS),
			PathPrefix: "dist/assets",
			Browse:     false,
		}))
	}
}

// MountChi attaches all documentation, login, QA tracker, Workspace Hub, and Swagger UI routes to a Chi router.
func MountChi(r chi.Router, cfg Config) {
	cfg, wm, authEnabled, err := NormalizeConfig(cfg)
	if err != nil {
		panic(fmt.Sprintf("go-apidocs initialization failed: %v", err))
	}

	aiClient := buildAIDispatcher(cfg)
	defaultFilter := schema.NewSpecFilter(cfg.SpecFilePath, cfg.DocsDir, cfg.PathsDir, cfg.ModuleTagMap, nil)
	defaultQA := qa.NewQATracker(cfg.QAStoragePath, cfg.Title, aiClient)
	authGuard := HTTPAuthMiddleware(authEnabled, cfg.AuthUser, cfg.AuthPassword, cfg.JWTSecret)
	assetServer := NewAssetFileServer(cfg.EmbeddedFS)

	// Capabilities API
	r.Get("/docs/capabilities", func(w http.ResponseWriter, req *http.Request) {
		setSecurityHeaders(w)
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(w).Encode(Capabilities{
			WorkspacesEnabled:      cfg.EnableWorkspaces,
			WorkspaceWritesEnabled: cfg.EnableWorkspaceWrites,
			SecurityAuditEnabled:   cfg.EnableSecurityAudit,
			LiveSpecEditingEnabled: cfg.EnableLiveSpecEditing,
			RemoteFetchEnabled:     cfg.RemoteFetch.Enabled,
			RemoteFetchPolicy:      cfg.RemoteFetch,
			MaxSpecBytes:           cfg.MaxSpecBytes,
		})
	})

	// Workspace Unlock & Invitation APIs
	r.Post("/docs/workspaces/unlock", WorkspaceUnlockHandler(cfg, wm))
	r.Post("/docs/workspaces/invite", WorkspaceInviteHandler(cfg, wm))
	r.Get("/docs/workspaces/accept-invite", WorkspaceAcceptInviteHandler(cfg))

	// Live Spec Editing APIs
	r.Get("/docs/workspaces/spec/raw", SpecRawHandler(cfg, wm))
	r.Put("/docs/workspaces/spec", SpecSaveHandler(cfg, wm))

	// Swagger JSON routes
	r.Get("/docs/swagger.json", SwaggerJSONHandler(cfg, wm, defaultFilter))
	r.Get("/swagger/swagger.json", SwaggerJSONHandler(cfg, wm, defaultFilter))
	r.Get("/swagger.json", SwaggerJSONHandler(cfg, wm, defaultFilter))

	// Navigation, Readme & Markdown Documents APIs
	r.Get("/docs/nav", NavHandler(cfg))
	r.Get("/docs/readme", ReadmeHandler(cfg, wm))
	r.Get("/docs/markdown-docs", MarkdownDocsHandler(wm))

	// Workspace Management APIs
	if cfg.EnableWorkspaces {
		r.Get("/docs/workspaces", WorkspacesListHandler(cfg, wm))
	}
	if cfg.EnableWorkspaceWrites {
		r.Post("/docs/workspaces", WorkspaceCreateHandler(wm))
		r.Put("/docs/workspaces", WorkspaceUpdateHandler(wm))
		r.Delete("/docs/workspaces", WorkspaceDeleteHandler(wm))
		r.Post("/docs/workspaces/import", WorkspaceImportHandler(cfg, wm))
	}
	if cfg.EnableSecurityAudit {
		r.Get("/docs/security/audit", SecurityAuditHandler(cfg, wm))
	}

	// QA Tracking, Reports & AI Test Generation
	r.Get("/docs/qa/data", defaultQA.HandleGetDataHTTP)
	r.Post("/docs/qa/record", defaultQA.HandleSaveRecordHTTP)
	r.Post("/docs/qa/reset", defaultQA.HandleResetDataHTTP)
	r.Get("/docs/qa/report", defaultQA.HandleGetReportHTTP)
	r.Post("/docs/qa/ai-generate", defaultQA.HandleGenerateAITestsHTTP)
	r.Post("/docs/qa/execute", defaultQA.HandleExecuteHTTP)
	r.Get("/docs/qa/reports", defaultQA.HandleReportsHTTP)
	r.Post("/docs/qa/reports", defaultQA.HandleReportsHTTP)
	r.Delete("/docs/qa/reports", defaultQA.HandleReportsHTTP)
	r.Post("/docs/qa/sequence", defaultQA.HandleSequenceHTTP)
	r.Post("/docs/qa/sequence/ai", defaultQA.HandleAISequenceHTTP)

	// Login & Session Routes
	r.Get("/docs/login", LoginHandler(cfg, authEnabled))
	r.Post("/docs/login", LoginHandler(cfg, authEnabled))
	r.Get("/docs/logout", LogoutHandler())
	r.Get("/swagger", SwaggerRedirectHandler())

	// Documentation Portals with Auth Gate (React SPA)
	r.Group(func(gr chi.Router) {
		gr.Use(authGuard)
		gr.Get("/", SPAHandler(cfg))
		gr.Get("/docs", SPAHandler(cfg))
		gr.Get("/docs/index.html", SPAHandler(cfg))
		gr.Get("/guide", SPAHandler(cfg))
		gr.Get("/pricing", SPAHandler(cfg))
		gr.Get("/dashboard", SPAHandler(cfg))
	})

	// Static Assets
	r.Get("/docs/*", func(w http.ResponseWriter, req *http.Request) {
		subpath := chi.URLParam(req, "*")
		if subpath == "" || subpath == "index.html" {
			authGuard(SPAHandler(cfg)).ServeHTTP(w, req)
			return
		}
		assetServer.ServeHTTP(w, req)
	})
	r.Get("/assets/*", assetServer.ServeHTTP)
}

// MountGin attaches all documentation, login, QA tracker, Workspace Hub, and Swagger UI routes to a Gin engine or router group.
func MountGin(r gin.IRoutes, cfg Config) {
	cfg, wm, authEnabled, err := NormalizeConfig(cfg)
	if err != nil {
		panic(fmt.Sprintf("go-apidocs initialization failed: %v", err))
	}

	aiClient := buildAIDispatcher(cfg)
	defaultFilter := schema.NewSpecFilter(cfg.SpecFilePath, cfg.DocsDir, cfg.PathsDir, cfg.ModuleTagMap, nil)
	defaultQA := qa.NewQATracker(cfg.QAStoragePath, cfg.Title, aiClient)
	authGuard := GinAuthMiddleware(authEnabled, cfg.AuthUser, cfg.AuthPassword, cfg.JWTSecret)
	assetServer := NewAssetFileServer(cfg.EmbeddedFS)

	// Capabilities API
	r.GET("/docs/capabilities", gin.WrapF(func(w http.ResponseWriter, req *http.Request) {
		setSecurityHeaders(w)
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(w).Encode(Capabilities{
			WorkspacesEnabled:      cfg.EnableWorkspaces,
			WorkspaceWritesEnabled: cfg.EnableWorkspaceWrites,
			SecurityAuditEnabled:   cfg.EnableSecurityAudit,
			LiveSpecEditingEnabled: cfg.EnableLiveSpecEditing,
			RemoteFetchEnabled:     cfg.RemoteFetch.Enabled,
			RemoteFetchPolicy:      cfg.RemoteFetch,
			MaxSpecBytes:           cfg.MaxSpecBytes,
		})
	}))

	// Workspace Unlock & Invitation APIs
	r.POST("/docs/workspaces/unlock", gin.WrapF(WorkspaceUnlockHandler(cfg, wm)))
	r.POST("/docs/workspaces/invite", gin.WrapF(WorkspaceInviteHandler(cfg, wm)))
	r.GET("/docs/workspaces/accept-invite", gin.WrapF(WorkspaceAcceptInviteHandler(cfg)))

	// Live Spec Editing APIs
	r.GET("/docs/workspaces/spec/raw", gin.WrapF(SpecRawHandler(cfg, wm)))
	r.PUT("/docs/workspaces/spec", gin.WrapF(SpecSaveHandler(cfg, wm)))

	// Swagger JSON routes
	r.GET("/docs/swagger.json", gin.WrapF(SwaggerJSONHandler(cfg, wm, defaultFilter)))
	r.GET("/swagger/swagger.json", gin.WrapF(SwaggerJSONHandler(cfg, wm, defaultFilter)))
	r.GET("/swagger.json", gin.WrapF(SwaggerJSONHandler(cfg, wm, defaultFilter)))

	// Navigation, Readme & Markdown Documents APIs
	r.GET("/docs/nav", gin.WrapF(NavHandler(cfg)))
	r.GET("/docs/readme", gin.WrapF(ReadmeHandler(cfg, wm)))
	r.GET("/docs/markdown-docs", gin.WrapF(MarkdownDocsHandler(wm)))

	// Workspace Management APIs
	if cfg.EnableWorkspaces {
		r.GET("/docs/workspaces", gin.WrapF(WorkspacesListHandler(cfg, wm)))
	}
	if cfg.EnableWorkspaceWrites {
		r.POST("/docs/workspaces", gin.WrapF(WorkspaceCreateHandler(wm)))
		r.PUT("/docs/workspaces", gin.WrapF(WorkspaceUpdateHandler(wm)))
		r.DELETE("/docs/workspaces", gin.WrapF(WorkspaceDeleteHandler(wm)))
		r.POST("/docs/workspaces/import", gin.WrapF(WorkspaceImportHandler(cfg, wm)))
	}
	if cfg.EnableSecurityAudit {
		r.GET("/docs/security/audit", gin.WrapF(SecurityAuditHandler(cfg, wm)))
	}

	// QA Tracking, Reports & AI Test Generation
	r.GET("/docs/qa/data", gin.WrapF(defaultQA.HandleGetDataHTTP))
	r.POST("/docs/qa/record", gin.WrapF(defaultQA.HandleSaveRecordHTTP))
	r.POST("/docs/qa/reset", gin.WrapF(defaultQA.HandleResetDataHTTP))
	r.GET("/docs/qa/report", gin.WrapF(defaultQA.HandleGetReportHTTP))
	r.POST("/docs/qa/ai-generate", gin.WrapF(defaultQA.HandleGenerateAITestsHTTP))
	r.POST("/docs/qa/execute", gin.WrapF(defaultQA.HandleExecuteHTTP))
	r.GET("/docs/qa/reports", gin.WrapF(defaultQA.HandleReportsHTTP))
	r.POST("/docs/qa/reports", gin.WrapF(defaultQA.HandleReportsHTTP))
	r.DELETE("/docs/qa/reports", gin.WrapF(defaultQA.HandleReportsHTTP))
	r.POST("/docs/qa/sequence", gin.WrapF(defaultQA.HandleSequenceHTTP))
	r.POST("/docs/qa/sequence/ai", gin.WrapF(defaultQA.HandleAISequenceHTTP))

	// Login & Session Routes
	r.GET("/docs/login", gin.WrapF(LoginHandler(cfg, authEnabled)))
	r.POST("/docs/login", gin.WrapF(LoginHandler(cfg, authEnabled)))
	r.GET("/docs/logout", gin.WrapF(LogoutHandler()))
	r.GET("/swagger", gin.WrapF(SwaggerRedirectHandler()))

	// Documentation Portals with Auth Gate (React SPA)
	spaGin := gin.WrapF(SPAHandler(cfg))
	r.GET("/", authGuard, spaGin)
	r.GET("/docs", authGuard, spaGin)
	r.GET("/docs/index.html", authGuard, spaGin)
	r.GET("/guide", authGuard, spaGin)
	r.GET("/pricing", authGuard, spaGin)
	r.GET("/dashboard", authGuard, spaGin)

	// Static Assets (React Bundles)
	r.GET("/assets/*filepath", gin.WrapH(assetServer))
}

// MountNetHTTP attaches documentation and workspace routes to a standard http.ServeMux.
func MountNetHTTP(mux *http.ServeMux, cfg Config) {
	cfg, wm, authEnabled, err := NormalizeConfig(cfg)
	if err != nil {
		panic(fmt.Sprintf("go-apidocs initialization failed: %v", err))
	}

	aiClient := buildAIDispatcher(cfg)
	defaultFilter := schema.NewSpecFilter(cfg.SpecFilePath, cfg.DocsDir, cfg.PathsDir, cfg.ModuleTagMap, nil)
	defaultQA := qa.NewQATracker(cfg.QAStoragePath, cfg.Title, aiClient)
	authGuard := HTTPAuthMiddleware(authEnabled, cfg.AuthUser, cfg.AuthPassword, cfg.JWTSecret)
	assetServer := NewAssetFileServer(cfg.EmbeddedFS)

	// Capabilities API
	mux.HandleFunc("/docs/capabilities", func(w http.ResponseWriter, req *http.Request) {
		setSecurityHeaders(w)
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(w).Encode(Capabilities{
			WorkspacesEnabled:      cfg.EnableWorkspaces,
			WorkspaceWritesEnabled: cfg.EnableWorkspaceWrites,
			SecurityAuditEnabled:   cfg.EnableSecurityAudit,
			LiveSpecEditingEnabled: cfg.EnableLiveSpecEditing,
			RemoteFetchEnabled:     cfg.RemoteFetch.Enabled,
			RemoteFetchPolicy:      cfg.RemoteFetch,
			MaxSpecBytes:           cfg.MaxSpecBytes,
		})
	})

	// Workspace Unlock & Invitation APIs
	mux.HandleFunc("/docs/workspaces/unlock", WorkspaceUnlockHandler(cfg, wm))
	mux.HandleFunc("/docs/workspaces/invite", WorkspaceInviteHandler(cfg, wm))
	mux.HandleFunc("/docs/workspaces/accept-invite", WorkspaceAcceptInviteHandler(cfg))

	// Live Spec Editing APIs
	mux.HandleFunc("/docs/workspaces/spec/raw", SpecRawHandler(cfg, wm))
	mux.HandleFunc("/docs/workspaces/spec", SpecSaveHandler(cfg, wm))

	// Swagger JSON
	mux.HandleFunc("/docs/swagger.json", SwaggerJSONHandler(cfg, wm, defaultFilter))
	mux.HandleFunc("/swagger/swagger.json", SwaggerJSONHandler(cfg, wm, defaultFilter))
	mux.HandleFunc("/swagger.json", SwaggerJSONHandler(cfg, wm, defaultFilter))

	// Nav, Readme, Markdown Documents & QA APIs
	mux.HandleFunc("/docs/nav", NavHandler(cfg))
	mux.HandleFunc("/docs/readme", ReadmeHandler(cfg, wm))
	mux.HandleFunc("/docs/markdown-docs", MarkdownDocsHandler(wm))
	mux.HandleFunc("/docs/qa/data", defaultQA.HandleGetDataHTTP)
	mux.HandleFunc("/docs/qa/record", defaultQA.HandleSaveRecordHTTP)
	mux.HandleFunc("/docs/qa/reset", defaultQA.HandleResetDataHTTP)
	mux.HandleFunc("/docs/qa/report", defaultQA.HandleGetReportHTTP)
	mux.HandleFunc("/docs/qa/ai-generate", defaultQA.HandleGenerateAITestsHTTP)
	mux.HandleFunc("/docs/qa/execute", defaultQA.HandleExecuteHTTP)
	mux.HandleFunc("/docs/qa/reports", defaultQA.HandleReportsHTTP)
	mux.HandleFunc("/docs/qa/sequence", defaultQA.HandleSequenceHTTP)
	mux.HandleFunc("/docs/qa/sequence/ai", defaultQA.HandleAISequenceHTTP)

	// Live Dynamic Mock API Server (synthesized directly from OpenAPI schemas)
	mockServer := schema.NewMockServer(defaultFilter)
	mux.Handle("/docs/mock/", http.StripPrefix("/docs/mock", mockServer))
	mux.Handle("/docs/mock", mockServer)

	// Client SDK Generator (TypeScript, Go, Python)
	mux.HandleFunc("/docs/sdk", func(w http.ResponseWriter, r *http.Request) {
		setSecurityHeaders(w)
		specMap, err := defaultFilter.FilterSpec("", "")
		if err != nil {
			http.Error(w, "Failed to load OpenAPI spec: "+err.Error(), http.StatusInternalServerError)
			return
		}

		lang := schema.SDKLanguage(r.URL.Query().Get("lang"))
		if lang == "" {
			lang = schema.SDKTypeScript
		}
		baseURL := r.URL.Query().Get("base_url")

		code, filename, err := schema.GenerateClientSDK(specMap, lang, baseURL)
		if err != nil {
			http.Error(w, "SDK generation error: "+err.Error(), http.StatusBadRequest)
			return
		}

		if r.URL.Query().Get("download") == "1" {
			w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
			w.Header().Set("Content-Type", "text/plain; charset=utf-8")
			_, _ = w.Write([]byte(code))
			return
		}

		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"language": lang,
			"filename": filename,
			"code":     code,
		})
	})

	// Workspace APIs
	if cfg.EnableWorkspaces {
		mux.HandleFunc("/docs/workspaces", func(w http.ResponseWriter, r *http.Request) {
			if cfg.EnableWorkspaceWrites {
				switch r.Method {
				case http.MethodPost:
					WorkspaceCreateHandler(wm)(w, r)
					return
				case http.MethodPut, http.MethodPatch:
					WorkspaceUpdateHandler(wm)(w, r)
					return
				case http.MethodDelete:
					WorkspaceDeleteHandler(wm)(w, r)
					return
				}
			}
			WorkspacesListHandler(cfg, wm)(w, r)
		})
	}
	if cfg.EnableWorkspaceWrites {
		mux.HandleFunc("/docs/workspaces/create", WorkspaceCreateHandler(wm))
		mux.HandleFunc("/docs/workspaces/update", WorkspaceUpdateHandler(wm))
		mux.HandleFunc("/docs/workspaces/delete", WorkspaceDeleteHandler(wm))
		mux.HandleFunc("/docs/workspaces/import", WorkspaceImportHandler(cfg, wm))
	}
	if cfg.EnableSecurityAudit {
		mux.HandleFunc("/docs/security/audit", SecurityAuditHandler(cfg, wm))
	}

	// Login & Session
	mux.HandleFunc("/docs/login", LoginHandler(cfg, authEnabled))
	mux.HandleFunc("/docs/logout", LogoutHandler())
	mux.HandleFunc("/swagger", SwaggerRedirectHandler())

	// Protected React SPA portals & Client Routes
	spa := authGuard(SPAHandler(cfg))
	mux.Handle("/", authGuard(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		p := req.URL.Path
		if p == "/" || p == "/landing" || p == "/login" || p == "/register" || p == "/guide" || p == "/pricing" || p == "/dashboard" || p == "/docs" {
			SPAHandler(cfg)(w, req)
			return
		}
		// If path doesn't look like a static asset file with an extension, fallback to React SPA router
		if !strings.Contains(filepath.Base(p), ".") {
			SPAHandler(cfg)(w, req)
			return
		}
		assetServer.ServeHTTP(w, req)
	})))
	mux.Handle("/docs", spa)
	mux.Handle("/docs/", authGuard(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		if req.URL.Path == "/docs/" || req.URL.Path == "/docs/index.html" || req.URL.Path == "/docs/login" || req.URL.Path == "/docs/register" {
			SPAHandler(cfg)(w, req)
			return
		}
		assetServer.ServeHTTP(w, req)
	})))
	mux.Handle("/login", spa)
	mux.Handle("/register", spa)
	mux.Handle("/guide", spa)
	mux.Handle("/pricing", spa)
	mux.Handle("/dashboard", spa)
	mux.Handle("/assets/", assetServer)
}

// Handler returns a standalone http.Handler implementing all documentation and QA endpoints.
func Handler(cfg Config) http.Handler {
	mux := http.NewServeMux()
	MountNetHTTP(mux, cfg)
	return mux
}

// Common Reusable HTTP Handlers

// SwaggerJSONHandler resolves spec bytes from workspace cache/storage or defaults to static filter.
func SwaggerJSONHandler(cfg Config, wm *WorkspaceManager, defaultFilter *SpecFilter) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		setSecurityHeaders(w)
		wsID := r.URL.Query().Get("ws")
		svcID := r.URL.Query().Get("svc")

		if wsID != "" && svcID != "" && cfg.EnableWorkspaces && wm != nil {
			// Tenant isolation: locked workspaces require a session whose token
			// records this workspace as unlocked (via passcode or invite).
			if !wm.IsWorkspaceUnlocked(wsID, sessionUnlockedWorkspaces(r, cfg.JWTSecret)) {
				w.Header().Set("Content-Type", "application/json; charset=utf-8")
				w.WriteHeader(http.StatusLocked)
				_, _ = w.Write([]byte(`{"error":"workspace is locked","workspace":"` + wsID + `","unlock":"POST /docs/workspaces/unlock"}`))
				return
			}
			data, err := wm.GetSpecData(wsID, svcID)
			if err == nil && len(data) > 0 {
				w.Header().Set("Content-Type", "application/json; charset=utf-8")
				w.WriteHeader(http.StatusOK)
				_, _ = w.Write(data)
				return
			}
		}
		defaultFilter.ServeHTTP(w, r)
	}
}

// sessionUnlockedWorkspaces extracts the verified unlocked-workspace list from
// the session cookie. Missing/invalid cookies yield nil (locked until proven).
func sessionUnlockedWorkspaces(r *http.Request, secret string) []string {
	c, err := r.Cookie(DocsSessionCookieName)
	if err != nil || c == nil || c.Value == "" {
		return nil
	}
	if sess, ok := auth.ParseAndVerifySessionToken(c.Value, "", secret); ok && sess != nil {
		return sess.UnlockedWorkspaces
	}
	return nil
}

// WorkspacesListHandler returns list of all workspaces, annotated with the
// per-session unlock state (is_unlocked) so the UI restores unlocked
// workspaces across page reloads without exposing passcodes.
func WorkspacesListHandler(cfg Config, wm *WorkspaceManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		setSecurityHeaders(w)
		unlocked := sessionUnlockedWorkspaces(r, cfg.JWTSecret)
		workspaces := wm.ListWorkspaces()
		out := make([]map[string]any, 0, len(workspaces))
		for _, ws := range workspaces {
			// Serialize the workspace without the passcode, then annotate.
			data, err := json.Marshal(ws)
			if err != nil {
				continue
			}
			var m map[string]any
			if err := json.Unmarshal(data, &m); err != nil {
				continue
			}
			m["is_unlocked"] = wm.IsWorkspaceUnlocked(ws.ID, unlocked)
			out = append(out, m)
		}
		_ = json.NewEncoder(w).Encode(out)
	}
}

// WorkspaceCreateHandler creates a new workspace.
func WorkspaceCreateHandler(wm *WorkspaceManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		setSecurityHeaders(w)
		if !checkCSRFHeader(r) {
			http.Error(w, "missing or invalid CSRF header", http.StatusForbidden)
			return
		}

		var ws Workspace
		if err := json.NewDecoder(r.Body).Decode(&ws); err != nil {
			http.Error(w, "invalid payload", http.StatusBadRequest)
			return
		}
		if err := wm.AddWorkspace(ws); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(w).Encode(map[string]any{"success": true, "workspace": ws})
	}
}

// WorkspaceUpdateHandler modifies an existing workspace.
func WorkspaceUpdateHandler(wm *WorkspaceManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		setSecurityHeaders(w)
		if !checkCSRFHeader(r) {
			http.Error(w, "missing or invalid CSRF header", http.StatusForbidden)
			return
		}

		var ws Workspace
		if err := json.NewDecoder(r.Body).Decode(&ws); err != nil {
			http.Error(w, "invalid payload", http.StatusBadRequest)
			return
		}

		wsID := r.URL.Query().Get("id")
		if wsID != "" {
			ws.ID = wsID
		}

		if err := wm.UpdateWorkspace(ws); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(w).Encode(map[string]any{"success": true, "workspace": ws})
	}
}

// WorkspaceDeleteHandler deletes a workspace by ID.
func WorkspaceDeleteHandler(wm *WorkspaceManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		setSecurityHeaders(w)
		if !checkCSRFHeader(r) {
			http.Error(w, "missing or invalid CSRF header", http.StatusForbidden)
			return
		}

		wsID := r.URL.Query().Get("id")
		if wsID == "" {
			var body struct {
				ID string `json:"id"`
			}
			if err := json.NewDecoder(r.Body).Decode(&body); err == nil {
				wsID = body.ID
			}
		}

		if wsID == "" {
			http.Error(w, "workspace id is required", http.StatusBadRequest)
			return
		}

		if err := wm.DeleteWorkspace(wsID); err != nil {
			http.Error(w, err.Error(), http.StatusNotFound)
			return
		}

		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(w).Encode(map[string]any{"success": true, "message": "workspace deleted", "id": wsID})
	}
}

// WorkspaceImportHandler parses and imports an OpenAPI spec.
func WorkspaceImportHandler(cfg Config, wm *WorkspaceManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		setSecurityHeaders(w)
		if !checkCSRFHeader(r) {
			http.Error(w, "missing or invalid CSRF header", http.StatusForbidden)
			return
		}

		parsed, standardizedJSON, err := ParseSpec(r.Body, cfg.MaxSpecBytes)
		if err != nil {
			http.Error(w, fmt.Sprintf("spec validation failed: %v", err), http.StatusBadRequest)
			return
		}

		wsID := r.URL.Query().Get("ws")
		if wsID == "" {
			wsID = "default"
		}
		svcID := r.URL.Query().Get("svc")
		if svcID == "" {
			svcID = sanitizeID(parsed.Title)
		}

		// Tenant isolation: cannot import into a locked workspace without unlock.
		if !wm.IsWorkspaceUnlocked(wsID, sessionUnlockedWorkspaces(r, cfg.JWTSecret)) {
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			w.WriteHeader(http.StatusLocked)
			_, _ = w.Write([]byte(`{"error":"workspace is locked","workspace":"` + wsID + `","unlock":"POST /docs/workspaces/unlock"}`))
			return
		}

		svc := APIService{
			ID:          svcID,
			Title:       parsed.Title,
			Version:     parsed.Version,
			Description: parsed.Description,
			Icon:        "⚡",
			Environments: map[string]string{
				"Local": "http://localhost:8080",
			},
		}

		savedSvc, err := wm.SaveImportedSpec(wsID, svc, standardizedJSON)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"success": true,
			"service": savedSvc,
			"summary": parsed,
		})
	}
}

// WorkspaceUnlockHandler handles unlocking a PIN/passcode-locked workspace.
// Includes per-IP+workspace brute-force protection: 5 failed attempts triggers
// a 15-minute cooldown for that combination.
func WorkspaceUnlockHandler(cfg Config, wm *WorkspaceManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		setSecurityHeaders(w)
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var req struct {
			WorkspaceID string `json:"workspace_id"`
			Passcode    string `json:"passcode"`
		}
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64<<10)).Decode(&req); err != nil {
			http.Error(w, "invalid payload", http.StatusBadRequest)
			return
		}
		if req.WorkspaceID == "" {
			http.Error(w, "workspace_id is required", http.StatusBadRequest)
			return
		}

		// Brute-force guard: cap attempts per client IP + workspace.
		clientIP := clientIPFrom(r)
		if !unlockAttemptLimiter.Allow(clientIP + ":" + req.WorkspaceID) {
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			w.Header().Set("Retry-After", "900")
			w.WriteHeader(http.StatusTooManyRequests)
			_, _ = w.Write([]byte(`{"success":false,"message":"Too many unlock attempts. Try again in 15 minutes."}`))
			return
		}

		unlocked, err := wm.UnlockWorkspace(req.WorkspaceID, req.Passcode)
		if err != nil {
			http.Error(w, err.Error(), http.StatusNotFound)
			return
		}
		if !unlocked {
			unlockAttemptLimiter.Fail(clientIP + ":" + req.WorkspaceID)
			w.WriteHeader(http.StatusUnauthorized)
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			_ = json.NewEncoder(w).Encode(map[string]any{"success": false, "message": "Invalid passcode"})
			return
		}

		// Success: reset the attempt counter for this client+workspace.
		unlockAttemptLimiter.Reset(clientIP + ":" + req.WorkspaceID)

		// Update session cookie with newly unlocked workspace
		var unlockedList []string
		username := cfg.AuthUser
		if cookie, err := r.Cookie(DocsSessionCookieName); err == nil && cookie != nil && cookie.Value != "" {
			if sess, ok := auth.ParseAndVerifySessionToken(cookie.Value, "", cfg.JWTSecret); ok && sess != nil {
				unlockedList = sess.UnlockedWorkspaces
				if sess.Username != "" {
					username = sess.Username
				}
			}
		}

		already := false
		for _, u := range unlockedList {
			if u == req.WorkspaceID {
				already = true
				break
			}
		}
		if !already {
			unlockedList = append(unlockedList, req.WorkspaceID)
		}

		newToken := auth.GenerateDocsSessionToken(username, cfg.JWTSecret, unlockedList...)
		http.SetCookie(w, &http.Cookie{
			Name:     DocsSessionCookieName,
			Value:    newToken,
			Path:     "/",
			Expires:  time.Now().Add(24 * time.Hour),
			HttpOnly: true,
			SameSite: http.SameSiteLaxMode,
		})

		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"success":   true,
			"message":   "Workspace unlocked successfully",
			"workspace": req.WorkspaceID,
		})
	}
}

// WorkspaceInviteHandler creates a signed invitation link for a workspace.
func WorkspaceInviteHandler(cfg Config, wm *WorkspaceManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		setSecurityHeaders(w)
		if !checkCSRFHeader(r) {
			http.Error(w, "missing or invalid CSRF header", http.StatusForbidden)
			return
		}
		var req struct {
			WorkspaceID string `json:"workspace_id"`
			DurationSec int64  `json:"duration_sec"` // Duration in seconds, defaults to 7 days
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid payload", http.StatusBadRequest)
			return
		}
		if req.WorkspaceID == "" {
			http.Error(w, "workspace_id is required", http.StatusBadRequest)
			return
		}
		if _, err := wm.GetWorkspace(req.WorkspaceID); err != nil {
			http.Error(w, "workspace not found", http.StatusNotFound)
			return
		}

		dur := time.Duration(req.DurationSec) * time.Second
		if dur <= 0 {
			dur = 7 * 24 * time.Hour
		}

		inviteToken := auth.GenerateInviteToken(req.WorkspaceID, cfg.JWTSecret, dur)
		inviteLink := fmt.Sprintf("/docs/workspaces/accept-invite?token=%s", inviteToken)

		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"success":      true,
			"token":        inviteToken,
			"invite_link":  inviteLink,
			"expires_in":   int64(dur.Seconds()),
			"workspace_id": req.WorkspaceID,
		})
	}
}

// WorkspaceAcceptInviteHandler accepts a signed invitation link, unlocks access, and redirects to docs.
func WorkspaceAcceptInviteHandler(cfg Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		setSecurityHeaders(w)
		token := r.URL.Query().Get("token")
		if token == "" {
			http.Error(w, "token is required", http.StatusBadRequest)
			return
		}

		wsID, valid := auth.VerifyInviteToken(token, cfg.JWTSecret)
		if !valid || wsID == "" {
			http.Error(w, "invalid or expired invitation token", http.StatusUnauthorized)
			return
		}

		var unlockedList []string
		username := cfg.AuthUser
		if cookie, err := r.Cookie(DocsSessionCookieName); err == nil && cookie != nil && cookie.Value != "" {
			if sess, ok := auth.ParseAndVerifySessionToken(cookie.Value, "", cfg.JWTSecret); ok && sess != nil {
				unlockedList = sess.UnlockedWorkspaces
				if sess.Username != "" {
					username = sess.Username
				}
			}
		}

		already := false
		for _, u := range unlockedList {
			if u == wsID {
				already = true
				break
			}
		}
		if !already {
			unlockedList = append(unlockedList, wsID)
		}

		newToken := auth.GenerateDocsSessionToken(username, cfg.JWTSecret, unlockedList...)
		http.SetCookie(w, &http.Cookie{
			Name:     DocsSessionCookieName,
			Value:    newToken,
			Path:     "/",
			Expires:  time.Now().Add(24 * time.Hour),
			HttpOnly: true,
			SameSite: http.SameSiteLaxMode,
		})

		http.Redirect(w, r, fmt.Sprintf("/docs?ws=%s", wsID), http.StatusFound)
	}
}

// SpecRawHandler returns the raw OpenAPI JSON/YAML for in-browser editing.
func SpecRawHandler(cfg Config, wm *WorkspaceManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		setSecurityHeaders(w)
		wsID := r.URL.Query().Get("ws")
		if wsID == "" {
			wsID = "default"
		}
		svcID := r.URL.Query().Get("svc")
		if svcID == "" {
			svcID = "default"
		}

		// Tenant isolation: locked workspaces require a verified unlocked session.
		if wm != nil && !wm.IsWorkspaceUnlocked(wsID, sessionUnlockedWorkspaces(r, cfg.JWTSecret)) {
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			w.WriteHeader(http.StatusLocked)
			_, _ = w.Write([]byte(`{"error":"workspace is locked","workspace":"` + wsID + `","unlock":"POST /docs/workspaces/unlock"}`))
			return
		}

		var specBytes []byte
		var err error
		if wm != nil {
			specBytes, err = wm.GetSpecData(wsID, svcID)
		}
		if err != nil || len(specBytes) == 0 {
			specBytes, err = os.ReadFile(cfg.SpecFilePath)
		}
		if err != nil || len(specBytes) == 0 {
			http.Error(w, "spec not found", http.StatusNotFound)
			return
		}

		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_, _ = w.Write(specBytes)
	}
}

// SpecSaveHandler saves edited OpenAPI spec data atomically with history backup.
func SpecSaveHandler(cfg Config, wm *WorkspaceManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		setSecurityHeaders(w)
		if !checkCSRFHeader(r) {
			http.Error(w, "missing or invalid CSRF header", http.StatusForbidden)
			return
		}
		if !cfg.EnableLiveSpecEditing {
			http.Error(w, "live spec editing is disabled", http.StatusForbidden)
			return
		}

		var req struct {
			WorkspaceID string `json:"workspace_id"`
			ServiceID   string `json:"service_id"`
			Content     string `json:"content"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid payload", http.StatusBadRequest)
			return
		}

		if req.WorkspaceID == "" {
			req.WorkspaceID = "default"
		}
		if req.ServiceID == "" {
			req.ServiceID = "default"
		}
		if strings.TrimSpace(req.Content) == "" {
			http.Error(w, "spec content cannot be empty", http.StatusBadRequest)
			return
		}

		// Tenant isolation: cannot edit specs inside a locked workspace.
		if wm != nil && !wm.IsWorkspaceUnlocked(req.WorkspaceID, sessionUnlockedWorkspaces(r, cfg.JWTSecret)) {
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			w.WriteHeader(http.StatusLocked)
			_, _ = w.Write([]byte(`{"error":"workspace is locked","workspace":"` + req.WorkspaceID + `","unlock":"POST /docs/workspaces/unlock"}`))
			return
		}

		parsed, standardizedJSON, err := ParseSpec(strings.NewReader(req.Content), cfg.MaxSpecBytes)
		if err != nil {
			http.Error(w, fmt.Sprintf("spec validation failed: %v", err), http.StatusBadRequest)
			return
		}

		if err := wm.SaveLiveSpec(req.WorkspaceID, req.ServiceID, standardizedJSON); err != nil {
			http.Error(w, fmt.Sprintf("failed saving live spec: %v", err), http.StatusInternalServerError)
			return
		}

		wm.LogAudit(AuditEvent{
			Action:    "spec:live_edit",
			Workspace: req.WorkspaceID,
			Service:   req.ServiceID,
			RemoteIP:  r.RemoteAddr,
			Status:    "SUCCESS",
			Details:   fmt.Sprintf("Saved live spec: %s (v%s)", parsed.Title, parsed.Version),
		})

		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"success": true,
			"message": "Spec saved successfully",
			"summary": parsed,
		})
	}
}

// SecurityAuditHandler runs static spec and live header security analysis.
func SecurityAuditHandler(cfg Config, wm *WorkspaceManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		setSecurityHeaders(w)
		wsID := r.URL.Query().Get("ws")
		if wsID == "" {
			wsID = "default"
		}
		svcID := r.URL.Query().Get("svc")
		if svcID == "" {
			svcID = "default"
		}

		var specMap map[string]any
		specBytes, err := wm.GetSpecData(wsID, svcID)
		if err == nil && len(specBytes) > 0 {
			_ = json.Unmarshal(specBytes, &specMap)
		}
		if specMap == nil {
			if defaultBytes, err := os.ReadFile(cfg.SpecFilePath); err == nil {
				_ = json.Unmarshal(defaultBytes, &specMap)
			}
		}

		if specMap == nil {
			http.Error(w, "no valid spec found for security audit", http.StatusNotFound)
			return
		}

		auditResult := AnalyzeSpecSecurity(specMap)

		targetEnvURL := r.URL.Query().Get("target_url")
		if targetEnvURL != "" {
			safeClient := security.NewSafeHTTPClient(cfg.RemoteFetch)
			headerAudit, err := AuditLiveHeaders(r.Context(), safeClient, targetEnvURL)
			if err == nil {
				auditResult.HeaderAudit = headerAudit
			}
		}

		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(w).Encode(auditResult)
	}
}

func checkCSRFHeader(r *http.Request) bool {
	if r.Header.Get("X-Apidocs-CSRF") == "1" || r.Header.Get("X-Requested-With") != "" {
		return true
	}
	origin := r.Header.Get("Origin")
	return origin != "" && (strings.Contains(origin, r.Host) || strings.Contains(r.Host, origin))
}

func checkCSRFHeaderFiber(c *fiber.Ctx) bool {
	if c.Get("X-Apidocs-CSRF") == "1" || c.Get("X-Requested-With") != "" {
		return true
	}
	origin := c.Get("Origin")
	return origin != "" && (strings.Contains(origin, c.Hostname()) || strings.Contains(c.Hostname(), origin))
}

func sanitizeID(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	var sb strings.Builder
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' {
			sb.WriteRune(r)
		} else if r == ' ' || r == '_' {
			sb.WriteRune('-')
		}
	}
	res := strings.Trim(sb.String(), "-")
	if res == "" {
		return fmt.Sprintf("api-%d", time.Now().Unix())
	}
	return res
}

// NavHandler returns the navigation configuration JSON.
func NavHandler(cfg Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		setSecurityHeaders(w)
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"title":     cfg.Title,
			"subtitle":  cfg.Subtitle,
			"icon":      cfg.BrandIcon,
			"nav_items": cfg.NavItems,
		})
	}
}

// MarkdownDocsHandler returns the JSON list of available markdown documents for a service.
func MarkdownDocsHandler(wm *WorkspaceManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		setSecurityHeaders(w)
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		wsID := r.URL.Query().Get("ws")
		if wsID == "" {
			wsID = "default"
		}
		svcID := r.URL.Query().Get("svc")
		if svcID == "" {
			svcID = "default"
		}
		var docs []MarkdownDoc
		if wm != nil {
			docs = wm.ListMarkdownDocs(wsID, svcID)
		}
		if docs == nil {
			docs = []MarkdownDoc{}
		}
		_ = json.NewEncoder(w).Encode(docs)
	}
}

// ReadmeHandler returns the project README markdown or requested markdown document.
func ReadmeHandler(cfg Config, wm ...*WorkspaceManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		setSecurityHeaders(w)
		w.Header().Set("Content-Type", "text/markdown; charset=utf-8")

		wsID := r.URL.Query().Get("ws")
		if wsID == "" {
			wsID = "default"
		}
		svcID := r.URL.Query().Get("svc")
		if svcID == "" {
			svcID = "default"
		}
		fileQuery := r.URL.Query().Get("file")

		var activeWM *WorkspaceManager
		if len(wm) > 0 && wm[0] != nil {
			activeWM = wm[0]
		}

		if activeWM != nil {
			if fileQuery != "" {
				if b, err := activeWM.GetMarkdownDocContent(wsID, svcID, fileQuery); err == nil && len(b) > 0 {
					w.WriteHeader(http.StatusOK)
					_, _ = w.Write(b)
					return
				}
			}
			if b, err := activeWM.GetMarkdownDocContent(wsID, svcID, "README.md"); err == nil && len(b) > 0 {
				w.WriteHeader(http.StatusOK)
				_, _ = w.Write(b)
				return
			}
		}

		candidates := []string{
			cfg.ReadmePath,
			filepath.Join(cfg.DocsDir, "README.md"),
			filepath.Join(cfg.DocsDir, "readme.md"),
			"./README.md",
			"./readme.md",
			"README.md",
		}
		for _, p := range candidates {
			if p == "" {
				continue
			}
			if b, err := os.ReadFile(p); err == nil && len(b) > 0 {
				w.WriteHeader(http.StatusOK)
				_, _ = w.Write(b)
				return
			}
		}
		if cfg.EmbeddedFS != nil {
			if b, err := LoadAsset(cfg.EmbeddedFS, "README.md"); err == nil && len(b) > 0 {
				w.WriteHeader(http.StatusOK)
				_, _ = w.Write(b)
				return
			}
		}

		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("# " + cfg.Title + "\n\nWelcome to the API Documentation & Developer Portal."))
	}
}

// LoginHandler handles login page rendering (GET) and authentication verification (POST).
func LoginHandler(cfg Config, authEnabled bool) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		setSecurityHeaders(w)
		if req.Method == http.MethodPost {
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			if !authEnabled || cfg.AuthUser == "" {
				_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "message": "Authentication disabled"})
				return
			}
			var body struct {
				Username string `json:"username"`
				Password string `json:"password"`
			}
			if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
				w.WriteHeader(http.StatusBadRequest)
				_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "message": "Invalid payload"})
				return
			}
			if subtle.ConstantTimeCompare([]byte(body.Username), []byte(cfg.AuthUser)) != 1 ||
				!auth.CheckPassword(body.Password, cfg.AuthPassword, cfg.AuthPasswordHash) {
				w.WriteHeader(http.StatusUnauthorized)
				_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "message": "Invalid username or password"})
				return
			}
			token := GenerateDocsSessionToken(cfg.AuthUser, cfg.JWTSecret)
			http.SetCookie(w, &http.Cookie{
				Name:     DocsSessionCookieName,
				Value:    token,
				Path:     "/",
				Expires:  time.Now().Add(24 * time.Hour),
				HttpOnly: true,
				SameSite: http.SameSiteLaxMode,
			})
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "message": "Authenticated successfully"})
			return
		}

		if !authEnabled || cfg.AuthUser == "" {
			http.Redirect(w, req, "/docs", http.StatusFound)
			return
		}
		cookie, err := req.Cookie(DocsSessionCookieName)
		if err == nil && cookie != nil && cookie.Value != "" && VerifyDocsSessionToken(cookie.Value, cfg.AuthUser, cfg.JWTSecret) {
			redirect := req.URL.Query().Get("redirect")
			if redirect == "" {
				redirect = "/docs"
			}
			http.Redirect(w, req, redirect, http.StatusFound)
			return
		}
		ServeAssetHTTP(w, req, cfg.EmbeddedFS, "index.html")
	}
}

// LogoutHandler clears the docs session cookie and redirects to /docs/login.
func LogoutHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		http.SetCookie(w, &http.Cookie{
			Name:     DocsSessionCookieName,
			Value:    "",
			Path:     "/",
			Expires:  time.Now().Add(-1 * time.Hour),
			MaxAge:   -1,
			HttpOnly: true,
		})
		http.Redirect(w, req, "/docs/login", http.StatusFound)
	}
}

// SwaggerRedirectHandler redirects /swagger to /docs while preserving query strings.
func SwaggerRedirectHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		target := "/docs"
		if req.URL.RawQuery != "" {
			target += "?" + req.URL.RawQuery
		}
		http.Redirect(w, req, target, http.StatusFound)
	}
}

// SPAHandler serves the React SPA index.html.
func SPAHandler(cfg Config) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		setSecurityHeaders(w)
		ServeAssetHTTP(w, req, cfg.EmbeddedFS, "index.html")
	}
}

// GetMimeType resolves the proper Content-Type for a file extension.
func GetMimeType(filename string) string {
	ext := strings.ToLower(filepath.Ext(filename))
	ctype := mime.TypeByExtension(ext)
	if ctype != "" {
		return ctype
	}
	switch ext {
	case ".html", ".htm":
		return "text/html; charset=utf-8"
	case ".css":
		return "text/css; charset=utf-8"
	case ".js":
		return "application/javascript; charset=utf-8"
	case ".json":
		return "application/json; charset=utf-8"
	case ".svg":
		return "image/svg+xml"
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	default:
		return "application/octet-stream"
	}
}

// LoadAsset loads static asset content from embedded FS or disk fallback.
func LoadAsset(embedded *embed.FS, filename string) ([]byte, error) {
	clean := strings.TrimPrefix(filename, "/")

	if embedded != nil {
		candidates := []string{
			clean,
			"dist/" + clean,
			"docs/" + clean,
			"assets/" + clean,
			"dist/assets/" + clean,
		}
		for _, c := range candidates {
			if b, readErr := fs.ReadFile(embedded, c); readErr == nil && len(b) > 0 {
				return b, nil
			}
		}
	}

	diskCandidates := []string{
		clean,
		"./" + clean,
		"./dist/" + clean,
		"./assets/dist/" + clean,
		"./assets/" + clean,
		"./docs/" + clean,
		"./backend/docs/" + clean,
	}
	for _, p := range diskCandidates {
		if b, readErr := os.ReadFile(p); readErr == nil && len(b) > 0 {
			return b, nil
		}
	}

	return nil, fmt.Errorf("asset %s not found", filename)
}

// ServeAssetHTTP serves a named asset with proper content-type to an http.ResponseWriter.
func ServeAssetHTTP(w http.ResponseWriter, r *http.Request, embedded *embed.FS, filename string) {
	data, err := LoadAsset(embedded, filename)
	if err != nil {
		http.Error(w, "Documentation file not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	w.Header().Set("Pragma", "no-cache")
	w.Header().Set("Expires", "0")
	w.Header().Set("Content-Type", GetMimeType(filename))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(data)
}

func serveAsset(c *fiber.Ctx, embedded *embed.FS, filename string) error {
	data, err := LoadAsset(embedded, filename)
	if err != nil {
		return c.Status(fiber.StatusNotFound).SendString("Documentation file not found")
	}

	c.Set("Cache-Control", "no-cache, no-store, must-revalidate")
	c.Set("Pragma", "no-cache")
	c.Set("Expires", "0")
	c.Set("Content-Type", GetMimeType(filename))
	return c.Send(data)
}

// NewAssetFileServer returns an http.Handler that serves embedded and disk assets.
func NewAssetFileServer(embedded *embed.FS) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/docs/")
		path = strings.TrimPrefix(path, "/docs")
		path = strings.TrimPrefix(path, "/assets/")
		path = strings.TrimPrefix(path, "/assets")
		path = strings.TrimPrefix(path, "/")

		if path == "" {
			path = "index.html"
		}

		data, err := LoadAsset(embedded, path)
		if err != nil {
			data, err = LoadAsset(embedded, "assets/"+path)
		}
		if err != nil {
			http.NotFound(w, r)
			return
		}

		w.Header().Set("Content-Type", GetMimeType(path))
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, string(data))
	})
}

// ---------- Unlock brute-force protection ----------

// unlockAttempt is one client+workspace attempt record.
type unlockAttempt struct {
	failures  int
	blockedUntil time.Time
}

// unlockLimiter caps failed unlock attempts: 5 consecutive failures trigger a
// 15-minute cooldown per client IP + workspace combination. Success resets.
type unlockLimiter struct {
	mu       sync.Mutex
	attempts map[string]*unlockAttempt
	maxFail  int
	cooloff  time.Duration
}

var unlockAttemptLimiter = &unlockLimiter{
	attempts: make(map[string]*unlockAttempt),
	maxFail:  5,
	cooloff:  15 * time.Minute,
}

// Allow reports whether an attempt is permitted and records a new attempt slot.
func (l *unlockLimiter) Allow(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	a, ok := l.attempts[key]
	if !ok {
		return true
	}
	if a.blockedUntil.After(time.Now()) {
		return false
	}
	return true
}

// Fail records a failed attempt; after maxFail consecutive failures the key is
// blocked for the cooloff duration.
func (l *unlockLimiter) Fail(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	a, ok := l.attempts[key]
	if !ok {
		a = &unlockAttempt{}
		l.attempts[key] = a
	}
	a.failures++
	if a.failures >= l.maxFail {
		a.blockedUntil = time.Now().Add(l.cooloff)
		a.failures = 0 // reset count; the block window does the throttling
	}
}

// Reset clears the failure count after a successful unlock.
func (l *unlockLimiter) Reset(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	delete(l.attempts, key)
}

// periodicEvict bounds memory by dropping idle entries; called opportunistically.
func (l *unlockLimiter) periodicEvict() {
	l.mu.Lock()
	defer l.mu.Unlock()
	for k, a := range l.attempts {
		if a.blockedUntil.Before(time.Now()) && a.failures == 0 {
			delete(l.attempts, k)
		}
	}
}

// clientIPFrom extracts the best-guess client IP, preferring proxy headers.
func clientIPFrom(r *http.Request) string {
	if xf := r.Header.Get("X-Forwarded-For"); xf != "" {
		if idx := strings.Index(xf, ","); idx > 0 {
			return strings.TrimSpace(xf[:idx])
		}
		return strings.TrimSpace(xf)
	}
	if xr := r.Header.Get("X-Real-IP"); xr != "" {
		return strings.TrimSpace(xr)
	}
	if host, _, err := net.SplitHostPort(r.RemoteAddr); err == nil {
		return host
	}
	return r.RemoteAddr
}

func init() {
	// Opportunistic memory bound for the attempt map.
	go func() {
		t := time.NewTicker(10 * time.Minute)
		defer t.Stop()
		for range t.C {
			unlockAttemptLimiter.periodicEvict()
		}
	}()
}
