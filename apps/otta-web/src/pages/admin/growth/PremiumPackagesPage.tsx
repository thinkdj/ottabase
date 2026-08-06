/**
 * Premium packages (admin)
 *
 * The operator's view of every paid add-on registered in `ottabase/config.premium.ts`:
 * what is installed, what state each license is in, and where to paste a key.
 *
 * The whole surface is the package's drop-in `<PremiumPackagesManager />`, so any
 * Ottabase app gets the same operator story without writing one. An app that sells
 * nothing sees an explicit "none installed" note rather than a blank panel.
 */

import { premiumRequest } from '@/lib/premium';
import { PremiumPackagesManager, PremiumProvider } from '@ottabase/premium/react';
import { Gem } from 'lucide-react';

export function PremiumPackagesPage() {
    return (
        <PremiumProvider basePath="/api/premium" request={premiumRequest}>
            <div className="max-w-3xl space-y-8">
                <div className="space-y-1.5">
                    <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
                        <Gem className="h-6 w-6 text-muted-foreground" />
                        Premium packages
                    </h1>
                    <p className="max-w-3xl text-muted-foreground">
                        Paid add-ons installed in this app. Licenses are verified offline — no key ever leaves this
                        deployment. A key set through an environment variable takes precedence over one pasted here.
                    </p>
                </div>

                <PremiumPackagesManager />

                <p className="text-xs text-muted-foreground">
                    Install a package by adding its manifest to{' '}
                    <code className="rounded bg-muted px-1 py-0.5 font-mono">ottabase/config.premium.ts</code>, then run
                    migrations so its tables exist. See{' '}
                    <code className="rounded bg-muted px-1 py-0.5 font-mono">docs/PREMIUM_PACKAGES.md</code>.
                </p>
            </div>
        </PremiumProvider>
    );
}
