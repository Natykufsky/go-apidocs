package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"strconv"
	"strings"
	"testing"
	"time"

	"golang.org/x/crypto/bcrypt"
)

func TestGenerateAndVerifySessionToken(t *testing.T) {
	secret := "test-secret-123"
	tok := GenerateDocsSessionToken("alice", secret, "ws-a", "ws-b")
	if tok == "" {
		t.Fatal("expected non-empty token")
	}

	sess, ok := ParseAndVerifySessionToken(tok, "alice", secret)
	if !ok {
		t.Fatal("expected token to verify")
	}
	if sess.Username != "alice" {
		t.Errorf("username = %q, want alice", sess.Username)
	}
	if len(sess.UnlockedWorkspaces) != 2 || sess.UnlockedWorkspaces[0] != "ws-a" {
		t.Errorf("unlocked workspaces = %v, want [ws-a ws-b]", sess.UnlockedWorkspaces)
	}
	if sess.ExpiresAt <= time.Now().Unix() {
		t.Errorf("expiry %d should be in the future", sess.ExpiresAt)
	}
}

func TestParseAndVerifySessionToken_RejectsTampering(t *testing.T) {
	secret := "test-secret-123"
	tok := GenerateDocsSessionToken("alice", secret)

	cases := map[string]string{
		"bad signature":   tamperSignature(tok, "deadbeef"),
		"wrong secret":    GenerateDocsSessionToken("alice", "other-secret"),
		"garbage input":   "not-a-token",
		"empty input":     "",
		"payload swapped": swapUsername(tok, "bob"),
	}
	for name, bad := range cases {
		if _, ok := ParseAndVerifySessionToken(bad, "alice", secret); ok {
			t.Errorf("%s: expected verification to fail", name)
		}
	}
}

func TestParseAndVerifySessionToken_ExpectedUsernameMismatch(t *testing.T) {
	secret := "s"
	tok := GenerateDocsSessionToken("alice", secret)
	if _, ok := ParseAndVerifySessionToken(tok, "bob", secret); ok {
		t.Error("expected mismatched expectedUsername to fail")
	}
	// Empty expectedUsername skips the username check (portal-internal use).
	if _, ok := ParseAndVerifySessionToken(tok, "", secret); !ok {
		t.Error("expected empty expectedUsername to pass")
	}
}

// tamperSignature replaces the trailing HMAC hex with the supplied value.
func tamperSignature(tok, sig string) string {
	raw, err := base64Decode(tok)
	if err != nil {
		return "bogus"
	}
	idx := strings.LastIndex(raw, ":")
	if idx < 0 {
		return "bogus"
	}
	return base64Encode(raw[:idx+1] + sig)
}

// swapUsername rewrites the payload username while keeping the original
// signature — verifies the HMAC actually protects payload integrity.
func swapUsername(tok, newUser string) string {
	raw, err := base64Decode(tok)
	if err != nil {
		return "bogus"
	}
	parts := strings.SplitN(raw, ":", 3) // username:expiry:signature(with workspaces)
	if len(parts) < 3 {
		return "bogus"
	}
	// keep expiry and signature, replace username
	rest := strings.Join(parts[1:], ":")
	return base64Encode(newUser + ":" + rest)
}

func base64Decode(s string) (string, error) {
	b, err := base64.URLEncoding.DecodeString(s)
	return string(b), err
}

func base64Encode(s string) string {
	return base64.URLEncoding.EncodeToString([]byte(s))
}

func TestGenerateInviteToken_RoundTrip(t *testing.T) {
	secret := "invite-secret"
	tok := GenerateInviteToken("ws-42", secret, time.Hour)
	if tok == "" {
		t.Fatal("expected non-empty invite token")
	}
	wsID, ok := VerifyInviteToken(tok, secret)
	if !ok || wsID != "ws-42" {
		t.Errorf("got wsID=%q ok=%v, want ws-42 true", wsID, ok)
	}
}

func TestGenerateInviteToken_Expiry(t *testing.T) {
	secret := "invite-secret"
	// Craft an already-expired invite token by hand (payload: invite:ws:<past>).
	past := time.Now().Add(-time.Hour).Unix()
	expired := GenerateInviteTokenAt("ws-42", past, secret)
	if _, ok := VerifyInviteToken(expired, secret); ok {
		t.Error("expected expired invite to fail verification")
	}
	// Note: GenerateInviteToken treats durations <= 0 as "default 7 days", so a
	// negative duration cannot accidentally mint a permanently-valid invite.
}

// GenerateInviteTokenAt builds an invite token with an explicit expiry timestamp.
func GenerateInviteTokenAt(wsID string, expiresAt int64, secret string) string {
	payload := "invite:" + wsID + ":" + strconv.FormatInt(expiresAt, 10)
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(payload))
	sig := hex.EncodeToString(mac.Sum(nil))
	return base64.URLEncoding.EncodeToString([]byte(payload + ":" + sig))
}

func TestGenerateInviteToken_WrongSecret(t *testing.T) {
	tok := GenerateInviteToken("ws-42", "secret-a", time.Hour)
	if _, ok := VerifyInviteToken(tok, "secret-b"); ok {
		t.Error("expected invite signed with a different secret to fail")
	}
}

func TestCheckPassword(t *testing.T) {
	password := "s3cret-P4ssword!"
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.MinCost)
	if err != nil {
		t.Fatalf("failed to generate bcrypt hash: %v", err)
	}
	if !CheckPassword(password, "", string(hash)) {
		t.Error("bcrypt hash should verify correct password")
	}
	if CheckPassword("wrong", "", string(hash)) {
		t.Error("bcrypt hash should reject wrong password")
	}
	if !CheckPassword("plain", "plain", "") {
		t.Error("plain comparison should match")
	}
	if CheckPassword("plain", "other", "") {
		t.Error("plain comparison should reject mismatch")
	}
	if CheckPassword("x", "", "") {
		t.Error("no expected credential configured should always fail")
	}
}

func TestProductionFailsClosedWithoutSecret(t *testing.T) {
	t.Setenv("APP_ENV", "production")

	if tok := GenerateDocsSessionToken("alice", ""); tok != "" {
		t.Error("expected empty token when secret missing in production")
	}
	if _, ok := ParseAndVerifySessionToken("whatever", "", ""); ok {
		t.Error("expected verification to fail without secret in production")
	}
	if tok := GenerateInviteToken("ws", "", time.Hour); tok != "" {
		t.Error("expected empty invite token without secret in production")
	}
}

func TestDevFallsBackToDevSecret(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	tok := GenerateDocsSessionToken("alice", "")
	if tok == "" {
		t.Fatal("dev environment should still mint tokens with fallback secret")
	}
	if _, ok := ParseAndVerifySessionToken(tok, "alice", devFallbackSecret); !ok {
		t.Error("fallback-secret token should verify against devFallbackSecret")
	}
}
