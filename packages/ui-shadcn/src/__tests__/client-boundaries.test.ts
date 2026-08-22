import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const overrideAwarePrimitives = ['badge.tsx', 'button.tsx', 'card.tsx', 'input.tsx'];

describe('React Server Component boundaries', () => {
    it.each(overrideAwarePrimitives)('%s declares a client boundary before using brand component context', (file) => {
        const source = fs.readFileSync(path.join(process.cwd(), 'components', 'ui', file), 'utf8');
        expect(source.startsWith("'use client';")).toBe(true);
    });
});
