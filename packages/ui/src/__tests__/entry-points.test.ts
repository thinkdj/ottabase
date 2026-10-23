import { describe, expect, it } from 'vitest';

import * as jsonEditorEntry from '../../components/ui/json-editor';
import * as providersEntry from '../providers';
import * as root from '../index';

describe('@ottabase/ui entry points', () => {
    it('exports the primitives, the composed components and the providers from the root', () => {
        const expected = [
            // Primitives and Design System v1 pieces
            'Button',
            'Card',
            'Dialog',
            'AlertDialog',
            'Input',
            'Pagination',
            'Spinner',
            'PageHeader',
            'Stat',
            'Status',
            // Composed components (formerly @ottabase/ui-components and @ottabase/ui-split-pane)
            'ConfirmDialog',
            'DarkModeToggle',
            'MessageBox',
            'SplitPane',
            // Helpers and providers
            'cn',
            'toast',
            'ThemeProvider',
            'UIProviders',
            'BrandComponentsProvider',
            'BrandScope',
        ];
        for (const name of expected) {
            expect(root, name).toHaveProperty(name);
        }
    });

    it('keeps JsonEditor off the root and ships it on its own entry', () => {
        expect(root).not.toHaveProperty('JsonEditor');
        expect(jsonEditorEntry.JsonEditor).toBeTypeOf('function');
    });

    it('exposes the providers on the providers entry', () => {
        expect(providersEntry.UIProviders).toBeTypeOf('function');
        expect(providersEntry.ThemeProvider).toBeTypeOf('function');
    });
});
