import type { ReactNode } from 'react';

/** Canonical data contract for every about-page variant. */
export type AboutData = {
    /** Page title */
    title?: ReactNode;
    /** Short description under the title */
    description?: string;
    /** GitHub repo URL */
    githubUrl?: string;
};
