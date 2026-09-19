package chi

import (
	"github.com/go-chi/chi/v5"
	"github.com/Natykufsky/go-apidocs"
)

// Mount attaches all documentation, login, QA tracker, and Swagger UI routes to a Chi router.
func Mount(r chi.Router, cfg apidocs.Config) {
	apidocs.MountChi(r, cfg)
}
