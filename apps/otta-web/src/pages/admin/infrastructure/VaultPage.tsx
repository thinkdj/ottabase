/**
 * Vault (admin) — backups to R2, restore, and the licensed schedule and tenant export.
 *
 * The route is ALWAYS registered: a paid page that vanishes when the license lapses gives a
 * bookmarked link a 404 and no explanation. There is no license check written here;
 * `<VaultSettings />` gates its paid cards from the same server-resolved entitlements the
 * API enforces, and the free tier (backup, restore, delete) renders either way.
 */

import { premiumRequest } from '@/lib/premium';
import { PremiumProvider } from '@ottabase/premium/react';
import { VaultSettings } from '@ottabase/vault/react';
import { Archive } from 'lucide-react';

export function VaultPage() {
    return (
        <PremiumProvider basePath="/api/premium" request={premiumRequest}>
            <div className="max-w-4xl space-y-8">
                <div className="space-y-1.5">
                    <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
                        <Archive className="h-6 w-6 text-muted-foreground" />
                        Vault
                    </h1>
                    <p className="max-w-3xl text-muted-foreground">
                        Every D1 table in your own R2 bucket as NDJSON. Take a backup before a risky migration and
                        restore it in one transaction; a license runs it nightly and keeps the history pruned.
                    </p>
                </div>

                <VaultSettings />
            </div>
        </PremiumProvider>
    );
}
