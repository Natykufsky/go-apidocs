Below is a hardened, production-ready revision of the plan. The core idea: **treat `go-apidocs` as an administrative/QA surface that lives inside someone else's server process** — so every new feature is deny-by-default, confined to a single storage root, and incapable of being used as an SSRF/RCE/DoS pivot against the host.

---

# Implementation Plan: Workspace Hub, Pre-Flight Schema Importer & QA Cybersecurity Suite (Production-Hardened)

Transform `go-apidocs` into an enterprise-grade **API Workspace Hub, Schema Importer, and Cybersecurity & QA Audit Suite** for Go applications — without ever exposing the host server process, its filesystem, or its internal network to abuse.

---

## 0. What Changed vs. the Original Plan

The original plan was functionally complete but treated the host server as trusted infrastructure. Several features are **attack surfaces** if shipped as described:

| Original feature | Hidden risk | Mitigation in this revision |
|---|---|---|
| "Fetch from remote URL" | SSRF → cloud metadata (`169.254.169.254`), internal admin panels, `localhost`, `file://` | SSRF-hardened HTTP client (dial-time IP blocking, no redirects to private ranges, scheme allowlist) |
| "Upload JSON / YAML" + "Save to Disk" | YAML bombs, path traversal, arbitrary file write, overwrite of host files | Size-capped strict parsers + write only into a sandboxed storage root with sanitized names |
| `POST /docs/workspaces` etc. | Unauthenticated admin API in the host app | Mandatory `Authorizer` gate; deny-by-default; opt-in endpoints |
| "1-Click Fuzzing Payloads" | Turns the host server into a DDoS/attack launcher | Client-side payload generation only (copy/paste), or server-side under strict target allowlist + rate limit + timeout |
| Response body analyzer / PII scan | Logs secrets, leaks into memory/disk | In-memory only, redaction, no persistence of response bodies, opt-in |
| Always-on docs routes | Info disclosure in prod | `Enabled` / `Environment` gate; refuse to mount write routes unless explicitly enabled |
| Memory caching of specs | OOM via huge/decompression-bomb specs | Byte caps, LRU with max total bytes, per-entry TTL |

---

## 1. Security Model & Threat Model (NEW — read first)

### 1.1 Trust boundaries

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ HOST APPLICATION PROCESS (trusted)                                           │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ go-apidocs router (semi-trusted)                                       │  │
│  │   ├─ READ endpoints      → safe-by-default                             │  │
│  │   ├─ WRITE endpoints     → REQUIRE Authorizer + opt-in flag            │  │
│  │   └─ SECURITY endpoints  → REQUIRE Authorizer + admin role + opt-in    │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│        │                                                      │              │
│        ▼                                                      ▼              │
│  [ Sandboxed Storage Root ]                        [ Egress allowlist only ] │
│   ./apidocs-data/  (no symlinks, no ..)            (public HTTPS hosts)      │
└──────────────────────────────────────────────────────────────────────────────┘
        │
        ▼  UNTRUSTED: browser, uploaded specs, fetched URLs, fuzz targets
```

### 1.2 Assumptions

- The **host application is the security authority**. `go-apidocs` never invents its own auth; it consumes an `Authorizer` provided by the host.
- Anything a browser or a remote server sends is **hostile** until proven otherwise.
- The library may run in a container with a read-only filesystem and no outbound network. It must degrade gracefully.
- "Authorized QA" is enforced by the **host**, not by a checkbox in the UI.

### 1.3 Non-goals

- `go-apidocs` is **not** a penetration-testing tool against third parties. The fuzzing UI generates payloads; it does not autonomously attack arbitrary hosts.
- It does **not** replace a WAF, SAST, or DAST pipeline.

---

## 2. Architecture Overview (revised with trust annotations)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ ⚡ GO-APIDOCS ENTERPRISE WORKSPACE & SECURITY PORTAL                                  │
│    (write/admin surfaces require Authorizer + explicit opt-in)                         │
├──────────────────────────┬───────────────────────────────┬─────────────────────────────┤
│ 📁 1. WORKSPACE HUB      │ 📥 2. SCHEMA IMPORTER         │ 🛡️ 3. CYBERSECURITY SUITE   │
│                          │                               │                             │
│ • Multi-Service Catalog  │ • Upload JSON / YAML  [AUTH]  │ • OWASP API Top 10 Audit    │
│ • Workspace Switcher     │ • Fetch remote URL    [AUTH]  │ • Security Header Analysis  │
│ • Environment Management │   → SSRF-hardened client      │ • Sensitive Data/PII Guard  │
│ • Multi-Spec Aggregator  │ • Pre-flight validator        │ • Client-side fuzz payloads │
│ • Per-Service QA Records │ • Sandboxed disk write        │ • Excel/PDF export          │
└──────────────────────────┴───────────────────────────────┴─────────────────────────────┘
     read: gated by Enabled          write: Authorizer + opt-in + audit log
```

---

## 3. Configuration: Secure by Default

Extend `Config` with **explicit opt-ins**. Everything new is **off** unless enabled.

```go
type Config struct {
    // ... existing fields ...

    // Existing single-API compatibility is preserved.

    // ---- Feature gates (default: false) ----
    EnableWorkspaces      bool // mount GET /docs/workspaces, /docs/swagger.json?ws=…
    EnableWorkspaceWrites bool // mount POST /docs/workspaces, /import  (requires Authorizer)
    EnableSecurityAudit   bool // mount /docs/security/*               (requires Authorizer)

    // ---- Authorization (REQUIRED when any write/security feature is on) ----
    // Returning (allowed=false) MUST yield 403. Nil + writes enabled = startup error.
    Authorizer Authorizer

    // ---- Sandboxed storage ----
    // All writes are confined to this root. Defaults to ./apidocs-data
    StorageRoot string
    // Maximum bytes per stored spec (default 5 MiB)
    MaxSpecBytes int64
    // Maximum total bytes held in the in-memory spec cache (default 64 MiB)
    MaxCacheBytes int64

    // ---- SSRF policy for remote spec fetch ----
    RemoteFetch RemoteFetchPolicy

    // ---- Rate limiting for mutating routes ----
    RateLimit RateLimitConfig
}

type Authorizer interface {
    // action is one of "workspace:read", "workspace:write", "security:run", "qa:write"
    Authorize(r *http.Request, action string) (allowed bool, principal string)
}

type RemoteFetchPolicy struct {
    Enabled          bool
    AllowedSchemes   []string // default ["https"]
    HostAllowlist    []string // exact or *.suffix — empty means "deny all"
    MaxBytes         int64    // default 5 MiB
    Timeout          time.Duration // default 5s
    MaxRedirects     int      // default 0 (no redirects)
}

type RateLimitConfig struct {
    Enabled bool
    RPS     float64
    Burst   int
}
```

**Startup validation:** if `EnableWorkspaceWrites || EnableSecurityAudit` and `Authorizer == nil`, return an error from `Mount`. Fail closed at boot, not at request time.

**Compatibility guarantee:** A host that only calls `apidocs.Mount(app, apidocs.Config{...})` with none of the new flags gets exactly today's behavior — no new routes, no new files, no new network calls.

---

## 4. Core Package Changes (with security controls)

### [NEW] `workspace.go`

Data models as before, plus:

- **Storage confinement.** Every path write goes through:

```go
func (m *WorkspaceManager) safeJoin(root, name string) (string, error) {
    clean := filepath.Clean("/" + name)           // strip leading ../
    full := filepath.Join(root, clean)
    rel, err := filepath.Rel(root, full)
    if err != nil || strings.HasPrefix(rel, ".."+string(os.PathSeparator)) || rel == ".." {
        return "", ErrPathEscape
    }
    return full, nil
}
```

- **No symlink following** on the storage root (`O_NOFOLLOW` semantics via `os.Lstat` check before open).
- **Generated filenames.** Never trust the uploaded filename. Store as `{uuid}.{json|yaml}` and keep the original name as metadata only.
- **Bounded cache.** LRU keyed by `(ws, svc)`, evicting when `MaxCacheBytes` is exceeded.
- **Atomic writes.** Write to `*.tmp` then `os.Rename` to avoid partial files on crash.

### [NEW] `security.go`

Split into two engines with different trust levels:

1. **Static spec analysis (safe, pure):** OpenAPI parsed structure only. No network, no execution.
   - Missing `security` on sensitive paths/methods.
   - Hardcoded secrets in `example`/`default` values (regex: AWS keys, JWT, private keys, `ghp_…`, Slack tokens).
   - Loose `additionalProperties`, missing `maxLength`, unbounded arrays.
2. **Live header audit (network, opt-in):** sends a `GET`/`OPTIONS` to the **host-configured** service base URL only, checks `CSP`, `X-Content-Type-Options`, `X-Frame-Options`, `HSTS`, `Referrer-Policy`, CORS.
   - Uses the **same SSRF-hardened client** as remote spec fetch.
   - Target URLs are **not** user-supplied at request time; they come from the service's configured `Environments` map, which only an authorized writer can set.
   - Per-run timeout (2s), max 3 redirects, no body read.

**Fuzzing payloads:** generated as strings and returned to the browser for copy/paste or use in the Swagger "Try it out" form (which sends from the browser, not the server). **The server never sends fuzz payloads to arbitrary hosts.** If a server-side mode is ever added, it must:
- require `security:run` on a target allowlist entry,
- be rate-limited per principal,
- refuse private/link-local IPs,
- hard-cap concurrency to 1.

### [NEW] `safefetch.go` (SSRF-hardened HTTP client)

```go
func newSafeClient(p RemoteFetchPolicy) *http.Client {
    blocked := func(ip netip.Addr) bool {
        ip = ip.Unmap()
        return ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() ||
            ip.IsLinkLocalMulticast() || ip.IsInterfaceLocalMulticast() ||
            ip.IsMulticast() || ip.IsUnspecified() ||
            ip.IsIn(netip.MustParsePrefix("100.64.0.0/10")) || // CGNAT
            ip.IsIn(netip.MustParsePrefix("169.254.0.0/16")) || // metadata
            ip.IsIn(netip.MustParsePrefix("192.0.0.0/24")) ||
            ip.IsIn(netip.MustParsePrefix("198.18.0.0/15")) ||
            ip.IsIn(netip.MustParsePrefix("240.0.0.0/4"))
    }

    dialer := &net.Dialer{Timeout: 3 * time.Second}
    transport := &http.Transport{
        DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
            host, port, err := net.SplitHostPort(addr)
            if err != nil { return nil, err }
            ips, err := net.DefaultResolver.LookupNetIP(ctx, "ip", host)
            if err != nil { return nil, err }
            for _, ip := range ips {
                if blocked(ip) { return nil, ErrBlockedAddress }
            }
            // Dial the *checked* IP, not the hostname → defeats DNS rebinding.
            return dialer.DialContext(ctx, network, net.JoinHostPort(ips[0].String(), port))
        },
        TLSHandshakeTimeout:   3 * time.Second,
        ResponseHeaderTimeout: 3 * time.Second,
        DisableKeepAlives:     true,
    }
    return &http.Client{
        Transport: transport,
        Timeout:   p.Timeout,
        CheckRedirect: func(req *http.Request, via []*http.Request) error {
            if len(via) >= p.MaxRedirects { return http.ErrUseLastResponse }
            return nil
        },
    }
}
```

Plus: scheme allowlist (`https` only by default), host allowlist matching, `io.LimitReader(resp.Body, MaxBytes)`.

### [NEW] `safeimport.go` (upload hardening)

```go
const maxUpload = 5 << 20 // 5 MiB, override via Config.MaxSpecBytes

func ParseSpec(r io.Reader, contentType string) (*Spec, error) {
    limited := io.LimitReader(r, maxUpload+1)
    data, err := io.ReadAll(limited)
    if err != nil { return nil, err }
    if int64(len(data)) > maxUpload { return nil, ErrTooLarge }

    switch {
    case isJSON(contentType, data):
        var raw map[string]any
        dec := json.NewDecoder(bytes.NewReader(data))
        dec.UseNumber()
        if err := dec.Decode(&raw); err != nil { return nil, ErrBadSpec }
        if dec.More() { return nil, ErrBadSpec } // reject trailing docs
        return validateOpenAPI(raw)

    case isYAML(contentType, data):
        // yaml.v3 is safe against arbitrary type instantiation, but we still
        // cap size and depth and reject multiple documents / custom tags.
        var node yaml.Node
        if err := yaml.Unmarshal(data, &node); err != nil { return nil, ErrBadSpec }
        if err := checkYAMLDepth(&node, 0, 64); err != nil { return nil, err }
        var raw map[string]any
        if err := node.Decode(&raw); err != nil { return nil, ErrBadSpec }
        return validateOpenAPI(raw)
    }
    return nil, ErrUnsupportedType
}
```

Rules:
- Content type **and** sniffing must agree; reject `text/html`, `application/octet-stream` disguised as JSON.
- Reject YAML custom tags (`!!python/...` etc.) — `yaml.v3` already doesn't instantiate them, but we explicitly walk the node tree and reject `Tag` values outside the standard set.
- Depth cap (64) and node-count cap (100k) to stop alias-expansion bombs before decoding.
- After parse: must be a JSON object, must contain `openapi`/`swagger` version, must have `paths` as an object.

### [MODIFY] `apidocs.go`

Route table with required permission per route:

| Method | Path | Feature flag | Permission |
|---|---|---|---|
| GET  | `/docs/workspaces` | `EnableWorkspaces` | `workspace:read` (or public if host says so) |
| POST | `/docs/workspaces` | `EnableWorkspaceWrites` | `workspace:write` |
| POST | `/docs/workspaces/import` | `EnableWorkspaceWrites` | `workspace:write` |
| POST | `/docs/workspaces/import/url` | `EnableWorkspaceWrites` + `RemoteFetch.Enabled` | `workspace:write` |
| GET  | `/docs/swagger.json` | `EnableWorkspaces` | `workspace:read` |
| GET  | `/docs/readme` | `EnableWorkspaces` | `workspace:read` |
| GET  | `/docs/qa/data` | `EnableWorkspaces` | `workspace:read` |
| POST | `/docs/qa/record` | `EnableWorkspaceWrites` | `qa:write` |
| GET  | `/docs/security/audit` | `EnableSecurityAudit` | `security:run` |

Every write route additionally:
- enforces `Content-Type` and a body size cap,
- is CSRF-protected (see §6),
- is rate-limited per principal,
- emits a structured audit log line: `{ts, principal, action, ws, svc, remote_ip, result}`.

### [NEW] `workspace_test.go` / `security_test.go`

Tests must include the adversarial cases (see §8).

---

## 5. Frontend Changes

Same component structure as the original plan, with these additions:

### `SchemaImporterModal.tsx`
- **Client-side pre-flight is the default path.** Parsing happens in the browser (with size caps) *before* anything is uploaded.
- Remote URL field shows the configured policy (`AllowedSchemes`, `HostAllowlist`) so users get immediate feedback instead of a server 403.
- Warn banner: *"Server-side fetch is disabled unless your administrator enabled it."*

### `SecurityAuditModal.tsx`
- Clearly labels fuzzing as **payload generation** — buttons copy payloads to clipboard or pre-fill the Swagger sandbox; a prominent notice states requests originate from the browser.
- Export uses a client-generated blob (no server round-trip), so audit data never persists on disk.
- Security score and OWASP breakdown are computed from the static spec + header audit response; no raw response bodies are kept.

### `WorkspaceSwitcher.tsx`
- Shows read-only state when write features are disabled (`EnableWorkspaceWrites=false`) — importer button is hidden, not just disabled.
- Environment selector reads from server-provided config, not free text.

### `LandingView.tsx` / `Navbar.tsx` / `SwaggerSandboxView.tsx`
- All new UI gated on server-provided capability flags (`GET /docs/capabilities`), so the SPA never renders controls the server will reject.

### Security headers on the docs SPA itself
The mount function must set, for all `/docs/*` responses:
```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: no-referrer
Cross-Origin-Opener-Policy: same-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

---

## 6. Cross-Cutting Controls

### CSRF
Mutating routes require **either**:
- a same-origin `Origin`/`Sec-Fetch-Site` header check, **and**
- a custom header (`X-Apidocs-CSRF: 1`) that non-CORS-safelisted, forcing preflight.

No cookies are set by the library itself; auth is delegated to the host's existing session/token mechanism.

### CORS
Never `Access-Control-Allow-Origin: *` on mutating routes. Default: no CORS headers. If the host enables CORS, it must echo an explicit origin and `Access-Control-Allow-Credentials: true` only with an origin allowlist.

### Rate limiting & DoS
- Per-principal token bucket on all write/security routes (`RateLimitConfig`).
- Global concurrency semaphore (default 8) for spec parsing and remote fetch.
- Body size caps on every route, including `GET` (via `MaxBytesReader`).
- Request timeouts: read 5s, write 10s, remote fetch 5s.

### Audit logging
`go-apidocs` does not own a logger. It accepts an optional `AuditLogger func(Event)`; if nil, it writes structured lines to `log/slog` at `INFO`. Never logs request bodies or response bodies. Secrets matched by PII scan are reported as `{type, offset, redacted_length}`, never the value.

### Dependency hygiene
- Pin `gopkg.in/yaml.v3`, `encoding/json` (stdlib), and HTTP client only.
- CI runs `govulncheck ./...` and `go test -race ./...`.
- No `unsafe`, no `reflect.Value.Set` on user data.

### Fail-closed behavior
- Missing `Authorizer` + writes enabled → `Mount` returns error.
- Storage root missing/unwritable + writes enabled → `Mount` returns error.
- Storage root writable + writes disabled → fine, no writes attempted.
- Remote fetch disabled → URL import route not mounted at all (404, not 403).

---

## 7. Router Adapters

`gin/gin.go`, `chi/chi.go`, `cmd/go-apidocs/main.go`:
- Register the new routes only if the corresponding feature flags are set.
- Apply `Authorizer` middleware **before** body parsing.
- Apply rate limiter and CSRF check on mutating routes.
- Preserve the existing single-API mount path unchanged.

---

## 8. Verification Plan

### 8.1 Automated (must pass in CI)

```powershell
go test -race ./...
go vet ./...
govulncheck ./...
```

**Security unit tests (new, required):**

| Area | Test |
|---|---|
| SSRF | Fetch `http://169.254.169.254/latest/meta-data/` → blocked |
| SSRF | Fetch `http://127.0.0.1:8080/` → blocked |
| SSRF | Host resolves to public IP then rebinds to `10.0.0.1` → blocked at dial |
| SSRF | Redirect from public host to `http://10.0.0.1/` → not followed |
| SSRF | `file:///etc/passwd` scheme → rejected |
| SSRF | Response > `MaxBytes` → truncated and rejected |
| Upload | 100 MB JSON body → 413 |
| Upload | YAML anchor bomb (`a: &a [*a,*a,...]`) → rejected within budget |
| Upload | YAML with `!!python/object` tag → rejected |
| Upload | Filename `../../etc/passwd` → stored as UUID inside root |
| Upload | Symlink inside storage root → refused |
| Path | `safeJoin(root, "../../etc/passwd")` → `ErrPathEscape` |
| Auth | Write route with `Authorizer == nil` → `Mount` errors |
| Auth | `Authorizer` returns false → 403, no side effects |
| Auth | Missing CSRF header on POST → 403 |
| Rate | 100 POSTs in 1s from one principal → 429 after burst |
| Headers | SPA responses include CSP, `X-Frame-Options`, `nosniff` |
| Logs | PII match does not print the matched value |

### 8.2 Manual verification

1. Start test server with `EnableWorkspaces=true`, all other flags false. Confirm only read routes exist; `POST /docs/workspaces` → 404.
2. Enable `EnableWorkspaceWrites` **without** `Authorizer` → server refuses to start with a clear error.
3. Enable writes **with** an `Authorizer` that returns false for the test principal → all mutations 403.
4. With an authorized principal: upload a valid OpenAPI JSON and YAML; verify pre-flight counts, then "Save & Launch in Swagger".
5. Attempt to fetch a remote spec from an internal host → blocked; from a host not on `HostAllowlist` → blocked; from an allowlisted public host → succeeds.
6. Enable `EnableSecurityAudit`; run header audit against the configured staging environment; verify it hits only the configured base URL.
7. In Swagger Sandbox, click a fuzz payload → confirm it fills the parameter locally and the request originates from the browser (Network tab shows the browser as originator, not the server).
8. Switch workspaces; confirm QA checklists and endpoints are isolated per service.
9. Inspect the audit log for a full sequence of actions and confirm no request/response bodies appear.

### 8.3 Pre-production checklist

- [ ] `EnableWorkspaces` / `EnableWorkspaceWrites` / `EnableSecurityAudit` explicitly set (not inherited).
- [ ] `Authorizer` wired to the host's real auth (session or token), with roles for `workspace:write`, `qa:write`, `security:run`.
- [ ] `StorageRoot` points to a dedicated directory (or ephemeral volume) — never the source tree.
- [ ] `RemoteFetch.Enabled=false` unless the deployment genuinely needs it; if enabled, `HostAllowlist` is populated.
- [ ] `RateLimit` configured.
- [ ] `AuditLogger` routed to the host's structured logs.
- [ ] CSP/`X-Frame-Options` verified on the deployed SPA.
- [ ] `govulncheck` clean.
- [ ] Runbook: how to disable the suite in an incident (single flag flip + redeploy).

---

## 9. Rollout

1. **Phase 1 — read-only hub.** Ship `EnableWorkspaces` only. No writes, no network. Zero new attack surface beyond static docs.
2. **Phase 2 — authorized writes.** Ship `EnableWorkspaceWrites` behind `Authorizer`, `RemoteFetch.Enabled=false`. Importer is upload-only.
3. **Phase 3 — security audit.** Ship `EnableSecurityAudit` behind `Authorizer` + admin role. Header audit restricted to configured environments.
4. **Phase 4 — remote fetch (optional).** Only if a real need exists, with an explicit host allowlist.

Each phase is independently revertible by turning off its flag — no schema migrations, no data coupling.

---

**Bottom line:** the original plan adds three powerful admin features to a library that lives *inside* a host server. This revision keeps every capability, but makes each one opt-in, authorized, rate-limited, audited, sandboxed to a single storage root, and incapable of reaching the host's internal network or filesystem. A misconfigured host fails to boot rather than silently exposing an attack surface.