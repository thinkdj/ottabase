/**
 * TypeScript type definitions for i18next
 * This provides type-safe translations throughout the application
 */

import 'i18next';
import { resources, defaultNS } from './config';

declare module 'i18next' {
    interface CustomTypeOptions {
        defaultNS: typeof defaultNS;
        resources: (typeof resources)['en'];
    }
}
