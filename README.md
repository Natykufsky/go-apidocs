<div align="center">

# 📚 go-apidocs

### The All-In-One Swagger UI, Multi-API Workspace Hub, OWASP Cybersecurity Suite & QA Portal for Go

[![Go Reference](https://pkg.go.dev/badge/github.com/Natykufsky/go-apidocs.svg)](https://pkg.go.dev/github.com/Natykufsky/go-apidocs)
[![Go Report Card](https://goreportcard.com/badge/github.com/Natykufsky/go-apidocs)](https://goreportcard.com/report/github.com/Natykufsky/go-apidocs)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/Natykufsky/go-apidocs/pulls)
[![Maintenance](https://img.shields.io/badge/Maintained%3F-yes-green.svg)](https://github.com/Natykufsky/go-apidocs/graphs/commit-activity)

<p align="center">
  <strong>Multi-Tenant SaaS Platform • Multi-Provider AI Suite (NVIDIA DeepSeek, OpenAI, Anthropic, Ollama) • In-Browser Automated Test Runner • SaaS Theme Customizer • Automated OWASP Cybersecurity Audit • Live Security Headers Analyzer • Automatic Token Capture • ReadMe Developer Guide • Multi-Language Code Snippets • 1-Click Excel & Markdown Audit Reports • Zero Deployment Dependencies</strong>
</p>

</div>

---

## 🌟 Why `go-apidocs`?

Standard Swagger UI solutions only display a single static API contract. **`go-apidocs`** transforms your documentation into an enterprise-grade **Multi-Tenant SaaS Platform, Multi-Provider AI Test Generation Studio, Automated Test Execution Runner, Cybersecurity Audit Engine & QA Collaboration Suite**:

1. **🤖 Multi-Provider AI Test Generation Suite**: Synthesizes test cases covering *Happy Paths*, *Boundary & Edge Cases*, *Negative & Error Handling*, and *Security & Injection Probes* using **NVIDIA NIM (DeepSeek v4.1)**, **OpenAI (GPT-4o)**, **Anthropic (Claude 3.5 Sonnet)**, or **Local Ollama** (100% air-gapped / offline).
2. **▶️ In-Browser Automated Test Execution Runner**: Execute synthesized test scenarios directly against live API endpoints from within the portal with instant assertion verification, timing metrics, and pass/fail reporting.
3. **🏢 Multi-Tenant SaaS Gateway & Usage Quotas (`/api/v1/saas/*`)**: Multi-tenant isolation with subdomain resolution, live token metering, custom storage limits, and Stripe webhook subscription lifecycle management.
4. **🎨 Dynamic Tenant Theme Customizer**: Real-time portal branding with custom primary/accent color palettes, custom logos, and CSS stylesheets per organization.
5. **🏢 Multi-Service Workspaces (`/docs/workspaces`)**: Organize, switch, and manage multiple microservices, APIs, and environments (`Local`, `Staging`, `Production`) from a unified workspace switcher in the navbar.
6. **📥 Pre-Flight Schema Importer**: Upload OpenAPI JSON/YAML files or fetch remote URLs with client-side syntax verification, operation count preview, and direct launch into the Swagger sandbox.
7. **🛡️ Automated OWASP API Top 10 Cybersecurity Audit**: Static analysis engine scans OpenAPI definitions for missing authentication on mutating routes, exposed API credentials/keys in examples, and unbounded schemas, assigning an overall security posture score (0–100) and letter grade (`A+` to `F`).
8. **🔒 Live Environment Security Headers Analyzer**: Probes target environments for `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options`, `Strict-Transport-Security` (HSTS), and CORS misconfigurations using an SSRF-hardened client.
9. **🧪 Client-Side Fuzzing Payloads**: 1-click injection presets for SQL Injection (SQLi), Cross-Site Scripting (XSS), and boundary/overflow limits for browser-side testing.
10. **🏠 Interactive Developer Hub (`/`)**: Automatically renders your project's `README.md` with authentic GitHub typography, **Secret Masking Safe Mode** (redacts passwords, JWTs, DB strings), and displays live endpoint statistics and microservice cards.
11. **🔐 Automatic Token & Multi-Tenant Credential Interceptor**: Testing a login/token endpoint automatically captures `access_token`, `refresh_token`, `tenant_id`, and `entity_id`, immediately attaching them to all subsequent requests.
12. **💻 Multi-Language Code Snippet Generator**: 1-click generation of production-ready **cURL**, **Go**, **Node.js (`fetch`)**, and **Python (`requests`)** code snippets pre-populated with active authorization tokens.
13. **📖 ReadMe-Style Developer Guide (`/guide`)**: Interactive multi-column developer reference powered by Scalar with full support for hash anchors, search, and multi-language snippets.
14. **⚡ Swagger UI Sandbox (`/docs`)**: Interactive API playground with "Try It Out", token persistence, clean in-endpoint QA badges with comment previews, and real-time response PII leakage detection.
15. **🔒 Password Security Gate (`/docs/login`)**: Protect staging and production API specs with cryptographic HMAC-signed session cookies and zero external auth dependencies.
16. **📋 Automated Executive Audit Reports (`/docs/qa/report`)**: Generate live Markdown and RFC 4180 Excel (`.csv`) reports of all tested endpoints with bug notes ready for GitHub Issues or Jira.
17. **📦 100% Self-Contained (`//go:embed`)**: All React UI assets, CSS, and JS files are compiled directly into your Go binary. Zero CDN downtime, zero missing file paths on Docker/Kubernetes/cPanel/Air-gapped offline networks.

---

## ⚡ Quick Start: 3 Lines of Code on Any Router

### 1. Install the package
```bash
go get github.com/Natykufsky/go-apidocs
```

### 2. Mount it on your favorite router

#### 🚀 Fiber Router (`main.go`)
```go
package main

import (
	"github.com/gofiber/fiber/v2"
	"github.com/Natykufsky/go-apidocs"
)

func main() {
	app := fiber.New()

	// 🚀 Register all docs, workspace hub, security audit & QA portal
	apidocs.Mount(app, apidocs.Config{
		SpecFilePath: "./docs/swagger.json",
		Title:        "Enterprise API Hub",
		AuthUser:     "admin",
		AuthPassword: "SecretPassword",
	})

	app.Listen(":8080")
}
```

#### 🚀 Chi Router (`main.go`)
```go
package main

import (
	"net/http"
	"github.com/go-chi/chi/v5"
	"github.com/Natykufsky/go-apidocs"
	chiadapter "github.com/Natykufsky/go-apidocs/chi"
)

func main() {
	r := chi.NewRouter()

	chiadapter.Mount(r, apidocs.Config{
		SpecFilePath: "./docs/swagger.json",
		Title:        "Platform API Portal",
	})

	http.ListenAndServe(":8080", r)
}
```

#### 🚀 Gin Router (`main.go`)
```go
package main

import (
	"github.com/gin-gonic/gin"
	"github.com/Natykufsky/go-apidocs"
	ginadapter "github.com/Natykufsky/go-apidocs/gin"
)

func main() {
	r := gin.Default()

	ginadapter.Mount(r, apidocs.Config{
		SpecFilePath: "./docs/swagger.json",
		Title:        "Service API Portal",
	})

	r.Run(":8080")
}
```

---

## 🏢 Workspaces & Multi-API Configuration

You can configure multiple microservices and workspaces directly in Go:

```go
apidocs.Mount(app, apidocs.Config{
	Title:            "FinTech Microservices Portal",
	EnableWorkspaces: true,
	NVIDIA: apidocs.NVIDIAConfig{
		APIKey: "nvapi-...", // Or set NVIDIA_API_KEY env variable
		Model:  "deepseek-ai/deepseek-v4.1-flash",
	},
	Workspaces: []apidocs.Workspace{
		{
			ID:          "payments",
			Name:        "Payment Services",
			Description: "Billing, Checkout & Bank Integrations",
			Icon:        "💳",
			Services: []apidocs.APIService{
				{
					ID:           "invoicing",
					Title:        "Invoicing API",
					Version:      "2.1.0",
					SpecFilePath: "./docs/payments/invoicing.json",
					Environments: map[string]string{
						"Local":   "http://localhost:8081",
						"Staging": "https://staging-pay.example.com",
					},
				},
				{
					ID:           "checkout",
					Title:        "Checkout API",
					Version:      "1.4.0",
					SpecFilePath: "./docs/payments/checkout.json",
				},
			},
		},
		{
			ID:          "identity",
			Name:        "Identity & Access",
			Icon:        "🔐",
			Services: []apidocs.APIService{
				{
					ID:           "oauth",
					Title:        "OAuth & User Service",
					Version:      "3.0.0",
					SpecFilePath: "./docs/auth/swagger.json",
				},
			},
		},
	},
})
```

---

## 🐳 Microservice & Standalone Deployment

`go-apidocs` can run as an independent microservice container with persistent volume storage for uploaded schemas:

```bash
# Set your NVIDIA API key for DeepSeek test generation
export NVIDIA_API_KEY="nvapi-your-key"

# Launch via Docker Compose
docker compose up -d
```

Or run directly via Go CLI:
```bash
go run ./cmd/go-apidocs --spec=./docs/swagger.json --port=8080 --workspaces=true
```

---

## 🛡️ Production-Hardened Security Model

`go-apidocs` is designed with a **zero-trust, deny-by-default architecture**:

1. **Explicit Feature Opt-In**: Write routes (`EnableWorkspaceWrites`) and security scanning (`EnableSecurityAudit`) are disabled by default.
2. **Mandatory `Authorizer` Gate**: If write or security features are enabled without providing an `Authorizer`, the library fails closed on boot.
3. **SSRF-Hardened Client**: Outbound requests verify resolved IP addresses at dial time, immediately blocking loopback, RFC1918 private, link-local, multicast, and cloud metadata (`169.254.169.254`) ranges while defeating DNS rebinding.
4. **Sandboxed Storage Root**: Uploaded specs are written to a sandboxed directory (`StorageRoot`, default `./apidocs-data`) with strict path traversal checking (`SafeJoin`), symlink rejection, atomic writes (`*.tmp -> os.Rename`), and UUID filenames.
5. **Anti-DoS / Bomb Protection**: Strict 5MB size caps, YAML depth (64) and node count (100k) recursion limits to prevent expansion bombs.
6. **Default CSP & Security Headers**: Every `/docs/*` response includes `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and `Referrer-Policy: no-referrer`.

---

## 📡 Built-In Endpoints

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| **`/`** | `GET` | Developer Landing Hub with microservice cards, README markdown reader, and live stats. |
| **`/guide`** | `GET` | ReadMe-style interactive Developer Reference powered by Scalar. |
| **`/docs`** | `GET` | Interactive Swagger UI Sandbox with QA checklist overlay and token interceptor. |
| **`/docs/capabilities`** | `GET` | Returns runtime feature flags and security policy to the frontend SPA. |
| **`/docs/workspaces`** | `GET` | Catalog of all configured workspaces, services, and environments. |
| **`/docs/workspaces/import`** | `POST` | Upload and import an OpenAPI JSON/YAML specification into a workspace. |
| **`/docs/security/audit`** | `GET` | Automated OWASP security analysis and live environment security headers audit. |
| **`/docs/swagger.json`** | `GET` | Dynamic OpenAPI JSON spec (supports `?ws=...&svc=...&module=...`). |
| **`/docs/qa/data`** | `GET` | Returns all recorded QA test statuses and comments for the active service. |
| **`/docs/qa/record`** | `POST` | Upserts a test status (`passed`, `failed`, `retest`, `untested`) and comment. |
| **`/docs/qa/report`** | `GET` | Live formatted Markdown and Excel (`.csv`) QA report table. |
| **`/docs/login`** | `GET/POST` | Password login gate with HMAC session cookie authentication. |
| **`/dashboard`** | `GET` | System health and API status overview dashboard. |

---

## 🧪 Interactive QA & Cybersecurity Flow

1. **Workspace Switcher**: Select between microservices in the top navigation bar.
2. **In-Endpoint Status Badges & Comment Previews**: QA pills next to each endpoint method with note snippet tooltips.
3. **Dedicated QA Sprint Report Modal**: Click **QA Report** to view testing completion metrics and export to Excel / Markdown.
4. **OWASP Cybersecurity Scanner**: Click **Security** to view the vulnerability score, letter grade, remediation guidance, and client-side fuzzing payloads.
5. **Real-Time PII & Leak Alerts**: Sandbox detects unmasked credentials, private keys, and database query error traces in live response bodies.

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
