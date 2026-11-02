# Agent Guidelines & Project Rules

## Go Semantic Import Versioning Rules (Go Modules)

- **Strict Major Version Suffixing**: Go enforces Semantic Import Versioning. For any release `v2.0.0` or higher (`v2.x.x`, `v3.x.x`, etc.):
  1. The module path in `go.mod` MUST include the major version suffix (e.g. `module github.com/Natykufsky/go-apidocs/v2`).
  2. All internal package imports across the entire repository and its subpackages (e.g. adapters `chi/`, `gin/`, CLI tools, tests) MUST use the versioned path:
     ```go
     import "github.com/Natykufsky/go-apidocs/v2"
     import "github.com/Natykufsky/go-apidocs/v2/chi"
     import "github.com/Natykufsky/go-apidocs/v2/gin"
     ```
  3. All user-facing documentation (`README.md`), landing pages (`LandingView.tsx`), and code examples MUST instruct users to install and import the major version path (`go get github.com/Natykufsky/go-apidocs/v2`).
  4. Whenever a major version bump occurs (e.g. `v2` -> `v3`), update `go.mod`, all internal import paths, docs, and examples before tagging or releasing.

## Git Release & Tagging Rules

- **Automated Version Tagging on Push**: Whenever committing and pushing changes to this repository, you MUST always:
  1. Determine the appropriate semantic version increment (`vX.Y.Z` - patch for fixes/refactors, minor for new features/adapters, major for breaking changes).
  2. Ensure `ui/package.json` and `ui/package-lock.json` are updated to match the release version (`X.Y.Z`).
  3. Ensure the module path in `go.mod` matches the major version (`/v2` for `v2.x.x`, `/v3` for `v3.x.x`).
  4. Create an annotated Git release tag with a descriptive release summary:
     ```bash
     git tag -a vX.Y.Z -m "Release vX.Y.Z: <summary of changes>"
     ```
  5. Push both the branch and the tags to origin:
     ```bash
     git push origin main --tags
     ```
  6. Ensure that no commit is pushed to remote without its corresponding release tag.

## NPM Release & NPM Publish Rules

- **Automated NPM Release & Publish on Push**: Whenever committing and pushing changes that affect the NPM package:
  1. Determine the appropriate semantic version increment (`vX.Y.Z`).
  2. Update the `package.json` and `package-lock.json` files with the new version.
  3. Create an annotated Git release tag with a descriptive release summary:
     ```bash
     git tag -a vX.Y.Z -m "Release vX.Y.Z: <summary of changes>"
     ```
  4. Push both the branch and the tags to origin:
     ```bash
     git push origin main --tags
     ```
  5. Publish the package to NPM:
     ```bash
     npm publish
     ```
  6. Ensure that no commit is pushed to remote without its corresponding release tag and NPM publish.