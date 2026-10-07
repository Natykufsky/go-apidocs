package auth

import (
	"fmt"
	"net/http"
	"net/url"
	"os"
)

// GitHubOAuthHandler redirects to GitHub's OAuth authorization page.
func GitHubOAuthHandler(w http.ResponseWriter, r *http.Request) {
	clientID := os.Getenv("GITHUB_CLIENT_ID")
	if clientID == "" {
		// Fallback developer mode notification
		http.Redirect(w, r, "/docs/login?error="+url.QueryEscape("GitHub OAuth not configured in .env (GITHUB_CLIENT_ID missing)"), http.StatusTemporaryRedirect)
		return
	}

	redirectURI := fmt.Sprintf("%s/docs/oauth/github/callback", getHostOrigin(r))
	authURL := fmt.Sprintf("https://github.com/login/oauth/authorize?client_id=%s&redirect_uri=%s&scope=read:user,user:email",
		url.QueryEscape(clientID),
		url.QueryEscape(redirectURI),
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

	redirectURI := fmt.Sprintf("%s/docs/oauth/google/callback", getHostOrigin(r))
	authURL := fmt.Sprintf("https://accounts.google.com/o/oauth2/v2/auth?client_id=%s&redirect_uri=%s&response_type=code&scope=openid%%20email%%20profile",
		url.QueryEscape(clientID),
		url.QueryEscape(redirectURI),
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
