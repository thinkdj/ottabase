/** Canonical data contract for every footer variant. */
export type FooterLink = {
    href: string;
    label: string;
    external?: boolean;
};

export type FooterData = {
    siteName?: string;
    links?: FooterLink[];
    tagline?: string;
};
