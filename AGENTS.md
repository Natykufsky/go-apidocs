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
  5. Ensure package.json and package-lock.json are updated with the new version.


  
## NPM Release & NPM Publish Rules
- **Automated NPM Release & Publish on Push**: Whenever committing and pushing changes to this repository, you MUST always:
  1. Determine the appropriate semantic version increment (`vX.Y.Z` - patch for fixes/refactors, minor for new features/adapters, major for breaking changes).
  2. Update the package.json and package-lock.json files with the new version.
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