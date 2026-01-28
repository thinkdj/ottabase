# @ottabase/referrals

Referral tracking system with fat model for Ottabase apps.

## Quick Start

### 1. Register Model

```typescript
// cloudflare-worker.ts
import { ReferralTracking } from "@ottabase/referrals";
import { registerModels } from "@ottabase/ottaorm";

registerModels([ReferralTracking]);
```

### 2. Export Table in Schema

```typescript
// ottabase/db/schema.ts
export { referralTrackingTable } from "@ottabase/referrals";
```

### 3. Add Fields to User Model

```sql
-- In your migration
ALTER TABLE users ADD COLUMN referral_username TEXT UNIQUE;
ALTER TABLE users ADD COLUMN referred_by_id TEXT;
```

### 4. Run Migrations

```bash
curl -X POST http://localhost:3004/api/ottaorm/init
```

## Usage

### Track Referral Click

```typescript
import { ReferralTracking } from "@ottabase/referrals";

// When user clicks referral link
const tracking = await ReferralTracking.create({
  userId: referrerId,
  referralCode: "johndoe",
  status: "pending",
  ipAddress: request.headers.get("CF-Connecting-IP"),
  userAgent: request.headers.get("User-Agent"),
  referer: request.headers.get("Referer"),
  meta: { utm_source: "twitter" },
});
```

### Convert on Signup

```typescript
// When referred user signs up
const tracking = await ReferralTracking.first({
  referralCode: storedCode,
  status: "pending",
});

if (tracking) {
  tracking.set("status", "completed");
  tracking.set("referredUserId", newUser.id);
  tracking.set("conversionAt", new Date());
  await tracking.save();

  // Update referrer's user record
  newUser.set("referredById", tracking.get("userId"));
  await newUser.save();
}
```

### Get Stats

```typescript
const stats = await ReferralTracking.getStats(userId);
// { totalClicks: 50, completedReferrals: 12, pendingReferrals: 5 }
```

### Query Records

```typescript
// Get all for user
const records = await ReferralTracking.forUser(userId, {
  status: "completed",
  limit: 50,
});

// Find by code
const record = await ReferralTracking.findByCode("johndoe");
```

## Validate Username

```typescript
import { validateReferralUsername } from "@ottabase/referrals";

const result = validateReferralUsername("my-username");
if (!result.valid) {
  return errorResponse(result.error, 400);
}
```

## Schema

| Field | Type | Description |
|-------|------|-------------|
| `id` | text | UUID primary key |
| `userId` | text | Referrer user ID |
| `referralCode` | text | Code used at click |
| `referredUserId` | text | Converted user ID |
| `status` | text | pending, completed, invalid |
| `ipAddress` | text | Click IP |
| `userAgent` | text | Browser user agent |
| `referer` | text | HTTP referer |
| `meta` | json | Extra metadata (UTM) |
| `createdAt` | timestamp | Click time |
| `conversionAt` | timestamp | Conversion time |

## Exports

```typescript
import { ReferralTracking, referralTrackingTable } from "@ottabase/referrals";
import { validateReferralUsername } from "@ottabase/referrals";
import type { ReferralTrackingRecord, ReferralTrackingInsert } from "@ottabase/referrals";
```
