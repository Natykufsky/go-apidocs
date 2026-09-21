package apidocs

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

var (
	// ErrPathEscape is returned when a path traversal attempt is detected.
	ErrPathEscape = errors.New("file path escapes sandboxed storage root")
	// ErrSymlinkForbidden is returned when a path is a symbolic link.
	ErrSymlinkForbidden = errors.New("symlinks are forbidden in sandboxed storage")
	// ErrWorkspaceNotFound is returned when a workspace ID is not found.
	ErrWorkspaceNotFound = errors.New("workspace not found")
	// ErrServiceNotFound is returned when an API service ID is not found.
	ErrServiceNotFound = errors.New("api service not found")
	// ErrUnauthorized is returned when an operation is denied by the Authorizer.
	ErrUnauthorized = errors.New("action not authorized")
)

// Authorizer defines the authorization hook supplied by the host application.
type Authorizer interface {
	// Authorize checks if the given request is allowed to perform the specified action.
	// Actions include: "workspace:read", "workspace:write", "qa:write", "security:run"
	Authorize(r *http.Request, action string) (allowed bool, principal string)
}

// RateLimitConfig configures request throttling on mutating routes.
type RateLimitConfig struct {
	Enabled bool    `json:"enabled"`
	RPS     float64 `json:"rps"`   // Tokens per second
	Burst   int     `json:"burst"` // Max token burst
}

// AuditEvent represents a structured security log entry.
type AuditEvent struct {
	Timestamp time.Time `json:"timestamp"`
	Principal string    `json:"principal"`
	Action    string    `json:"action"`
	Workspace string    `json:"workspace,omitempty"`
	Service   string    `json:"service,omitempty"`
	RemoteIP  string    `json:"remote_ip"`
	Status    string    `json:"status"` // "ALLOW", "DENY", "ERROR", "SUCCESS"
	Details   string    `json:"details,omitempty"`
}

// APIService represents a single API or microservice within a workspace.
type APIService struct {
	ID            string            `json:"id"`
	Title         string            `json:"title"`
	Version       string            `json:"version"`
	Description   string            `json:"description,omitempty"`
	Icon          string            `json:"icon,omitempty"`
	SpecFilePath  string            `json:"spec_file_path,omitempty"`
	SpecURL       string            `json:"spec_url,omitempty"`
	DocsDir       string            `json:"docs_dir,omitempty"`
	PathsDir      string            `json:"paths_dir,omitempty"`
	ReadmePath    string            `json:"readme_path,omitempty"`
	QAStoragePath string            `json:"qa_storage_path,omitempty"`
	Environments  map[string]string `json:"environments,omitempty"` // e.g. {"Local": "http://localhost:8080", "Staging": "https://stg.api.com"}
	ModuleTagMap  map[string][]string `json:"module_tag_map,omitempty"`

	// StoredFilename internal sandboxed storage filename (e.g. "a1b2c3d4.json")
	StoredFilename string `json:"stored_filename,omitempty"`
}

// Workspace represents a collection of related API services (e.g. "Billing Services", "Auth Microservices").
type Workspace struct {
	ID          string       `json:"id"`
	Name        string       `json:"name"`
	Description string       `json:"description,omitempty"`
	Icon        string       `json:"icon,omitempty"`
	Services    []APIService `json:"services"`
}

// Capabilities represents the runtime feature flags exposed to the frontend SPA.
type Capabilities struct {
	WorkspacesEnabled      bool              `json:"workspaces_enabled"`
	WorkspaceWritesEnabled bool              `json:"workspace_writes_enabled"`
	SecurityAuditEnabled   bool              `json:"security_audit_enabled"`
	RemoteFetchEnabled     bool              `json:"remote_fetch_enabled"`
	RemoteFetchPolicy      RemoteFetchPolicy `json:"remote_fetch_policy"`
	MaxSpecBytes           int64             `json:"max_spec_bytes"`
}

// WorkspaceManager manages multi-workspace registration, sandboxed disk storage, and bounded LRU caching.
type WorkspaceManager struct {
	mu           sync.RWMutex
	workspaces   map[string]*Workspace
	storageRoot  string
	maxSpecBytes int64
	maxCacheBytes int64

	// Bounded in-memory spec cache
	cacheMu      sync.Mutex
	cache        map[string][]byte
	cacheKeys    []string
	currCacheBytes int64

	authorizer   Authorizer
	auditLogger  func(AuditEvent)
	rateLimiter  *simpleRateLimiter
}

// simpleRateLimiter provides basic token bucket rate limiting per principal or IP.
type simpleRateLimiter struct {
	mu      sync.Mutex
	enabled bool
	rps     float64
	burst   int
	buckets map[string]*bucket
}

type bucket struct {
	tokens     float64
	lastUpdate time.Time
}

func newSimpleRateLimiter(cfg RateLimitConfig) *simpleRateLimiter {
	if !cfg.Enabled {
		return &simpleRateLimiter{enabled: false}
	}
	rps := cfg.RPS
	if rps <= 0 {
		rps = 10.0
	}
	burst := cfg.Burst
	if burst <= 0 {
		burst = 20
	}
	return &simpleRateLimiter{
		enabled: true,
		rps:     rps,
		burst:   burst,
		buckets: make(map[string]*bucket),
	}
}

func (rl *simpleRateLimiter) Allow(key string) bool {
	if rl == nil || !rl.enabled {
		return true
	}
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	b, exists := rl.buckets[key]
	if !exists {
		rl.buckets[key] = &bucket{
			tokens:     float64(rl.burst - 1),
			lastUpdate: now,
		}
		return true
	}

	elapsed := now.Sub(b.lastUpdate).Seconds()
	b.tokens += elapsed * rl.rps
	if b.tokens > float64(rl.burst) {
		b.tokens = float64(rl.burst)
	}
	b.lastUpdate = now

	if b.tokens >= 1.0 {
		b.tokens -= 1.0
		return true
	}
	return false
}

// NewWorkspaceManager creates a WorkspaceManager with strict security controls.
func NewWorkspaceManager(
	workspaces []Workspace,
	storageRoot string,
	maxSpecBytes int64,
	maxCacheBytes int64,
	authorizer Authorizer,
	rateLimit RateLimitConfig,
	auditLogger func(AuditEvent),
) (*WorkspaceManager, error) {
	if storageRoot == "" {
		storageRoot = "./apidocs-data"
	}
	if maxSpecBytes <= 0 {
		maxSpecBytes = 5 << 20 // 5 MiB
	}
	if maxCacheBytes <= 0 {
		maxCacheBytes = 64 << 20 // 64 MiB
	}

	wm := &WorkspaceManager{
		workspaces:    make(map[string]*Workspace),
		storageRoot:   filepath.Clean(storageRoot),
		maxSpecBytes:  maxSpecBytes,
		maxCacheBytes: maxCacheBytes,
		cache:         make(map[string][]byte),
		authorizer:    authorizer,
		auditLogger:   auditLogger,
		rateLimiter:   newSimpleRateLimiter(rateLimit),
	}

	for _, ws := range workspaces {
		copied := ws
		wm.workspaces[ws.ID] = &copied
	}

	return wm, nil
}

// LogAudit emits a structured audit log entry.
func (wm *WorkspaceManager) LogAudit(evt AuditEvent) {
	if evt.Timestamp.IsZero() {
		evt.Timestamp = time.Now().UTC()
	}
	if wm.auditLogger != nil {
		wm.auditLogger(evt)
		return
	}
	// Fallback to slog
	slog.Info("apidocs_audit",
		"ts", evt.Timestamp.Format(time.RFC3339),
		"principal", evt.Principal,
		"action", evt.Action,
		"status", evt.Status,
		"workspace", evt.Workspace,
		"service", evt.Service,
		"ip", evt.RemoteIP,
		"details", evt.Details,
	)
}

// SafeJoin guarantees that a path remains securely within the storageRoot.
func (wm *WorkspaceManager) SafeJoin(subPath string) (string, error) {
	if strings.Contains(subPath, "..") {
		return "", fmt.Errorf("%w: %s", ErrPathEscape, subPath)
	}
	clean := filepath.Clean(subPath)
	full := filepath.Join(wm.storageRoot, clean)
	rel, err := filepath.Rel(wm.storageRoot, full)
	if err != nil || strings.HasPrefix(rel, ".."+string(os.PathSeparator)) || rel == ".." {
		return "", fmt.Errorf("%w: %s", ErrPathEscape, subPath)
	}

	// Reject if any element is a symlink
	if info, err := os.Lstat(full); err == nil {
		if info.Mode()&os.ModeSymlink != 0 {
			return "", ErrSymlinkForbidden
		}
	}

	return full, nil
}

// ListWorkspaces returns the list of all registered workspaces.
func (wm *WorkspaceManager) ListWorkspaces() []Workspace {
	wm.mu.RLock()
	defer wm.mu.RUnlock()

	result := make([]Workspace, 0, len(wm.workspaces))
	for _, ws := range wm.workspaces {
		result = append(result, *ws)
	}
	return result
}

// GetWorkspace returns a workspace by ID.
func (wm *WorkspaceManager) GetWorkspace(id string) (*Workspace, error) {
	wm.mu.RLock()
	defer wm.mu.RUnlock()

	ws, ok := wm.workspaces[id]
	if !ok {
		return nil, ErrWorkspaceNotFound
	}
	return ws, nil
}

// GetService returns a specific service within a workspace.
func (wm *WorkspaceManager) GetService(wsID, svcID string) (*Workspace, *APIService, error) {
	wm.mu.RLock()
	defer wm.mu.RUnlock()

	ws, ok := wm.workspaces[wsID]
	if !ok {
		return nil, nil, ErrWorkspaceNotFound
	}

	for i := range ws.Services {
		if ws.Services[i].ID == svcID {
			return ws, &ws.Services[i], nil
		}
	}
	return nil, nil, ErrServiceNotFound
}

// AddWorkspace registers a new workspace.
func (wm *WorkspaceManager) AddWorkspace(ws Workspace) error {
	wm.mu.Lock()
	defer wm.mu.Unlock()

	if strings.TrimSpace(ws.ID) == "" {
		return errors.New("workspace id cannot be empty")
	}
	if strings.TrimSpace(ws.Name) == "" {
		ws.Name = ws.ID
	}
	if ws.Icon == "" {
		ws.Icon = "📁"
	}
	if ws.Services == nil {
		ws.Services = []APIService{}
	}

	wm.workspaces[ws.ID] = &ws
	return nil
}

// SaveImportedSpec writes an imported spec atomically to the sandboxed storageRoot and attaches it to a workspace.
func (wm *WorkspaceManager) SaveImportedSpec(wsID string, svc APIService, specData []byte) (*APIService, error) {
	if int64(len(specData)) > wm.maxSpecBytes {
		return nil, fmt.Errorf("%w: %d bytes (limit: %d)", ErrSpecTooLarge, len(specData), wm.maxSpecBytes)
	}

	// Ensure sandboxed storage root exists
	if err := os.MkdirAll(wm.storageRoot, 0750); err != nil {
		return nil, fmt.Errorf("failed creating storage directory: %w", err)
	}

	// Generate a secure UUID filename (never trust client filename)
	randBytes := make([]byte, 16)
	if _, err := rand.Read(randBytes); err != nil {
		return nil, fmt.Errorf("failed generating uuid: %w", err)
	}
	filename := hex.EncodeToString(randBytes) + ".json"

	targetPath, err := wm.SafeJoin(filename)
	if err != nil {
		return nil, err
	}

	// Atomic write via temp file
	tempPath := targetPath + ".tmp"
	if err := os.WriteFile(tempPath, specData, 0600); err != nil {
		return nil, fmt.Errorf("failed writing temp spec file: %w", err)
	}
	if err := os.Rename(tempPath, targetPath); err != nil {
		_ = os.Remove(tempPath)
		return nil, fmt.Errorf("failed finalizing spec file: %w", err)
	}

	svc.StoredFilename = filename
	svc.SpecFilePath = targetPath
	if svc.Icon == "" {
		svc.Icon = "⚡"
	}

	wm.mu.Lock()
	defer wm.mu.Unlock()

	ws, ok := wm.workspaces[wsID]
	if !ok {
		// Auto-create workspace if it doesn't exist
		ws = &Workspace{
			ID:       wsID,
			Name:     strings.Title(strings.ReplaceAll(wsID, "-", " ")),
			Icon:     "📁",
			Services: []APIService{},
		}
		wm.workspaces[wsID] = ws
	}

	// Update existing service or append
	updated := false
	for i := range ws.Services {
		if ws.Services[i].ID == svc.ID {
			ws.Services[i] = svc
			updated = true
			break
		}
	}
	if !updated {
		ws.Services = append(ws.Services, svc)
	}

	// Cache spec in memory
	wm.putCache(wsID+":"+svc.ID, specData)

	return &svc, nil
}

// GetSpecData retrieves spec JSON bytes, utilizing the bounded LRU cache.
func (wm *WorkspaceManager) GetSpecData(wsID, svcID string) ([]byte, error) {
	cacheKey := wsID + ":" + svcID
	if data := wm.getCache(cacheKey); data != nil {
		return data, nil
	}

	_, svc, err := wm.GetService(wsID, svcID)
	if err != nil {
		return nil, err
	}

	var path string
	if svc.StoredFilename != "" {
		p, err := wm.SafeJoin(svc.StoredFilename)
		if err != nil {
			return nil, err
		}
		path = p
	} else if svc.SpecFilePath != "" {
		path = svc.SpecFilePath
	} else {
		return nil, errors.New("no spec file associated with service")
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed reading spec from disk: %w", err)
	}

	wm.putCache(cacheKey, data)
	return data, nil
}

func (wm *WorkspaceManager) getCache(key string) []byte {
	wm.cacheMu.Lock()
	defer wm.cacheMu.Unlock()
	if d, ok := wm.cache[key]; ok {
		return d
	}
	return nil
}

func (wm *WorkspaceManager) putCache(key string, data []byte) {
	wm.cacheMu.Lock()
	defer wm.cacheMu.Unlock()

	dataLen := int64(len(data))
	// If single item exceeds maxCacheBytes, don't cache
	if dataLen > wm.maxCacheBytes {
		return
	}

	// Evict oldest items if exceeding capacity
	for wm.currCacheBytes+dataLen > wm.maxCacheBytes && len(wm.cacheKeys) > 0 {
		oldest := wm.cacheKeys[0]
		wm.cacheKeys = wm.cacheKeys[1:]
		if oldData, ok := wm.cache[oldest]; ok {
			wm.currCacheBytes -= int64(len(oldData))
			delete(wm.cache, oldest)
		}
	}

	wm.cache[key] = data
	wm.cacheKeys = append(wm.cacheKeys, key)
	wm.currCacheBytes += dataLen
}

// SaveWorkspacesManifest writes the current workspaces catalog to the storage root.
func (wm *WorkspaceManager) SaveWorkspacesManifest() error {
	wm.mu.RLock()
	defer wm.mu.RUnlock()

	path, err := wm.SafeJoin("workspaces.json")
	if err != nil {
		return err
	}

	list := make([]Workspace, 0, len(wm.workspaces))
	for _, ws := range wm.workspaces {
		list = append(list, *ws)
	}

	b, err := json.MarshalIndent(list, "", "  ")
	if err != nil {
		return err
	}

	tempPath := path + ".tmp"
	if err := os.WriteFile(tempPath, b, 0600); err != nil {
		return err
	}
	return os.Rename(tempPath, path)
}
