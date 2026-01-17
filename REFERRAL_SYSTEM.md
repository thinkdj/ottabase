# Referral System Documentation

## Overview

The referral system for Ottabase is a complete, framework-agnostic solution that tracks inbound referral links, stores the first referrer for a visitor, tracks referral clicks, and attributes new signups to referrers. It provides stats, tracking logs, and user-managed referral usernames.

**Key Features:**
- ✅ First-touch attribution (first valid referral code wins)
- ✅ 90-day expiry window for stored referral codes
- ✅ Click tracking with metadata (IP, user agent, UTM params, referrer)
- ✅ Conversion tracking (pending → completed on signup)
- ✅ User-managed referral usernames
- ✅ Comprehensive dashboard with stats and activity feed
- ✅ RESTful API for all referral operations

## Architecture

### Package Structure

```
packages/referrals/              # @ottabase/referrals package
├── src/
│   ├── schema.ts               # Drizzle schema for referral_tracking table
│   ├── validation.ts           # Username validation utilities
│   └── index.ts                # Package exports
└── README.md

apps/ottabase-template-app-tanstack/
├── ottabase/
│   ├── models/
│   │   └── ReferralTracking.ts # OttaORM model for referral tracking
│   └── helpers/
│       └── referral-attribution.ts # Server-side attribution helper
├── src/
│   ├── components/
│   │   ├── ReferralTracker.tsx  # Auto-tracking component
│   │   └── ReferralDashboard.tsx # Dashboard UI
│   ├── lib/
│   │   └── referrals.ts         # Client-side utilities
│   └── pages/
│       ├── referrals/
│       │   └── ReferralsPage.tsx # Dashboard page
│       └── auth/
│           └── RegisterPage.tsx  # Enhanced with referral support
└── cloudflare-worker.ts         # API routes
```

## Database Schema

### User Model Updates

Added to `packages/ottaorm/src/models/User.ts`:

```typescript
{
  referralUsername: text("referral_username").unique(),
  referredById: text("referred_by_id"),
}
```

**New Methods:**
- `findByReferralUsername(username: string)` - Find user by referral username
- `referrer()` - Get the user who referred this user
- `referrals()` - Get users referred by this user

### ReferralTracking Table

Defined in `packages/referrals/src/schema.ts`:

```typescript
{
  id: UUID (primary key)
  userId: User ID (referrer)
  referralCode: Referral username at time of click
  referredUserId: User ID of converted user (null until signup)
  status: 'pending' | 'completed' | 'invalid'
  ipAddress: IP address of click
  userAgent: Browser user agent
  referer: HTTP referer header
  meta: JSON (UTM params, headers, etc.)
  createdAt: Click timestamp
  conversionAt: Conversion timestamp (null until signup)
}
```

**Indexes:**
- userId
- referredUserId
- referralCode
- status

## API Endpoints

All endpoints are implemented in `cloudflare-worker.ts`:

### Track Referral Click

```
POST /api/referrals/track
Content-Type: application/json

{
  "referralCode": "johndoe",
  "referer": "https://twitter.com/...",
  "meta": {
    "utm": {
      "source": "twitter",
      "campaign": "launch"
    }
  }
}

Response: 200
{
  "success": true,
  "tracking": { ... }
}
```

**Behavior:**
- Validates referral code exists
- Extracts IP, user agent from headers
- Creates tracking record with status 'pending'
- Returns 404 if referral code is invalid

### Get Referral Stats

```
GET /api/referrals/stats?userId={userId}

Response: 200
{
  "total": 42,
  "completed": 15,
  "pending": 27
}
```

### Get User Referral Data

```
GET /api/referrals/user?userId={userId}

Response: 200
{
  "user": {
    "id": "...",
    "name": "John Doe",
    "email": "john@example.com",
    "referralUsername": "johndoe",
    "referredById": "..."
  },
  "stats": {
    "total": 42,
    "completed": 15,
    "pending": 27
  },
  "tracking": [ ... ]
}
```

### Update Referral Username

```
PUT /api/referrals/username
Content-Type: application/json

{
  "userId": "user-123",
  "referralUsername": "newusername"
}

Response: 200
{
  "success": true,
  "user": { ... }
}
```

**Validation:**
- 3-20 characters
- Letters, numbers, underscores only
- Must be unique
- Returns 400 with error if validation fails

### Set Pending Referral (Before Signup)

```
POST /api/referrals/set-pending
Content-Type: application/json

{
  "referralCode": "johndoe",
  "sessionId": "session-123"
}

Response: 200
{
  "success": true
}
```

Stores the referral code in KV for 1 hour, to be retrieved during signup.

### Get Pending Referral

```
GET /api/referrals/get-pending?sessionId={sessionId}

Response: 200
{
  "referralCode": "johndoe"
}
```

### List Tracking Records

```
GET /api/referrals/tracking?userId={userId}&status=pending&page=1&perPage=20

Response: 200
{
  "data": [ ... ],
  "total": 42,
  "page": 1,
  "perPage": 20,
  "totalPages": 3
}
```

**Filters:**
- `status` - pending | completed | invalid
- `page` - Page number (default: 1)
- `perPage` - Items per page (default: 20)

## Client-Side Implementation

### Automatic Tracking

Place `<ReferralTracker />` in your root layout to enable automatic referral tracking:

```tsx
// src/router.tsx
import { ReferralTracker } from "@/components/ReferralTracker";

function RootLayout() {
  return (
    <div>
      <ReferralTracker />
      {/* ... rest of layout */}
    </div>
  );
}
```

**Behavior:**
1. Checks URL for `?ref=` parameter
2. Validates and stores referral code in localStorage (if not already stored)
3. Sends tracking request to API
4. Cleans URL (removes `?ref=` parameter)
5. Respects first-touch attribution

### Referral Dashboard

The dashboard is a protected page that shows:
- Referral stats (total, completed, pending)
- Username management
- Referral link with copy button
- Stored referral info (if user arrived via referral)
- Recent activity table

```tsx
// Usage
import { ReferralDashboard } from "@/components/ReferralDashboard";

<ReferralDashboard userId={user.id} />
```

### Utility Functions

Defined in `src/lib/referrals.ts`:

```typescript
// Get stored referral code (validates expiry)
const code = getStoredReferralCode();

// Store referral code (first-touch wins)
storeReferralCode("johndoe");

// Clear stored referral code
clearStoredReferralCode();

// Track referral click
await trackReferralClick("johndoe", { utm: { ... } });

// Set pending referral for auth
await setPendingReferralForAuth("johndoe", sessionId);

// Get pending referral
const code = await getPendingReferral(sessionId);

// Extract UTM params from URL
const utm = extractUtmParams();

// Clean referral from URL
cleanReferralFromUrl();

// Get referral expiry info
const { expiresAt, daysRemaining, isExpired } = getReferralExpiryInfo();
```

## Server-Side Implementation

### Referral Attribution Helper

Use during user creation to handle referral attribution:

```typescript
import { processReferralAttribution } from "@/ottabase/helpers/referral-attribution";

// In Auth.js callback or registration endpoint
const result = await processReferralAttribution({
  newUserId: user.id,
  sessionId: session.id, // Optional
  referralCode: "johndoe", // Optional (will check KV if not provided)
  kvNamespace: env.OBCF_KV,
});

if (result.attributed) {
  console.log(`User referred by ${result.referrerId}`);
  console.log(`Updated ${result.trackingRecordsUpdated} tracking records`);
}
```

**What it does:**
1. Gets pending referral code from KV (if sessionId provided)
2. Looks up referrer by referralUsername
3. Sets new user's `referredById` field
4. Updates ReferralTracking records: `pending` → `completed`
5. Clears pending referral from KV
6. Prevents self-referral

### Model Methods

**ReferralTracking Model:**

```typescript
// Get tracking records for a user
const records = await ReferralTracking.forUser(userId, {
  status: "completed",
  limit: 10,
});

// Get stats
const stats = await ReferralTracking.getStats(userId);

// Find pending records by code
const pending = await ReferralTracking.findPendingByCode("johndoe");

// Recent conversions
const recent = await ReferralTracking.recentConversions(10);

// Instance methods
await tracking.markCompleted(referredUserId);
await tracking.markInvalid();
const isConverted = tracking.isConverted();
const utmParams = tracking.getUtmParams();
const browserInfo = tracking.getBrowserInfo();
```

## Integration with Signup Flow

The `RegisterPage` has been enhanced to:

1. **Display referral info** - Shows who referred the user
2. **Handle attribution** - Passes referral code during registration
3. **Visual feedback** - Shows expiry countdown

For production Auth.js integration, add to your auth callbacks:

```typescript
// In auth.config.ts or similar
callbacks: {
  async signIn({ user, account, profile }) {
    // Process referral attribution
    if (user.id) {
      await processReferralAttribution({
        newUserId: user.id,
        sessionId: /* get from cookie/context */,
        kvNamespace: env.OBCF_KV,
      });
    }
    return true;
  },
}
```

## Validation Rules

Referral usernames must follow these rules (enforced in `@ottabase/referrals/validation`):

- **Length:** 3-20 characters
- **Characters:** Letters, numbers, underscores only (a-z, A-Z, 0-9, _)
- **Uniqueness:** Must be unique across all users
- **No special chars:** No spaces, hyphens, or special characters

Example validation:

```typescript
import { validateReferralUsername } from "@ottabase/referrals";

const result = validateReferralUsername("john_doe123");
if (!result.valid) {
  console.error(result.error);
}
```

## Local Storage

The system uses these localStorage keys:

- `ottabase_referralCode` - Stored referral code
- `ottabase_referralTimestamp` - Timestamp when code was stored

**Expiry:** 90 days (configurable via `REFERRAL_EXPIRY_MS`)

## Key Behaviors

### First-Touch Attribution

Once a referral code is stored, subsequent referral links are ignored (for 90 days). This ensures fair attribution to the first referrer who brought the visitor.

### Expiry Enforcement

Stored referral codes automatically expire after 90 days. Expired codes are:
- Cleared from localStorage
- Not used for attribution
- Not returned by `getStoredReferralCode()`

### Invalid Codes

If a user visits with an invalid referral code:
- API returns 404 error
- No tracking record is created
- Code is not stored in localStorage

### Username Changes

When a user changes their referral username:
- Old referral links stop working
- Pending referrals with old code may not convert
- A warning is shown in the UI
- Completed conversions remain linked

## Testing Checklist

- [ ] Visit site with `?ref=validcode` - code should be stored
- [ ] Visit again with `?ref=differentcode` - first code should remain
- [ ] Check localStorage for stored code
- [ ] Verify tracking record created in database
- [ ] Register new account - referral should be attributed
- [ ] Check `referredById` field is set
- [ ] Check tracking record status changed to `completed`
- [ ] View referral dashboard - stats should show correctly
- [ ] Update referral username - should validate and save
- [ ] Copy referral link - should include new username
- [ ] Test with invalid code - should return 404
- [ ] Test with expired code (mock timestamp) - should be cleared

## Production Considerations

1. **Auth.js Integration** - Add `processReferralAttribution()` to sign-in callback
2. **Session Management** - Ensure sessionId is available for pending referrals
3. **Rate Limiting** - Add rate limiting to tracking endpoint to prevent abuse
4. **Analytics** - Consider adding analytics events for referral conversions
5. **Fraud Prevention** - Implement IP-based duplicate detection
6. **Email Notifications** - Notify referrers when someone signs up
7. **Rewards** - Add reward logic for successful referrals
8. **Multi-tenancy** - Add `appName` field if using multi-tenant setup

## Deployment Steps

1. **Run migrations:**
   ```bash
   pnpm db:push
   ```

2. **Verify tables created:**
   - `users` table has `referral_username` and `referred_by_id` columns
   - `referral_tracking` table exists with all columns

3. **Test locally:**
   ```bash
   pnpm dev
   ```

4. **Deploy to Cloudflare:**
   ```bash
   pnpm deploy
   ```

5. **Test in production:**
   - Visit `/referrals` while logged in
   - Set your referral username
   - Share your referral link
   - Register a test account via referral link

## Troubleshooting

**Referral code not being stored:**
- Check browser localStorage is enabled
- Verify ReferralTracker component is mounted
- Check browser console for errors

**Tracking API returns 404:**
- Verify referral username exists in database
- Check user has set their referral username
- Verify API routes are deployed

**Attribution not working:**
- Check `processReferralAttribution()` is called during signup
- Verify KV namespace is configured
- Check database for pending tracking records
- Verify sessionId is passed correctly

**Username validation failing:**
- Must be 3-20 characters
- Only letters, numbers, underscores
- Check for uniqueness conflicts

## Future Enhancements

- [ ] Email notifications for conversions
- [ ] Reward/incentive system
- [ ] Admin analytics dashboard
- [ ] Referral leaderboard
- [ ] Custom referral link URLs (e.g., `/r/{username}`)
- [ ] Multi-level referrals (referral of referral)
- [ ] Export referral data (CSV/JSON)
- [ ] Webhook notifications for conversions
- [ ] A/B testing for referral campaigns

## License

Part of the Ottabase monorepo. See main LICENSE file.
