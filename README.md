<div align="center">

# 📚 go-apidocs

### The All-In-One Swagger UI, Security Gate & Real-Time QA Testing Portal for Go

[![Go Reference](https://pkg.go.dev/badge/github.com/Natykufsky/go-apidocs.svg)](https://pkg.go.dev/github.com/Natykufsky/go-apidocs)
[![Go Report Card](https://goreportcard.com/badge/github.com/Natykufsky/go-apidocs)](https://goreportcard.com/report/github.com/Natykufsky/go-apidocs)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/Natykufsky/go-apidocs/pulls)
[![Maintenance](https://img.shields.io/badge/Maintained%3F-yes-green.svg)](https://github.com/Natykufsky/go-apidocs/graphs/commit-activity)

<p align="center">
  <strong>Drop-in OpenAPI 3.0 Documentation • Password Access Gate • Team-Wide QA Checklist & Commenting • Instant Markdown Audit Reports • Zero Deployment Dependencies</strong>
</p>

</div>

---

## 🌟 Why `go-apidocs`?

Standard Swagger UI solutions only display static API contracts. **`go-apidocs`** turns your API documentation into a complete **Developer & QA Collaboration Hub**:

1. **🔒 Password Security Gate (`/docs/login`)**: Protect staging and production API specs from unauthorized eyes with cryptographic HMAC-signed session cookies.
2. **🧪 Live Team QA Checklist**: QA testers and developers can mark endpoints (`🟢 Passed`, `🟡 Needs Retest`, `🔴 Failed / Bug Found`) and leave notes directly on each endpoint box.
3. **💾 Real-Time Team Synchronization**: All QA statuses and comments automatically sync to the backend server (`/docs/qa/*`) so the entire engineering team sees the exact same test progress.
4. **📋 Automated Executive Audit Reports (`/docs/qa/report`)**: Generate live Markdown reports of all tested endpoints with bug notes ready to paste into GitHub Issues, Jira, or Slack.
5. **⚡ Smart Token & Header Auto-Injector**: Automatically captures Bearer JWT tokens and tenant IDs upon login in Swagger UI and injects them into subsequent test requests.
6. **📦 100% Self-Contained (`//go:embed`)**: All HTML, CSS, and JS files are compiled directly into your Go binary. Zero CDN downtime, zero missing file paths on Docker/Kubernetes/cPanel.

---

## ⚡ Quick Start: Is that all to run docs on any project?

**Yes! Literally 2 steps and 3 lines of code:**

### 1. Install the package
```bash
go get github.com/Natykufsky/go-apidocs
```

### 2. Mount it in your `main.go`
```go
package main

import (
	"github.com/gofiber/fiber/v2"
	"github.com/Natykufsky/go-apidocs"
)

func main() {
	app := fiber.New()

	// 🚀 Mount the entire docs, security gate, QA tracker & Swagger UI
	apidocs.Mount(app, apidocs.Config{
		SpecFilePath: "./docs/swagger.json",
		Title:        "HarvestPad Platform API",
		AuthUser:     "admin",          // Optional: Reads from DOCS_AUTH_USER env if omitted
		AuthPassword: "SecretPassword", // Optional: Reads from DOCS_AUTH_PASS env if omitted
	})

	// Your existing API routes...
	app.Get("/api/v1/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})

	app.Listen(":8080")
}
```

Now open **`http://localhost:8080/docs`** in your browser! 🎉

---

## 🛠️ Configuration Reference

```go
apidocs.Mount(app, apidocs.Config{
    // Path to your swagger.json or openapi.json file (default: "./docs/swagger.json")
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
})
```

---

## 📡 Built-In Endpoints

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| **`/docs`** | `GET` | Interactive Swagger UI with live QA checklist overlay and module filters. |
| **`/docs/nav`** | `GET` | JSON endpoint delivering unified navigation links, brand titles, and menu structure. |
| **`/docs/login`** | `GET/POST` | Password login gate with HMAC session cookie authentication. |
| **`/docs/logout`** | `GET` | Invalidates docs session cookie and redirects to login. |
| **`/docs/swagger.json`** | `GET` | Dynamic OpenAPI JSON spec (supports `?module=...` and `?tag=...`). |
| **`/docs/qa/data`** | `GET` | Returns all recorded QA test statuses and comments across the team. |
| **`/docs/qa/record`** | `POST` | Upserts a test status (`passed`, `failed`, `retest`, `untested`) and comment. |
| **`/docs/qa/report`** | `GET` | Live formatted Markdown QA report table (`?format=json` supported). |
| **`/docs/qa/reset`** | `POST` | Clears all QA test data on the server to start a fresh sprint. |
| **`/guide`** | `GET` | Developer integration and onboarding guide portal. |
| **`/dashboard`** | `GET` | System health and API status overview dashboard. |

---

## 🤝 Collaboration & Contributor Roadmap

We believe API documentation shouldn't just be static HTML—it should be a **collaborative workspace** connecting backend engineers, frontend developers, QA testers, and product managers.

Whether you want to contribute in **Go**, **TypeScript / React**, **UI/UX Design**, or **Documentation**, here is where we're headed and where we need your help:

### 🗺️ High-Impact Contribution Areas:

#### 1. 🌐 Multi-Router Ecosystem Adapters
Expand framework coverage beyond Fiber with drop-in adapters:
- [ ] **Gin Adapter** (`github.com/Natykufsky/go-apidocs/gin` -> `apidocs.MountGin(r, cfg)`)
- [ ] **Chi / net/http Adapter** (`github.com/Natykufsky/go-apidocs/chi` -> `apidocs.MountChi(r, cfg)`)
- [ ] **Echo Adapter** (`github.com/Natykufsky/go-apidocs/echo` -> `apidocs.MountEcho(e, cfg)`)

#### 2. 💾 Multi-Tenant QA Persistence Backends
Enable distributed teams to sync test results without relying only on local JSON:
- [ ] **PostgreSQL / MySQL Driver** (stores QA test runs directly in your database via `gorm` or `sqlx`)
- [ ] **SQLite Embedded Driver** (lightweight zero-config persistence for local containers)
- [ ] **Redis Streams Driver** (pub/sub live test notifications across the engineering team)

#### 3. 🎨 Next-Gen React UI (`/ui`)
Extend the React 18 + TypeScript + Tailwind portal with rich tooling:
- [ ] **Multi-Language Code Snippet Generator** (instant cURL, JavaScript `fetch`/`axios`, Python `requests`, Go `net/http`, and PHP snippets)
- [ ] **Interactive Webhook Simulator** (trigger test delivery payloads and inspect HMAC signatures in real time)
- [ ] **Mock Server Simulator** (generate instant mock JSON responses directly in browser without a live backend)
- [ ] **Dark / Light Theme Switcher** with persistent user preference
- [ ] **1-Click Postman & Insomnia Collection Exporter**

#### 4. 📢 Team Notifications & CI/CD Integrations
- [ ] **Slack & Discord Webhook Alerts** (automatically notify your dev channel when QA marks an endpoint as `🔴 FAILED / BUG`)
- [ ] **GitHub Actions / GitLab CI Runner** (fail automated builds if untested or broken endpoints exist)

---

### 🎨 Frontend React UI Development (`/ui`):
The UI is built with **React 18 + Vite + TypeScript + Tailwind CSS**:
```bash
cd ui
npm install
npm run dev    # Starts hot-reloading dev server on http://localhost:3000
npm run build  # Compiles production bundle directly into ../assets/dist/
```

### 🛠️ Step-by-Step Contribution Workflow:
1. **Fork the Repository**: Click the `Fork` button on [GitHub](https://github.com/Natykufsky/go-apidocs).
2. **Clone your fork**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/go-apidocs.git
   cd go-apidocs
   ```
3. **Create a Feature Branch**:
   ```bash
   git checkout -b feat/multi-router-gin-adapter
   ```
4. **Commit & Push**:
   ```bash
   git commit -m "feat(gin): add native Gin framework router adapter"
   git push origin feat/multi-router-gin-adapter
   ```
5. **Open a Pull Request**: Submit your PR with a clear description and tests. We review and merge active PRs quickly!

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
