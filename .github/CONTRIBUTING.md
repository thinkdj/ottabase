# Contributing to Ottabase

Thank you for your interest in contributing to Ottabase! This guide will help you get started.

## Getting Started

### Prerequisites

- **Node.js** ≥ 24.0.0
- **pnpm** ≥ 10.0.0 (install via `corepack enable pnpm`)
- A Cloudflare account (free tier works for development)

### Setup

```bash
# 1. Fork and clone the repo
git clone https://github.com/thinkdj/ottabase.git
cd ottabase

# 2. Install dependencies
pnpm install

# 3. Build shared packages (required before running apps)
pnpm build:pkg

# 4. Start the dev server
pnpm dev
```

### Project Structure

```text
ottabase/
├── apps/           # Application templates
├── packages/       # Shared packages (@ottabase/*)
├── docs/           # Additional documentation
└── turbo.json      # Turborepo build config
```

See [AGENTS.MD](./AGENTS.MD) for full architecture details.

## How to Contribute

### Reporting Bugs

- Use the [Bug Report form](https://github.com/thinkdj/ottabase/issues/new/choose)
- Include steps to reproduce, expected behavior, and actual behavior
- Include your environment details (OS, Node.js version, pnpm version)

### Suggesting Features

- Use the [Feature Request form](https://github.com/thinkdj/ottabase/issues/new/choose)
- Explain the use case and why existing features don't solve it
- Check existing issues to avoid duplicates

### Submitting Pull Requests

1. **Fork the repo** and create a branch from `main`
2. **Make your changes** — keep them focused and small
3. **Add or update tests** for any changed functionality
4. **Update documentation** (README.md, inline comments) as needed
5. **Run quality checks:**

    ```bash
    pnpm lint                              # Lint all packages
    pnpm type-check                        # TypeScript validation
    pnpm --filter=@ottabase/<package> test # Run tests for your package
    ```

6. **Submit a pull request** using the PR template

### Finding Issues to Work On

Look for issues labeled:

- [`good first issue`](https://github.com/thinkdj/ottabase/labels/good%20first%20issue) — small, well-scoped tasks for
  newcomers
- [`help wanted`](https://github.com/thinkdj/ottabase/labels/help%20wanted) — areas where we need community help

## Coding Standards

### General

- **TypeScript only** — no plain JavaScript in source code
- **Prettier** for formatting (run `pnpm format` before committing)
- **ESLint** for linting (run `pnpm lint` to check)

### Architecture

- **Fat Models** — business logic goes in OttaORM `BaseModel` subclasses, not in controllers or services
- **Edge-compatible** — avoid Node.js-only APIs (`fs`, `child_process`) in app and package code
- **Workspace protocol** — use `workspace:*` for internal package dependencies
- **Catalog dependencies** — use `catalog:` for shared external dependencies

### Packages

- Every new package must have a `README.md`
- Every new package must include tests
- Use `tsup` for building (see existing packages for examples)
- Export types explicitly

### Commits

- Use clear, descriptive commit messages
- Reference issue numbers when applicable (e.g., `fix: resolve RBAC cache race condition (#42)`)

## Development Workflow

### Working on a Package

```bash
# Build a specific package
pnpm --filter @ottabase/<package> build

# Run tests for a specific package
pnpm --filter=@ottabase/<package> test

# Type-check a specific package
pnpm --filter=@ottabase/<package> type-check
```

### Adding Dependencies

- **Multiple packages need it?** → Add to `pnpm-workspace.yaml` catalog
- **Only one package needs it?** → Add directly to that package's `package.json`
- **Framework dependency in a shared package?** → Add as `peerDependency`

```bash
# Add to a specific package
pnpm add --filter @ottabase/<package> <dependency>

# Add to catalog (edit pnpm-workspace.yaml, then reference as catalog:)
```

### Database Changes

If you modify a model or schema:

1. Update the schema in the appropriate file
2. Export the table in `ottabase/db/schema.ts`
3. Register the model in `worker/lib/db-utils.ts` if it needs CRUD API
4. Test with `curl -X POST http://localhost:3004/api/ottaorm/init`

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](./CODE_OF_CONDUCT.md). By participating, you are
expected to uphold this code. Please report unacceptable behavior to the maintainers.

## Questions?

- Open a [Discussion](https://github.com/thinkdj/ottabase/discussions) on GitHub
- Tag `@thinkdj` for architecture-related questions

## License

By contributing to Ottabase, you agree that your contributions will be licensed under its [MIT License](./LICENSE).
