package apidocs

import (
	"embed"
	"encoding/json"
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

// Config defines the options for the API Docs and QA Suite.
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
}

// NormalizeConfig applies default configuration values.
func NormalizeConfig(cfg Config) (Config, bool) {
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

	return cfg, authEnabled
}

// Mount attaches all documentation, login, QA tracker, and Swagger UI routes to a Fiber app.
func Mount(app *fiber.App, cfg Config) {
	MountFiber(app, cfg)
}

// MountFiber attaches all documentation, login, QA tracker, and Swagger UI routes to a Fiber app.
func MountFiber(app *fiber.App, cfg Config) {
	cfg, authEnabled := NormalizeConfig(cfg)

	filter := newSpecFilter(cfg.SpecFilePath, cfg.DocsDir, cfg.PathsDir, cfg.ModuleTagMap, nil)
	qa := newQATracker(cfg.QAStoragePath, cfg.Title)

	// Swagger JSON routes
	app.Get("/docs/swagger.json", filter.ServeFilteredSwagger)
	app.Get("/swagger/swagger.json", filter.ServeFilteredSwagger)
	app.Get("/swagger.json", filter.ServeFilteredSwagger)

	// Navigation & Branding Configuration API
	app.Get("/docs/nav", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"title":     cfg.Title,
			"subtitle":  cfg.Subtitle,
			"icon":      cfg.BrandIcon,
			"nav_items": cfg.NavItems,
		})
	})

	// Markdown README content API
	app.Get("/docs/readme", func(c *fiber.Ctx) error {
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

	// QA Tracking and Reports
	app.Get("/docs/qa/data", qa.HandleGetData)
	app.Post("/docs/qa/record", qa.HandleSaveRecord)
	app.Post("/docs/qa/reset", qa.HandleResetData)
	app.Get("/docs/qa/report", qa.HandleGetReport)

	// Auth Guard & Session Routes
	docsGuard := WebAuthMiddleware(authEnabled, cfg.AuthUser, cfg.AuthPassword, cfg.JWTSecret)

	app.Get("/docs/login", func(c *fiber.Ctx) error {
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

// MountChi attaches all documentation, login, QA tracker, and Swagger UI routes to a Chi router.
func MountChi(r chi.Router, cfg Config) {
	cfg, authEnabled := NormalizeConfig(cfg)

	filter := newSpecFilter(cfg.SpecFilePath, cfg.DocsDir, cfg.PathsDir, cfg.ModuleTagMap, nil)
	qa := newQATracker(cfg.QAStoragePath, cfg.Title)
	authGuard := HTTPAuthMiddleware(authEnabled, cfg.AuthUser, cfg.AuthPassword, cfg.JWTSecret)
	assetServer := NewAssetFileServer(cfg.EmbeddedFS)

	// Swagger JSON routes
	r.Get("/docs/swagger.json", filter.ServeHTTP)
	r.Get("/swagger/swagger.json", filter.ServeHTTP)
	r.Get("/swagger.json", filter.ServeHTTP)

	// Navigation API
	r.Get("/docs/nav", NavHandler(cfg))
	r.Get("/docs/readme", ReadmeHandler(cfg))

	// QA Tracking and Reports
	r.Get("/docs/qa/data", qa.HandleGetDataHTTP)
	r.Post("/docs/qa/record", qa.HandleSaveRecordHTTP)
	r.Post("/docs/qa/reset", qa.HandleResetDataHTTP)
	r.Get("/docs/qa/report", qa.HandleGetReportHTTP)

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

// MountGin attaches all documentation, login, QA tracker, and Swagger UI routes to a Gin engine or router group.
func MountGin(r gin.IRoutes, cfg Config) {
	cfg, authEnabled := NormalizeConfig(cfg)

	filter := newSpecFilter(cfg.SpecFilePath, cfg.DocsDir, cfg.PathsDir, cfg.ModuleTagMap, nil)
	qa := newQATracker(cfg.QAStoragePath, cfg.Title)
	authGuard := GinAuthMiddleware(authEnabled, cfg.AuthUser, cfg.AuthPassword, cfg.JWTSecret)
	assetServer := NewAssetFileServer(cfg.EmbeddedFS)

	// Swagger JSON routes
	r.GET("/docs/swagger.json", gin.WrapH(filter))
	r.GET("/swagger/swagger.json", gin.WrapH(filter))
	r.GET("/swagger.json", gin.WrapH(filter))

	// Navigation API
	r.GET("/docs/nav", gin.WrapF(NavHandler(cfg)))
	r.GET("/docs/readme", gin.WrapF(ReadmeHandler(cfg)))

	// QA Tracking and Reports
	r.GET("/docs/qa/data", gin.WrapF(qa.HandleGetDataHTTP))
	r.POST("/docs/qa/record", gin.WrapF(qa.HandleSaveRecordHTTP))
	r.POST("/docs/qa/reset", gin.WrapF(qa.HandleResetDataHTTP))
	r.GET("/docs/qa/report", gin.WrapF(qa.HandleGetReportHTTP))

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

// MountNetHTTP attaches documentation routes to a standard http.ServeMux.
func MountNetHTTP(mux *http.ServeMux, cfg Config) {
	cfg, authEnabled := NormalizeConfig(cfg)

	filter := newSpecFilter(cfg.SpecFilePath, cfg.DocsDir, cfg.PathsDir, cfg.ModuleTagMap, nil)
	qa := newQATracker(cfg.QAStoragePath, cfg.Title)
	authGuard := HTTPAuthMiddleware(authEnabled, cfg.AuthUser, cfg.AuthPassword, cfg.JWTSecret)
	assetServer := NewAssetFileServer(cfg.EmbeddedFS)

	// Swagger JSON
	mux.Handle("/docs/swagger.json", filter)
	mux.Handle("/swagger/swagger.json", filter)
	mux.Handle("/swagger.json", filter)

	// Nav & QA APIs
	mux.HandleFunc("/docs/nav", NavHandler(cfg))
	mux.HandleFunc("/docs/readme", ReadmeHandler(cfg))
	mux.HandleFunc("/docs/qa/data", qa.HandleGetDataHTTP)
	mux.HandleFunc("/docs/qa/record", qa.HandleSaveRecordHTTP)
	mux.HandleFunc("/docs/qa/reset", qa.HandleResetDataHTTP)
	mux.HandleFunc("/docs/qa/report", qa.HandleGetReportHTTP)

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

// NavHandler returns the navigation configuration JSON.
func NavHandler(cfg Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
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

	w.Header().Set("Content-Type", GetMimeType(filename))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(data)
}

func serveAsset(c *fiber.Ctx, embedded *embed.FS, filename string) error {
	data, err := LoadAsset(embedded, filename)
	if err != nil {
		return c.Status(fiber.StatusNotFound).SendString("Documentation file not found")
	}

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
