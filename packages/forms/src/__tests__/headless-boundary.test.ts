import { describe, it, expect } from 'vitest';
// Import the PURE root barrel (what consumers get from `@ottabase/forms`).
// NOTE: rendered components (ModelForm, ModelCrud, ModelTable, ModelDetail,
// FormField) deliberately do NOT live here — they moved to the
// `@ottabase/forms/react` subpath (src/react.ts). This test guards that
// boundary. It must NOT import any UI package or component.
import * as forms from '../index';

describe('headless boundary (@ottabase/forms root entry)', () => {
    it('resolves the pure config builders', () => {
        expect(typeof forms.createModelConfig).toBe('function');
        expect(typeof forms.defineModelConfig).toBe('function');
    });

    it('produces a usable config without touching any rendered UI', () => {
        const config = forms.defineModelConfig({
            entity: 'todos',
            fields: {
                id: { type: 'id', primaryKey: true },
                title: { type: 'string', editable: true, validation: { rules: 'required' } },
            },
        });
        expect(config.entity).toBe('todos');
        expect(config.zodCreateSchema).toBeDefined();
    });

    it('does NOT re-export rendered components (they live under /react)', () => {
        // Value exports for the 5 components must be absent from the pure entry.
        const surface = forms as Record<string, unknown>;
        expect(surface.FormField).toBeUndefined();
        expect(surface.ModelForm).toBeUndefined();
        expect(surface.ModelTable).toBeUndefined();
        expect(surface.ModelDetail).toBeUndefined();
        expect(surface.ModelCrud).toBeUndefined();
    });
});
