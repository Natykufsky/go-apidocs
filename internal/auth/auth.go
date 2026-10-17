package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gofiber/fiber/v2"
	"golang.org/x/crypto/bcrypt"
)

const DocsSessionCookieName = "apidocs_session_token"

// SessionData holds parsed session token claims.
type SessionData struct {
	Username          string   `json:"username"`
	Role              string   `json:"role"`
	UnlockedWorkspaces []string `json:"unlocked_workspaces"`
	ExpiresAt         int64    `json:"expires_at"`
}

// CheckPassword verifies a provided password against either a bcrypt hash or plain text password with constant-time matching.
func CheckPassword(providedPass, expectedPlain, expectedHash string) bool {
	if expectedHash != "" {
		err := bcrypt.CompareHashAndPassword([]byte(expectedHash), []byte(providedPass))
		return err == nil
	}
	if expectedPlain != "" {
		return subtle.ConstantTimeCompare([]byte(providedPass), []byte(expectedPlain)) == 1
	}
	return false
}

// GenerateDocsSessionToken creates an HMAC-SHA256 signed session cookie token with role and unlocked workspaces.
func GenerateDocsSessionToken(username, secret string, unlockedWorkspaces ...string) string {
	if secret == "" {
		secret = "default_apidocs_dev_secret"
	}
	expiresAt := time.Now().Add(24 * time.Hour).Unix()
	unlockedStr := strings.Join(unlockedWorkspaces, ",")
	payload := fmt.Sprintf("%s:%d:%s", username, expiresAt, unlockedStr)

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(payload))
	signature := hex.EncodeToString(mac.Sum(nil))

	raw := fmt.Sprintf("%s:%s", payload, signature)
	return base64.URLEncoding.EncodeToString([]byte(raw))
}

// GenerateInviteToken creates a signed, time-limited invitation token for a workspace.
func GenerateInviteToken(wsID, secret string, validDuration time.Duration) string {
	if secret == "" {
		secret = "default_apidocs_dev_secret"
	}
	if validDuration <= 0 {
		validDuration = 7 * 24 * time.Hour // Default 7 days
	}
	expiresAt := time.Now().Add(validDuration).Unix()
	payload := fmt.Sprintf("invite:%s:%d", wsID, expiresAt)

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(payload))
	signature := hex.EncodeToString(mac.Sum(nil))

	raw := fmt.Sprintf("%s:%s", payload, signature)
	return base64.URLEncoding.EncodeToString([]byte(raw))
}

// VerifyInviteToken validates an invitation token and returns the invited workspace ID if valid.
func VerifyInviteToken(tokenStr, secret string) (string, bool) {
	if secret == "" {
		secret = "default_apidocs_dev_secret"
	}
	rawBytes, err := base64.URLEncoding.DecodeString(tokenStr)
	if err != nil {
		return "", false
	}
	rawStr := string(rawBytes)
	lastColon := strings.LastIndex(rawStr, ":")
	if lastColon <= 0 {
		return "", false
	}

	payload := rawStr[:lastColon]
	providedSig := rawStr[lastColon+1:]

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(payload))
	expectedSig := hex.EncodeToString(mac.Sum(nil))

	if subtle.ConstantTimeCompare([]byte(providedSig), []byte(expectedSig)) != 1 {
		return "", false
	}

	parts := strings.Split(payload, ":")
	if len(parts) != 3 || parts[0] != "invite" {
		return "", false
	}

	wsID := parts[1]
	expiresAt, err := strconv.ParseInt(parts[2], 10, 64)
	if err != nil || time.Now().Unix() > expiresAt {
		return "", false
	}

	return wsID, true
}

// ParseAndVerifySessionToken validates token signature and returns parsed session data.
func ParseAndVerifySessionToken(tokenStr, expectedUsername, secret string) (*SessionData, bool) {
	if secret == "" {
		secret = "default_apidocs_dev_secret"
	}
	rawBytes, err := base64.URLEncoding.DecodeString(tokenStr)
	if err != nil {
		return nil, false
	}
	rawStr := string(rawBytes)
	lastColon := strings.LastIndex(rawStr, ":")
	if lastColon <= 0 {
		return nil, false
	}

	payload := rawStr[:lastColon]
	providedSignature := rawStr[lastColon+1:]

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(payload))
	expectedSignature := hex.EncodeToString(mac.Sum(nil))

	if subtle.ConstantTimeCompare([]byte(providedSignature), []byte(expectedSignature)) != 1 {
		return nil, false
	}

	parts := strings.Split(payload, ":")
	if len(parts) < 2 {
		return nil, false
	}

	username := parts[0]
	expiresAtStr := parts[1]

	if expectedUsername != "" && subtle.ConstantTimeCompare([]byte(username), []byte(expectedUsername)) != 1 {
		return nil, false
	}

	expiresAt, err := strconv.ParseInt(expiresAtStr, 10, 64)
	if err != nil || time.Now().Unix() > expiresAt {
		return nil, false // Expired
	}

	var unlocked []string
	if len(parts) >= 3 && parts[2] != "" {
		unlocked = strings.Split(parts[2], ",")
	}

	return &SessionData{
		Username:           username,
		Role:               "admin",
		UnlockedWorkspaces: unlocked,
		ExpiresAt:          expiresAt,
	}, true
}

// VerifyDocsSessionToken checks if the cookie session token is valid and not expired.
func VerifyDocsSessionToken(tokenStr, expectedUsername, secret string) bool {
	_, valid := ParseAndVerifySessionToken(tokenStr, expectedUsername, secret)
	return valid
}

// WebAuthMiddleware protects documentation and UI routes behind a login gate if enabled for Fiber.
func WebAuthMiddleware(authEnabled bool, authUser, authPass, jwtSecret string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if !authEnabled || authUser == "" {
			return c.Next()
		}

		cookieVal := c.Cookies(DocsSessionCookieName)
		if cookieVal != "" && VerifyDocsSessionToken(cookieVal, authUser, jwtSecret) {
			return c.Next()
		}

		originalPath := c.OriginalURL()
		loginURL := "/docs/login"
		if originalPath != "" && originalPath != "/" && originalPath != "/docs/login" {
			loginURL = fmt.Sprintf("/docs/login?redirect=%s", url.QueryEscape(originalPath))
		}
		return c.Redirect(loginURL)
	}
}

// HTTPAuthMiddleware protects documentation and UI routes behind a login gate for standard net/http & Chi.
func HTTPAuthMiddleware(authEnabled bool, authUser, authPass, jwtSecret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !authEnabled || authUser == "" {
				next.ServeHTTP(w, r)
				return
			}

			cookie, err := r.Cookie(DocsSessionCookieName)
			if err == nil && cookie != nil && cookie.Value != "" && VerifyDocsSessionToken(cookie.Value, authUser, jwtSecret) {
				next.ServeHTTP(w, r)
				return
			}

			originalPath := r.RequestURI
			loginURL := "/docs/login"
			if originalPath != "" && originalPath != "/" && originalPath != "/docs/login" {
				loginURL = fmt.Sprintf("/docs/login?redirect=%s", url.QueryEscape(originalPath))
			}
			http.Redirect(w, r, loginURL, http.StatusFound)
		})
	}
}

// GinAuthMiddleware protects documentation and UI routes behind a login gate for Gin.
func GinAuthMiddleware(authEnabled bool, authUser, authPass, jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !authEnabled || authUser == "" {
			c.Next()
			return
		}

		cookieVal, err := c.Cookie(DocsSessionCookieName)
		if err == nil && cookieVal != "" && VerifyDocsSessionToken(cookieVal, authUser, jwtSecret) {
			c.Next()
			return
		}

		originalPath := c.Request.RequestURI
		loginURL := "/docs/login"
		if originalPath != "" && originalPath != "/" && originalPath != "/docs/login" {
			loginURL = fmt.Sprintf("/docs/login?redirect=%s", url.QueryEscape(originalPath))
		}
		c.Redirect(http.StatusFound, loginURL)
		c.Abort()
	}
}
