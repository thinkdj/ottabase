# @ottabase/auth

Auth.js v5 integration for Cloudflare D1 with Drizzle ORM.

## Quick Start

```typescript
// cloudflare-worker.ts
import { handleAuthRequest } from "@ottabase/auth/backend";

if (url.pathname.startsWith("/api/auth/")) {
  return handleAuthRequest(request, env);
}
```

That's it! Auto-configures providers from environment variables.

## Environment Variables

```bash
# Required
AUTH_SECRET=your_secret  # openssl rand -base64 32

# OAuth (optional - auto-detected)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...

# Magic Link (optional)
EMAIL_RESEND_API_KEY=...  # or EMAIL_SERVER + EMAIL_FROM for SMTP
```

## Manual Configuration

```typescript
import { createOttabaseAuthConfig, createGoogleProvider } from "@ottabase/auth";

const config = createOttabaseAuthConfig({
  d1: env.OBCF_D1,
  providers: [createGoogleProvider(env)],
});
```

## Get Session

```typescript
import { getSession } from "@ottabase/auth/backend";

const session = await getSession(request, env);
if (session?.user) {
  console.log(session.user.id, session.user.email);
}
```

## UI Components

```tsx
import { LoginForm, getLoginConfig } from "@ottabase/auth/components";

function LoginPage() {
  const config = getLoginConfig(process.env); // Auto-detect providers

  return (
    <LoginForm
      socialProviders={config.socialProviders}
      showCredentials={config.showCredentials}
      showMagicLink={config.showMagicLink}
      onSocialLogin={(id) => signIn(id)}
      onCredentialsLogin={({ email, password }) => signIn("credentials", { email, password })}
      onMagicLinkSend={(email) => signIn("email", { email })}
    />
  );
}
```

### Individual Components

```tsx
import { SocialLoginButtons, CredentialsForm, MagicLinkForm } from "@ottabase/auth/components";

<SocialLoginButtons
  providers={[{ id: "google", name: "Google" }]}
  onProviderClick={(id) => signIn(id)}
/>

<CredentialsForm onSubmit={({ email, password }) => signIn("credentials", { email, password })} />

<MagicLinkForm onSubmit={(email) => signIn("email", { email })} />
```

## Providers

```typescript
import {
  createGoogleProvider,
  createGitHubProvider,
  createDiscordProvider,
  createCredentialsProvider,
  createResendProvider,
  autoConfigureProviders,  // Auto-detect from env
} from "@ottabase/auth";

// OAuth
createGoogleProvider(env);
createGitHubProvider(env);

// Credentials (username/password)
createCredentialsProvider(async ({ email, password }) => {
  const user = await findUser(email);
  if (!user || !await verifyPassword(password, user.hash)) return null;
  return { id: user.id, email: user.email, name: user.name };
});

// Magic Link
createResendProvider(env, { from: "noreply@example.com" });
```

## Session Utilities

```typescript
import { isAuthenticated, getUserId, requireAuth } from "@ottabase/auth";

if (isAuthenticated(session)) {
  const id = getUserId(session);
}

const session = requireAuth(await getSession()); // Throws if not authed
```

## Custom User Fields

```typescript
// 1. Add columns via migration
// ALTER TABLE User ADD COLUMN role TEXT;

// 2. Configure adapter
const config = createOttabaseAuthConfig({
  d1: env.OBCF_D1,
  providers: [...],
  customUserFields: ["role"],
});
```

## Password Utilities

```typescript
import { hashPassword, verifyPassword } from "@ottabase/auth/backend";

const hash = await hashPassword("password123");
const valid = await verifyPassword("password123", hash);
```

## React Hooks

```typescript
import { useSession } from "@ottabase/auth";

function Component() {
  const { session, status } = useSession();
  // status: "loading" | "authenticated" | "unauthenticated"
}
```

## Full Config Options

```typescript
createOttabaseAuthConfig({
  d1: env.OBCF_D1,
  providers: [...],
  sessionStrategy: "jwt",        // or "database"
  sessionMaxAge: 30 * 24 * 60 * 60, // 30 days
  customUserFields: ["role"],
  onError: (error, op) => console.error(op, error),
  authConfig: {
    pages: { signIn: "/login" },
    callbacks: { /* Auth.js callbacks */ },
  },
});
```

## Exports

```typescript
// Backend (Cloudflare Workers)
import { handleAuthRequest, getSession, createAuthConfig } from "@ottabase/auth/backend";
import { hashPassword, verifyPassword } from "@ottabase/auth/backend";

// Config & Providers
import { createOttabaseAuthConfig, autoConfigureProviders } from "@ottabase/auth";
import { createGoogleProvider, createGitHubProvider, createCredentialsProvider } from "@ottabase/auth";

// Adapters
import { createD1AuthAdapter, createDrizzleD1AuthAdapter } from "@ottabase/auth";

// Session utilities
import { isAuthenticated, requireAuth, getUserId, getUserEmail } from "@ottabase/auth";

// React
import { useSession } from "@ottabase/auth";

// UI Components
import { LoginForm, CredentialsForm, MagicLinkForm, SocialLoginButtons } from "@ottabase/auth/components";
import { getLoginConfig, getConfiguredSocialProviders } from "@ottabase/auth/components";
```
