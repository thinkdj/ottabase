# @ottabase/referrals

Referral system package for Ottabase. Provides schema, validation, and types for implementing a complete referral
tracking system.

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

## OttaORM Model

Use the built-in ReferralTracking model:

```typescript
import { ReferralTracking } from '@ottabase/referrals';

// Create tracking record on click
const tracking = await ReferralTracking.create({
    userId: referrerId,
    referralCode: 'ref123',
    ipAddress: request.headers.get('x-forwarded-for') || '',
    userAgent: request.headers.get('user-agent') || '',
    referer: request.headers.get('referer') || '',
});

// Mark as converted on signup
const tracking = await ReferralTracking.find(trackingId);
await tracking.update({
    referredUserId: newUserId,
    status: 'completed',
    conversionAt: new Date(),
});

// Get pending conversions
const pending = await ReferralTracking.where('status', '=', 'pending')
    .where('createdAt', '>', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)) // Last 90 days
    .get();
```

## Integration Examples

### 1. User Model Setup

```typescript
// models/User.ts
import { BaseModel } from '@ottabase/ottaorm';
import { sqliteTable, text, uuid } from 'drizzle-orm/sqlite-core';

export const usersTable = sqliteTable('users', {
    id: uuid('id').primaryKey(),
    email: text('email').notNull().unique(),
    name: text('name'),
    referralUsername: text('referral_username').unique(), // Unique referral code
    referredById: uuid('referred_by_id'), // User who referred this user
    createdAt: text('created_at').default(sql`current_timestamp`),
});

export class User extends BaseModel {
    static entity = 'users';
    static table = usersTable;
}
```

### 2. Signup Flow

```typescript
import { User } from './models/User';
import { ReferralTracking, validateReferralUsername } from '@ottabase/referrals';

export async function handleSignup(email: string, name: string, referralCode?: string) {
    // Generate unique referral username
    const baseUsername = name.toLowerCase().replace(/\s+/g, '');
    let referralUsername = baseUsername;
    let counter = 1;

    while (await User.where('referralUsername', '=', referralUsername).exists()) {
        referralUsername = `${baseUsername}${counter}`;
        counter++;
    }

    // Create user
    const user = await User.create({
        email,
        name,
        referralUsername,
    });

    // Handle referral attribution
    if (referralCode) {
        // Find tracking record
        const tracking = await ReferralTracking.where('referralCode', '=', referralCode).first();

        if (tracking && !tracking.referredUserId) {
            // Check if still within 90-day window
            const ageMs = Date.now() - new Date(tracking.createdAt).getTime();
            const daysSinceClick = ageMs / (1000 * 60 * 60 * 24);

            if (daysSinceClick < 90) {
                // Mark as converted
                await tracking.update({
                    referredUserId: user.id,
                    status: 'completed',
                    conversionAt: new Date(),
                });

                // Set referrer on user
                await user.update({ referredById: tracking.userId });

                // Optional: Issue reward
                await issueReferralReward(tracking.userId, user.id);
            }
        }
    }

    return user;
}
```

### 3. Tracking Component

```tsx
import { useEffect } from 'react';
import { ReferralTracking } from '@ottabase/referrals';

interface ReferralTrackerProps {
    referralCode?: string;
}

export function ReferralTracker({ referralCode }: ReferralTrackerProps) {
    useEffect(() => {
        if (!referralCode) return;

        async function trackClick() {
            try {
                await fetch('/api/referral/track', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ referralCode }),
                });
            } catch (err) {
                console.error('Failed to track referral', err);
            }
        }

        trackClick();
    }, [referralCode]);

    return null; // Invisible tracker component
}
```

### 4. API Endpoints

#### Track Referral Click

```typescript
// POST /api/referral/track
export async function POST(request: Request) {
    const { referralCode } = await request.json();

    if (!referralCode) {
        return Response.json({ error: 'Missing referral code' }, { status: 400 });
    }

    // Find referrer by code
    const referrer = await User.where('referralUsername', '=', referralCode).first();

    if (!referrer) {
        return Response.json({ error: 'Invalid referral code' }, { status: 404 });
    }

    // Create tracking record
    const tracking = await ReferralTracking.create({
        userId: referrer.id,
        referralCode,
        ipAddress: request.headers.get('x-forwarded-for') || '',
        userAgent: request.headers.get('user-agent') || '',
        referer: request.headers.get('referer') || '',
    });

    return Response.json({ success: true, trackingId: tracking.id });
}
```

#### Get Referral Stats

```typescript
// GET /api/referral/stats/:userId
export async function GET(request: Request, { userId }: { userId: string }) {
    const stats = {
        totalReferrals: 0,
        completedReferrals: 0,
        pendingReferrals: 0,
        totalReward: 0,
    };

    // Count total referral clicks
    const allTracking = await ReferralTracking.where('userId', '=', userId).get();
    stats.totalReferrals = allTracking.length;

    // Count completed conversions
    const completed = allTracking.filter((t) => t.status === 'completed');
    stats.completedReferrals = completed.length;

    // Count pending (within 90 days)
    const pending = allTracking.filter((t) => {
        if (t.status !== 'pending') return false;
        const ageMs = Date.now() - new Date(t.createdAt).getTime();
        return ageMs < 90 * 24 * 60 * 60 * 1000;
    });
    stats.pendingReferrals = pending.length;

    // Calculate total reward (e.g., $5 per conversion)
    stats.totalReward = stats.completedReferrals * 5;

    return Response.json(stats);
}
```

#### List Referrals

```typescript
// GET /api/referral/list?userId=XXX&page=1
export async function GET(request: Request) {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const page = parseInt(url.searchParams.get('page') || '1');

    if (!userId) {
        return Response.json({ error: 'Missing userId' }, { status: 400 });
    }

    const results = await ReferralTracking.where('userId', '=', userId).orderBy('createdAt', 'desc').paginate(page, 20);

    return Response.json(results);
}
```

### 5. Referral Dashboard

```tsx
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router';

interface ReferralStats {
    totalReferrals: number;
    completedReferrals: number;
    pendingReferrals: number;
    totalReward: number;
}

export function ReferralDashboard() {
    const { userId } = useParams();

    const { data: stats } = useQuery<ReferralStats>({
        queryKey: ['referral-stats', userId],
        queryFn: async () => {
            const res = await fetch(`/api/referral/stats/${userId}`);
            return res.json();
        },
    });

    const { data: referrals } = useQuery({
        queryKey: ['referrals', userId],
        queryFn: async () => {
            const res = await fetch(`/api/referral/list?userId=${userId}`);
            return res.json();
        },
    });

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-4 gap-4">
                <Card>
                    <div className="text-2xl font-bold">{stats?.totalReferrals}</div>
                    <p className="text-sm text-gray-600">Total Clicks</p>
                </Card>
                <Card>
                    <div className="text-2xl font-bold">{stats?.completedReferrals}</div>
                    <p className="text-sm text-gray-600">Completed</p>
                </Card>
                <Card>
                    <div className="text-2xl font-bold">{stats?.pendingReferrals}</div>
                    <p className="text-sm text-gray-600">Pending (90d)</p>
                </Card>
                <Card>
                    <div className="text-2xl font-bold">${stats?.totalReward}</div>
                    <p className="text-sm text-gray-600">Total Reward</p>
                </Card>
            </div>

            <div>
                <h2 className="text-xl font-semibold mb-4">Recent Referrals</h2>
                <table className="w-full">
                    <thead>
                        <tr className="border-b">
                            <th className="text-left py-2">Date</th>
                            <th className="text-left py-2">Status</th>
                            <th className="text-left py-2">IP Address</th>
                        </tr>
                    </thead>
                    <tbody>
                        {referrals?.data?.map((ref) => (
                            <tr key={ref.id} className="border-b hover:bg-gray-50">
                                <td className="py-2">{new Date(ref.createdAt).toLocaleDateString()}</td>
                                <td className="py-2">
                                    <span
                                        className={`px-2 py-1 rounded text-sm ${
                                            ref.status === 'completed'
                                                ? 'bg-green-100 text-green-800'
                                                : 'bg-yellow-100 text-yellow-800'
                                        }`}
                                    >
                                        {ref.status}
                                    </span>
                                </td>
                                <td className="py-2 text-sm text-gray-600">{ref.ipAddress}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
```

## Validation

Validate referral usernames:

```typescript
import { validateReferralUsername } from '@ottabase/referrals';

const result = validateReferralUsername('john_doe');
if (!result.valid) {
    console.error(result.error); // "Username must be 3-20 characters"
}

// Requirements:
// - 3-20 characters
// - Alphanumeric + underscore
// - No spaces or special characters
```

## Reward System

Example reward calculation:

```typescript
async function issueReferralReward(referrerId: string, referredUserId: string) {
    const REWARD_AMOUNT = 5; // $5 per referral

    // Add to user balance or create transaction
    const referrer = await User.find(referrerId);
    await referrer.increment('referralBalance', REWARD_AMOUNT);

    // Optional: Log transaction
    await Transaction.create({
        userId: referrerId,
        type: 'referral_reward',
        amount: REWARD_AMOUNT,
        metadata: { referredUserId },
    });
}
```

## Performance Notes

- **Indexed Queries** - `userId`, `referralCode`, and `status` are indexed
- **First-Touch Attribution** - Only first valid conversion counted
- **Auto-Expiry** - 90-day window handled in queries, no cleanup job needed
- **No Real-Time Limits** - Click tracking is lightweight, suitable for high traffic
