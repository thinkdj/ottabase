import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility helper that merges Tailwind class strings while preserving intent.
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}
