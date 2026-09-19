package apidocs

import (
	"encoding/json"
	"net/http"
	"os"
	"strings"
	"sync"

	"github.com/gofiber/fiber/v2"
)

type SpecFilter struct {
	specPath      string
	moduleTagMap  map[string][]string
	mu            sync.RWMutex
	rawSpec       map[string]interface{}
	embeddedFiles map[string][]byte
}

func newSpecFilter(specPath string, moduleTagMap map[string][]string, embeddedFiles map[string][]byte) *SpecFilter {
	if moduleTagMap == nil {
		moduleTagMap = make(map[string][]string)
	}
	return &SpecFilter{
		specPath:      specPath,
		moduleTagMap:  moduleTagMap,
		embeddedFiles: embeddedFiles,
	}
}

func (f *SpecFilter) loadSpec() (map[string]interface{}, error) {
	f.mu.RLock()
	if f.rawSpec != nil {
		defer f.mu.RUnlock()
		return f.rawSpec, nil
	}
	f.mu.RUnlock()

	f.mu.Lock()
	defer f.mu.Unlock()
	if f.rawSpec != nil {
		return f.rawSpec, nil
	}

	var data []byte
	var err error

	if f.embeddedFiles != nil {
		if b, ok := f.embeddedFiles["swagger.json"]; ok && len(b) > 0 {
			data = b
		}
	}
	if len(data) == 0 {
		candidates := []string{
			f.specPath,
			"./docs/" + f.specPath,
			"./backend/docs/" + f.specPath,
			"./docs/swagger.json",
			"./backend/docs/swagger.json",
			"./swagger.json",
			"swagger.json",
		}
		for _, p := range candidates {
			if p == "" {
				continue
			}
			if b, readErr := os.ReadFile(p); readErr == nil && len(b) > 0 {
				data = b
				break
			}
		}
		if len(data) == 0 {
			// Check if modular OpenAPI directory structure exists (e.g. swagger_base.json + schemas.json + paths/*.json)
			baseCandidates := []string{
				"./docs/swagger_base.json",
				"../docs/swagger_base.json",
				"../../docs/swagger_base.json",
				"./swagger_base.json",
			}
			var baseData []byte
			var baseDir string
			for _, bp := range baseCandidates {
				if b, readErr := os.ReadFile(bp); readErr == nil && len(b) > 0 {
					baseData = b
					if strings.Contains(bp, "docs") {
						baseDir = bp[:strings.Index(bp, "swagger_base.json")]
					}
					break
				}
			}

			if len(baseData) > 0 {
				var modularSpec map[string]interface{}
				if json.Unmarshal(baseData, &modularSpec) == nil {
					// Merge schemas
					if schemasBytes, sErr := os.ReadFile(baseDir + "schemas.json"); sErr == nil {
						var schemas map[string]interface{}
						if json.Unmarshal(schemasBytes, &schemas) == nil {
							components, ok := modularSpec["components"].(map[string]interface{})
							if !ok {
								components = make(map[string]interface{})
								modularSpec["components"] = components
							}
							components["schemas"] = schemas
						}
					}

					// Merge paths
					mergedPaths := make(map[string]interface{})
					pathsDir := baseDir + "paths"
					if dirEntries, dErr := os.ReadDir(pathsDir); dErr == nil {
						for _, entry := range dirEntries {
							if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".json") {
								if pBytes, pErr := os.ReadFile(pathsDir + "/" + entry.Name()); pErr == nil {
									var subPaths map[string]interface{}
									if json.Unmarshal(pBytes, &subPaths) == nil {
										for k, v := range subPaths {
											mergedPaths[k] = v
										}
									}
								}
							}
						}
					}
					modularSpec["paths"] = mergedPaths
					f.rawSpec = modularSpec
					return f.rawSpec, nil
				}
			}

			data, err = os.ReadFile(f.specPath)
			if err != nil {
				return nil, err
			}
		}
	}

	var spec map[string]interface{}
	if err := json.Unmarshal(data, &spec); err != nil {
		return nil, err
	}
	f.rawSpec = spec
	return f.rawSpec, nil
}

// FilterSpec dynamically filters OpenAPI spec tags and endpoints based on module or customTag
func (f *SpecFilter) FilterSpec(module, customTag string) (map[string]interface{}, error) {
	spec, err := f.loadSpec()
	if err != nil {
		return nil, err
	}

	module = strings.TrimSpace(strings.ToLower(module))
	customTag = strings.TrimSpace(customTag)

	if (module == "" || module == "all") && customTag == "" {
		return spec, nil
	}

	allowedTags := make(map[string]bool)
	if customTag != "" {
		allowedTags[customTag] = true
	} else if tags, ok := f.moduleTagMap[module]; ok && len(tags) > 0 {
		for _, t := range tags {
			allowedTags[t] = true
		}
	} else {
		for key, tags := range f.moduleTagMap {
			if strings.Contains(key, module) {
				for _, t := range tags {
					allowedTags[t] = true
				}
			}
		}
	}

	filtered := make(map[string]interface{})
	for k, v := range spec {
		filtered[k] = v
	}

	originalPaths, _ := spec["paths"].(map[string]interface{})
	filteredPaths := make(map[string]interface{})

	for pathKey, pathItem := range originalPaths {
		itemMap, ok := pathItem.(map[string]interface{})
		if !ok {
			continue
		}

		matchingMethods := make(map[string]interface{})
		for method, op := range itemMap {
			if method == "parameters" || method == "summary" || method == "description" {
				matchingMethods[method] = op
				continue
			}

			opMap, ok := op.(map[string]interface{})
			if !ok {
				continue
			}

			tags, _ := opMap["tags"].([]interface{})
			hasTag := false
			for _, t := range tags {
				if tagStr, ok := t.(string); ok {
					if allowedTags[tagStr] {
						hasTag = true
						break
					}
					for allowed := range allowedTags {
						if strings.Contains(strings.ToLower(allowed), strings.ToLower(tagStr)) ||
							strings.Contains(strings.ToLower(tagStr), strings.ToLower(allowed)) {
							hasTag = true
							break
						}
					}
				}
			}

			if hasTag {
				matchingMethods[method] = op
			}
		}

		hasOperations := false
		for m := range matchingMethods {
			if m != "parameters" && m != "summary" && m != "description" {
				hasOperations = true
				break
			}
		}

		if hasOperations {
			filteredPaths[pathKey] = matchingMethods
		}
	}
	filtered["paths"] = filteredPaths

	if tagsList, ok := spec["tags"].([]interface{}); ok {
		var filteredTags []interface{}
		for _, t := range tagsList {
			tMap, ok := t.(map[string]interface{})
			if !ok {
				continue
			}
			name, _ := tMap["name"].(string)
			if allowedTags[name] {
				filteredTags = append(filteredTags, t)
				continue
			}
			for allowed := range allowedTags {
				if strings.Contains(strings.ToLower(allowed), strings.ToLower(name)) ||
					strings.Contains(strings.ToLower(name), strings.ToLower(allowed)) {
					filteredTags = append(filteredTags, t)
					break
				}
			}
		}
		filtered["tags"] = filteredTags
	}

	return filtered, nil
}

// ServeFilteredSwagger dynamically filters OpenAPI spec tags and endpoints based on ?module= or ?tag= for Fiber
func (f *SpecFilter) ServeFilteredSwagger(c *fiber.Ctx) error {
	filtered, err := f.FilterSpec(c.Query("module"), c.Query("tag"))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to load swagger spec: " + err.Error()})
	}
	return c.JSON(filtered)
}

// ServeHTTP serves filtered OpenAPI spec for standard net/http and Chi routers
func (f *SpecFilter) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	filtered, err := f.FilterSpec(q.Get("module"), q.Get("tag"))
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "failed to load swagger spec: " + err.Error()})
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(filtered)
}
