package apidocs

import (
	"encoding/json"
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

// ServeFilteredSwagger dynamically filters OpenAPI spec tags and endpoints based on ?module= or ?tag=
func (f *SpecFilter) ServeFilteredSwagger(c *fiber.Ctx) error {
	spec, err := f.loadSpec()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to load swagger spec: " + err.Error()})
	}

	module := strings.TrimSpace(strings.ToLower(c.Query("module")))
	customTag := strings.TrimSpace(c.Query("tag"))

	if (module == "" || module == "all") && customTag == "" {
		return c.JSON(spec)
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

	return c.JSON(filtered)
}
