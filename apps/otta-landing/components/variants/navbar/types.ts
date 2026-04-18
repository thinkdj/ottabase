/** Canonical data contract for every navbar variant. */
export type NavLink = {
    href: string;
    label: string;
    external?: boolean;
};

export type NavbarData = {
    title?: string;
    links?: NavLink[];
    githubUrl?: string;
};
