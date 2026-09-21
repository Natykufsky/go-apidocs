package apidocs

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strings"

	"gopkg.in/yaml.v3"
)

var (
	// ErrSpecTooLarge is returned when the uploaded spec exceeds MaxSpecBytes.
	ErrSpecTooLarge = errors.New("spec exceeds maximum allowed file size")
	// ErrInvalidSpecStructure is returned when the spec lacks basic OpenAPI structure.
	ErrInvalidSpecStructure = errors.New("invalid openapi specification structure")
	// ErrYAMLExceededDepth is returned when YAML document nesting exceeds the safe limit.
	ErrYAMLExceededDepth = errors.New("yaml depth exceeded safe nesting limit")
	// ErrYAMLExceededNodes is returned when YAML document contains too many nodes (anti-bomb).
	ErrYAMLExceededNodes = errors.New("yaml node count exceeded safe limit")
	// ErrUnsupportedSpecFormat is returned when content is neither valid JSON nor valid YAML.
	ErrUnsupportedSpecFormat = errors.New("unsupported spec format: must be valid JSON or YAML")
)

// ParsedSpec holds the validated OpenAPI data and summary metadata.
type ParsedSpec struct {
	Raw         map[string]any `json:"-"`
	Title       string         `json:"title"`
	Version     string         `json:"version"`
	Description string         `json:"description,omitempty"`
	OpenAPIVer  string         `json:"openapi_version"`
	PathCount   int            `json:"path_count"`
	TotalOps    int            `json:"total_operations"`
	Tags        []string       `json:"tags"`
	Methods     map[string]int `json:"methods"`
}

// walkYAMLNodes recursively checks node depth and total node counts to prevent YAML expansion bombs.
func walkYAMLNodes(node *yaml.Node, currentDepth, maxDepth int, nodeCount *int, maxNodes int) error {
	if node == nil {
		return nil
	}

	*nodeCount++
	if *nodeCount > maxNodes {
		return ErrYAMLExceededNodes
	}

	if currentDepth > maxDepth {
		return ErrYAMLExceededDepth
	}

	// Reject custom execution tags (e.g. !!python/object)
	if node.Tag != "" && !strings.HasPrefix(node.Tag, "tag:yaml.org,2002:") && !strings.HasPrefix(node.Tag, "!!") {
		return fmt.Errorf("forbidden yaml tag: %s", node.Tag)
	}

	for _, child := range node.Content {
		if err := walkYAMLNodes(child, currentDepth+1, maxDepth, nodeCount, maxNodes); err != nil {
			return err
		}
	}
	return nil
}

// ParseSpec safely validates and extracts metadata from an OpenAPI JSON or YAML stream.
func ParseSpec(r io.Reader, maxBytes int64) (*ParsedSpec, []byte, error) {
	if maxBytes <= 0 {
		maxBytes = 5 << 20 // Default 5 MiB
	}

	// Read with hard cap (+1 byte to detect overflow)
	limitedReader := io.LimitReader(r, maxBytes+1)
	data, err := io.ReadAll(limitedReader)
	if err != nil {
		return nil, nil, fmt.Errorf("failed reading spec: %w", err)
	}
	if int64(len(data)) > maxBytes {
		return nil, nil, fmt.Errorf("%w (limit: %d bytes)", ErrSpecTooLarge, maxBytes)
	}

	trimmed := bytes.TrimSpace(data)
	if len(trimmed) == 0 {
		return nil, nil, errors.New("empty spec payload")
	}

	var raw map[string]any

	// Attempt JSON decoding first if starts with '{'
	if trimmed[0] == '{' {
		dec := json.NewDecoder(bytes.NewReader(trimmed))
		dec.UseNumber()
		if err := dec.Decode(&raw); err == nil && !dec.More() {
			spec, err := validateAndExtract(raw)
			if err != nil {
				return nil, nil, err
			}
			return spec, trimmed, nil
		}
	}

	// Fallback to safe YAML decoding with node & depth restrictions
	var rootNode yaml.Node
	if err := yaml.Unmarshal(trimmed, &rootNode); err != nil {
		return nil, nil, fmt.Errorf("%w: %v", ErrUnsupportedSpecFormat, err)
	}

	nodeCount := 0
	if err := walkYAMLNodes(&rootNode, 0, 64, &nodeCount, 100000); err != nil {
		return nil, nil, err
	}

	if err := rootNode.Decode(&raw); err != nil {
		return nil, nil, fmt.Errorf("failed decoding yaml into object: %w", err)
	}

	spec, err := validateAndExtract(raw)
	if err != nil {
		return nil, nil, err
	}

	// Standardize to clean JSON bytes for internal storage
	jsonBytes, err := json.Marshal(raw)
	if err != nil {
		return nil, nil, fmt.Errorf("failed serializing parsed spec: %w", err)
	}

	return spec, jsonBytes, nil
}

// validateAndExtract verifies the basic OpenAPI / Swagger structure and computes statistics.
func validateAndExtract(raw map[string]any) (*ParsedSpec, error) {
	if raw == nil {
		return nil, ErrInvalidSpecStructure
	}

	// Determine OpenAPI or Swagger version
	var openapiVer string
	if v, ok := raw["openapi"].(string); ok {
		openapiVer = v
	} else if v, ok := raw["swagger"].(string); ok {
		openapiVer = v
	} else {
		return nil, fmt.Errorf("%w: missing 'openapi' or 'swagger' version tag", ErrInvalidSpecStructure)
	}

	// Paths must be an object
	rawPaths, hasPaths := raw["paths"].(map[string]any)
	if !hasPaths {
		return nil, fmt.Errorf("%w: missing or invalid 'paths' object", ErrInvalidSpecStructure)
	}

	parsed := &ParsedSpec{
		Raw:        raw,
		OpenAPIVer: openapiVer,
		PathCount:  len(rawPaths),
		Methods:    make(map[string]int),
	}

	// Extract Info block
	if info, ok := raw["info"].(map[string]any); ok {
		if t, ok := info["title"].(string); ok {
			parsed.Title = t
		}
		if v, ok := info["version"].(string); ok {
			parsed.Version = v
		}
		if d, ok := info["description"].(string); ok {
			parsed.Description = d
		}
	}
	if parsed.Title == "" {
		parsed.Title = "Imported API Specification"
	}
	if parsed.Version == "" {
		parsed.Version = "1.0.0"
	}

	// Extract Tags
	tagSet := make(map[string]struct{})
	if tags, ok := raw["tags"].([]any); ok {
		for _, t := range tags {
			if tm, ok := t.(map[string]any); ok {
				if name, ok := tm["name"].(string); ok && name != "" {
					tagSet[name] = struct{}{}
				}
			}
		}
	}

	// Count operations and methods
	totalOps := 0
	httpMethods := map[string]struct{}{
		"get": {}, "post": {}, "put": {}, "delete": {}, "patch": {}, "options": {}, "head": {},
	}

	for _, pathItem := range rawPaths {
		if pathMap, ok := pathItem.(map[string]any); ok {
			for key, op := range pathMap {
				method := strings.ToLower(key)
				if _, ok := httpMethods[method]; ok {
					totalOps++
					parsed.Methods[strings.ToUpper(method)]++
					if opMap, ok := op.(map[string]any); ok {
						if opTags, ok := opMap["tags"].([]any); ok {
							for _, ot := range opTags {
								if s, ok := ot.(string); ok && s != "" {
									tagSet[s] = struct{}{}
								}
							}
						}
					}
				}
			}
		}
	}

	parsed.TotalOps = totalOps
	for tag := range tagSet {
		parsed.Tags = append(parsed.Tags, tag)
	}

	return parsed, nil
}
