<div align="center">

# 📚 go-apidocs

### The All-In-One Swagger UI, Security Gate, Real-Time QA Suite & Developer Portal for Go

[![Go Reference](https://pkg.go.dev/badge/github.com/Natykufsky/go-apidocs.svg)](https://pkg.go.dev/github.com/Natykufsky/go-apidocs)
[![Go Report Card](https://goreportcard.com/badge/github.com/Natykufsky/go-apidocs)](https://goreportcard.com/report/github.com/Natykufsky/go-apidocs)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/Natykufsky/go-apidocs/pulls)
[![Maintenance](https://img.shields.io/badge/Maintained%3F-yes-green.svg)](https://github.com/Natykufsky/go-apidocs/graphs/commit-activity)

<p align="center">
  <strong>Drop-in OpenAPI 3.0 Documentation • Automatic Token & Multi-Tenant Capture • Password Access Gate • ReadMe-Style Developer Guide • Real-Time Endpoint Stats & GitHub README Reader with Secret Masking • Multi-Language Code Snippet Generator • Team-Wide QA Checklist • Instant Excel & Markdown Audit Reports • Zero Deployment Dependencies</strong>
</p>

</div>

---

## 🌟 Why `go-apidocs`?

Standard Swagger UI solutions only display static API contracts. **`go-apidocs`** turns your API documentation into a complete **Developer Portal & QA Collaboration Hub**:

1. **🏠 Interactive Developer Hub (`/`)**: Automatically reads and renders your project's `README.md` with authentic GitHub typography, line counts, **Secret Masking Safe Mode** (redacts passwords, JWTs, DB strings), and calculates **real-time live endpoint statistics**, HTTP method breakdowns, and engine domain explorers.
2. **🔐 Automatic Token & Multi-Tenant Credential Interceptor**: Testing a login/token endpoint automatically captures `access_token`, `refresh_token`, `tenant_id`, and `entity_id` and saves them in browser storage, immediately attaching them to all subsequent requests.
3. **🛠️ Custom Header & Credential Mapper Modal**: Map arbitrary custom headers (`X-Org-ID`, `X-App-Client`, etc.) with one-click copy and reset controls.
4. **💻 Multi-Language Code Snippet Generator**: 1-click generation of production-ready **cURL**, **Go**, **Node.js (`fetch`)**, and **Python (`requests`)** code snippets pre-populated with active authorization tokens across Local, Staging, and Production environments.
5. **📖 ReadMe-Style Developer Guide (`/guide`)**: Interactive multi-column developer reference powered by Scalar with full support for hash anchors (e.g. `/guide#description/introduction`), search, and multi-language code snippets.
6. **⚡ Swagger UI Sandbox (`/docs`)**: Interactive API playground with "Try It Out", token persistence, clean in-endpoint QA badges with comment previews, and dynamic scope filtering.
7. **🔒 Password Security Gate (`/docs/login`)**: Protect staging, offline, and production API specs from unauthorized eyes with cryptographic HMAC-signed session cookies and zero external auth dependencies.
8. **🔤 Portal Font Size Manager**: Accessible font scaling (`90% Compact`, `100% Default`, `110% Medium`, `125% Large`) directly in the header with `localStorage` persistence.
9. **🧪 Interactive QA Endpoint Inspector**: Step through endpoints sequentially (`Previous` / `Next`), toggle verification results (`🟢 Passed`, `🟡 Needs Retest`, `🔴 Failed / Bug Found`), view pre-authenticated snippets, and record Markdown bug notes.
10. **💾 Real-Time Team Synchronization**: All QA statuses and comments automatically sync to the backend server (`/docs/qa/*`) so the entire engineering team sees the exact same test progress.
11. **📋 Automated Executive Audit Reports (`/docs/qa/report`)**: Generate live Markdown and RFC 4180 Excel (`.csv`) reports of all tested endpoints with bug notes ready to download or copy into GitHub Issues, Jira, or Slack.
12. **📊 Operations Health Dashboard (`/dashboard`)**: Live service metrics, connection statuses, and interactive diagnostic log console.
13. **📱 Unified Mobile-First Top Header**: Consistent, responsive top navigation bar across all views with Spotlight Search (`⌘K` / `/`) and mobile drawer support.
14. **📦 100% Self-Contained (`//go:embed`)**: All React UI assets, CSS, and JS files are compiled directly into your Go binary. Zero CDN downtime, zero missing file paths on Docker/Kubernetes/cPanel/Air-gapped offline networks.

---

## ⚡ Quick Start: Is that all to run docs on any project?

**Yes! Literally 2 steps and 3 lines of code on any router:**

### 1. Install the package
```bash
go get github.com/Natykufsky/go-apidocs
```

### 2. Mount it on your favorite router

#### 🚀 Chi Router (`cmd/api/main.go` / `chi`)
```go
package main

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/Natykufsky/go-apidocs"
	chiadapter "github.com/Natykufsky/go-apidocs/chi"
)

func main() {
	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	// 🚀 Register all docs, auth gate, QA tracking & portals on Chi router
	chiadapter.Mount(r, apidocs.Config{
		SpecFilePath: "./docs/swagger.json",
		Title:        "Platform API Portal",
		AuthUser:     "admin",
		AuthPassword: "SecretPassword",
	})

	r.Get("/api/v1/health", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"status":"ok"}`))
	})

	http.ListenAndServe(":8080", r)
}
```

#### 🚀 Gin Router (`cmd/api/main.go` / `gin`)
```go
package main

import (
	"github.com/gin-gonic/gin"
	"github.com/Natykufsky/go-apidocs"
	ginadapter "github.com/Natykufsky/go-apidocs/gin"
)

func main() {
	r := gin.Default()

	// 🚀 Register all docs, auth gate, QA tracking & portals on Gin router
	ginadapter.Mount(r, apidocs.Config{
		SpecFilePath: "./docs/swagger.json",
		Title:        "Platform API Portal",
		AuthUser:     "admin",
		AuthPassword: "SecretPassword",
	})

	r.GET("/api/v1/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	r.Run(":8080")
}
```

#### 🚀 Fiber Router (`cmd/api/main.go` / `fiber`)
```go
package main

import (
	"github.com/gofiber/fiber/v2"
	"github.com/Natykufsky/go-apidocs"
)

func main() {
	app := fiber.New()

	// 🚀 Mount the entire docs, security gate, QA tracker & portals on Fiber
	apidocs.Mount(app, apidocs.Config{
		SpecFilePath: "./docs/swagger.json",
		Title:        "Platform API Portal",
		AuthUser:     "admin",
		AuthPassword: "SecretPassword",
	})

	app.Get("/api/v1/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})

	app.Listen(":8080")
}
```

Now open **`http://localhost:8080/docs`** (or **`http://localhost:8080/`**) in your browser! 🎉

---

## 🔑 Automatic Token, Multi-Tenant & Custom Header Interception

`go-apidocs` features smart request and response interceptors built directly into the Swagger sandbox:

### 1. Automatic Login Capture
When you test any authentication endpoint (such as `POST /api/auth/login` or `POST /api/token`), `go-apidocs` automatically detects JSON response keys:
* **Access Tokens**: `token`, `access_token`, `accessToken`, `jwt`, `bearer_token`
* **Refresh Tokens**: `refresh_token`, `refreshToken`
* **Tenant IDs**: `tenant_id`, `tenantId`, `tenant`
* **Entity IDs**: `entity_id`, `entityId`, `entity`

Values are immediately stored in browser `localStorage` and a toast notification confirms auto-synchronization.

### 2. Automatic Header Injection
All subsequent API Sandbox calls automatically attach:
* `Authorization: Bearer <stored_token>`
* `X-Tenant-ID: <stored_tenant_id>`
* `X-Entity-ID: <stored_entity_id>`
* `X-Refresh-Token: <stored_refresh_token>`
* Any user-defined custom headers (e.g. `X-Account-Key`, `X-App-Client`).

### 3. Credential Manager & Code Snippet Generator
* Click **Tokens / Credentials (🔐)** in the navbar or subheader to inspect, edit, copy, or clear stored credentials.
* Open the **Snippets** generator on any endpoint to view ready-to-run **cURL**, **Go**, **Node.js**, or **Python** code pre-populated with your captured tokens.

---

## 📥 How Developers Can Import Their OpenAPI Spec

`go-apidocs` gives developers **4 flexible ways** to import their OpenAPI specs:

### Option 1: Single Monolithic `swagger.json` / `openapi.json`
Point `SpecFilePath` directly to your generated OpenAPI file (from tools like `swag`, `oapi-codegen`, `go-swagger`, or Postman exports):

```go
apidocs.Mount(app, apidocs.Config{
    SpecFilePath: "./docs/swagger.json", // or "./api/openapi.json"
    Title:        "My API Documentation",
})
```

### Option 2: Modular Multi-File Schema Structure (Zero Merge Conflicts)
As APIs scale, monolithic files cause Git merge conflicts. You can split your spec into modular files:
- `docs/swagger_base.json` (OpenAPI version, server URLs, security schemes)
- `docs/schemas.json` (Reusable DTO models)
- `docs/paths/*.json` (One JSON file per domain / controller, e.g. `auth.json`, `orders.json`)

```go
apidocs.Mount(app, apidocs.Config{
    DocsDir:  "./docs",       // Contains swagger_base.json and schemas.json
    PathsDir: "./docs/paths", // Auto-merges all JSON path files
})
```
`go-apidocs` automatically merges all schemas and paths in memory without requiring manual build scripts!

### Option 3: In-Browser Live Drag & Drop / File Upload (📥 Import Spec)
Developers and QA testers can import any local `swagger.json` or `openapi.json` file directly into the sandbox UI:
1. Open the sandbox at **`/docs`**.
2. Click the **📥 Import Spec** button in the top toolbar.
3. Select your local `.json` or `.yaml` file. The Swagger explorer and real-time QA testing suite will immediately render the imported endpoints in memory without restarting the backend!

### Option 4: Embedded Binary Distribution (`//go:embed`)
For standalone or offline binaries where no external files exist on disk, embed your spec directly in Go:

```go
//go:embed docs/*
var embeddedDocs embed.FS

apidocs.Mount(app, apidocs.Config{
    EmbeddedFS:   &embeddedDocs,
    SpecFilePath: "docs/swagger.json",
})
```

---

## 📦 Standalone Binary Releases (No Go Environment Required)

If you or your team use Node.js, Python, Java, PHP, or C# and don't have Go installed, you can download the precompiled single binary directly from GitHub Releases:

1. Go to **[GitHub Releases](https://github.com/Natykufsky/go-apidocs/releases)**.
2. Download the binary for your platform (`go-apidocs-linux-amd64`, `go-apidocs-darwin-arm64`, or `go-apidocs-windows-amd64.exe`).
3. Run it pointing to your OpenAPI file:
   ```bash
   ./go-apidocs --spec=./docs/swagger.json --readme=./README.md --port=8080
   ```
   Or install via `go install`:
   ```bash
   go install github.com/Natykufsky/go-apidocs/cmd/go-apidocs@latest
   ```

---

## 🔐 Managing Passwords & Security for Offline & Enterprise Usage

`go-apidocs` includes a zero-dependency **Authentication Gate** designed for air-gapped environments, offline local networks, staging environments, and internal enterprise systems:

```mermaid
graph TD
    A["Developer / QA Browser"] -->|GET /docs| B{"Valid Session Cookie?"}
    B -->|Yes| C["Display Portal / Sandbox"]
    B -->|No / Expired| D["Redirect to /docs/login"]
    D -->|Submit Credentials| E{"Valid AuthUser & Password?"}
    E -->|Yes| F["Issue 24h HMAC Cookie"] --> C
    E -->|No| G["Return 401 Unauthorized"]
```

### 1. Environment Variable Configuration (Recommended for Docker/K8s/CI)
No hardcoded passwords in source code. `go-apidocs` automatically reads standard environment variables:

```bash
export DOCS_AUTH_USER="developer"
export DOCS_AUTH_PASS="SuperSecretPassword123!"
export JWT_SECRET="cryptographic_signing_key_32_chars"
export DOCS_AUTH_ENABLED="true"
```

```go
// Reads directly from environment variables when fields are left blank
apidocs.Mount(app, apidocs.Config{
    Title: "Air-Gapped Core API",
})
```

### 2. Code-Level Configuration
```go
apidocs.Mount(app, apidocs.Config{
    AuthUser:     "staging_tester",
    AuthPassword: "StrongPassword2026#",
    JWTSecret:    "custom_hmac_secret_key",
})
```

---

## 🛠️ Configuration Reference

```go
cfg := apidocs.Config{
    // Base directory for documentation assets and OpenAPI schema files (default: "./docs")
    DocsDir: "./docs",

    // Optional modular directory containing endpoint json files (default: "<DocsDir>/paths")
    PathsDir: "./docs/paths",

    // Path to your project README markdown file (default: "<DocsDir>/README.md" or "./README.md")
    ReadmePath: "./README.md",

    // Path to your monolithic swagger.json (default: "<DocsDir>/swagger.json")
    SpecFilePath: "./docs/swagger.json",

    // Title displayed on Swagger UI and QA Audit reports
    Title: "My REST API Documentation",

    // Subtitle displayed in header brand
    Subtitle: "Developer Portal & QA Hub",

    // Brand emoji or icon
    BrandIcon: "⚡",

    // Unified Mobile-First Header Navigation (configurable in Go or loaded via /docs/nav JSON API)
    NavItems: []apidocs.NavItem{
        {Label: "Home", URL: "/", Icon: "🏠"},
        {Label: "Guide", URL: "/guide", Icon: "📖"},
        {Label: "API Sandbox", URL: "/docs", Icon: "⚡"},
        {Label: "Health", URL: "/dashboard", Icon: "📊"},
        {Label: "OpenAPI Spec", URL: "/docs/swagger.json", Icon: "📄", IsButton: true},
    },

    // Username for docs login (auto-reads from DOCS_AUTH_USER if empty)
    AuthUser: "developer",

    // Password for docs login (auto-reads from DOCS_AUTH_PASS if empty)
    AuthPassword: "MySuperSecurePassword!",

    // Secret key for HMAC cookie signatures (auto-reads from JWT_SECRET if empty)
    JWTSecret: "super_secret_session_signing_key",

    // Path where server-side QA test notes & comments are saved (default: "./docs/qa_tracker.json")
    QAStoragePath: "./docs/qa_tracker.json",

    // Optional: Map custom shorthand query modules (?module=auth) to OpenAPI tag names
    ModuleTagMap: map[string][]string{
        "auth":  {"01. Authentication & Identity"},
        "users": {"02. User Management"},
    },
}

// Mount on Chi
apidocs.MountChi(chiRouter, cfg)

// Mount on Gin
apidocs.MountGin(ginRouter, cfg)

// Mount on Fiber
apidocs.Mount(fiberApp, cfg)

// Mount on standard net/http ServeMux
apidocs.MountNetHTTP(mux, cfg)
```

---

## 📡 Built-In Endpoints

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| **`/`** | `GET` | Developer Landing Hub with README.md markdown reader, Safe Mode secret redactor, and live endpoint stats. |
| **`/guide`** | `GET` | ReadMe-style interactive Developer Reference powered by Scalar (supports deep links like `#description/introduction`). |
| **`/docs`** | `GET` | Interactive Swagger UI Sandbox with QA checklist overlay, scope filters, and auto token/tenant interceptor. |
| **`/docs/nav`** | `GET` | JSON endpoint delivering unified navigation links, brand titles, and menu structure. |
| **`/docs/readme`** | `GET` | Returns the raw project `README.md` markdown content. |
| **`/docs/login`** | `GET/POST` | Password login gate with HMAC session cookie authentication. |
| **`/docs/logout`** | `GET` | Invalidates docs session cookie and redirects to login. |
| **`/docs/swagger.json`** | `GET` | Dynamic OpenAPI JSON spec (supports `?module=...` and `?tag=...`). |
| **`/docs/qa/data`** | `GET` | Returns all recorded QA test statuses and comments across the team. |
| **`/docs/qa/record`** | `POST` | Upserts a test status (`passed`, `failed`, `retest`, `untested`) and comment. |
| **`/docs/qa/report`** | `GET` | Live formatted Markdown and Excel (`.csv`) QA report table. |
| **`/docs/qa/reset`** | `POST` | Clears all QA test data on the server to start a fresh sprint. |
| **`/dashboard`** | `GET` | System health and API status overview dashboard. |

---

## 🧪 Interactive QA Testing Flow & Modals

The built-in QA Suite allows engineering and QA teams to review APIs collaboratively:

1. **In-Endpoint Status Badges & Comment Previews**: Clean status pill next to each endpoint method with note snippet tooltips.
2. **Dedicated QA Sprint Report Modal**: Click **QA Report** to view testing completion metrics, filter endpoints by status, and search test comments.
3. **📊 1-Click Excel (.csv) & Markdown Audit Reports**:
   - **Export to Excel (`.csv`)**: One-click download formatted with UTF-8 BOM and RFC 4180 escaping for instant spreadsheet opening in Microsoft Excel or Google Sheets.
   - **Download Markdown (`.md`)**: Formatted Markdown audit table ready to paste into GitHub Issues, PRs, or Jira.
   - **REST API Automation**: Download reports programmatically via `GET /docs/qa/report?format=csv` or `GET /docs/qa/report?format=excel`.
4. **Endpoint Inspector Modal**: Click **QA** on any endpoint to review details, toggle statuses (`Passed`, `Needs Retest`, `Failed / Bug Found`, `Untested`), view code snippets, document bug reproduction steps, and navigate sequentially across endpoints using **Previous** / **Next** controls.

---

## 👥 Using `go-apidocs` in Any Stack (Node.js, Python, Java, PHP, Rust)

You don't need to be a Go developer to use `go-apidocs`. Run it as a **standalone documentation microservice / container sidecar** for your backend:

```mermaid
graph LR
    A["Your App (Node / Python / Java / PHP)"] -->|Exports| B["docs/swagger.json & README.md"]
    C["go-apidocs Server"] -->|Serves & Protects| B
    D["Team / Developers / QA"] -->|Access :8080| C
```

### Option A: Standalone Docker Container
```bash
docker run -d \
  -p 8080:8080 \
  -v $(pwd)/docs:/docs \
  -v $(pwd)/README.md:/docs/README.md \
  -e DOCS_AUTH_USER="admin" \
  -e DOCS_AUTH_PASS="SuperSecretPassword" \
  natykufsky/go-apidocs:latest
```

### Option B: Standalone Precompiled Binary
Download the precompiled single binary release and run:
```bash
./go-apidocs --spec=./docs/swagger.json --readme=./README.md --port=8080
```

---

## 📁 Recommended Project Layout & Modular OpenAPI Paths

```text
your-project/
├── cmd/api/main.go
├── README.md                 # Project README (automatically rendered on /)
├── docs/
│   ├── swagger.json          # Master generated/merged OpenAPI 3.0 specification
│   ├── schemas.json          # Reusable shared DTO/model definitions
│   ├── qa_tracker.json       # Auto-created by go-apidocs for QA notes
│   └── paths/                # (Optional & Recommended) Modular endpoint definitions
│       ├── auth.json         # Authentication & Identity routes
│       ├── users.json        # User profile & management routes
│       ├── billing.json      # Invoices & wallet payment routes
│       └── messaging.json    # Core business API routes
```

---

## 💬 Community, Support & Author

- 👨‍💻 **Author & Maintainer**: **[Eng. Kufre N. Moses (Natykufsky)](https://github.com/Natykufsky)**
- 📧 **Direct Inquiries & Support**: [natykufsky@gmail.com](mailto:natykufsky@gmail.com)
- 🐛 **Found a bug or have an idea?** [Open a GitHub Issue](https://github.com/Natykufsky/go-apidocs/issues)
- ⭐ **Star the Repo**: If you find `go-apidocs` helpful, please give it a star on [GitHub](https://github.com/Natykufsky/go-apidocs)!

---

## 📄 License

This project is open-source and licensed under the [MIT License](LICENSE).

Copyright (c) 2026 **[Eng. Kufre N. Moses (Natykufsky)](https://github.com/Natykufsky)**.
