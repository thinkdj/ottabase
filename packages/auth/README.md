# @ottabase/auth

Framework-agnostic Auth.js (NextAuth.js) integration for Ottabase with Cloudflare D1 and Drizzle ORM.

## Features

- Auth.js v5 with Cloudflare D1 support
- OAuth providers (Google, GitHub, Discord, Azure AD, Auth0)
- Credentials and Magic Link authentication
- Pre-built UI components with shadcn/ui
- Custom user fields support
- Framework agnostic (Next.js, Remix, SvelteKit, Workers)

## Installation

```bash
pnpm add @auth/core drizzle-orm
```

## Quick Start

### 1. Enable Auth Feature

```typescript
// db.config.ts
export default defineAppDbConfig({
  appId: "your-app",
  features: ["auth"],
});
```

### 2. Configure Auth

```typescript
// auth.ts
import { createOttabaseAuthConfig, createGoogleProvider } from "@ottabase/auth";

export const authConfig = createOttabaseAuthConfig({
  d1: env.DB,
  providers: [createGoogleProvider(env)],
});
```

### 3. Next.js Integration

```typescript
// app/auth.ts
import NextAuth from "next-auth";
import { createOttabaseAuthConfig, createGoogleProvider } from "@ottabase/auth";

export const { handlers, auth, signIn, signOut } = NextAuth((request) => {
  const env = request?.env || process.env;
  return createOttabaseAuthConfig({
    d1: env.OBCF_D1,
    providers: [createGoogleProvider(env)],
  });
});
```

```typescript
// middleware.ts
export { auth as middleware } from "@/app/auth";
```

## Common Use Cases

### Multiple OAuth Providers

```typescript
import {
  createOttabaseAuthConfig,
  createGoogleProvider,
  createGitHubProvider,
  createDiscordProvider,
} from "@ottabase/auth";

export const authConfig = createOttabaseAuthConfig({
  d1: env.DB,
  providers: [
    createGoogleProvider(env),
    createGitHubProvider(env),
    createDiscordProvider(env),
  ],
});
```

### Credentials Authentication

```typescript
import { createCredentialsProvider } from "@ottabase/auth";
import bcrypt from "bcryptjs";

const credentialsProvider = createCredentialsProvider(async (credentials) => {
  const user = await db.user.findUnique({ where: { email: credentials.email } });

  if (!user || !await bcrypt.compare(credentials.password, user.passwordHash)) {
    return null;
  }

  return { id: user.id, email: user.email, name: user.name };
});
```

### Magic Link (Passwordless)

```typescript
import { createResendProvider } from "@ottabase/auth";

const emailProvider = createResendProvider(env, {
  from: "noreply@yourdomain.com",
});
// Requires RESEND_API_KEY environment variable
```

### Custom User Fields

```typescript
// 1. Add fields in migration
// ALTER TABLE User ADD COLUMN role TEXT;

// 2. Configure adapter
const config = createOttabaseAuthConfig({
  d1: env.DB,
  providers: [...],
  customUserFields: ["role", "subscriptionTier"],
});
```

### Auto-Configure from Environment

```typescript
import { autoConfigureProviders } from "@ottabase/auth";

const config = createOttabaseAuthConfig({
  d1: env.DB,
  providers: autoConfigureProviders(env),
});
```

## UI Components

```typescript
import { LoginForm } from "@ottabase/auth/components";
import { signIn } from "next-auth/react";

export function LoginPage() {
  return (
    <LoginForm
      socialProviders={[
        { id: "google", name: "Google" },
        { id: "github", name: "GitHub" },
      ]}
      onSocialLogin={(providerId) => signIn(providerId)}
      showCredentials
      onCredentialsLogin={async ({ email, password }) => {
        await signIn("credentials", { email, password });
      }}
      showMagicLink
      onMagicLinkSend={async (email) => {
        await signIn("email", { email });
      }}
    />
  );
}
```

## Session Utilities

```typescript
import {
  isAuthenticated,
  requireAuth,
  getUserId,
  getUserEmail,
} from "@ottabase/auth";

const session = await getSession();

if (isAuthenticated(session)) {
  const userId = getUserId(session);
  const email = getUserEmail(session);
}

// Require auth (throws if not authenticated)
const session = requireAuth(await getSession());
```

## Environment Variables

```bash
# Required
AUTH_SECRET=your_random_secret  # openssl rand -base64 32

# OAuth Providers (optional)
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret

# Email Provider (optional)
RESEND_API_KEY=your_resend_api_key
```

## Database Tables

Auth tables are managed by OttaORM migrations (001, 002, 006, 007, 008):
- `User` - User accounts
- `Account` - OAuth provider accounts
- `Session` - Session storage
- `VerificationToken` - Email verification
- `Authenticator` - WebAuthn/Passkey credentials

## License

MIT
