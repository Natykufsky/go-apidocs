// Package middleware provides composable net/http middleware for structured
// logging, request correlation, panic recovery, and security headers.
package middleware

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"log/slog"
	"net/http"
	"time"
)

// ctxKey is an unexported type for context keys in this package.
type ctxKey string

// RequestIDContextKey stores the correlation ID in request context.
const RequestIDContextKey ctxKey = "apidocs_request_id"

// RequestIDHeader is the response/request header carrying the correlation ID.
const RequestIDHeader = "X-Request-ID"

// RequestID returns the correlation ID from context ("" if absent).
func RequestID(ctx context.Context) string {
	if v, ok := ctx.Value(RequestIDContextKey).(string); ok {
		return v
	}
	return ""
}

// newRequestID generates a 16-byte random hex correlation ID.
func newRequestID() string {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return hex.EncodeToString([]byte(time.Now().Format("20060102150405")))
	}
	return hex.EncodeToString(buf)
}

// RequestIDMiddleware assigns a correlation ID to every request: honoring an
// inbound X-Request-ID (trusted proxies only should set it), otherwise
// generating one. The ID is set on the response header and request context.
func RequestIDMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := r.Header.Get(RequestIDHeader)
		if id == "" || len(id) > 64 {
			id = newRequestID()
		}
		w.Header().Set(RequestIDHeader, id)
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), RequestIDContextKey, id)))
	})
}

// Logger returns the package-level structured logger.
func Logger() *slog.Logger {
	return slog.Default()
}

// LoggingMiddleware emits one structured log line per request with method,
// path, status, duration, bytes, remote address, and the correlation ID.
func LoggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rw := &statusWriter{ResponseWriter: w, status: http.StatusOK}

		next.ServeHTTP(rw, r)

		slog.InfoContext(r.Context(), "http_request",
			"request_id", RequestID(r.Context()),
			"method", r.Method,
			"path", r.URL.Path,
			"status", rw.status,
			"duration_ms", time.Since(start).Milliseconds(),
			"bytes", rw.bytes,
			"remote", r.RemoteAddr,
		)
	})
}

// RecoverMiddleware converts panics into 500 responses instead of killing the
// connection (and logs the stack with the correlation ID).
func RecoverMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				slog.ErrorContext(r.Context(), "panic_recovered",
					"request_id", RequestID(r.Context()),
					"panic", rec,
					"path", r.URL.Path,
				)
				http.Error(w, `{"error":"internal server error"}`, http.StatusInternalServerError)
			}
		}()
		next.ServeHTTP(w, r)
	})
}

// SecureHeadersMiddleware sets baseline defense-in-depth response headers.
func SecureHeadersMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-Frame-Options", "DENY")
		h.Set("Referrer-Policy", "strict-origin-when-cross-origin")
		h.Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		next.ServeHTTP(w, r)
	})
}

// statusWriter captures the response status and byte count for logging.
type statusWriter struct {
	http.ResponseWriter
	status int
	bytes  int
}

func (w *statusWriter) WriteHeader(code int) {
	w.status = code
	w.ResponseWriter.WriteHeader(code)
}

func (w *statusWriter) Write(b []byte) (int, error) {
	n, err := w.ResponseWriter.Write(b)
	w.bytes += n
	return n, err
}

// Chain applies middleware in order: the first argument is outermost.
func Chain(h http.Handler, mws ...func(http.Handler) http.Handler) http.Handler {
	for i := len(mws) - 1; i >= 0; i-- {
		h = mws[i](h)
	}
	return h
}
