import { definePackage, type OttaPackage, type PackageExtras } from '@ottabase/kernel';
import { Shortlink, shortlinksTable } from './ottaorm-models/Shortlink';

export const SHORTLINKS_PACKAGE_KEY = 'shortlinks';

export type ShortlinksPackageOptions<Env> = PackageExtras<Env>;

/**
 * The shortlinks package as the app registers it. The package owns the table and the
 * model; the host adds the routes, because the redirect and the admin API need the host's
 * session, analytics binding and interstitial branding.
 */
export function createShortlinksPackage<Env = unknown>(options: ShortlinksPackageOptions<Env> = {}): OttaPackage<Env> {
    return definePackage<Env>({
        key: SHORTLINKS_PACKAGE_KEY,
        name: 'Shortlinks',
        version: '1.0.0',
        description: 'Short URLs with expiry, interstitial pages and click analytics.',
        tables: { shortlinksTable },
        models: [Shortlink],
        ...options,
    });
}
