# @ottabase/referrals

Referral system package for Ottabase. Provides schema, validation, and types for implementing a complete referral
tracking system.

## Features

- **Referral username**: Unique, user-chosen identifier for referral links
- **First-touch attribution**: First valid referral code wins
- **90-day expiry window**: Stored referral codes expire automatically
- **Click analytics**: Referral clicks written to Cloudflare Analytics Engine (WAE)
- **Conversion tracking**: D1 records created on signup (no per-click DB writes)

## Usage

### Schema

```typescript
import { referralTrackingTable } from '@ottabase/referrals';
```

### Model

```typescript
import { ReferralTracking } from '@ottabase/referrals';
```

### Validation

```typescript
import { validateReferralUsername } from '@ottabase/referrals';

const result = validateReferralUsername('myusername');
if (!result.valid) {
    console.error(result.error);
}
```

## Database Schema

### ReferralTracking Table

Stores conversions only (clicks go to WAE). Each row = one successful signup attributed to a referrer.

- `id`: Unique tracking ID
- `userId`: Referrer user ID
- `referralCode`: Code used at click time
- `referredUserId`: Converted user ID
- `status`: completed (conversion records)
- `ipAddress`: Client IP (captured at signup)
- `userAgent`: Browser user agent
- `referer`: HTTP Referer header
- `meta`: JSON (UTM params, headers) — full context at conversion
- `createdAt`: Record creation timestamp
- `conversionAt`: Conversion timestamp

## Integration

This package should be integrated with:

1. User model (add `referralUsername` and `referredById` fields)
2. Signup flow (attribute new users to referrers)
3. Frontend (tracking component, dashboard)
4. API routes (tracking, stats, username management)

See the TanStack app implementation for a complete example.
