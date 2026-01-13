# @ottabase/referral

A reusable referral system designed for multi-tenant applications with localStorage persistence and React provider integration.

## Features

- 🔗 Automatic referral code detection from URL query parameters
- 💾 LocalStorage persistence with configurable expiry
- 🎯 Multi-tenant support via `appName` field
- ⚙️ Flexible configuration options
- 🏗️ Built on Drizzle ORM for Cloudflare D1
- 🔄 Reusable across monorepo apps
- ⏰ Configurable expiry times
- 🛡️ Type-safe with full TypeScript support

## Installation

```bash
pnpm add @ottabase/referral
```

## Quick Start

### 1. Wrap your app with ReferralProvider

```tsx
import { ReferralProvider } from "@ottabase/referral";

function App() {
  return (
    <ReferralProvider config={{ overrideReferral: false }}>
      <YourApp />
    </ReferralProvider>
  );
}
```

### 2. Use the referral in your components

```tsx
import { useReferral } from "@ottabase/referral";

function SignupForm() {
  const { referrerCode, hasReferral } = useReferral();

  const handleSignup = async (userData) => {
    // Include referral code in signup
    await api.signup({
      ...userData,
      referredBy: referrerCode,
    });
  };

  return (
    <div>
      {hasReferral && (
        <p>You were referred by: {referrerCode}</p>
      )}
      {/* signup form */}
    </div>
  );
}
```

## Configuration Options

The `ReferralProvider` accepts a `config` prop with the following options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `storageKey` | `string` | `"ottabase.referral"` | LocalStorage key for persistence |
| `queryParam` | `string` | `"referrer"` | URL query parameter to check for referral code |
| `overrideReferral` | `boolean` | `true` | Whether to override existing referral with new one |
| `expiryMs` | `number \| null` | `2592000000` (30 days) | Expiry time in milliseconds (null = never expire) |
| `appName` | `string` | `"default"` | App identifier for multi-tenant support |
| `onReferralDetected` | `(code: string) => void` | - | Callback when referral is detected |
| `onReferralCleared` | `() => void` | - | Callback when referral is cleared |
| `debug` | `boolean` | `false` | Enable debug logging |

### Configuration Examples

#### First Referral Wins (No Override)

```tsx
<ReferralProvider config={{ overrideReferral: false }}>
  <App />
</ReferralProvider>
```

With this configuration, the first referral code is preserved even if the user visits with a different referral code later.

#### 7-Day Expiry

```tsx
<ReferralProvider config={{ 
  expiryMs: 7 * 24 * 60 * 60 * 1000 // 7 days
}}>
  <App />
</ReferralProvider>
```

#### Never Expire

```tsx
<ReferralProvider config={{ expiryMs: null }}>
  <App />
</ReferralProvider>
```

#### Custom Query Parameter

```tsx
<ReferralProvider config={{ queryParam: "ref" }}>
  <App />
</ReferralProvider>
```

Now users can share links like: `https://yourapp.com?ref=john123`

#### With Callbacks

```tsx
<ReferralProvider config={{
  onReferralDetected: (code) => {
    console.log("Referral detected:", code);
    analytics.track("referral_detected", { code });
  },
  onReferralCleared: () => {
    console.log("Referral cleared");
  },
  debug: true,
}}>
  <App />
</ReferralProvider>
```

## useReferral Hook

The `useReferral` hook provides access to the referral context:

```tsx
const {
  referralData,       // Full referral data object
  referrerCode,       // Current referrer code (or null)
  hasReferral,        // Boolean indicating if referral exists
  setReferral,        // Manually set a referral code
  clearReferral,      // Clear the current referral
  isExpired,          // Check if referral has expired
  getTimeRemaining,   // Get time remaining until expiry (ms)
} = useReferral();
```

### Hook Examples

#### Display Referral Status

```tsx
function ReferralBanner() {
  const { hasReferral, referrerCode, getTimeRemaining } = useReferral();

  if (!hasReferral) return null;

  const remaining = getTimeRemaining();
  const daysLeft = remaining ? Math.floor(remaining / (24 * 60 * 60 * 1000)) : null;

  return (
    <div className="banner">
      Referred by: {referrerCode}
      {daysLeft && ` (${daysLeft} days remaining)`}
    </div>
  );
}
```

#### Manually Set Referral

```tsx
function AdminPanel() {
  const { setReferral } = useReferral();

  const handleAssignReferral = () => {
    setReferral("special-promo", { source: "admin", campaign: "summer2024" });
  };

  return <button onClick={handleAssignReferral}>Assign Referral</button>;
}
```

#### Clear Referral After Signup

```tsx
function SignupSuccess() {
  const { clearReferral } = useReferral();

  useEffect(() => {
    // Clear referral after successful signup
    clearReferral();
  }, [clearReferral]);

  return <div>Thanks for signing up!</div>;
}
```

## Database Schema

The package exports a `referralsTable` Drizzle schema for tracking referral records:

### Import Schema

```typescript
import { referralsTable } from "@ottabase/referral/schema";
```

### Schema Fields

- `id` - UUID primary key
- `referrerCode` - The referrer identifier
- `referredUserId` - User who was referred (set after signup)
- `appName` - App identifier for multi-tenant support
- `source` - Source of the referral (link, qr, email, etc.)
- `landingUrl` - Landing page URL
- `ipAddress` - IP address (optional)
- `userAgent` - User agent (optional)
- `converted` - Whether referral resulted in conversion
- `convertedAt` - Conversion timestamp
- `metadata` - Additional data as JSON string
- `createdAt` - Creation timestamp
- `updatedAt` - Last update timestamp

### Database Usage Example

```typescript
import { drizzle } from "drizzle-orm/d1";
import { referralsTable } from "@ottabase/referral/schema";
import { eq } from "drizzle-orm";

// Create a referral record
await db.insert(referralsTable).values({
  referrerCode: "john123",
  appName: "myapp",
  source: "link",
  landingUrl: "https://myapp.com",
});

// Query referrals
const referrals = await db
  .select()
  .from(referralsTable)
  .where(eq(referralsTable.referrerCode, "john123"));

// Mark as converted
await db
  .update(referralsTable)
  .set({ 
    converted: true, 
    convertedAt: new Date(),
    referredUserId: "user_123" 
  })
  .where(eq(referralsTable.id, referralId));
```

## Advanced Usage

### Server-Side Referral Tracking

You can combine the client-side provider with server-side tracking:

```typescript
// In your signup API endpoint
export async function POST(request: Request) {
  const { email, password, referrerCode } = await request.json();

  // Create user
  const user = await createUser({ email, password });

  // Track referral if present
  if (referrerCode) {
    await db.insert(referralsTable).values({
      referrerCode,
      referredUserId: user.id,
      appName: "myapp",
      converted: true,
      convertedAt: new Date(),
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
    });
  }

  return { success: true };
}
```

### Analytics Integration

```tsx
import { ReferralProvider } from "@ottabase/referral";
import { analytics } from "./analytics";

function App() {
  return (
    <ReferralProvider
      config={{
        onReferralDetected: (code) => {
          analytics.track("referral_visit", { 
            referrerCode: code,
            url: window.location.href 
          });
        },
      }}
    >
      <YourApp />
    </ReferralProvider>
  );
}
```

### Multi-App Support

```tsx
// App 1
<ReferralProvider config={{ appName: "app1" }}>
  <App1 />
</ReferralProvider>

// App 2
<ReferralProvider config={{ appName: "app2" }}>
  <App2 />
</ReferralProvider>
```

## TypeScript Types

The package exports comprehensive TypeScript types:

```typescript
import type {
  Referral,
  NewReferral,
  ReferralProviderConfig,
  ReferralData,
  ReferralContextValue,
  CreateReferralRequest,
  UpdateReferralRequest,
  ReferralResponse,
  ReferralSource,
} from "@ottabase/referral";
```

## How It Works

1. **URL Detection**: On app load, the provider checks the URL for the referral query parameter (default: `?referrer=xyz`)
2. **Storage**: If found, it saves the referral code to localStorage with metadata (timestamp, expiry, source URL)
3. **Persistence**: The referral persists across page reloads and sessions until it expires or is cleared
4. **Access**: Components can access the referral code via the `useReferral` hook
5. **Usage**: The referral code can be used during signup, purchase, or any conversion event
6. **Tracking**: Server-side APIs can store referral records in the database for analytics

## Best Practices

1. **Clear referrals after conversion**: Call `clearReferral()` after successful signup to prevent double-counting
2. **Set appropriate expiry times**: Choose expiry times based on your conversion funnel (7-30 days is common)
3. **Track server-side**: Store referral records in the database for accurate analytics
4. **Use unique codes**: Generate unique referrer codes for each user/campaign
5. **Monitor expiry**: Check `getTimeRemaining()` to display countdown timers or urgency messages

## License

MIT
