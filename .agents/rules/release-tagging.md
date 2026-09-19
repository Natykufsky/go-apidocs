---
description: Enforce creating and pushing a semantic release tag on every git push
always_on: true
---

# Release Tagging Rule

Whenever changes are committed and pushed to the repository:
1. Increment the version number according to SemVer (`vX.Y.Z`).
2. Create an annotated git tag:
   ```bash
   git tag -a vX.Y.Z -m "Release vX.Y.Z: <description>"
   ```
3. Push to remote with tags:
   ```bash
   git push origin main --tags
   ```
4. Never push commits without their corresponding release tag.
