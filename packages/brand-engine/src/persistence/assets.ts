// ---------------------------------------------------------------------------
// Brand Engine – logo assets
// The package stores no bytes itself. The host hands each upload route a BrandAssetClient
// backed by its files service (purpose `brand-asset`: public, SVG allowed and served under
// the sandbox CSP), so sniffing, the allow-list, metadata stripping and the bucket rules are
// the app's one pipeline. A kit stores only the public storage key; URLs are built from it.
// ---------------------------------------------------------------------------

export type LogoType = 'logo' | 'logo-dark' | 'icon' | 'og-image' | 'email-logo';

/** The BrandKit column each logo type is stored in. */
export const LOGO_KEY_FIELDS: Record<LogoType, string> = {
    logo: 'logoKey',
    'logo-dark': 'logoDarkKey',
    icon: 'iconKey',
    'og-image': 'ogImageKey',
    'email-logo': 'emailLogoKey',
};

export interface BrandAssetClient {
    /** Store an uploaded logo: its public storage key, or the Response refusing it (type, size, quota). */
    upload(file: File, type: LogoType): Promise<string | Response>;
    /** Delete a stored logo by its key. Never throws: a leftover file must not fail a kit change. */
    remove(key: string): Promise<void>;
    /** The public URL of a key. */
    url(key: string): string;
}
