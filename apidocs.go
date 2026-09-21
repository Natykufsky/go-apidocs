package apidocs

import (
	"bytes"
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-chi/chi/v5"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/filesystem"

	"github.com/Natykufsky/go-apidocs/assets"
)

// NavItem represents a link in the unified navigation header.
type NavItem struct {
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

	// AuthEnabled explicitly turns on/off authentication protection (defaults to true if AuthUser is set)
	AuthEnabled *bool

	// JWTSecret is used to cryptographically sign docs session cookies
	JWTSecret string

	// QAStoragePath is where QA test reviews and bug notes are persisted (default: "./docs/qa_tracker.json")
	QAStoragePath string

	// DocsDir is the base directory containing docs files like schemas.json, swagger_base.json (default: "./docs")
	DocsDir string

	// ReadmePath is the path to README.md (default: "<DocsDir>/README.md" or "./README.md")
	ReadmePath string

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
}

// ValidateConfig checks for configuration consistency and fails closed if write/audit is enabled without Authorizer.
func ValidateConfig(cfg Config) error {
	if (cfg.EnableWorkspaceWrites || cfg.EnableSecurityAudit) && cfg.Authorizer == nil {
		return errors.New("apidocs security violation: EnableWorkspaceWrites or EnableSecurityAudit is enabled, but Authorizer is nil. You must provide a valid Authorizer to enable mutating/security routes")
	}
	return nil
}

// NormalizeConfig applies default configuration values and constructs a WorkspaceManager.
func NormalizeConfig(cfg Config) (Config, *WorkspaceManager, bool, error) {
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
	if cfg.JWTSecret == "" {
		cfg.JWTSecret = os.Getenv("JWT_SECRET")
		if cfg.JWTSecret == "" {
			cfg.JWTSecret = "apidocs_super_secret_session_key"
		}
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
		authEnabled = os.Getenv("DOCS_AUTH_ENABLED") == "true" || (cfg.AuthUser != "" && cfg.AuthPassword != "")
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

	wm, err := NewWorkspaceManager(
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
	w.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("X-Frame-Options", "DENY")
	w.Header().Set("Referrer-Policy", "no-referrer")
	w.Header().Set("Cross-Origin-Opener-Policy", "same-origin")
}

func setFiberSecurityHeaders(c *fiber.Ctx) {
	c.Set("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
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

	defaultFilter := newSpecFilter(cfg.SpecFilePath, cfg.DocsDir, cfg.PathsDir, cfg.ModuleTagMap, nil)
	defaultQA := newQATracker(cfg.QAStoragePath, cfg.Title)

	// Capabilities API
	app.Get("/docs/capabilities", func(c *fiber.Ctx) error {
		setFiberSecurityHeaders(c)
		caps := Capabilities{
			WorkspacesEnabled:      cfg.EnableWorkspaces,
			WorkspaceWritesEnabled: cfg.EnableWorkspaceWrites,
			SecurityAuditEnabled:   cfg.EnableSecurityAudit,
			RemoteFetchEnabled:     cfg.RemoteFetch.Enabled,
			RemoteFetchPolicy:      cfg.RemoteFetch,
			MaxSpecBytes:           cfg.MaxSpecBytes,
		}
		return c.JSON(caps)
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

	// Markdown README content API
	app.Get("/docs/readme", func(c *fiber.Ctx) error {
		setFiberSecurityHeaders(c)
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

	// QA Tracking APIs
	app.Get("/docs/qa/data", defaultQA.HandleGetData)
	app.Post("/docs/qa/record", defaultQA.HandleSaveRecord)
	app.Post("/docs/qa/reset", defaultQA.HandleResetData)
	app.Get("/docs/qa/report", defaultQA.HandleGetReport)

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
				safeClient := newSafeHTTPClient(cfg.RemoteFetch)
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
		if req.Username != cfg.AuthUser || req.Password != cfg.AuthPassword {
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

	defaultFilter := newSpecFilter(cfg.SpecFilePath, cfg.DocsDir, cfg.PathsDir, cfg.ModuleTagMap, nil)
	defaultQA := newQATracker(cfg.QAStoragePath, cfg.Title)
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
			RemoteFetchEnabled:     cfg.RemoteFetch.Enabled,
			RemoteFetchPolicy:      cfg.RemoteFetch,
			MaxSpecBytes:           cfg.MaxSpecBytes,
		})
	})

	// Swagger JSON routes
	r.Get("/docs/swagger.json", SwaggerJSONHandler(cfg, wm, defaultFilter))
	r.Get("/swagger/swagger.json", SwaggerJSONHandler(cfg, wm, defaultFilter))
	r.Get("/swagger.json", SwaggerJSONHandler(cfg, wm, defaultFilter))

	// Navigation & Readme APIs
	r.Get("/docs/nav", NavHandler(cfg))
	r.Get("/docs/readme", ReadmeHandler(cfg))

	// Workspace Management APIs
	if cfg.EnableWorkspaces {
		r.Get("/docs/workspaces", WorkspacesListHandler(wm))
	}
	if cfg.EnableWorkspaceWrites {
		r.Post("/docs/workspaces", WorkspaceCreateHandler(wm))
		r.Post("/docs/workspaces/import", WorkspaceImportHandler(cfg, wm))
	}
	if cfg.EnableSecurityAudit {
		r.Get("/docs/security/audit", SecurityAuditHandler(cfg, wm))
	}

	// QA Tracking and Reports
	r.Get("/docs/qa/data", defaultQA.HandleGetDataHTTP)
	r.Post("/docs/qa/record", defaultQA.HandleSaveRecordHTTP)
	r.Post("/docs/qa/reset", defaultQA.HandleResetDataHTTP)
	r.Get("/docs/qa/report", defaultQA.HandleGetReportHTTP)

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

	defaultFilter := newSpecFilter(cfg.SpecFilePath, cfg.DocsDir, cfg.PathsDir, cfg.ModuleTagMap, nil)
	defaultQA := newQATracker(cfg.QAStoragePath, cfg.Title)
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
			RemoteFetchEnabled:     cfg.RemoteFetch.Enabled,
			RemoteFetchPolicy:      cfg.RemoteFetch,
			MaxSpecBytes:           cfg.MaxSpecBytes,
		})
	}))

	// Swagger JSON routes
	r.GET("/docs/swagger.json", gin.WrapF(SwaggerJSONHandler(cfg, wm, defaultFilter)))
	r.GET("/swagger/swagger.json", gin.WrapF(SwaggerJSONHandler(cfg, wm, defaultFilter)))
	r.GET("/swagger.json", gin.WrapF(SwaggerJSONHandler(cfg, wm, defaultFilter)))

	// Navigation & Readme APIs
	r.GET("/docs/nav", gin.WrapF(NavHandler(cfg)))
	r.GET("/docs/readme", gin.WrapF(ReadmeHandler(cfg)))

	// Workspace Management APIs
	if cfg.EnableWorkspaces {
		r.GET("/docs/workspaces", gin.WrapF(WorkspacesListHandler(wm)))
	}
	if cfg.EnableWorkspaceWrites {
		r.POST("/docs/workspaces", gin.WrapF(WorkspaceCreateHandler(wm)))
		r.POST("/docs/workspaces/import", gin.WrapF(WorkspaceImportHandler(cfg, wm)))
	}
	if cfg.EnableSecurityAudit {
		r.GET("/docs/security/audit", gin.WrapF(SecurityAuditHandler(cfg, wm)))
	}

	// QA Tracking and Reports
	r.GET("/docs/qa/data", gin.WrapF(defaultQA.HandleGetDataHTTP))
	r.POST("/docs/qa/record", gin.WrapF(defaultQA.HandleSaveRecordHTTP))
	r.POST("/docs/qa/reset", gin.WrapF(defaultQA.HandleResetDataHTTP))
	r.GET("/docs/qa/report", gin.WrapF(defaultQA.HandleGetReportHTTP))

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

	defaultFilter := newSpecFilter(cfg.SpecFilePath, cfg.DocsDir, cfg.PathsDir, cfg.ModuleTagMap, nil)
	defaultQA := newQATracker(cfg.QAStoragePath, cfg.Title)
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
			RemoteFetchEnabled:     cfg.RemoteFetch.Enabled,
			RemoteFetchPolicy:      cfg.RemoteFetch,
			MaxSpecBytes:           cfg.MaxSpecBytes,
		})
	})

	// Swagger JSON
	mux.HandleFunc("/docs/swagger.json", SwaggerJSONHandler(cfg, wm, defaultFilter))
	mux.HandleFunc("/swagger/swagger.json", SwaggerJSONHandler(cfg, wm, defaultFilter))
	mux.HandleFunc("/swagger.json", SwaggerJSONHandler(cfg, wm, defaultFilter))

	// Nav & QA APIs
	mux.HandleFunc("/docs/nav", NavHandler(cfg))
	mux.HandleFunc("/docs/readme", ReadmeHandler(cfg))
	mux.HandleFunc("/docs/qa/data", defaultQA.HandleGetDataHTTP)
	mux.HandleFunc("/docs/qa/record", defaultQA.HandleSaveRecordHTTP)
	mux.HandleFunc("/docs/qa/reset", defaultQA.HandleResetDataHTTP)
	mux.HandleFunc("/docs/qa/report", defaultQA.HandleGetReportHTTP)

	// Workspace APIs
	if cfg.EnableWorkspaces {
		mux.HandleFunc("/docs/workspaces", WorkspacesListHandler(wm))
	}
	if cfg.EnableWorkspaceWrites {
		mux.HandleFunc("/docs/workspaces/create", WorkspaceCreateHandler(wm))
		mux.HandleFunc("/docs/workspaces/import", WorkspaceImportHandler(cfg, wm))
	}
	if cfg.EnableSecurityAudit {
		mux.HandleFunc("/docs/security/audit", SecurityAuditHandler(cfg, wm))
	}

	// Login & Session
	mux.HandleFunc("/docs/login", LoginHandler(cfg, authEnabled))
	mux.HandleFunc("/docs/logout", LogoutHandler())
	mux.HandleFunc("/swagger", SwaggerRedirectHandler())

	// Protected React SPA portals
	spa := authGuard(SPAHandler(cfg))
	mux.Handle("/", authGuard(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		if req.URL.Path == "/" {
			SPAHandler(cfg)(w, req)
			return
		}
		assetServer.ServeHTTP(w, req)
	})))
	mux.Handle("/docs", spa)
	mux.Handle("/docs/", authGuard(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		if req.URL.Path == "/docs/" || req.URL.Path == "/docs/index.html" {
			SPAHandler(cfg)(w, req)
			return
		}
		assetServer.ServeHTTP(w, req)
	})))
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

// WorkspacesListHandler returns list of all workspaces.
func WorkspacesListHandler(wm *WorkspaceManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		setSecurityHeaders(w)
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(w).Encode(wm.ListWorkspaces())
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
			safeClient := newSafeHTTPClient(cfg.RemoteFetch)
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

// ReadmeHandler returns the project README markdown.
func ReadmeHandler(cfg Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		setSecurityHeaders(w)
		w.Header().Set("Content-Type", "text/markdown; charset=utf-8")

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
			if body.Username != cfg.AuthUser || body.Password != cfg.AuthPassword {
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
