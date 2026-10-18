/**
 * Premium packages (admin)
 *
 * The operator's view of every paid add-on listed in `ottabase/packages.ts`:
 * what is installed, what state each license is in, and where to paste a key.
 *
 * The whole surface is the package's drop-in `<PremiumPackagesManager />`, so any
 * Ottabase app gets the same operator story without writing one. An app that sells
 * nothing sees an explicit "none installed" note rather than a blank panel.
 */

import { premiumRequest } from '@/lib/premium';
import { PremiumPackagesManager, PremiumProvider } from '@ottabase/premium/react';
import { PageHeader } from '@ottabase/ui-shadcn';

export function PremiumPackagesPage() {
    return (
        <PremiumProvider basePath="/api/premium" request={premiumRequest}>
            <div className="flex max-w-3xl flex-col gap-6">
                <PageHeader
                    title="Premium packages"
                    description="Paid add-ons installed in this app. Licenses are verified offline; no key ever leaves this deployment. A key set through an environment variable outranks one pasted here."
                />

                <PremiumPackagesManager />

                <p className="text-xs text-muted-foreground">
                    Install a package by adding its manifest to{' '}
                    <code className="rounded-[3px] border bg-muted px-1 py-0.5 font-mono text-foreground">
                        ottabase/packages.ts
                    </code>
                    , then run migrations so its tables exist. See{' '}
                    <code className="rounded-[3px] border bg-muted px-1 py-0.5 font-mono text-foreground">
                        docs/PREMIUM_PACKAGES.md
                    </code>
                    .
                </p>
            </div>
        </PremiumProvider>
    );
}
