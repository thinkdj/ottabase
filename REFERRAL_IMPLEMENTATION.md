# Referral System Implementation Summary

## Overview

Successfully implemented a comprehensive referral system package (`@ottabase/referral`) following the monorepo best practices and existing patterns from `@ottabase/shortlinks`.

## Package Structure

### Files Created

1. **`packages/referral/package.json`** - Package configuration with peer dependencies
2. **`packages/referral/tsconfig.json`** - TypeScript configuration
3. **`packages/referral/src/schema.ts`** - Drizzle ORM schema for referrals table
4. **`packages/referral/src/types.ts`** - Comprehensive TypeScript types and interfaces
5. **`packages/referral/src/provider.tsx`** - React provider component with hooks
6. **`packages/referral/src/index.ts`** - Main export file
7. **`packages/referral/README.md`** - Comprehensive documentation

## Features Implemented

### Core Functionality

1. **Automatic Query Parameter Detection**
   - Detects `?referrer=xyz` (configurable param name) on app load
   - Saves to localStorage automatically
   - Supports SSR-safe implementation with client-side only detection

2. **LocalStorage Persistence**
   - Configurable storage key (default: `ottabase.referral`)
   - JSON storage format with metadata
   - Automatic expiry checking on load

3. **Configuration Options**
   ```typescript
   {
     storageKey: string,           // LocalStorage key
     queryParam: string,            // URL query parameter name
     overrideReferral: boolean,     // Whether to override existing referral
     expiryMs: number | null,       // Expiry time in milliseconds
     appName: string,               // Multi-tenant support
     onReferralDetected: callback,  // Event callback
     onReferralCleared: callback,   // Event callback
     debug: boolean                 // Debug logging
   }
   ```

4. **React Hook API**
   ```typescript
   const {
     referralData,      // Full referral data object
     referrerCode,      // Current referrer code
     hasReferral,       // Boolean flag
     setReferral,       // Manually set referral
     clearReferral,     // Clear referral
     isExpired,         // Check expiry
     getTimeRemaining,  // Time until expiry
   } = useReferral();
   ```

5. **Database Schema**
   - Drizzle ORM schema for SQLite (Cloudflare D1)
   - Fields: referrerCode, referredUserId, appName, source, landingUrl, ipAddress, userAgent, converted, metadata
   - Multi-tenant support via appName field
   - Conversion tracking built-in

## Integration into TanStack Template App

### Files Modified

1. **`apps/ottabase-template-app-tanstack/package.json`**
   - Added `"@ottabase/referral": "workspace:*"` dependency

2. **`apps/ottabase-template-app-tanstack/src/providers/Providers.tsx`**
   - Imported `ReferralProvider` from `@ottabase/referral`
   - Wrapped app with provider:
     ```tsx
     <ReferralProvider
       config={{
         storageKey: `${appConfig.storage.prefix}.referral`,
         overrideReferral: true,
         expiryMs: 30 * 24 * 60 * 60 * 1000, // 30 days
         debug: false,
       }}
     >
       {/* rest of app */}
     </ReferralProvider>
     ```

3. **`apps/ottabase-template-app-tanstack/src/pages/demo/referral/ReferralDemoPage.tsx`**
   - Comprehensive demo page showing all features
   - Live status display
   - Manual referral setting
   - Test links
   - Configuration display
   - Usage examples

4. **`apps/ottabase-template-app-tanstack/src/router.tsx`**
   - Added `demoReferralRoute` definition
   - Added route to `routeTree`

5. **`apps/ottabase-template-app-tanstack/src/pages/demo/DemoIndexPage.tsx`**
   - Added "Referral System" card linking to demo

## Usage Examples

### Basic Integration

```tsx
import { ReferralProvider } from "@ottabase/referral";

function App() {
  return (
    <ReferralProvider>
      <YourApp />
    </ReferralProvider>
  );
}
```

### In Signup Flow

```tsx
import { useReferral } from "@ottabase/referral";

function SignupForm() {
  const { referrerCode } = useReferral();

  const handleSignup = async (data) => {
    await api.signup({
      ...data,
      referredBy: referrerCode,
    });
  };

  return <form>...</form>;
}
```

### Server-Side Tracking

```typescript
import { referralsTable } from "@ottabase/referral/schema";

// Store referral record
await db.insert(referralsTable).values({
  referrerCode: "john123",
  referredUserId: "user_456",
  appName: "myapp",
  converted: true,
  convertedAt: new Date(),
});
```

## Configuration Patterns

### First Referral Wins

```tsx
<ReferralProvider config={{ overrideReferral: false }}>
  <App />
</ReferralProvider>
```

### Custom Expiry

```tsx
<ReferralProvider config={{ expiryMs: 7 * 24 * 60 * 60 * 1000 }}>
  <App />
</ReferralProvider>
```

### With Analytics

```tsx
<ReferralProvider config={{
  onReferralDetected: (code) => {
    analytics.track("referral_detected", { code });
  }
}}>
  <App />
</ReferralProvider>
```

## Testing

### Manual Testing

1. Visit demo page: `/demo/referral`
2. Click test links with different referrer codes
3. Verify localStorage persistence
4. Test expiry and clear functions
5. Try manual referral setting

### Test Scenarios

- ✅ Initial visit with `?referrer=xyz` sets referral
- ✅ Subsequent visits without param preserve referral
- ✅ Override behavior respects configuration
- ✅ Expiry is calculated correctly
- ✅ Clear function removes from localStorage
- ✅ SSR-safe (no window access during server render)

## Type Safety

All exports are fully typed:
- ✅ Schema types from Drizzle
- ✅ Configuration interfaces
- ✅ Hook return types
- ✅ Response types

## Documentation

Comprehensive README.md includes:
- Installation instructions
- Quick start guide
- Full API reference
- Configuration options table
- Multiple usage examples
- Database schema documentation
- Best practices

## Standards Compliance

✅ Follows monorepo package creation guidelines
✅ Uses catalog dependencies appropriately
✅ React/React DOM as peer dependencies only
✅ Framework-agnostic core logic
✅ Drizzle ORM for database schema
✅ Type-safe exports
✅ Comprehensive documentation

## Next Steps for Users

1. **Configure Provider**: Adjust settings in `Providers.tsx` based on business needs
2. **Implement Signup Integration**: Use `useReferral` hook in signup/conversion flows
3. **Add Server Tracking**: Create API endpoints to store referral records in database
4. **Setup Analytics**: Integrate with existing analytics platform
5. **Create Migrations**: Add referrals table to database schema
6. **Generate Referral Codes**: Implement referral code generation for users

## Notes

- The package is ready for production use
- The demo page provides comprehensive testing interface
- The implementation follows all monorepo best practices
- The database schema supports full conversion tracking
- Multi-tenant support is built-in via appName field
