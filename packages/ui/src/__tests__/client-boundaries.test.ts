import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const readComponent = (file: string) => fs.readFileSync(path.join(process.cwd(), 'components', 'ui', file), 'utf8');

const overrideAwarePrimitives = ['badge.tsx', 'button.tsx', 'card.tsx', 'input.tsx'];

// Composed components that hold their own state or effects.
const statefulComposedComponents = ['dark-mode-toggle.tsx', 'json-editor.tsx', 'split-pane.tsx'];

describe('React Server Component boundaries', () => {
    it.each(overrideAwarePrimitives)('%s declares a client boundary before using brand component context', (file) => {
        expect(readComponent(file).startsWith("'use client';")).toBe(true);
    });

    it.each(statefulComposedComponents)('%s declares a client boundary before using hooks', (file) => {
        expect(readComponent(file).startsWith("'use client';")).toBe(true);
    });
});
