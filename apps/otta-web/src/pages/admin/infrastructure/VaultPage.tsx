/**
 * Vault (admin): backups to R2, restore, the nightly schedule and tenant export.
 */

import { VaultSettings } from '@ottabase/vault/react';
import { Archive } from 'lucide-react';

export function VaultPage() {
    return (
        <div className="max-w-4xl space-y-8">
            <div className="space-y-1.5">
                <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-[-0.015em]">
                    <Archive className="h-6 w-6 text-muted-foreground" />
                    Vault
                </h1>
                <p className="max-w-3xl text-muted-foreground">
                    Every D1 table in your own R2 bucket as NDJSON. Take a backup before a risky migration and restore
                    it in one transaction; the nightly run keeps the history pruned.
                </p>
            </div>

            <VaultSettings />
        </div>
    );
}
