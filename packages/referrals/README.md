# @ottabase/referrals

Referral system package for Ottabase — schema, model, validation, and attribution tracking.

## Features

- **Referral username** — Unique, user-chosen identifier for referral links (3–20 chars, `[a-zA-Z0-9_]`)
- **First-touch attribution** — First valid referral code wins; stored for 90 days then expires
- **Click analytics** — Referral clicks written to Cloudflare Analytics Engine (WAE); no per-click DB writes
- **Conversion tracking** — D1 record created on signup, linked to the referring user

## Install

```bash
pnpm add @ottabase/referrals
```

## Usage

### Schema

Export the table from your Drizzle schema file:

```typescript
// ottabase/db/schema.ts
export { referralTrackingTable } from '@ottabase/referrals';
```

### Model

```typescript
import { ReferralTracking } from '@ottabase/referrals';

// Record a conversion (called at signup when referral cookie exists)
await ReferralTracking.create({
    userId: referrerId,
    referralCode: 'alice',
    referredUserId: newUser.id,
    status: 'completed',
    ipAddress: request.headers.get('cf-connecting-ip'),
    userAgent: request.headers.get('user-agent'),
    conversionAt: Date.now(),
});

// Query referrals for a user
const referrals = await ReferralTracking.where({ userId: 'user-123' });
```

### Validation

```typescript
import { validateReferralUsername, isReferralExpired, REFERRAL_EXPIRY_MS } from '@ottabase/referrals';

const result = validateReferralUsername('myusername');
if (!result.valid) {
    console.error(result.error);
}
// Rules: 3–20 characters, letters/numbers/underscores only

// Check if a stored referral timestamp has expired (90-day window)
if (isReferralExpired(storedTimestamp)) {
    // referral cookie is stale — ignore it
}
```

**Validation constants:**

```typescript
import {
    REFERRAL_USERNAME_MIN_LENGTH, // 3
    REFERRAL_USERNAME_MAX_LENGTH, // 20
    REFERRAL_USERNAME_PATTERN, // /^[a-zA-Z0-9_]+$/
    REFERRAL_EXPIRY_MS, // 90 days in ms
} from '@ottabase/referrals';
```

## Database Schema

`referral_tracking` table — stores conversions only (clicks go to WAE):

| Column           | Type      | Description                         |
| ---------------- | --------- | ----------------------------------- |
| `id`             | string    | Unique tracking ID                  |
| `userId`         | string    | Referrer's user ID                  |
| `referralCode`   | string    | Code used at click time             |
| `referredUserId` | string    | Converted (new) user ID             |
| `status`         | string    | `completed` for conversion records  |
| `ipAddress`      | string    | Client IP at signup                 |
| `userAgent`      | string    | Browser user agent                  |
| `referer`        | string    | HTTP Referer header                 |
| `meta`           | JSON      | UTM params and full request context |
| `createdAt`      | timestamp | Record creation time                |
| `conversionAt`   | timestamp | Conversion time                     |

## Integration Points

1. **User model** — add `referralUsername` (the user's own code) and `referredById` fields
2. **Signup flow** — read referral cookie, validate + attribute on account creation
3. **Click tracking** — write to WAE on each referral link visit (via `@ottabase/analytics`)
4. **Frontend** — display referral link (`/{username}`), show conversion stats

See the TanStack app implementation (`/api/referrals/*`) for a full example.

## License

MIT
