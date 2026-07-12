# @ottabase/referrals — agent notes

Referral attribution: click/conversion tracking model plus username/expiry validation. Full docs: ./README.md

## Use when

- Adding referral links, first-touch attribution, or recording signup conversions.
- Validating referral usernames or checking the 90-day expiry window.
- NOT for per-click analytics — clicks go to Cloudflare Analytics Engine via @ottabase/analytics, not this table.

## Imports

    import { ReferralTracking, referralTrackingTable } from '@ottabase/referrals';
    import { validateReferralUsername, isReferralExpired, REFERRAL_EXPIRY_MS } from '@ottabase/referrals';
    import type { ReferralTrackingInsert, ReferralTrackingRecord, ValidationResult } from '@ottabase/referrals';

Also exported: REFERRAL_USERNAME_MIN_LENGTH / MAX_LENGTH / PATTERN.

## Canonical usage

    const result = validateReferralUsername(input); // { valid, error? }
    if (!result.valid) return errorResponse(400, result.error);

    // Convert a pending referral on signup (fat model — logic lives on ReferralTracking)
    const [tracking] = await ReferralTracking.findPendingByCode(code);
    if (tracking && !isReferralExpired(tracking.get('createdAt') as number)) {
        await tracking.markCompleted(newUserId);
    }

    // Referrer dashboard
    const stats = await ReferralTracking.getStats(userId); // { total, completed, pending }
    const rows = await ReferralTracking.forUser(userId, { status: 'completed', limit: 20 });

## Wiring

1. Add to PACKAGE_REGISTRY in apps/*/ottabase/config.migrations.ts: `referrals: { tables: { referralTrackingTable }, migrations: [] }`.
2. Register the model in worker/lib/db-utils.ts registerModels: `...(packages.referrals ? [ReferralTracking] : [])`.
3. Re-export `referralTrackingTable` from the app's ottabase/db/schema.ts so drizzle migrations pick it up.

## Gotchas

- Only conversions hit the DB; clicks are written to Cloudflare Analytics Engine (@ottabase/analytics), not referral_tracking.
- `referer` column intentionally keeps the historical misspelled HTTP header name.
- Attribution expires after 90 days (REFERRAL_EXPIRY_MS); first valid code wins.
- Query helpers (forUser, findPendingByCode) require RLS context set via OttaORM before use.
