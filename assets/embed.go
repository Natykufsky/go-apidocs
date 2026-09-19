package assets

import (
	"embed"
)

//go:embed *
var DefaultFS embed.FS
