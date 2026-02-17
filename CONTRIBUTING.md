# Contributing to Ottabase

Thank you for considering contributing to Ottabase! This guide will help you get started.

## Prerequisites

- **Node.js** >= 24.0.0
- **pnpm** >= 10.0.0

> **Windows Users**: Ensure [Visual C++ Redistributable](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist?view=msvc-170#latest-supported-redistributable-version) is installed.

## Setup

```bash
# Clone the repository
git clone https://github.com/thinkdj/ottabase.git
cd ottabase

# Install dependencies
pnpm install

# Build all packages (required before first run)
pnpm build:pkg

# Start development
pnpm dev
```

## Project Structure

Ottabase is a monorepo using pnpm workspaces and Turborepo:

```
ottabase/
├── apps/                  # Applications
├── packages/              # Shared packages (@ottabase/*)
├── ottabase.manifest.json # Package tier definitions
├── turbo.json             # Turborepo configuration
└── pnpm-workspace.yaml    # Workspace configuration
```

## Development Workflow

### Making Changes

1. Create a feature branch from `main`
2. Make your changes in the relevant `packages/` or `apps/` directory
3. Run quality checks before committing

### Quality Checks

```bash
# Lint
pnpm lint

# Type check
pnpm type-check

# Run tests
pnpm test

# Run tests for a specific package
pnpm test --filter=@ottabase/ottaorm
```

### Creating a New Package

Use the `hello-world` package as a template:

```bash
cp -r packages/hello-world packages/my-package
cd packages/my-package
# Update package.json (name, description)
# Start building your package
```

### Creating a New App

```bash
# Scaffold from the TanStack template
pnpm create-app my-app

# Follow the on-screen instructions
```

## Code Conventions

- **Package Manager**: Always use pnpm (never npm or yarn)
- **Internal Dependencies**: Use `"workspace:*"` for @ottabase packages
- **Shared Dependencies**: Reference `"catalog:"` for versions defined in pnpm-workspace.yaml
- **Models**: Follow the Fat Model pattern (schema + logic together)
- **TypeScript**: Strict mode, exported types for all public APIs
- **Formatting**: Prettier with project settings

## Package Tiers

Packages are organized into tiers (see `ottabase.manifest.json`):

- **community** – Included in the open-source distribution
- **pro** – Available only in the PRO distribution

When contributing to a **pro** package, ensure your changes don't create dependencies from community packages on pro packages.

## Pull Requests

1. Keep PRs focused and small
2. Include tests for new functionality
3. Update documentation if behavior changes
4. Ensure all quality checks pass

## Reporting Issues

- Use GitHub Issues for bug reports and feature requests
- Include reproduction steps for bugs
- Label issues with the relevant package name

## License

By contributing to Ottabase, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
