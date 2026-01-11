# @ottabase/auth

Framework-agnostic Auth.js integration for Ottabase with Cloudflare D1 and Drizzle ORM.

## Features

- ✅ **Auth.js v5** - Full Auth.js support with Cloudflare D1
- ✅ **Drizzle ORM** - Edge-optimized database adapter
- ✅ **Framework Agnostic** - Works with Next.js, Remix, SvelteKit, Workers
- ✅ **Multiple Auth Methods** - OAuth, Credentials, Magic Link (Email)
- ✅ **Provider Presets** - Google, GitHub, Discord, Azure AD, Auth0, Resend, SMTP
- ✅ **UI Components** - Ready-to-use login forms with shadcn/ui
- ✅ **Custom Fields** - Extend user model per-app
- ✅ **Error Handling** - Production-ready with custom handlers

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
  features: ["auth"], // Adds auth tables to migrations
});
```

### 2. Run Migrations

```bash
pnpm ottaorm:migrate
```

Auth tables are in core OttaORM migrations (001, 002, 006, 007, 008).

### 3. Configure Auth

```typescript
import { createOttabaseAuthConfig, createGoogleProvider } from "@ottabase/auth";

export const authConfig = createOttabaseAuthConfig({
  d1: env.DB,
  providers: [createGoogleProvider(env)],
});
```

## Usage Examples

### Basic Configuration

```typescript
import { createOttabaseAuthConfig } from "@ottabase/auth";

const config = createOttabaseAuthConfig({
  d1: env.DB,
  providers: [
    createGoogleProvider(env),
    createGitHubProvider(env),
  ],
});
```

### With Custom User Fields

```typescript
// 1. Add fields to User table in your migration
// ALTER TABLE User ADD COLUMN role TEXT;
// ALTER TABLE User ADD COLUMN subscriptionTier TEXT;

// 2. Configure adapter to query custom fields
const config = createOttabaseAuthConfig({
  d1: env.DB,
  providers: [...],
  customUserFields: ["role", "subscriptionTier"],
});
```

### With Error Handling

```typescript
const config = createOttabaseAuthConfig({
  d1: env.DB,
  providers: [...],
  onError: (error, operation) => {
    console.error(`Auth error in ${operation}:`, error);
    // Report to your error tracking service
  },
});
```

### Auto-Configure Providers

```typescript
import { autoConfigureProviders } from "@ottabase/auth";

// Automatically enables providers based on env vars
const config = createOttabaseAuthConfig({
  d1: env.DB,
  providers: autoConfigureProviders(env),
});
```

## Framework Integration

### Next.js App Router

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

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
```

### Cloudflare Workers

```typescript
import { Auth } from "@auth/core";
import { createOttabaseAuthConfig } from "@ottabase/auth";

export default {
  async fetch(request: Request, env: Env) {
    const config = createOttabaseAuthConfig({
      d1: env.DB,
      providers: [/* ... */],
    });
    
    const auth = Auth(request, config);
    const session = await auth.getSession();
    
    return new Response(JSON.stringify(session));
  }
};
```

### SvelteKit

```typescript
// src/hooks.server.ts
import { SvelteKitAuth } from "@auth/sveltekit";
import { createOttabaseAuthConfig } from "@ottabase/auth";

export const handle = SvelteKitAuth(async ({ platform }) => {
  return createOttabaseAuthConfig({
    d1: platform.env.DB,
    providers: [/* ... */],
  });
});
```

## UI Components

Pre-built, accessible login forms using shadcn/ui components. Import and use directly in your React apps.

### Unified Login Form

The `LoginForm` component provides a complete login experience with all methods:

```typescript
import { LoginForm } from "@ottabase/auth/components";
import { signIn } from "next-auth/react";

export function LoginPage() {
  return (
    <LoginForm
      // Social providers
      socialProviders={[
        { id: "google", name: "Google" },
        { id: "github", name: "GitHub" },
      ]}
      onSocialLogin={(providerId) => signIn(providerId)}
      
      // Credentials login
      showCredentials
      onCredentialsLogin={async ({ email, password }) => {
        await signIn("credentials", { email, password });
      }}
      
      // Magic link
      showMagicLink
      onMagicLinkSend={async (email) => {
        await signIn("email", { email });
      }}
      
      // Customization
      title="Welcome back"
      description="Sign in to continue"
      showSignUp
      onSignUpClick={() => router.push("/signup")}
    />
  );
}
```

### Auto-Configuration from Environment Variables

Use helper functions to automatically detect which providers are configured:

```typescript
import { LoginForm, getLoginConfig } from "@ottabase/auth/components";
import { signIn } from "next-auth/react";

export function LoginPage() {
  // Automatically detect configured providers from env vars
  const config = getLoginConfig(process.env);

  return (
    <LoginForm
      // Auto-configured based on env vars
      socialProviders={config.socialProviders}
      showCredentials={config.showCredentials}
      showMagicLink={config.showMagicLink}
      
      // Handlers
      onSocialLogin={(id) => signIn(id)}
      onCredentialsLogin={async ({ email, password }) => {
        await signIn("credentials", { email, password });
      }}
      onMagicLinkSend={async (email) => {
        await signIn("email", { email });
      }}
      
      title="Welcome back"
    />
  );
}
```

**Helper functions:**
- `getLoginConfig(env)` - Returns complete configuration
- `getConfiguredSocialProviders(env)` - Returns only configured OAuth providers
- `isEmailProviderConfigured(env)` - Checks if Resend or SMTP is configured

```typescript
import { 
  getConfiguredSocialProviders, 
  isEmailProviderConfigured 
} from "@ottabase/auth/components";

// Get only social providers that have credentials
const socialProviders = getConfiguredSocialProviders(process.env);
// Returns: [{ id: "google", name: "Google" }, { id: "github", name: "GitHub" }]

// Check if magic link is available
const canUseMagicLink = isEmailProviderConfigured(process.env);
// Returns: true if RESEND_API_KEY or EMAIL_SERVER is set
```

### Individual Components

#### Social Login Buttons

```typescript
import { SocialLoginButtons, SocialLoginDivider } from "@ottabase/auth/components";

<SocialLoginButtons
  providers={[
    { id: "google", name: "Google" },
    { id: "github", name: "GitHub" },
    { id: "discord", name: "Discord" },
  ]}
  onProviderClick={(id) => signIn(id)}
/>

<SocialLoginDivider text="or" />
```

#### Credentials Form

```typescript
import { CredentialsForm } from "@ottabase/auth/components";

<CredentialsForm
  onSubmit={async ({ email, password }) => {
    const result = await signIn("credentials", { email, password });
    if (result?.error) {
      setError(result.error);
    }
  }}
  showForgotPassword
  onForgotPassword={() => router.push("/forgot-password")}
/>
```

#### Magic Link Form

```typescript
import { MagicLinkForm } from "@ottabase/auth/components";

<MagicLinkForm
  onSubmit={async (email) => {
    await signIn("email", { email });
    setSuccess(true);
  }}
  success={success}
  successMessage="Check your inbox for the login link!"
/>
```

### Styling

Components use Tailwind CSS and follow shadcn/ui design patterns. They automatically inherit your app's theme.

```typescript
// Custom styling
<LoginForm
  className="shadow-xl"
  // ... other props
/>
```

## Providers

### OAuth Providers

```typescript
import {
  createGoogleProvider,
  createGitHubProvider,
  createDiscordProvider,
  createAzureAdProvider,
  createAuth0Provider,
} from "@ottabase/auth";

createGoogleProvider(env); // Requires GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
createGitHubProvider(env); // Requires GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET
createDiscordProvider(env); // Requires DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET
createAzureAdProvider(env); // Requires AZURE_AD_* vars
createAuth0Provider(env); // Requires AUTH0_* vars
```

#### With Custom Scopes

```typescript
createGoogleProvider(env, {
  scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
});

createGitHubProvider(env, {
  scopes: ["repo", "read:org"],
});
```

### Credentials Provider (Username/Password)

```typescript
import { createCredentialsProvider } from "@ottabase/auth";
import bcrypt from "bcryptjs";

const credentialsProvider = createCredentialsProvider(async (credentials) => {
  // Validate credentials against your database
  const user = await db.user.findUnique({
    where: { email: credentials.email }
  });

  if (!user || !await bcrypt.compare(credentials.password, user.passwordHash)) {
    return null; // Invalid credentials
  }

  // Return user object (without password!)
  return {
    id: user.id,
    email: user.email,
    name: user.name,
  };
});
```

#### Custom Credentials Fields

```typescript
import { createCustomCredentialsProvider } from "@ottabase/auth";

const provider = createCustomCredentialsProvider({
  credentials: {
    username: { label: "Username", type: "text" },
    password: { label: "Password", type: "password" },
    domain: { label: "Domain", type: "text" },
  },
  authorize: async (credentials) => {
    // Your custom validation logic
    const user = await validateUser(
      credentials.username,
      credentials.password,
      credentials.domain
    );
    
    return user ? { id: user.id, name: user.name } : null;
  },
});
```

### Email Provider (Magic Link / Passwordless)

#### Using Resend

```typescript
import { createResendProvider } from "@ottabase/auth";

const emailProvider = createResendProvider(env, {
  from: "noreply@yourdomain.com",
});
// Requires: RESEND_API_KEY env var
```

#### Using Nodemailer (SMTP)

```typescript
import { createNodemailerProvider } from "@ottabase/auth";

// Option 1: Using env vars
const emailProvider = createNodemailerProvider(env);
// Requires: EMAIL_SERVER and EMAIL_FROM env vars

// Option 2: Custom SMTP config
const emailProvider = createNodemailerProvider(env, {
  server: {
    host: "smtp.gmail.com",
    port: 587,
    auth: {
      user: "your.email@gmail.com",
      pass: "your-app-password",
    },
  },
  from: "noreply@yourdomain.com",
});
```

## Session Utilities

```typescript
import {
  isAuthenticated,
  requireAuth,
  getUserId,
  getUserEmail,
  hasVerifiedEmail,
  serializeSession,
} from "@ottabase/auth";

// Check if authenticated
const session = await getSession();
if (isAuthenticated(session)) {
  console.log(session.user.id);
}

// Require auth (throws if not authenticated)
const session = requireAuth(await getSession());

// Extract user data
const userId = getUserId(session); // string | null
const email = getUserEmail(session); // string | null
const verified = hasVerifiedEmail(session); // boolean

// Serialize for API responses
const data = serializeSession(session);
```

## Configuration Options

```typescript
interface OttabaseAuthConfigOptions {
  d1: D1Database;
  providers: Provider[];
  
  // Optional
  sessionStrategy?: "jwt" | "database"; // Default: "jwt"
  sessionMaxAge?: number; // Default: 30 days
  useCachedAdapter?: boolean; // Default: true
  log?: boolean | ("query" | "info" | "warn" | "error")[];
  customUserFields?: string[];
  onError?: (error: Error, operation: string) => void;
  authConfig?: Partial<AuthConfig>; // Additional Auth.js options
}
```

## Adapter Options

### Using the Unified Adapter

```typescript
import { createD1AuthAdapter } from "@ottabase/auth";

const adapter = createD1AuthAdapter(env.DB, {
  log: ["query", "error"],
  customUserFields: ["role", "tier"],
  onError: (error, operation) => {
    console.error(`Error in ${operation}:`, error);
  },
});
```

### Using the Drizzle Adapter Directly

```typescript
import { createDrizzleD1AuthAdapter } from "@ottabase/auth";

const adapter = createDrizzleD1AuthAdapter(env.DB, {
  log: true,
  customUserFields: ["organizationId"],
});
```

### Cached Adapter (Recommended for Production)

```typescript
import { createD1AuthAdapterCached } from "@ottabase/auth";

const adapter = createD1AuthAdapterCached(env.DB);
```

## Environment Variables

```bash
# Required for Auth.js
AUTH_SECRET=your_random_secret  # Generate: openssl rand -base64 32

# Google OAuth (optional)
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret

# GitHub OAuth (optional)
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret

# Discord OAuth (optional)
DISCORD_CLIENT_ID=your_client_id
DISCORD_CLIENT_SECRET=your_client_secret

# Azure AD (optional)
AZURE_AD_CLIENT_ID=your_client_id
AZURE_AD_CLIENT_SECRET=your_client_secret
AZURE_AD_TENANT_ID=your_tenant_id

# Auth0 (optional)
AUTH0_CLIENT_ID=your_client_id
AUTH0_CLIENT_SECRET=your_client_secret
AUTH0_ISSUER=https://your-domain.auth0.com

# Email Provider - Resend (optional)
RESEND_API_KEY=your_resend_api_key

# Email Provider - Nodemailer/SMTP (optional)
EMAIL_SERVER=smtp://user:password@smtp.example.com:587
EMAIL_FROM=noreply@yourdomain.com
```

## Database Schema

Auth tables are managed by OttaORM migrations:

| Table | Migration | Purpose |
|-------|-----------|---------|
| `User` | 001 | User accounts |
| `Account` | 002 | OAuth provider accounts |
| `Session` | 006 | Session storage (database strategy) |
| `VerificationToken` | 007 | Email verification tokens |
| `Authenticator` | 008 | WebAuthn/Passkey credentials |

### Extending the User Model

Add custom columns in your app's migrations:

```sql
-- In your migration file
ALTER TABLE User ADD COLUMN role TEXT;
ALTER TABLE User ADD COLUMN subscriptionTier TEXT;
ALTER TABLE User ADD COLUMN organizationId TEXT;
```

Then configure the adapter:

```typescript
const config = createOttabaseAuthConfig({
  d1: env.DB,
  providers: [...],
  customUserFields: ["role", "subscriptionTier", "organizationId"],
});
```

## API Reference

### Exports

```typescript
// Adapters
export { createD1AuthAdapter, createD1AuthAdapterCached } from "@ottabase/auth";
export { createDrizzleD1AuthAdapter, createDrizzleD1AuthAdapterCached } from "@ottabase/auth";

// Config
export { createOttabaseAuthConfig, createOttabaseAuthConfigDev } from "@ottabase/auth";

// Providers - OAuth
export {
  createGoogleProvider,
  createGitHubProvider,
  createDiscordProvider,
  createAzureAdProvider,
  createAuth0Provider,
  autoConfigureProviders,
} from "@ottabase/auth";

// Providers - Credentials
export {
  createCredentialsProvider,
  createCustomCredentialsProvider,
} from "@ottabase/auth";

// Providers - Email (Magic Link)
export {
  createResendProvider,
  createNodemailerProvider,
} from "@ottabase/auth";

// Session Utilities
export {
  isAuthenticated,
  requireAuth,
  getUserId,
  getUserEmail,
  hasVerifiedEmail,
  serializeSession,
} from "@ottabase/auth";

// Feature
export { authFeature, registerAuthFeature } from "@ottabase/auth";
```

## Advanced Usage

### Custom Auth.js Configuration

```typescript
const config = createOttabaseAuthConfig({
  d1: env.DB,
  providers: [...],
  authConfig: {
    pages: {
      signIn: "/login",
      error: "/error",
    },
    callbacks: {
      async jwt({ token, user }) {
        if (user) {
          token.id = user.id;
          token.role = user.role;
        }
        return token;
      },
      async session({ session, token }) {
        session.user.id = token.id;
        session.user.role = token.role;
        return session;
      },
    },
  },
});
```

### Development Configuration

```typescript
import { createOttabaseAuthConfigDev } from "@ottabase/auth";

// Simplified config for development
const config = createOttabaseAuthConfigDev(env.DB, [
  createGoogleProvider(env),
]);
// Includes: JWT sessions, no caching, error/warn logging
```

## Architecture

```
@ottabase/auth
├── Uses @ottabase/db/drizzle-d1 for D1 driver
├── Uses @ottabase/ottaorm for migrations (auth tables in core)
├── Uses @auth/core for Auth.js functionality
└── Uses drizzle-orm for database operations
```

**Benefits:**
- Framework-agnostic (works anywhere)
- Tree-shakeable (optimal bundle size)
- Type-safe (full TypeScript support)
- Production-ready (error handling, caching)
- Extensible (custom fields, error handlers)

## Troubleshooting

### Provider not loading

Make sure environment variables are set:

```typescript
// Check if provider credentials are available (without logging secrets)
if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
  console.error("Missing Google OAuth environment variables");
}
```

### Custom fields not working

1. Verify columns exist in User table
2. Match field names exactly (case-sensitive)
3. Add fields to `customUserFields` array

### Errors not being caught

Add error handler to see what's happening:

```typescript
const config = createOttabaseAuthConfig({
  d1: env.DB,
  providers: [...],
  onError: (error, operation) => {
    console.error(`Auth error in ${operation}:`, error);
  },
});
```

## License

MIT
