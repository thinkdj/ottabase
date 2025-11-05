# Agents & Architecture

This is a monorepo which uses **Turbo** for efficient build orchestration and contains shared packages and standalone applications.

## 📁 Core Structure

```text
ottabase/
├── apps/           # Standalone, independent applications
└── packages/       # Shared code and utilities
```

## 💻 Applications (`/apps`)

Independent applications that can be deployed separately:

- **`ottabase-template-app`** - Template Next.js 15+ Application with shared package integration (Default App Template)

## 📦 Shared Packages (`/packages`)

IMPORTANT NOTE: Packages need to be generic, reusable, optimized, and well-documented. React/React DOM dependencies are allowed as peer dependencies. Next.js-specific functionality should be added to the Ottabase Template App.

Reusable code shared across applications:

### Core Packages

- **`@ottabase/config`** - Application configuration utilities
- **`@ottabase/state`** - State management with providers
- **`@ottabase/ui-core`** - UI components and theming system
- **`@ottabase/hello-world`** - Example component package

### Package Details

| Package       | Purpose           | Key Features                      |
| ------------- | ----------------- | --------------------------------- |
| `config`      | App configuration | Type-safe config creation         |
| `state`       | State management  | Global state with React providers |
| `ui`          | UI components     | Tailwind CSS, themes, providers   |
| `hello-world` | Example package   | Sample React component            |

## 🛠 Build System

- **Turbo** - Monorepo build orchestration
- **pnpm** - Package manager with workspace support
- **TypeScript** - Type safety across all packages

## 🎯 Development

Each app in `/apps` can:

- Import and use any package from `/packages`
- Be developed and deployed independently
- Share common utilities and components

Each package in `/packages` provides:

- Reusable functionality across multiple apps
- Type definitions and full TypeScript support
- Consistent APIs and patterns
- Documentation in README.md describing usage
- Framework-agnostic design (React allowed as peer dep)

## 📋 Dependency Management

This monorepo uses a sophisticated dependency management strategy for maximum deduplication and efficiency:

### 🎯 pnpm Catalog System

All shared dependencies are managed through **pnpm's catalog feature** defined in [`pnpm-workspace.yaml`](pnpm-workspace.yaml:5):

- **Centralized versions**: Common dependencies like [`react`](pnpm-workspace.yaml:25), [`typescript`](pnpm-workspace.yaml:29), [`@mantine/core`](pnpm-workspace.yaml:8) are defined once in the catalog
- **Catalog references**: Packages use `"catalog:"` specifier instead of version numbers (e.g., [`"react": "catalog:"`](apps/ottabase-template-app/package.json:14))
- **Version consistency**: Ensures all packages use identical versions of shared dependencies

### 🔗 Workspace Dependencies

Internal packages use [`workspace:*`](apps/ottabase-template-app/package.json:16) protocol:

```json
"@ottabase/ui-core": "workspace:*",
"@ottabase/config": "workspace:*",
"@ottabase/state": "workspace:*"
```

This creates symlinks to local packages during development and resolves to proper versions during publishing.

### 🎨 Peer Dependencies Strategy

Shared packages declare external dependencies as **peerDependencies** to avoid duplication:

- [`@ottabase/hello-world`](packages/hello-world/package.json:27): Declares `react` and `react-dom` as peers
- [`@ottabase/state`](packages/state/package.json:35): Declares `jotai` as peer dependency
- [`@ottabase/ui-core`](packages/ui-core/package.json:44): Declares `mantine` dependencies as peers

### 📦 Package-Specific Lock Files

**✅ RESOLVED**: Package-specific lock files have been removed to maintain monorepo consistency.

### ✅ Best Practices for Contributors

1. **Use catalog references**: Always use `"catalog:"` for shared dependencies
2. **Workspace protocol**: Use `"workspace:*"` for internal package dependencies
3. **Peer dependencies**: Declare framework dependencies as peers in shared packages
4. **Single lock file**: Maintain only the root [`pnpm-lock.yaml`](pnpm-lock.yaml:1) - remove package-specific lock files
5. **Version updates**: Update versions only in [`pnpm-workspace.yaml`](pnpm-workspace.yaml:5) catalog section
6. Ensure the dependency needs to be added to root `pnpm-workspace.yaml` before adding it to catalog. Sometimes it could be better to add it in the package alone as it might not be used by apps directly.

This strategy ensures:

- **Zero duplication** of common dependencies across packages
- **Consistent versions** throughout the monorepo
- **Efficient installs** with PNPM's content-addressable storage
- **Type safety** with shared TypeScript configurations

---

#### Local Development Environment

- OS: Windows 11
- Default Terminal: Command Prompt (cmd)
- Disk: Dev Drive (ReFS)
- Runtime: Nodejs 24
- Package Manager: pnpm (workspace-enabled)
- Language: TypeScript
- Styling: Tailwind, Mantine, shadcn, Tremor
- Code Quality: ESLint, Prettier
- Build System: Turbo
- Documentation: Storybook

##### DEV NOTES

- To keep formatting on save consistent with Prettier, for VS Code, ensure to add the recommended plugins (under `.vscode\extensions.json`)

---

## 🏆 Monorepo Best Practices

Industry-standard patterns for scalable monorepo architecture with Turborepo.

### Package Design Principles

#### 1. Single Responsibility

- Each package should solve one problem well
- Avoid "kitchen sink" packages with unrelated functionality
- Clear, focused purpose documented in README

#### 2. Zero Framework Lock-in

- Packages should be framework-agnostic where possible
- Use peer dependencies for framework code (React, Vue, etc.)
- Separate business logic from framework-specific implementations

#### 3. Explicit Dependencies

- Declare all dependencies explicitly in package.json
- Use peer dependencies for shared frameworks
- Avoid implicit dependencies through hoisting

#### 4. Public API Surface

- Export only what consumers need via `index.ts`
- Use atomic exports for tree-shaking (`/component-name`)
- Version public APIs carefully (semver)

### Build & Performance

#### 1. Incremental Builds

- Leverage Turborepo's caching (`turbo.json`)
- Configure proper `outputs` for each task
- Use `dependsOn` to define task dependencies

#### 2. Efficient Bundling

- Dual ESM/CJS output for compatibility
- Generate TypeScript declarations (`.d.ts`)
- Enable tree-shaking with `sideEffects: false`

#### 3. Development Experience

- Watch mode for packages during development
- Fast refresh support for UI components
- Parallel builds where possible

### Dependency Management

#### 1. Version Consistency

- Use pnpm catalog for shared dependencies
- Single source of truth for versions
- Automated dependency updates (Renovate/Dependabot)

#### 2. Minimal Duplication

- Peer dependencies for frameworks
- Workspace protocol for internal packages
- Content-addressable storage (pnpm)

#### 3. Security & Updates

- Regular dependency audits (`pnpm audit`)
- Pinned versions in catalog
- Test updates before merging

### Code Quality

#### 1. Consistent Standards

- Shared ESLint/Prettier configs from root
- TypeScript strict mode enabled
- Pre-commit hooks (husky/lint-staged)

#### 2. Testing Strategy

- Unit tests in each package
- Integration tests in apps
- E2E tests for critical flows

#### 3. Documentation

- README with usage examples
- TSDoc comments for public APIs
- CHANGELOG for version history

### Application Architecture

#### 1. App Independence

- Apps should be independently deployable
- Share code via packages, not direct imports
- Each app owns its routing/layouts

#### 2. Feature Composition

- Compose features from generic packages
- App-specific code stays in app
- Next.js specifics in template app only

#### 3. Configuration

- Environment-based config per app
- Shared config package for defaults
- Type-safe configuration objects

### Scaling Strategies

#### 1. Package Granularity

- Start coarse, split when needed
- Monitor bundle impact of packages
- Avoid premature abstraction

#### 2. Team Ownership

- Clear CODEOWNERS for packages
- Package maintainer responsibilities
- Cross-team coordination for shared packages

#### 3. CI/CD Optimization

- Affected package detection
- Parallel test/build execution
- Cached remote builds (Turborepo Remote Cache)

### Anti-Patterns to Avoid

❌ **Circular dependencies** between packages
❌ **Direct file imports** across package boundaries
❌ **Framework-specific code** in generic packages
❌ **Massive barrel exports** hurting tree-shaking
❌ **Implicit peer dependencies** causing version conflicts
❌ **Package-specific lock files** in monorepo
❌ **Tight coupling** between apps and packages
❌ **Missing type definitions** for package exports

### References

- [Turborepo Best Practices](https://turbo.build/repo/docs/handbook)
- [pnpm Workspace Guide](https://pnpm.io/workspaces)

🕊️
