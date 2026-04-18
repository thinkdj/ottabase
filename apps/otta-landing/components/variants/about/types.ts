import type { ReactNode } from 'react';

/** Default GitHub URL used across about-page variants. */
export const DEFAULT_GITHUB_URL = 'https://github.com/thinkdj/ottabase';

/** Canonical data contract for every about-page variant. */
export type AboutData = {
    /** Page title */
    title?: ReactNode;
    /** Short description under the title */
    description?: string;
    /** GitHub repo URL */
    githubUrl?: string;
};
