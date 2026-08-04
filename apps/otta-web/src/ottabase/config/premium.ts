/**
 * Paid packages installed in this app — CLIENT-side mirror.
 *
 * The authoritative list is `ottabase/config.premium.ts`, which cannot be imported here:
 * a manifest carries server-side wiring (session resolution, route factories) that has no
 * place in a browser bundle.
 *
 * So this is a deliberate, MINIMAL duplicate — keys only, no behaviour — used to decide
 * which admin nav entries exist. `__tests__/premium-registration.test.ts` fails if the two
 * lists drift, which is what keeps the duplication honest.
 *
 * INSTALLED, NOT LICENSED: a page whose license has lapsed must stay reachable, or the
 * operator has no way to get to the screen that would fix it.
 */

import { WEBHOOKS_PACKAGE_KEY } from '@ottabase/premium-webhooks';

export const PREMIUM_PACKAGES_INSTALLED: readonly string[] = [WEBHOOKS_PACKAGE_KEY];

/** Is a paid package installed in this deployment? Says nothing about its license. */
export function isPremiumPackageInstalled(key: string): boolean {
    return PREMIUM_PACKAGES_INSTALLED.includes(key);
}
