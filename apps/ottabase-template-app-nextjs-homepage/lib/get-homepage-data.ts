import {
    buildHomepagePublicPayloadV1,
    safeParseHomepagePublicPayloadV1,
    type HomepagePublicPayloadV1,
} from '@ottabase/homepage-contract';
import { cache } from 'react';
import { themePreset as defaultThemePreset } from '../config/brand.config';

export type HomepagePayload = HomepagePublicPayloadV1;

const EMPTY: HomepagePayload = buildHomepagePublicPayloadV1([], null, defaultThemePreset);

/**
 * Fetches versioned homepage payload from the TanStack worker (Zod-validated v1).
 */
export const getHomepageData = cache(async (): Promise<HomepagePayload> => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3004';
    try {
        const response = await fetch(`${baseUrl}/api/homepage/data`, {
            headers: { Accept: 'application/json' },
            next: { revalidate: 60 },
        });
        if (!response.ok) {
            console.error('Homepage API error:', response.status, response.statusText);
            return EMPTY;
        }
        const json: unknown = await response.json();
        const parsed = safeParseHomepagePublicPayloadV1(json);
        if (!parsed) {
            console.error('Homepage API returned invalid v1 payload');
            return EMPTY;
        }
        return parsed;
    } catch (e) {
        console.error('getHomepageData failed:', e);
        return EMPTY;
    }
});
