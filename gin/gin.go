package gin

import (
	"github.com/gin-gonic/gin"
	"github.com/Natykufsky/go-apidocs"
)

// Mount attaches all documentation, login, QA tracker, and Swagger UI routes to a Gin engine or router group.
func Mount(r gin.IRoutes, cfg apidocs.Config) {
	apidocs.MountGin(r, cfg)
}
