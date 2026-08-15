import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const overrideAwarePrimitivePaths = [
    '../../components/ui/button.tsx',
    '../../components/ui/badge.tsx',
    '../../components/ui/card.tsx',
    '../../components/ui/input.tsx',
];

describe('override-aware primitives', () => {
    it.each(overrideAwarePrimitivePaths)('%s is marked as a client component', (relativePath) => {
        const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
        expect(source.startsWith("'use client';")).toBe(true);
    });
});
