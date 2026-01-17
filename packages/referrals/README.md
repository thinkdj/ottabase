# @ottabase/referrals

Referral system package for Ottabase. Provides schema, validation, and types for implementing a complete referral tracking system.

## Features

- **Referral username**: Unique, user-chosen identifier for referral links
- **First-touch attribution**: First valid referral code wins
- **90-day expiry window**: Stored referral codes expire automatically
- **Click tracking**: Every referral click creates a tracking record
- **Conversion tracking**: Updates from `pending` to `completed` on signup
- **Metadata capture**: IP, user agent, UTM params, referrer

## Usage

### Schema

```typescript
import { referralTrackingTable } from "@ottabase/referrals/schema";
```

### Validation

```typescript
import { validateReferralUsername } from "@ottabase/referrals";

const result = validateReferralUsername("myusername");
if (!result.valid) {
  console.error(result.error);
}
```

## Database Schema

### ReferralTracking Table

- `id`: Unique tracking ID
- `userId`: Referrer user ID
- `referralCode`: Code used at click time
- `referredUserId`: Converted user ID (null until signup)
- `status`: pending | completed | invalid
- `ipAddress`: Click IP address
- `userAgent`: Browser user agent
- `referer`: HTTP referer header
- `meta`: JSON metadata (UTM params, headers)
- `createdAt`: Click timestamp
- `conversionAt`: Conversion timestamp

## Integration

This package should be integrated with:
1. User model (add `referralUsername` and `referredById` fields)
2. Signup flow (attribute new users to referrers)
3. Frontend (tracking component, dashboard)
4. API routes (tracking, stats, username management)

See the TanStack app implementation for a complete example.
