import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createMantineTheme, mantineSlate, ProviderUIMantine, validateMantineThemeConfig } from '../index';

const TEN = [
    '#f0f9ff',
    '#e0f2fe',
    '#bae6fd',
    '#7dd3fc',
    '#38bdf8',
    '#0ea5e9',
    '#0284c7',
    '#0369a1',
    '#075985',
    '#0c4a6e',
] as const;
const brand = [...TEN] as unknown as [string, string, string, string, string, string, string, string, string, string];

describe('createMantineTheme', () => {
    it('lays the config over the preset and keeps what the preset had', () => {
        const theme = createMantineTheme(
            {
                baseTheme: 'mantine-slate',
                primaryColor: 'brand',
                colors: { brand },
                components: { Button: { defaultProps: { radius: 'xl' } } },
                designTokens: { brandBlur: '8px' },
            },
            mantineSlate,
        );
        expect(theme.primaryColor).toBe('brand');
        expect(theme.colors?.brand).toEqual(brand);
        expect(theme.colors).toMatchObject(mantineSlate.colors ?? {});
        expect(theme.components?.Button?.defaultProps?.radius).toBe('xl');
        expect(theme.other?.brandBlur).toBe('8px');
        for (const key of Object.keys(mantineSlate) as Array<keyof typeof mantineSlate>) {
            if (!['colors', 'components', 'other', 'primaryColor'].includes(key)) {
                expect(theme[key]).toEqual(mantineSlate[key]);
            }
        }
    });
});

describe('validateMantineThemeConfig', () => {
    it('names what is wrong, and nothing when nothing is', () => {
        expect(validateMantineThemeConfig({ baseTheme: 'mantine-slate', colors: { brand } })).toEqual([]);
        expect(
            validateMantineThemeConfig({
                baseTheme: '',
                primaryShade: 12 as never,
                colors: { brand: ['#fff'] as never },
            }),
        ).toEqual([
            'baseTheme is required',
            'primaryShade must be between 0 and 9',
            "Color 'brand' must be an array of exactly 10 hex colors",
        ]);
        expect(
            validateMantineThemeConfig({ baseTheme: 'x', colors: { brand: [...TEN.slice(0, 9), 'red'] as never } }),
        ).toEqual(["Color 'brand[9]' must be a valid hex color (e.g., #ffffff)"]);
    });
});

describe('ProviderUIMantine', () => {
    it('renders its children under the colour scheme it is given', () => {
        render(
            <ProviderUIMantine colorScheme="dark">
                <p>Hello</p>
            </ProviderUIMantine>,
        );
        expect(screen.getByText('Hello')).toBeTruthy();
        expect(document.documentElement.getAttribute('data-mantine-color-scheme')).toBe('dark');
    });
});
