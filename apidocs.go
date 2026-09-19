package apidocs

import (
	"embed"
	"io/fs"
	"net/http"
	"os"
	"time"

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

	// ModuleTagMap maps custom module shorthand queries (?module=auth) to OpenAPI tag names
	ModuleTagMap map[string][]string

	// EmbeddedFS optionally provides an embedded filesystem of HTML/CSS/JS assets
	EmbeddedFS *embed.FS
}

// Mount attaches all documentation, login, QA tracker, and Swagger UI routes to a Fiber app.
func Mount(app *fiber.App, cfg Config) {
	if cfg.SpecFilePath == "" {
		cfg.SpecFilePath = "./docs/swagger.json"
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

	// 1. Initialize Spec Filter & QA Tracker
	filter := newSpecFilter(cfg.SpecFilePath, cfg.ModuleTagMap, nil)
	qa := newQATracker(cfg.QAStoragePath, cfg.Title)

	// 2. Swagger JSON routes (unprotected or protected as desired)
	app.Get("/docs/swagger.json", filter.ServeFilteredSwagger)
	app.Get("/swagger/swagger.json", filter.ServeFilteredSwagger)
	app.Get("/swagger.json", filter.ServeFilteredSwagger)

	// 3. Navigation & Branding Configuration API
	app.Get("/docs/nav", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"title":     cfg.Title,
			"subtitle":  cfg.Subtitle,
			"icon":      cfg.BrandIcon,
			"nav_items": cfg.NavItems,
		})
	})

	// 4. QA Tracking and Reports (Team-wide live sync)
	app.Get("/docs/qa/data", qa.HandleGetData)
	app.Post("/docs/qa/record", qa.HandleSaveRecord)
	app.Post("/docs/qa/reset", qa.HandleResetData)
	app.Get("/docs/qa/report", qa.HandleGetReport)

	// 5. Docs Authentication Middleware Gate
	docsGuard := WebAuthMiddleware(authEnabled, cfg.AuthUser, cfg.AuthPassword, cfg.JWTSecret)

	// 5. Login & Session Routes
	app.Get("/docs/login", func(c *fiber.Ctx) error {
		if !authEnabled || cfg.AuthUser == "" {
			return c.Redirect("/docs")
		}
		cookieVal := c.Cookies(DocsSessionCookieName)
		if cookieVal != "" && VerifyDocsSessionToken(cookieVal, cfg.AuthUser, cfg.JWTSecret) {
			redirect := c.Query("redirect", "/docs")
			return c.Redirect(redirect)
		}
		return serveAsset(c, cfg.EmbeddedFS, "login.html")
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

	// 6. Interactive Documentation Portals (Protected by docsGuard)
	app.Get("/", docsGuard, func(c *fiber.Ctx) error {
		return serveAsset(c, cfg.EmbeddedFS, "landing.html")
	})
	app.Get("/docs", docsGuard, func(c *fiber.Ctx) error {
		return serveAsset(c, cfg.EmbeddedFS, "index.html")
	})
	app.Get("/docs/index.html", docsGuard, func(c *fiber.Ctx) error {
		return serveAsset(c, cfg.EmbeddedFS, "index.html")
	})
	app.Get("/guide", docsGuard, func(c *fiber.Ctx) error {
		return serveAsset(c, cfg.EmbeddedFS, "guide.html")
	})
	app.Get("/pricing", docsGuard, func(c *fiber.Ctx) error {
		return serveAsset(c, cfg.EmbeddedFS, "pricing.html")
	})
	app.Get("/dashboard", docsGuard, func(c *fiber.Ctx) error {
		return serveAsset(c, cfg.EmbeddedFS, "health.html")
	})

	app.Get("/swagger", func(c *fiber.Ctx) error {
		return c.Redirect("/docs?" + string(c.Request().URI().QueryString()))
	})

	// 7. Static Assets
	if cfg.EmbeddedFS != nil {
		app.Use("/docs", filesystem.New(filesystem.Config{
			Root:       http.FS(cfg.EmbeddedFS),
			PathPrefix: "docs",
			Browse:     false,
		}))
		app.Use("/docs", filesystem.New(filesystem.Config{
			Root:   http.FS(cfg.EmbeddedFS),
			Browse: false,
		}))
	}
}

func serveAsset(c *fiber.Ctx, embedded *embed.FS, filename string) error {
	var data []byte
	var err error

	if embedded != nil {
		data, err = fs.ReadFile(embedded, filename)
		if err != nil {
			data, err = fs.ReadFile(embedded, "docs/"+filename)
		}
	}
	if len(data) == 0 {
		data, err = os.ReadFile("./docs/" + filename)
		if err != nil {
			data, err = os.ReadFile("./backend/docs/" + filename)
		}
	}
	if err != nil || len(data) == 0 {
		return c.Status(fiber.StatusNotFound).SendString("Documentation file not found")
	}

	c.Set("Content-Type", "text/html; charset=utf-8")
	return c.Send(data)
}
