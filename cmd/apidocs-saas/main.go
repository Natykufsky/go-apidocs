package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/Natykufsky/go-apidocs"
	"github.com/Natykufsky/go-apidocs/internal/auth"
	"github.com/Natykufsky/go-apidocs/internal/env"
	"github.com/Natykufsky/go-apidocs/internal/middleware"
	tenantAdapter "github.com/Natykufsky/go-apidocs/internal/tenant/adapter"
	tenantMemory "github.com/Natykufsky/go-apidocs/internal/tenant/adapter/memory"
	tenantUsecase "github.com/Natykufsky/go-apidocs/internal/tenant/usecase"
)

func main() {
	env.LoadDotEnv()

	port := flag.Int("port", 8080, "Port for SaaS platform gateway server")
	specFile := flag.String("spec", "./docs/swagger.json", "Default fallback OpenAPI specification file")
	flag.Parse()

	// 1. Initialize SaaS Tenant Store & Service (billing idempotency enabled)
	tenantRepo := tenantMemory.NewMemoryTenantRepository()
	saasService := tenantUsecase.NewService(tenantRepo)
	saasService.SetEventDedup(tenantUsecase.NewInMemoryEventDedup(0, 0))

	// 2. Initialize Core Docs Configuration
	nvidiaKey := os.Getenv("NVIDIA_API_KEY")
	if nvidiaKey == "" {
		nvidiaKey = os.Getenv("Nvidia_key")
	}
	if nvidiaKey == "" {
		nvidiaKey = os.Getenv("NVIDIA_KEY")
	}
	cfg := apidocs.Config{
		Title:                 "API Docs Cloud Platform (SaaS)",
		Subtitle:              "Multi-Tenant Developer Hub & DeepSeek AI Testing",
		SpecFilePath:          *specFile,
		DocsDir:               "./docs",
		EnableWorkspaces:      true,
		EnableWorkspaceWrites: true,
		EnableSecurityAudit:   true,
		NVIDIA: apidocs.NVIDIAConfig{
			APIKey:  nvidiaKey,
			Model:   "deepseek-ai/deepseek-v4.1-flash",
			Timeout: 60 * time.Second,
		},
		NavItems: []apidocs.NavItem{
			{Label: "Overview", URL: "/", Icon: "🏠"},
			{Label: "API Sandbox", URL: "/docs", Icon: "⚡"},
			{Label: "Guide", URL: "/guide", Icon: "📖"},
			{Label: "Health & Ops", URL: "/dashboard", Icon: "📊"},
			{Label: "OpenAPI Spec", URL: "/docs/swagger.json", Icon: "📄", IsButton: true},
		},
	}

	// 3. Construct Root Multi-Tenant Multiplexer
	mux := http.NewServeMux()

	// Developer OAuth 2.0 Single Sign-On Endpoints (start + callback, with CSRF state)
	jwtSecret := os.Getenv("DOCS_JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = os.Getenv("JWT_SECRET")
	}
	mux.HandleFunc("/docs/oauth/github", auth.GitHubOAuthHandler)
	mux.HandleFunc("/docs/oauth/github/callback", auth.GitHubOAuthCallbackHandler(jwtSecret))
	mux.HandleFunc("/docs/oauth/google", auth.GoogleOAuthHandler)
	mux.HandleFunc("/docs/oauth/google/callback", auth.GoogleOAuthCallbackHandler(jwtSecret))

	// SaaS Tenant Onboarding & Management APIs
	mux.HandleFunc("/api/v1/saas/tenants/register", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Tenant-ID")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "method not allowed: use POST"})
			return
		}

		var req tenantUsecase.RegisterTenantRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid json payload: " + err.Error()})
			return
		}

		tenant, err := saasService.RegisterTenant(r.Context(), req)
		if err != nil {
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}

		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"success": true,
			"tenant":  tenant,
			"message": fmt.Sprintf("Organization '%s' created on plan '%s'", tenant.Name, tenant.Plan),
		})
	})

	stripeAdapter := tenantAdapter.NewStripeBillingAdapter(os.Getenv("STRIPE_WEBHOOK_SECRET"))

	mux.HandleFunc("/api/v1/saas/tenant", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		tenant, err := saasService.ResolveTenantFromRequest(r)
		if err != nil || tenant == nil {
			w.WriteHeader(http.StatusUnauthorized)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "tenant not found"})
			return
		}
		_ = json.NewEncoder(w).Encode(tenant)
	})

	// SaaS Tenant Theme Update API
	mux.HandleFunc("/api/v1/saas/tenant/theme", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		if r.Method != http.MethodPut && r.Method != http.MethodPost {
			http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
			return
		}

		tenant, err := saasService.ResolveTenantFromRequest(r)
		if err != nil || tenant == nil {
			w.WriteHeader(http.StatusUnauthorized)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "unauthorized"})
			return
		}

		var req tenantUsecase.UpdateThemeRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid json payload"})
			return
		}

		updated, err := saasService.UpdateTenantTheme(r.Context(), tenant.ID, req)
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}

		_ = json.NewEncoder(w).Encode(map[string]any{
			"success": true,
			"theme":   updated.Theme,
		})
	})

	// SaaS Stripe/Billing Webhook API
	mux.HandleFunc("/api/v1/saas/webhooks/billing", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		if r.Method != http.MethodPost {
			http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
			return
		}

		bodyBytes, err := io.ReadAll(r.Body)
		if err != nil {
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "failed to read body"})
			return
		}

		sig := r.Header.Get("Stripe-Signature")
		event, err := stripeAdapter.ProcessWebhook(r.Context(), bodyBytes, sig)
		if err != nil {
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}

		if err := saasService.ApplyBillingEvent(r.Context(), event); err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}

		_ = json.NewEncoder(w).Encode(map[string]any{
			"received": true,
			"event_id": event.EventID,
		})
	})

	// Mount core API documentation & sandbox UI
	apidocs.MountNetHTTP(mux, cfg)

	// Production hardening: health/readiness probes for load balancers & orchestrators
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})
	mux.HandleFunc("/readyz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		// Readiness requires the docs spec to be resolvable; liveness does not.
		if _, err := os.Stat(cfg.SpecFilePath); err != nil {
			w.WriteHeader(http.StatusServiceUnavailable)
			_, _ = w.Write([]byte(`{"status":"unavailable","reason":"spec file not resolvable"}`))
			return
		}
		_, _ = w.Write([]byte(`{"status":"ready"}`))
	})

	addr := fmt.Sprintf(":%d", *port)
	log.Printf("⚡ [SaaS Platform] Server active on http://localhost:%d", *port)

	server := &http.Server{
		Addr: addr,
		Handler: middleware.Chain(limitBodySize(mux, 2<<20),
			middleware.SecureHeadersMiddleware,
			middleware.RecoverMiddleware,
			middleware.LoggingMiddleware,
			middleware.RequestIDMiddleware,
		),
		ReadTimeout:       15 * time.Second,
		ReadHeaderTimeout: 5 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	// Graceful shutdown: drain in-flight requests (incl. Stripe webhooks) on SIGINT/SIGTERM.
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	errCh := make(chan error, 1)
	go func() {
		errCh <- server.ListenAndServe()
	}()

	select {
	case err := <-errCh:
		if err != nil && err != http.ErrServerClosed {
			log.Fatalf("SaaS server error: %v", err)
		}
	case <-ctx.Done():
		log.Println("⚡ [SaaS Platform] Shutdown signal received; draining connections...")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		if err := server.Shutdown(shutdownCtx); err != nil {
			log.Printf("SaaS graceful shutdown incomplete: %v", err)
		}
		log.Println("⚡ [SaaS Platform] Server stopped cleanly")
	}
}

// limitBodySize wraps the handler chain with an http.MaxBytesReader.
func limitBodySize(next http.Handler, maxBytes int64) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Body != nil {
			r.Body = http.MaxBytesReader(w, r.Body, maxBytes)
		}
		next.ServeHTTP(w, r)
	})
}
