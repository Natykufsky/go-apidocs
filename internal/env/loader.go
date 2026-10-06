package env

import (
	"bufio"
	"os"
	"strings"
)

// LoadDotEnv loads key-value pairs from .env or .env.local into the process environment if they are not already set.
func LoadDotEnv(paths ...string) {
	if len(paths) == 0 {
		paths = []string{".env", ".env.local"}
	}

	for _, path := range paths {
		file, err := os.Open(path)
		if err != nil {
			continue
		}
		defer file.Close()

		scanner := bufio.NewScanner(file)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}

			parts := strings.SplitN(line, "=", 2)
			if len(parts) == 2 {
				key := strings.TrimSpace(parts[0])
				val := strings.TrimSpace(parts[1])
				// Strip surrounding quotes
				val = strings.Trim(val, `"'`)
				if key != "" && os.Getenv(key) == "" {
					_ = os.Setenv(key, val)
				}
			}
		}
	}
}
