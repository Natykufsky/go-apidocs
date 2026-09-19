package apidocs

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
)

const DocsSessionCookieName = "apidocs_session_token"

// GenerateDocsSessionToken creates an HMAC-SHA256 signed session cookie token valid for 24h.
func GenerateDocsSessionToken(username, secret string) string {
	if secret == "" {
		secret = "default_apidocs_dev_secret"
	}
	expiresAt := time.Now().Add(24 * time.Hour).Unix()
	payload := fmt.Sprintf("%s:%d", username, expiresAt)

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(payload))
	signature := hex.EncodeToString(mac.Sum(nil))

	raw := fmt.Sprintf("%s:%s", payload, signature)
	return base64.URLEncoding.EncodeToString([]byte(raw))
}

// VerifyDocsSessionToken checks if the cookie session token is valid and not expired.
func VerifyDocsSessionToken(tokenStr, expectedUsername, secret string) bool {
	if secret == "" {
		secret = "default_apidocs_dev_secret"
	}
	rawBytes, err := base64.URLEncoding.DecodeString(tokenStr)
	if err != nil {
		return false
	}
	parts := strings.Split(string(rawBytes), ":")
	if len(parts) != 3 {
		return false
	}

	username := parts[0]
	expiresAtStr := parts[1]
	providedSignature := parts[2]

	if expectedUsername != "" && username != expectedUsername {
		return false
	}

	expiresAt, err := strconv.ParseInt(expiresAtStr, 10, 64)
	if err != nil || time.Now().Unix() > expiresAt {
		return false // Expired
	}

	payload := fmt.Sprintf("%s:%s", username, expiresAtStr)
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(payload))
	expectedSignature := hex.EncodeToString(mac.Sum(nil))

	return hmac.Equal([]byte(providedSignature), []byte(expectedSignature))
}

// WebAuthMiddleware protects documentation and UI routes behind a login gate if enabled.
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
