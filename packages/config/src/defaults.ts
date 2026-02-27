import type { ThemeColors } from './types';

export const DEFAULT_THEME_COLORS: ThemeColors = {
    primary: [
        '#f7eefb',
        '#ebdaf2',
        '#d6b0e6',
        '#c085dc',
        '#ae60d2',
        '#a349cc',
        '#9e3dca',
        '#8a30b3',
        '#7b29a0',
        '#6b218d',
    ],
    tremorBlue: [
        '#e5f3ff',
        '#cee2ff',
        '#9ec2fd',
        '#6aa1fa',
        '#3e84f6',
        '#2272f5',
        '#0d69f5',
        '#0058db',
        '#004ec5',
        '#0043af',
    ],
};

export const DEFAULT_EMAIL_CONFIG = {
    from: 'noreply@example.com',
    sesRegion: 'us-east-1',
} as const;

export const DEFAULT_AUTH_BEHAVIOR_CONFIG = {
    sessionMaxAge: 30 * 24 * 60 * 60, // 30 days
    requireEmailVerified: false,
    disableCredentials: false,
    verbose: false,
} as const;
