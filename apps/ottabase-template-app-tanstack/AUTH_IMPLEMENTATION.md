# Production-Ready Auth Implementation

## ✅ Architecture - Reusable Monorepo Structure

All core auth logic is now in the `@ottabase/auth` package, making it reusable across all apps in the monorepo. Apps
only contain minimal glue code and app-specific overrides.

## 📦 Package Structure

### `@ottabase/auth` Package (Reusable)

```
packages/auth/src/
├── backend-handler.ts     # Cloudflare Workers request handler
├── client-api.ts          # Frontend API client (framework-agnostic)
├── react-hooks.ts         # React session management hook
├── config.ts              # Auth.js configuration helpers
├── providers.ts           # OAuth/Email/Credentials provider presets
├── adapter.ts             # Cloudflare D1 adapter
├── session.ts             # Session utilities
├── components/            # React UI components
│   ├── LoginForm.tsx
│   ├── SocialLoginButtons.tsx
│   ├── CredentialsForm.tsx
│   ├── MagicLinkForm.tsx
│   └── helpers.ts         # Auto-configuration helpers
└── index.ts               # Main exports
```

**Package Exports:**

- `@ottabase/auth` - Main exports (adapters, config, providers, session utils)
- `@ottabase/auth/backend` - Backend handler for Workers
- `@ottabase/auth/client` - Frontend API client
- `@ottabase/auth/react` - React hooks (useSession)
- `@ottabase/auth/components` - UI components

### App (Minimal Glue Code)

```
apps/ottabase-template-app-tanstack/
├── cloudflare-worker.ts   # Import and use handleAuthRequest
├── src/lib/
│   ├── auth-backend.ts    # Re-export + optional overrides
│   ├── auth-api.ts        # Re-export for convenience
│   └── auth.ts            # Re-export for convenience
└── src/pages/auth/
    └── LoginPage.tsx      # Use LoginForm component + auth hooks
```

## 🚀 Usage Examples

### Backend (Cloudflare Worker)

**Out-of-the-box usage:**

```typescript
// cloudflare-worker.ts
import { handleAuthRequest } from '@ottabase/auth/backend';

if (url.pathname.startsWith('/api/auth/')) {
    return handleAuthRequest(request, env);
}
```

**With custom authorization:**

```typescript
import { handleAuthRequest } from '@ottabase/auth/backend';
import { verifyPassword } from '@ottabase/auth/backend';

if (url.pathname.startsWith('/api/auth/')) {
    return handleAuthRequest(request, env, {
        authorize: async ({ email, password }) => {
            // Your custom database query
            const user = await db.query.users.findFirst({
                where: eq(users.email, email),
            });

            if (!user || !(await verifyPassword(password, user.passwordHash))) {
                return null;
            }

            return { id: user.id, email: user.email, name: user.name };
        },
    });
}
```

### Frontend (React)

**Session management:**

```typescript
import { useSession } from "@ottabase/auth/react";

function MyComponent() {
  const { user, isAuthenticated, logout } = useSession();

  if (!isAuthenticated) {
    return <LoginPrompt />;
  }

  return (
    <div>
      <h1>Welcome {user.name}</h1>
      <button onClick={logout}>Sign Out</button>
    </div>
  );
}
```

**Login implementation:**

```typescript
import { signInWithCredentials, signInWithProvider } from "@ottabase/auth/client";
import { LoginForm } from "@ottabase/auth/components";
import { getLoginConfig } from "@ottabase/auth/components";

function LoginPage() {
  const config = getLoginConfig(import.meta.env);

  return (
    <LoginForm
      socialProviders={config.socialProviders}
      showCredentials={config.showCredentials}
      showMagicLink={config.showMagicLink}
      onSocialLogin={(id) => signInWithProvider(id)}
      onCredentialsLogin={({ email, password }) =>
        signInWithCredentials({ email, password })
      }
    />
  );
}
```

## 🔧 Configuration

### Auto-Configuration

The auth system automatically detects and enables providers based on environment variables:

```bash
# Set these in wrangler.jsonc or .env
AUTH_SECRET=your-secret
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
EMAIL_RESEND_API_KEY=...  # For magic link
```

The package will:

- ✅ Enable configured OAuth providers
- ✅ Show warnings for missing configuration
- ✅ Auto-configure UI components
- ✅ Work with zero configuration (credentials only)

### App-Specific Overrides

Apps can override behavior by passing options to `handleAuthRequest`:

```typescript
handleAuthRequest(request, env, {
    // Custom authorization
    authorize: async (credentials) => {
        /* ... */
    },

    // Session duration
    sessionMaxAge: 7 * 24 * 60 * 60, // 7 days

    // Verbose logging
    verbose: true,

    // Additional Auth.js config
    authConfig: {
        pages: {
            signIn: '/custom-login',
        },
    },
});
```

## 📋 Features

### ✅ Implemented

1. **Backend Handler** (`@ottabase/auth/backend`)
    - Plug-and-play Cloudflare Workers integration
    - Auto-configuration from env vars
    - Customizable authorization
    - Production-ready error handling

2. **Client API** (`@ottabase/auth/client`)
    - Framework-agnostic (works with any frontend)
    - Type-safe API calls
    - Credentials, OAuth, Magic Link support

3. **React Hooks** (`@ottabase/auth/react`)
    - `useSession()` with auto-sync
    - LocalStorage persistence
    - Loading states
    - Session refresh

4. **UI Components** (`@ottabase/auth/components`)
    - `LoginForm` - Unified login interface
    - `SocialLoginButtons` - OAuth providers
    - `CredentialsForm` - Email/password
    - `MagicLinkForm` - Passwordless
    - Auto-configuration helpers

5. **Provider Support**
    - ✅ Credentials (email/password)
    - ✅ Google OAuth
    - ✅ GitHub OAuth
    - ✅ Discord OAuth
    - ✅ Azure AD OAuth
    - ✅ Auth0
    - ✅ Magic Link (Resend)
    - ✅ Magic Link (SMTP/Nodemailer)

## 🏗️ Benefits of This Architecture

### For the Package

- ✅ Reusable across all apps
- ✅ Single source of truth
- ✅ Easy to maintain and update
- ✅ Well-tested and production-ready
- ✅ Framework-agnostic core

### For Apps

- ✅ Minimal boilerplate (just import and use)
- ✅ Can override anything when needed
- ✅ Automatic updates from package
- ✅ Consistent auth across apps
- ✅ Zero configuration to get started

### For the Monorepo

- ✅ DRY (Don't Repeat Yourself)
- ✅ Consistent patterns
- ✅ Easier onboarding
- ✅ Centralized improvements
- ✅ Production-quality baseline

## 🔄 Migration Path

### Before (App-Specific)

```typescript
// Lots of auth logic in each app
// Hard to maintain
// Duplicated across apps
```

### After (Package-Based)

```typescript
// 1. Backend: One line import
import { handleAuthRequest } from '@ottabase/auth/backend';

// 2. Frontend: Use hooks
import { useSession } from '@ottabase/auth/react';

// 3. UI: Use components
import { LoginForm } from '@ottabase/auth/components';

// Done! 🎉
```

## 📚 Next Steps

1. **Build the auth package:**

    ```bash
    cd packages/auth
    pnpm build
    ```

2. **Install dependencies in app:**

    ```bash
    cd apps/ottabase-template-app-tanstack
    pnpm install
    ```

3. **Configure environment:**
    - Copy `.env.example` to `.env.local`
    - Set `AUTH_SECRET` (required)
    - Add OAuth provider credentials (optional)

4. **Run the app:**

    ```bash
    pnpm dev
    ```

5. **Test authentication:**
    - Visit `/login`
    - See auto-configured providers
    - Check warnings for missing config
    - (Development only) Use the built-in credentials login to verify the flow locally. **Do not use the default
      credentials handler in production** — you must implement a real `authorize` callback backed by your user store
      before deploying.

## 🎯 Summary

**What's in the Package:**

- ✅ Backend request handler
- ✅ Client API
- ✅ React hooks
- ✅ UI components
- ✅ Auto-configuration
- ✅ Provider helpers
- ✅ Session utilities

**What's in the App:**

- ✅ Simple imports
- ✅ Optional overrides
- ✅ Environment config
- ✅ That's it!

**Result:** Production-ready auth that works out-of-the-box, but can be customized for any app-specific requirements.
Perfect for a reusable monorepo! 🚀
