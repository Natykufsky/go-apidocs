package auth

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

// GitHubOAuthHandler redirects to GitHub's OAuth authorization page.
func GitHubOAuthHandler(w http.ResponseWriter, r *http.Request) {
	clientID := os.Getenv("GITHUB_CLIENT_ID")
	if clientID == "" {
		// Fallback developer mode notification
		http.Redirect(w, r, "/docs/login?error="+url.QueryEscape("GitHub OAuth not configured in .env (GITHUB_CLIENT_ID missing)"), http.StatusTemporaryRedirect)
		return
	}

	state := setOAuthState(w)
	redirectURI := fmt.Sprintf("%s/docs/oauth/github/callback", getHostOrigin(r))
	authURL := fmt.Sprintf("https://github.com/login/oauth/authorize?client_id=%s&redirect_uri=%s&scope=read:user,user:email&state=%s",
		url.QueryEscape(clientID),
		url.QueryEscape(redirectURI),
		url.QueryEscape(state),
	)
	http.Redirect(w, r, authURL, http.StatusTemporaryRedirect)
}

// GoogleOAuthHandler redirects to Google's OAuth authorization page.
func GoogleOAuthHandler(w http.ResponseWriter, r *http.Request) {
	clientID := os.Getenv("GOOGLE_CLIENT_ID")
	if clientID == "" {
		http.Redirect(w, r, "/docs/login?error="+url.QueryEscape("Google OAuth not configured in .env (GOOGLE_CLIENT_ID missing)"), http.StatusTemporaryRedirect)
		return
	}

	state := setOAuthState(w)
	redirectURI := fmt.Sprintf("%s/docs/oauth/google/callback", getHostOrigin(r))
	authURL := fmt.Sprintf("https://accounts.google.com/o/oauth2/v2/auth?client_id=%s&redirect_uri=%s&response_type=code&scope=openid%%20email%%20profile&state=%s",
		url.QueryEscape(clientID),
		url.QueryEscape(redirectURI),
		url.QueryEscape(state),
	)
	http.Redirect(w, r, authURL, http.StatusTemporaryRedirect)
}

func getHostOrigin(r *http.Request) string {
	proto := "http"
	if r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https" {
		proto = "https"
	}
	host := r.Host
	if host == "" {
		host = "localhost:8080"
	}
	return fmt.Sprintf("%s://%s", proto, host)
}

// oauthStateCookie stores the CSRF nonce during the OAuth round-trip.
const oauthStateCookie = "apidocs_oauth_state"

// randomState generates a cryptographically random, URL-safe CSRF nonce.
func randomState() string {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		// crypto/rand failure is unrecoverable; fall back to time-based uniqueness.
		return fmt.Sprintf("st-%d", time.Now().UnixNano())
	}
	return base64.RawURLEncoding.EncodeToString(buf)
}

// validateState ensures the state query param matches the signed cookie value
// and that the nonce is consumed (single-use) to mitigate replay.
func validateState(w http.ResponseWriter, r *http.Request) bool {
	q := r.URL.Query().Get("state")
	if q == "" {
		return false
	}
	c, err := r.Cookie(oauthStateCookie)
	if err != nil || c.Value == "" || subtle.ConstantTimeCompare([]byte(q), []byte(c.Value)) != 1 {
		return false
	}
	// Consume the state cookie so a nonce can't be replayed.
	http.SetCookie(w, &http.Cookie{
		Name:     oauthStateCookie,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   r.TLS != nil,
		SameSite: http.SameSiteLaxMode,
	})
	return true
}

// setOAuthState issues a fresh CSRF nonce as a short-lived cookie and returns it
// so it can also be embedded in the outbound authorize URL.
func setOAuthState(w http.ResponseWriter) string {
	state := randomState()
	http.SetCookie(w, &http.Cookie{
		Name:     oauthStateCookie,
		Value:    state,
		Path:     "/",
		MaxAge:   600, // 10 minutes to complete the OAuth round-trip
		HttpOnly: true,
		Secure:   false,
		SameSite: http.SameSiteLaxMode,
	})
	return state
}

// exchangeGitHubCode swaps an OAuth authorization code for an access token and
// returns the verified GitHub login username.
func exchangeGitHubCode(ctx context.Context, code string) (string, error) {
	clientID := os.Getenv("GITHUB_CLIENT_ID")
	clientSecret := os.Getenv("GITHUB_CLIENT_SECRET")
	if clientID == "" || clientSecret == "" {
		return "", fmt.Errorf("GitHub OAuth not configured (GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET missing)")
	}

	tokenURL := "https://github.com/login/oauth/access_token"
	body, _ := json.Marshal(map[string]string{
		"client_id":     clientID,
		"client_secret": clientSecret,
		"code":          code,
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, tokenURL, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("github token exchange failed: %w", err)
	}
	defer resp.Body.Close()

	limited := io.LimitReader(resp.Body, 1<<20)
	var tok struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.NewDecoder(limited).Decode(&tok); err != nil || tok.AccessToken == "" {
		return "", fmt.Errorf("github token exchange returned no access token")
	}

	// Fetch the authenticated user to confirm the token is valid.
	ureq, _ := http.NewRequestWithContext(ctx, http.MethodGet, "https://api.github.com/user", nil)
	ureq.Header.Set("Authorization", "Bearer "+tok.AccessToken)
	ureq.Header.Set("Accept", "application/vnd.github+json")
	uresp, err := client.Do(ureq)
	if err != nil {
		return "", fmt.Errorf("github user fetch failed: %w", err)
	}
	defer uresp.Body.Close()
	if uresp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("github user fetch returned status %d", uresp.StatusCode)
	}
	var user struct {
		Login string `json:"login"`
	}
	if err := json.NewDecoder(io.LimitReader(uresp.Body, 1<<20)).Decode(&user); err != nil || user.Login == "" {
		return "", fmt.Errorf("github user payload invalid")
	}
	return user.Login, nil
}

// exchangeGoogleCode swaps an OAuth authorization code for an access token and
// returns the verified Google account email.
func exchangeGoogleCode(ctx context.Context, code string) (string, error) {
	clientID := os.Getenv("GOOGLE_CLIENT_ID")
	clientSecret := os.Getenv("GOOGLE_CLIENT_SECRET")
	if clientID == "" || clientSecret == "" {
		return "", fmt.Errorf("Google OAuth not configured (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET missing)")
	}

	tokenURL := "https://oauth2.googleapis.com/token"
	form := url.Values{
		"code":          {code},
		"client_id":     {clientID},
		"client_secret": {clientSecret},
		"grant_type":    {"authorization_code"},
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, tokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("google token exchange failed: %w", err)
	}
	defer resp.Body.Close()

	var tok struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&tok); err != nil || tok.AccessToken == "" {
		return "", fmt.Errorf("google token exchange returned no access token")
	}

	ureq, _ := http.NewRequestWithContext(ctx, http.MethodGet, "https://openidconnect.googleapis.com/v1/userinfo", nil)
	ureq.Header.Set("Authorization", "Bearer "+tok.AccessToken)
	uresp, err := client.Do(ureq)
	if err != nil {
		return "", fmt.Errorf("google userinfo failed: %w", err)
	}
	defer uresp.Body.Close()
	if uresp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("google userinfo returned status %d", uresp.StatusCode)
	}
	var user struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(io.LimitReader(uresp.Body, 1<<20)).Decode(&user); err != nil || user.Email == "" {
		return "", fmt.Errorf("google userinfo payload invalid")
	}
	return user.Email, nil
}

// loginRedirect bounces back to the docs login page with an error or success notice.
func loginRedirect(w http.ResponseWriter, r *http.Request, msg string) {
	http.Redirect(w, r, "/docs/login?error="+url.QueryEscape(msg), http.StatusTemporaryRedirect)
}

// GitHubOAuthCallbackHandler completes the GitHub OAuth flow: validates the CSRF
// state, exchanges the code, and establishes a docs session for the user.
func GitHubOAuthCallbackHandler(secret string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !validateState(w, r) {
			loginRedirect(w, r, "OAuth state validation failed (CSRF check)")
			return
		}
		username, err := exchangeGitHubCode(r.Context(), r.URL.Query().Get("code"))
		if err != nil {
			loginRedirect(w, r, err.Error())
			return
		}
		finishOAuthSession(w, r, username, secret)
	}
}

// GoogleOAuthCallbackHandler completes the Google OAuth flow with the same
// CSRF state validation and session establishment as the GitHub callback.
func GoogleOAuthCallbackHandler(secret string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !validateState(w, r) {
			loginRedirect(w, r, "OAuth state validation failed (CSRF check)")
			return
		}
		username, err := exchangeGoogleCode(r.Context(), r.URL.Query().Get("code"))
		if err != nil {
			loginRedirect(w, r, err.Error())
			return
		}
		finishOAuthSession(w, r, username, secret)
	}
}

// finishOAuthSession signs a docs session token for the OAuth-verified identity
// and sets it as an HttpOnly cookie, then redirects into the portal.
func finishOAuthSession(w http.ResponseWriter, r *http.Request, username, secret string) {
	token := GenerateDocsSessionToken(username, secret)
	if token == "" {
		loginRedirect(w, r, "session could not be issued (server signing secret missing)")
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     DocsSessionCookieName,
		Value:    token,
		Path:     "/",
		MaxAge:   24 * 3600,
		HttpOnly: true,
		Secure:   r.TLS != nil,
		SameSite: http.SameSiteLaxMode,
	})
	http.Redirect(w, r, "/docs", http.StatusTemporaryRedirect)
}
