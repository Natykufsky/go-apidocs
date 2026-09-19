package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/Natykufsky/go-apidocs"
)

func main() {
	specPath := flag.String("spec", "./docs/swagger.json", "Path to OpenAPI / Swagger spec file (JSON)")
	readmePath := flag.String("readme", "./README.md", "Path to project README markdown file")
	docsDir := flag.String("docs-dir", "./docs", "Base documentation directory")
	pathsDir := flag.String("paths-dir", "", "Optional directory containing modular paths json files (default: <docs-dir>/paths)")
	port := flag.String("port", "8080", "HTTP server port to listen on")
	title := flag.String("title", "API Documentation & QA Hub", "Title displayed on portal and Swagger UI")
	subtitle := flag.String("subtitle", "Developer Portal, Real-Time QA Suite & Sandbox", "Subtitle displayed in header")
	authUser := flag.String("user", "", "Optional username to protect docs (or set DOCS_AUTH_USER)")
	authPass := flag.String("pass", "", "Optional password to protect docs (or set DOCS_AUTH_PASS)")
	jwtSecret := flag.String("secret", "apidocs_standalone_secret_key", "HMAC cookie signing secret")
	qaStorage := flag.String("qa-storage", "./docs/qa_tracker.json", "File path to persist QA reviews and bug comments")

	flag.Usage = func() {
		fmt.Fprintf(os.Stderr, "🚀 go-apidocs — Zero-Dependency Standalone API Documentation & QA Portal Server\n\n")
		fmt.Fprintf(os.Stderr, "Usage:\n")
		fmt.Fprintf(os.Stderr, "  go-apidocs [options]\n\n")
		fmt.Fprintf(os.Stderr, "Options:\n")
		flag.PrintDefaults()
		fmt.Fprintf(os.Stderr, "\nExamples:\n")
		fmt.Fprintf(os.Stderr, "  go-apidocs --spec=./docs/swagger.json --port=8080\n")
		fmt.Fprintf(os.Stderr, "  go-apidocs --spec=./openapi.json --readme=./README.md --user=admin --pass=secret123\n")
	}

	flag.Parse()

	cfg := apidocs.Config{
		SpecFilePath:  *specPath,
		ReadmePath:    *readmePath,
		DocsDir:       *docsDir,
		PathsDir:      *pathsDir,
		Title:         *title,
		Subtitle:      *subtitle,
		AuthUser:      *authUser,
		AuthPassword:  *authPass,
		JWTSecret:     *jwtSecret,
		QAStoragePath: *qaStorage,
	}

	mux := http.NewServeMux()
	apidocs.MountNetHTTP(mux, cfg)

	addr := ":" + *port
	fmt.Println("==================================================================")
	fmt.Printf("🚀 go-apidocs server running at: http://localhost:%s\n", *port)
	fmt.Printf("   📖 Developer Reference:        http://localhost:%s/guide\n", *port)
	fmt.Printf("   ⚡ Swagger UI & QA Sandbox:    http://localhost:%s/docs\n", *port)
	fmt.Printf("   🏠 Developer Hub:              http://localhost:%s/\n", *port)
	if *authUser != "" {
		fmt.Printf("   🔒 Security Gate:              Enabled (User: %s)\n", *authUser)
	} else {
		fmt.Printf("   🔓 Security Gate:              Public Access (No Auth)\n")
	}
	fmt.Println("==================================================================")

	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
