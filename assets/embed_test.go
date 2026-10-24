package assets

import (
	"io/fs"
	"path"
	"regexp"
	"strings"
	"testing"
)

// The React bundle under dist/ is the runtime artifact embedded into the Go
// binary. Vite code-splits it, so the shipped bundle contains lazy chunks
// (e.g. dist/assets/SwaggerUILazy.js and its stylesheet) that are only
// referenced from inside the entry script. If one of those files is missing
// from the embedded filesystem the browser gets a 404 and the lazy import
// fails with "Failed to fetch dynamically imported module", which breaks the
// Swagger UI sandbox. These tests assert that every referenced asset is
// actually embedded.

var (
	htmlAssetRefRe = regexp.MustCompile(`(?:src|href)="(/assets/[^"]+)"`)
	jsImportRe     = regexp.MustCompile(`import\("(\./[^"]+)"\)`)
	jsAssetRefRe   = regexp.MustCompile(`"(assets/[^"]+\.(?:js|css|mjs|map))"`)
)

func embeddedPath(t *testing.T, rel string) bool {
	t.Helper()
	if _, err := fs.Stat(DefaultFS, rel); err != nil {
		return false
	}
	return true
}

// TestEmbeddedBundleReferencedAssetsExist verifies that every asset the
// embedded HTML/JS bundle points at is present in the embedded filesystem.
func TestEmbeddedBundleReferencedAssetsExist(t *testing.T) {
	html, err := DefaultFS.ReadFile("dist/index.html")
	if err != nil {
		t.Fatalf("dist/index.html is not embedded: %v", err)
	}

	missing := map[string]string{}

	for _, match := range htmlAssetRefRe.FindAllStringSubmatch(string(html), -1) {
		ref := strings.TrimPrefix(match[1], "/")
		if !embeddedPath(t, path.Join("dist", ref)) {
			missing[ref] = "referenced by dist/index.html"
		}
	}

	js, err := DefaultFS.ReadFile("dist/assets/index.js")
	if err != nil {
		t.Fatalf("dist/assets/index.js is not embedded: %v", err)
	}
	jsSource := string(js)

	// Lazily imported chunks are resolved relative to the importing script.
	for _, match := range jsImportRe.FindAllStringSubmatch(jsSource, -1) {
		ref := path.Join("dist/assets", strings.TrimPrefix(match[1], "./"))
		if !embeddedPath(t, ref) {
			missing[ref] = "lazily imported by dist/assets/index.js"
		}
	}

	// Vite's preload helper lists chunk + stylesheet dependencies as
	// "assets/<file>" paths relative to the bundle root.
	for _, match := range jsAssetRefRe.FindAllStringSubmatch(jsSource, -1) {
		ref := path.Join("dist", match[1])
		if !embeddedPath(t, ref) {
			missing[ref] = "listed as a preload dependency of dist/assets/index.js"
		}
	}

	for ref, reason := range missing {
		t.Errorf("embedded bundle is incomplete: %s is %s but is not embedded", ref, reason)
	}
}

// TestEmbeddedBundleHasCodeSplitChunk guards against a regression where the
// bundle is rebuilt without the lazy Swagger UI chunk.
func TestEmbeddedBundleHasCodeSplitChunk(t *testing.T) {
	entries, err := fs.ReadDir(DefaultFS, "dist/assets")
	if err != nil {
		t.Fatalf("dist/assets is not embedded: %v", err)
	}

	jsChunks := 0
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		if strings.HasSuffix(entry.Name(), ".js") && entry.Name() != "index.js" {
			jsChunks++
		}
	}

	if jsChunks == 0 {
		t.Error("expected at least one code-split JavaScript chunk in dist/assets, found none")
	}
}
