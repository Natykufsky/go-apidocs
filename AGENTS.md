# Agent Guidelines & Project Rules

## Git Release & Tagging Rules

- **Automated Version Tagging on Push**: Whenever committing and pushing changes to this repository, you MUST always:
  1. Determine the appropriate semantic version increment (`vX.Y.Z` - patch for fixes/refactors, minor for new features/adapters, major for breaking changes).
  2. Create an annotated Git release tag with a descriptive release summary:
     ```bash
     git tag -a vX.Y.Z -m "Release vX.Y.Z: <summary of changes>"
     ```
  3. Push both the branch and the tags to origin:
     ```bash
     git push origin main --tags
     ```
  4. Ensure that no commit is pushed to remote without its corresponding release tag.
