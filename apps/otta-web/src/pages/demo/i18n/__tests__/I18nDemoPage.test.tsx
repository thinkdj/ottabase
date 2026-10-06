import { I18nProvider, i18n } from '@ottabase/i18n/react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The shared demo header needs the router; the page under test does not
vi.mock('../../DemoPageHeader', () => ({ DemoPageHeader: ({ title }: { title: string }) => <h1>{title}</h1> }));

import { I18nDemoPage } from '../I18nDemoPage';

describe('I18nDemoPage', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('previews another package language without changing the app language', async () => {
        render(
            <I18nProvider defaultLanguage="en">
                <I18nDemoPage />
            </I18nProvider>,
        );
        const preview = await screen.findByRole('group', { name: 'Preview language' });
        expect(screen.getAllByText('Save').length).toBeGreaterThan(0);

        fireEvent.click(screen.getByRole('button', { name: 'Español' }));
        expect(await screen.findByText('Guardar')).toBeInTheDocument();
        expect(screen.getByText('Bienvenido a Ottabase')).toBeInTheDocument();
        // The override table still speaks the app's language
        expect(screen.getAllByText('Save')).toHaveLength(1);
        expect(preview.querySelector('[aria-pressed="true"]')).toHaveTextContent('Español');

        // The app's own language and the saved choice are untouched
        expect(i18n.language).toBe('en');
        expect(localStorage.getItem('ottabase.language')).not.toBe('es');
    });
});
