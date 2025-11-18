# Environment Variables Management Guide

This guide explains how to manage environment variables in the Ottabase monorepo using `@ottabase/env`.

## Quick Start

### 1. Install the Package (Already Done!)

The `@ottabase/env` package is already set up in the monorepo at `packages/env`.

### 2. Check Your Environment

```bash
# Check what variables are missing
pnpm ottabase-env check

# List all available variables
pnpm ottabase-env list

# Validate your current .env file
pnpm ottabase-env validate
```

### 3. Generate .env.example

```bash
# Generate a template with all variables
pnpm ottabase-env generate
```

This will create/update `.env.example` at the root with all environment variables from all packages.

### 4. Create Your .env File

```bash
# Copy the example
cp .env.example .env

# Edit with your actual values
vim .env  # or your favorite editor
```

## For Package Developers

### Adding Environment Variables to Your Package

When your package needs new environment variables, follow these steps:

#### Step 1: Create an `env.ts` in Your Package

```typescript
// packages/my-package/src/env.ts
import { createEnv, z } from "@ottabase/env";

export const env = createEnv({
  schema: z.object({
    // Required variables
    MY_API_KEY: z.string().min(16).describe("API key for my service"),
    MY_ENDPOINT: z.string().url().describe("Service endpoint URL"),

    // Optional with defaults
    MY_TIMEOUT: z.coerce.number().default(5000).describe("Request timeout in ms"),
    MY_RETRY_COUNT: z.coerce.number().default(3).describe("Number of retries"),
  }),
  packageName: "@ottabase/my-package",
});

// Export type for use in other files
export type Env = typeof env;
```

#### Step 2: Use It in Your Package

```typescript
// packages/my-package/src/client.ts
import { env } from "./env";

export class MyClient {
  constructor() {
    // Fully type-safe and validated at runtime!
    this.apiKey = env.MY_API_KEY;
    this.endpoint = env.MY_ENDPOINT;
    this.timeout = env.MY_TIMEOUT;
  }
}
```

#### Step 3: Add to Central Schema (Optional but Recommended)

To make your variables appear in `.env.example`:

```typescript
// packages/env/src/schemas/my-package.ts
import { z } from "zod";

export const myPackageEnvSchema = z.object({
  MY_API_KEY: z.string().min(16).describe("API key for my service"),
  MY_ENDPOINT: z.string().url().describe("Service endpoint URL"),
  MY_TIMEOUT: z.coerce.number().default(5000).describe("Request timeout in ms"),
  MY_RETRY_COUNT: z.coerce.number().default(3).describe("Number of retries"),
});

export type MyPackageEnv = z.infer<typeof myPackageEnvSchema>;
```

Then export it in `packages/env/src/schemas/index.ts`:

```typescript
export * from "./my-package";
```

And update the CLI in `packages/env/src/cli.ts` to include your schema in the `loadSchemas()` function.

#### Step 4: Rebuild and Regenerate

```bash
# Rebuild the env package
pnpm --filter @ottabase/env build

# Regenerate .env.example
pnpm ottabase-env generate
```

#### Step 5: Document in Your Package README

Add this section to your package's README:

```markdown
## Environment Variables

### Required

- `MY_API_KEY` - API key for my service (minimum 16 characters)
- `MY_ENDPOINT` - Service endpoint URL

### Optional

- `MY_TIMEOUT` - Request timeout in milliseconds (default: 5000)
- `MY_RETRY_COUNT` - Number of retry attempts (default: 3)
```

## Common Patterns

### Database URL

```typescript
import { createEnv, databaseUrl } from "@ottabase/env";

export const env = createEnv({
  schema: z.object({
    DATABASE_URL: databaseUrl().describe("PostgreSQL connection string"),
  }),
});
```

### API Keys and Tokens

```typescript
import { createEnv, apiKey, secretKey } from "@ottabase/env";

export const env = createEnv({
  schema: z.object({
    API_KEY: apiKey().describe("Public API key"),
    SECRET_KEY: secretKey().describe("Secret signing key"),
  }),
});
```

### Boolean Flags

```typescript
import { createEnv, bool } from "@ottabase/env";

export const env = createEnv({
  schema: z.object({
    ENABLE_FEATURE: bool().describe("Enable experimental feature"),
    DEBUG_MODE: bool().optional().default("false"),
  }),
});
```

### URLs

```typescript
import { createEnv, url } from "@ottabase/env";

export const env = createEnv({
  schema: z.object({
    API_URL: url().describe("Backend API URL"),
    WEBHOOK_URL: url().optional(),
  }),
});
```

### Numbers (Ports, Timeouts, etc.)

```typescript
import { createEnv, port } from "@ottabase/env";

export const env = createEnv({
  schema: z.object({
    PORT: port().default(3000),
    TIMEOUT: z.coerce.number().min(1000).max(60000).default(5000),
    MAX_CONNECTIONS: z.coerce.number().int().positive().default(100),
  }),
});
```

### Enums

```typescript
export const env = createEnv({
  schema: z.object({
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
    ENVIRONMENT: z.enum(["development", "staging", "production"]),
  }),
});
```

### Comma-Separated Lists

```typescript
import { createEnv, csvList } from "@ottabase/env";

export const env = createEnv({
  schema: z.object({
    ALLOWED_ORIGINS: csvList().describe("Comma-separated list of allowed origins"),
  }),
});

// Usage: ALLOWED_ORIGINS="https://example.com,https://app.example.com"
// Result: ["https://example.com", "https://app.example.com"]
```

### JSON Objects

```typescript
import { createEnv, json } from "@ottabase/env";

export const env = createEnv({
  schema: z.object({
    FEATURE_FLAGS: json(z.record(z.boolean())).describe("Feature flags JSON"),
  }),
});

// Usage: FEATURE_FLAGS='{"newUI": true, "beta": false}'
```

### Next.js Client-Side Variables (NEXT_PUBLIC_)

```typescript
export const env = createEnv({
  schema: z.object({
    NEXT_PUBLIC_API_URL: url().describe("Public API URL"),
    NEXT_PUBLIC_APP_NAME: z.string().default("My App"),
  }),
  packageName: "@ottabase/config",
});
```

## CLI Reference

### `ottabase-env generate`

Generates `.env.example` from all registered schemas.

```bash
pnpm ottabase-env generate
pnpm ottabase-env generate --output .env.local.example
```

### `ottabase-env check`

Checks for missing required environment variables.

```bash
pnpm ottabase-env check
```

Example output:
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

### `ottabase-env validate`

Validates all environment variables against their schemas.

```bash
pnpm ottabase-env validate
```

Example output:
```
🔍 Validating environment...

✓ @ottabase/cf
✓ @ottabase/db
✓ @ottabase/config

✓ All environment variables are valid
```

### `ottabase-env list`

Lists all environment variables with their metadata.

```bash
pnpm ottabase-env list
pnpm ottabase-env list --package @ottabase/db
```

## Best Practices

### ✅ DO

1. **Always use `.describe()`** to document what each variable is for
   ```typescript
   API_KEY: z.string().describe("Stripe API key for payment processing")
   ```

2. **Provide sensible defaults** for optional variables
   ```typescript
   TIMEOUT: z.coerce.number().default(5000)
   ```

3. **Use specific validators** instead of generic `z.string()`
   ```typescript
   // Good
   API_URL: url()
   EMAIL: email()
   PORT: port()

   // Not as good
   API_URL: z.string()
   EMAIL: z.string()
   PORT: z.string()
   ```

4. **Validate early** - Import and validate env at the top of your entry file
   ```typescript
   // src/index.ts
   import { env } from "./env";  // This validates immediately
   ```

5. **Keep schemas close to usage** - Define env schemas in the package that uses them

6. **Use the CLI** to generate `.env.example` automatically

### ❌ DON'T

1. **Don't commit `.env` files** - They contain secrets!
   ```bash
   # .gitignore already includes:
   .env
   .env.local
   .env*.local
   ```

2. **Don't use default values for secrets**
   ```typescript
   // Bad - secrets should be required
   API_KEY: z.string().default("test-key")

   // Good
   API_KEY: z.string().describe("Required API key")
   ```

3. **Don't skip validation in production**
   ```typescript
   // Bad
   skipValidation: process.env.NODE_ENV === "production"

   // Good - validation prevents runtime errors
   skipValidation: false
   ```

4. **Don't expose secrets via NEXT_PUBLIC_**
   ```typescript
   // Bad - this exposes to browser!
   NEXT_PUBLIC_API_SECRET: z.string()

   // Good - server-side only
   API_SECRET: z.string()
   ```

5. **Don't use generic `z.string()` when specific validators exist**

## Troubleshooting

### Error: "Environment variable X is not defined"

**Solution:** Add the variable to your `.env` file or set it in your environment.

```bash
# Check what's missing
pnpm ottabase-env check

# Add to .env
echo "X=value" >> .env
```

### Error: "Validation failed"

**Solution:** Check the error message for details about what's wrong with the value.

```bash
# Validate and see details
pnpm ottabase-env validate
```

Common issues:
- URL must include protocol (use `https://example.com` not `example.com`)
- Numbers must be numeric strings (use `3000` not `three thousand`)
- Booleans must be `true`, `false`, `1`, or `0`

### Warning: "Skipping environment validation"

**Solution:** Remove `SKIP_ENV_VALIDATION` or set it to `false`:

```bash
# .env
SKIP_ENV_VALIDATION=false
```

### Package Not Building

**Solution:** Make sure you rebuild the env package after changes:

```bash
pnpm --filter @ottabase/env build
```

## Migration from Old Approach

### From Manual `process.env` Access

**Before:**
```typescript
const apiKey = process.env.API_KEY || "default";
const port = parseInt(process.env.PORT || "3000", 10);
```

**After:**
```typescript
import { createEnv, z } from "@ottabase/env";

export const env = createEnv({
  schema: z.object({
    API_KEY: z.string().default("default"),
    PORT: z.coerce.number().default(3000),
  }),
});

const apiKey = env.API_KEY;
const port = env.PORT;
```

### From `@ottabase/utils` getEnvVar

**Before:**
```typescript
import { getEnvVar } from "@ottabase/utils/env";

const apiKey = getEnvVar("API_KEY");
const timeout = parseInt(getEnvVar("TIMEOUT", "5000"), 10);
```

**After:**
```typescript
import { createEnv, z } from "@ottabase/env";

export const env = createEnv({
  schema: z.object({
    API_KEY: z.string(),
    TIMEOUT: z.coerce.number().default(5000),
  }),
});
```

## Getting Help

1. Check the package README: `packages/env/README.md`
2. Use the CLI help: `pnpm ottabase-env help`
3. Look at existing schemas in `packages/env/src/schemas/`
4. Review this guide

## Summary

- Use `@ottabase/env` for all environment variable management
- Always validate with Zod schemas
- Use the CLI to generate `.env.example`
- Document all variables with `.describe()`
- Keep schemas close to where they're used
- Never commit `.env` files with secrets

Happy coding! 🚀
