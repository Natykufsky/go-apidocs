package schema

import (
	"os"
	"path/filepath"
	"testing"
)

// TestResolveSpecPath_ExplicitPath verifies an explicitly-configured spec path
// that exists is reported as found.
func TestResolveSpecPath_ExplicitPath(t *testing.T) {
	dir := t.TempDir()
	specPath := filepath.Join(dir, "openapi.json")
	if err := os.WriteFile(specPath, []byte(`{"openapi":"3.0.0","paths":{}}`), 0o644); err != nil {
		t.Fatalf("write spec: %v", err)
	}

	got, found := ResolveSpecPath(specPath)
	if !found {
		t.Fatal("expected spec to be found")
	}
	if got != specPath {
		t.Fatalf("path = %q, want %q", got, specPath)
	}
}

// TestResolveSpecPath_DirectoryIsNotASpec ensures a directory named like a spec
// is not mistaken for a usable spec file (os.Stat succeeds for dirs too).
func TestResolveSpecPath_DirectoryIsNotASpec(t *testing.T) {
	dir := t.TempDir()
	fakeSpec := filepath.Join(dir, "swagger.json")
	if err := os.Mkdir(fakeSpec, 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}

	if _, found := ResolveSpecPath(fakeSpec); found {
		t.Fatal("directory should not be treated as a spec file")
	}
}

// TestResolveSpecPath_Missing confirms an absent spec is reported as not found
// rather than silently succeeding.
func TestResolveSpecPath_Missing(t *testing.T) {
	missing := filepath.Join(t.TempDir(), "does-not-exist.json")
	if _, found := ResolveSpecPath(missing); found {
		t.Fatal("expected missing spec to report found=false")
	}
}

// TestSpecFilter_SourcePlaceholder asserts the built-in fallback is clearly
// classified, so readiness/probes can report a degraded state.
func TestSpecFilter_SourcePlaceholder(t *testing.T) {
	missing := filepath.Join(t.TempDir(), "missing.json")
	f := NewSpecFilter(missing, t.TempDir(), "", nil, nil)

	if _, err := f.LoadSpec(); err != nil {
		t.Fatalf("LoadSpec: %v", err)
	}

	src, path := f.Source()
	if src != SpecSourcePlaceholder {
		t.Fatalf("source = %q, want %q", src, SpecSourcePlaceholder)
	}
	if path != "" {
		t.Fatalf("placeholder sourcePath = %q, want empty", path)
	}
	if !f.IsPlaceholder() {
		t.Fatal("IsPlaceholder() = false, want true")
	}
}

// TestSpecFilter_SourceFile asserts a real on-disk spec is classified as a file
// source with the path it was read from.
func TestSpecFilter_SourceFile(t *testing.T) {
	specPath := filepath.Join(t.TempDir(), "swagger.json")
	spec := `{"openapi":"3.0.0","info":{"title":"Real","version":"1.0.0"},` +
		`"paths":{"/pets":{"get":{"tags":["pets"],"responses":{"200":{"description":"ok"}}}}}}`
	if err := os.WriteFile(specPath, []byte(spec), 0o644); err != nil {
		t.Fatalf("write spec: %v", err)
	}

	f := NewSpecFilter(specPath, t.TempDir(), "", nil, nil)
	if _, err := f.LoadSpec(); err != nil {
		t.Fatalf("LoadSpec: %v", err)
	}

	src, path := f.Source()
	if src != SpecSourceFile {
		t.Fatalf("source = %q, want %q", src, SpecSourceFile)
	}
	if path != specPath {
		t.Fatalf("sourcePath = %q, want %q", path, specPath)
	}
	if f.IsPlaceholder() {
		t.Fatal("IsPlaceholder() = true for a real spec")
	}
}
