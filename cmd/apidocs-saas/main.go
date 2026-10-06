package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/Natykufsky/go-apidocs"
	tenantMemory "github.com/Natykufsky/go-apidocs/internal/tenant/adapter/memory"
	tenantUsecase "github.com/Natykufsky/go-apidocs/internal/tenant/usecase"
)

func main() {
	port := flag.Int("port", 8080, "Port for SaaS platform gateway server")
	specFile := flag.String("spec", "./docs/swagger.json", "Default fallback OpenAPI specification file")
	flag.Parse()

	// 1. Initialize SaaS Tenant Store & Service
	tenantRepo := tenantMemory.NewMemoryTenantRepository()
	saasService := tenantUsecase.NewService(tenantRepo)

	// 2. Initialize Core Docs Configuration
	nvidiaKey := os.Getenv("NVIDIA_API_KEY")
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

	// SaaS Tenant Onboarding & Management APIs
	mux.HandleFunc("/api/v1/saas/tenants/register", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		if r.Method != http.MethodPost {
			http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
			return
		}

		var req tenantUsecase.RegisterTenantRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid json payload"})
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

	// Mount core API documentation & sandbox UI
	apidocs.MountNetHTTP(mux, cfg)

	addr := fmt.Sprintf(":%d", *port)
	log.Printf("⚡ [SaaS Platform] Server active on http://localhost:%d", *port)
	log.Printf("⚡ [SaaS Platform] Tenant Registration: POST http://localhost:%d/api/v1/saas/tenants/register", *port)
	log.Printf("⚡ [SaaS Platform] AI Inference Engine: NVIDIA NIM DeepSeek v4.1 Flash")

	server := &http.Server{
		Addr:         addr,
		Handler:      mux,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 60 * time.Second,
	}

	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("SaaS server error: %v", err)
	}
}
