// Design System v1 pieces: the status map drives the chip, markup never names a colour.
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';
import { Button } from '../../components/ui/button';
import { Stat } from '../../components/ui/stat';
import { Status, StatusChip } from '../../components/ui/status';
import { STATUS_LANGUAGE, statusOf } from '../../components/ui/status-language';

describe('status language', () => {
    it('maps every license state to a tone, a label and an icon', () => {
        for (const state of ['active', 'grace', 'expired', 'invalid', 'unlicensed', 'disabled'] as const) {
            const entry = STATUS_LANGUAGE.license[state];
            expect(entry.tone).toBeDefined();
            expect(entry.label.length).toBeGreaterThan(0);
            expect(entry.icon).toBeDefined();
        }
        expect(statusOf('license', 'grace').tone).toBe('amber');
        expect(statusOf('fleet', 'unreachable').tone).toBe('red');
        expect(statusOf('cron', 'never').tone).toBe('neutral');
    });

    it('falls back to a neutral chip labelled with the raw value', () => {
        const entry = statusOf('job', 'exploded');
        expect(entry.tone).toBe('neutral');
        expect(entry.label).toBe('exploded');
    });
});

describe('<Status> and <StatusChip>', () => {
    it('stamps the tone and the label from the map', () => {
        render(<Status domain="license" value="expired" />);
        const chip = screen.getByText('Expired');
        expect(chip.getAttribute('data-tone')).toBe('red');
        expect(chip.getAttribute('data-slot')).toBe('status-chip');
    });

    it('shows a dot by default and the icon when asked', () => {
        const { container, rerender } = render(<StatusChip tone="green">Active</StatusChip>);
        expect(container.querySelector('svg')).toBeNull();
        rerender(<Status domain="license" value="active" withIcon />);
        expect(container.querySelector('svg')).not.toBeNull();
    });
});

describe('<Button loading>', () => {
    it('keeps the label in the DOM, disables the button and marks it busy', () => {
        render(<Button loading>Run backup</Button>);
        const button = screen.getByRole('button', { name: /run backup/i });
        expect(button.hasAttribute('disabled')).toBe(true);
        expect(button.getAttribute('aria-busy')).toBe('true');
        expect(button.querySelector('[data-slot="spinner"]')).not.toBeNull();
    });

    it('exposes the danger outline as its own variant', () => {
        render(<Button variant="danger">Remove app</Button>);
        expect(screen.getByRole('button').getAttribute('data-variant')).toBe('danger');
    });
});

describe('<Stat>', () => {
    it('renders a button that reports its pressed state when clickable', () => {
        render(<Stat label="Checks failing" value={1} unit=" of 31" tone="red" pressed onClick={() => {}} />);
        const tile = screen.getByRole('button');
        expect(tile.getAttribute('aria-pressed')).toBe('true');
        expect(tile.getAttribute('data-tone')).toBe('red');
        expect(tile.textContent).toContain('1 of 31');
    });

    it('is a plain tile without an onClick', () => {
        const { container } = render(<Stat label="Packages" value={14} />);
        expect(container.querySelector('button')).toBeNull();
        expect(container.querySelector('[data-slot="stat"]')?.tagName).toBe('DIV');
    });
});
