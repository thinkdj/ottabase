# Releases

## Versioning

- This repository follows [Semantic Versioning](https://semver.org/).
- User-facing changes are tracked in [`CHANGELOG.md`](./CHANGELOG.md).

## Release Flow

1. Merge reviewed changes to `main`.
2. Ensure CI (`lint`, `type-check`, `test`, `build`) is green.
3. Update `CHANGELOG.md` (move relevant `Unreleased` entries into a version section).
4. Create and push a git tag (for example: `v1.0.1`).
5. Publish release notes on GitHub based on the changelog section.

## Hotfixes

- Use the same flow as above with a patch version bump.
- Include a clear root-cause summary in release notes when applicable.
