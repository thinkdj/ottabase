# @ottabase/env

Type-safe environment variable validation and management for Ottabase monorepo using Zod.

## Features

- 🔒 **Type-safe** - Full TypeScript support with inferred types
- ✅ **Validation** - Runtime validation using Zod schemas
- 📝 **Auto-documentation** - Generate .env.example automatically
- 🎯 **Zero config** - Pre-built schemas for Ottabase packages
- 🔍 **Developer-friendly** - Clear error messages and helpful CLI
- 🏗️ **Composable** - Easily extend or combine schemas

## Installation

```bash
pnpm add @ottabase/env
```

## Quick Start

### 1. Use Pre-built Schemas

For existing Ottabase packages, just import and use:

```typescript
// In your package
import { createEnv } from "@ottabase/env";
import { dbEnvSchema } from "@ottabase/env/schemas";

export const env = createEnv({
  schema: dbEnvSchema,
  packageName: "@ottabase/db",
});

// Now use with full type safety!
console.log(env.DATABASE_URL); // string
```

### 2. Create Custom Schema

For new packages:

```typescript
import { createEnv, z } from "@ottabase/env";

export const env = createEnv({
  schema: z.object({
    API_KEY: z.string().min(16),
    PORT: z.coerce.number().default(3000),
    DEBUG: z.enum(["true", "false"]).transform(v => v === "true"),
  }),
  packageName: "@ottabase/my-package",
});

export type Env = typeof env;
```

## Available Pre-built Schemas

### @ottabase/cf (Cloudflare)

```typescript
import { cfEnvSchema } from "@ottabase/env/schemas";
```

Variables:
- `CF_API_TOKEN` - Cloudflare API token
- `CF_ACCOUNT_ID` - Account ID
- `CF_ZONE_ID` - Zone ID
- `CF_IMAGES_ACCOUNT_HASH` - Images account hash
- `CF_R2_BUCKET` - R2 bucket name
- `CF_KV_NAMESPACE_ID` - KV namespace ID
- `CF_D1_DATABASE_ID` - D1 database ID
- `CF_PUBSUB_BROKER_URL` - PubSub broker URL
- `CF_PUBSUB_JWT` - PubSub JWT token

### @ottabase/db (Database)

```typescript
import { dbEnvSchema } from "@ottabase/env/schemas";
```

Variables:
- `DATABASE_URL` - **Required** - Prisma database connection URL
- `DIRECT_URL` - Direct database URL (bypasses pooling)
- `SHADOW_DATABASE_URL` - Shadow database for migrations
- `PRISMA_QUERY_LOG` - Enable query logging
- `PRISMA_DEBUG` - Enable debug mode
- `DATABASE_POOL_SIZE` - Connection pool size (default: 10)
- `DATABASE_TIMEOUT` - Connection timeout in ms (default: 5000)

### @ottabase/config (Application Config)

```typescript
import { configEnvSchema } from "@ottabase/env/schemas";
```

All variables use `NEXT_PUBLIC_` prefix for client-side access:

**App Metadata:**
- `NEXT_PUBLIC_APP_NAME` - App name (default: "Ottabase")
- `NEXT_PUBLIC_APP_TITLE` - Browser title
- `NEXT_PUBLIC_APP_DESCRIPTION` - SEO description
- `NEXT_PUBLIC_APP_KEYWORDS` - SEO keywords
- And more...

**UI Configuration:**
- `NEXT_PUBLIC_UI_FRAMEWORK` - "mantine" | "shadcn"
- `NEXT_PUBLIC_UI_LAYOUT_HEADER_HEIGHT` - Header height in px
- `NEXT_PUBLIC_UI_DEBOUNCE_MS` - Debounce delay
- And more...

See [schemas/config.ts](./src/schemas/config.ts) for full list.

## CLI Tool

The package includes a powerful CLI for managing environment variables:

```bash
# Generate .env.example from all schemas
pnpm ottabase-env generate

# Validate current environment
pnpm ottabase-env validate

# List all variables and their metadata
pnpm ottabase-env list

# Check for missing required variables
pnpm ottabase-env check

# Show help
pnpm ottabase-env help
```

### CLI Output Examples

**Check for missing variables:**
```
🔍 Checking for missing variables...

❌ @ottabase/db
──────────────────────────────────────────────────
  ✗ DATABASE_URL
    Database connection URL for Prisma
    Add this to your .env file

❌ 1 of 1 required variables are missing
💡 Run 'ottabase-env generate' to create .env.example
```

**Validation:**
```
🔍 Validating environment...

✓ @ottabase/cf
✓ @ottabase/db
✓ @ottabase/config

✓ All environment variables are valid
```

## Helper Functions

### Common Patterns

```typescript
import {
  url,           // Valid URL
  email,         // Valid email
  port,          // Port number (1-65535)
  bool,          // Boolean from string
  json,          // Parse JSON string
  csvList,       // Comma-separated list
  databaseUrl,   // Database connection URL
  cloudflareToken, // Cloudflare API token
  apiKey,        // Generic API key
  secretKey,     // Secure secret key
} from "@ottabase/env";

const schema = z.object({
  API_URL: url(),
  PORT: port(),
  ENABLED: bool(),
  TAGS: csvList(),
});
```

### Environment Detection

```typescript
import { isDev, isProd, isTest, isStaging, isCI } from "@ottabase/env";

if (isDev) {
  console.log("Development mode");
}

if (isCI) {
  console.log("Running in CI/CD");
}
```

## Advanced Usage

### Composing Schemas

Combine multiple schemas:

```typescript
import { z, mergeEnv, createEnv } from "@ottabase/env";
import { dbEnvSchema, cfEnvSchema } from "@ottabase/env/schemas";

const mySchema = z.object({
  MY_VAR: z.string(),
});

const combinedSchema = z.object({
  ...dbEnvSchema.shape,
  ...cfEnvSchema.shape,
  ...mySchema.shape,
});

export const env = createEnv({
  schema: combinedSchema,
  packageName: "@ottabase/my-app",
});
```

### Prefix Support

Handle prefixed variables (like `NEXT_PUBLIC_`):

```typescript
import { createEnv, z } from "@ottabase/env";

export const env = createEnv({
  schema: z.object({
    APP_NAME: z.string(),    // Will read NEXT_PUBLIC_APP_NAME
    API_URL: z.string().url(), // Will read NEXT_PUBLIC_API_URL
  }),
  prefix: "NEXT_PUBLIC_",
  packageName: "@ottabase/config",
});
```

### Skip Validation (Build Time)

```typescript
export const env = createEnv({
  schema: mySchema,
  skipValidation: process.env.NODE_ENV === "production",
});

// Or set environment variable:
// SKIP_ENV_VALIDATION=true pnpm build
```

### Custom Error Handling

```typescript
export const env = createEnv({
  schema: mySchema,
  onValidationError: (error) => {
    // Send to error tracking
    logToSentry(error);
    process.exit(1);
  },
});
```

## Adding New Environment Variables

When you add a new package or feature that needs env vars, follow these steps:

### 1. Create Schema in Your Package

Create `env.ts` in your package:

```typescript
// packages/my-package/src/env.ts
import { createEnv, z } from "@ottabase/env";

export const env = createEnv({
  schema: z.object({
    MY_API_KEY: z.string().min(16).describe("API key for my service"),
    MY_ENDPOINT: z.string().url().describe("Service endpoint URL"),
    MY_TIMEOUT: z.coerce.number().default(5000).describe("Request timeout in ms"),
  }),
  packageName: "@ottabase/my-package",
});
```

### 2. Update Central Schema (Optional)

If you want the variable in `.env.example`, add to `@ottabase/env/src/schemas/`:

```typescript
// packages/env/src/schemas/my-package.ts
import { z } from "zod";

export const myPackageEnvSchema = z.object({
  MY_API_KEY: z.string().min(16).describe("API key for my service"),
  MY_ENDPOINT: z.string().url().describe("Service endpoint URL"),
  MY_TIMEOUT: z.coerce.number().default(5000).describe("Request timeout in ms"),
});

export type MyPackageEnv = z.infer<typeof myPackageEnvSchema>;
```

Then export it in `schemas/index.ts`.

### 3. Regenerate .env.example

```bash
pnpm ottabase-env generate
```

### 4. Document in Your Package

Add to your package's README:

```markdown
## Environment Variables

Required:
- `MY_API_KEY` - API key for my service (minimum 16 characters)
- `MY_ENDPOINT` - Service endpoint URL

Optional:
- `MY_TIMEOUT` - Request timeout in milliseconds (default: 5000)
```

## Best Practices

### ✅ DO

- Always use `describe()` to document variables
- Provide sensible defaults for optional variables
- Use specific validators (url, email, etc.) instead of generic strings
- Validate early (at app startup)
- Keep schemas close to where they're used
- Use the CLI to generate .env.example

### ❌ DON'T

- Don't commit .env files to git
- Don't use default values for secrets
- Don't skip validation in production
- Don't store sensitive data in NEXT_PUBLIC_ variables (exposed to client)
- Don't use generic z.string() when specific validators exist

## Error Messages

The package provides clear, actionable error messages:

```
❌ Environment validation failed

@ottabase/db:
  DATABASE_URL: Required
  DATABASE_TIMEOUT: Expected number, received string

💡 Tip: Check your .env file or environment variables.
📦 Package: @ottabase/db
```

## Troubleshooting

### "Environment variable X is not defined"

1. Check your `.env` file exists
2. Ensure the variable is set
3. Restart your dev server

### "Validation failed"

1. Check the error message for details
2. Verify the value format matches the type
3. Run `pnpm ottabase-env validate` for details

### "Skip validation warning"

Set in your .env:
```
SKIP_ENV_VALIDATION=false
```

Or remove the `skipValidation` option.

## Migration Guide

### From Manual Type Coercion

**Before:**
```typescript
const port = parseInt(process.env.PORT || "3000", 10);
const enabled = process.env.ENABLED === "true";
```

**After:**
```typescript
import { createEnv, z } from "@ottabase/env";

const env = createEnv({
  schema: z.object({
    PORT: z.coerce.number().default(3000),
    ENABLED: z.enum(["true", "false"]).transform(v => v === "true"),
  }),
});
```

### From @ottabase/utils getEnvVar

**Before:**
```typescript
import { getEnvVar } from "@ottabase/utils/env";

const apiKey = getEnvVar("API_KEY");
```

**After:**
```typescript
import { createEnv, z } from "@ottabase/env";

const env = createEnv({
  schema: z.object({
    API_KEY: z.string(),
  }),
});

const apiKey = env.API_KEY; // Type-safe!
```

## Contributing

When adding new schemas:

1. Add schema to `src/schemas/`
2. Export from `src/schemas/index.ts`
3. Update CLI to include new schema
4. Regenerate .env.example
5. Update this README

## License

MIT
