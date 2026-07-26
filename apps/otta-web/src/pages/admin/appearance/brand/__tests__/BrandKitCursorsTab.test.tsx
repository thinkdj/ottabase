import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { BrandKitCursorsTab } from '../BrandKitCursorsTab';

// Seed a kit that themes half of the cursor states, so the preview has both
// themed and native tiles to assert on.
const TOKENS = JSON.stringify({
    cursors: {
        default: 'registry:arrow-azure',
        pointer: 'registry:hand-azure',
        text: 'registry:text-beam',
        grab: 'registry:hand-emerald',
        crosshair: 'registry:crosshair',
    },
});

const renderTab = (tokensJson = TOKENS) =>
    render(<BrandKitCursorsTab tokensJson={tokensJson} onTokensChange={vi.fn()} />);

describe('BrandKitCursorsTab preview', () => {
    it('renders a light and a dark surface with a themed-state count', () => {
        renderTab();
        expect(screen.getByText('Light')).toBeInTheDocument();
        expect(screen.getByText('Dark')).toBeInTheDocument();
        // 5 of the 10 states are themed in TOKENS, on each surface
        expect(screen.getAllByText('5/10 themed')).toHaveLength(2);
    });

    it('renders one tile per affordance, titled with its resolved cursor source', () => {
        renderTab();
        // Two surfaces, so every tile appears twice
        expect(screen.getAllByTitle('pointer — registry:hand-azure')).toHaveLength(2);
        expect(screen.getAllByTitle('help — native help')).toHaveLength(2);
        expect(screen.getAllByTitle('default — registry:arrow-azure')).toHaveLength(2);
    });

    it('reports the hovered cursor in the surface readout', () => {
        renderTab();
        const surface = screen.getAllByTitle('pointer — registry:hand-azure')[0].closest('.rounded-xl')!;
        expect(within(surface as HTMLElement).getByText('Hover to test')).toBeInTheDocument();

        fireEvent.mouseOver(screen.getAllByTitle('pointer — registry:hand-azure')[0]);
        expect(within(surface as HTMLElement).getByText('pointer')).toBeInTheDocument();
        expect(within(surface as HTMLElement).getByText('registry:hand-azure')).toBeInTheDocument();
    });

    it('swaps grab for grabbing while the drag tile is held down', () => {
        renderTab();
        const tile = screen.getAllByTitle('grab — registry:hand-emerald')[0];
        const surface = tile.closest('.rounded-xl') as HTMLElement;
        const grabCursor = tile.style.cursor;

        fireEvent.mouseOver(tile);
        fireEvent.mouseDown(tile);
        expect(within(surface).getByText('grabbing')).toBeInTheDocument();
        expect(tile.style.cursor).not.toBe(grabCursor);

        fireEvent.mouseUp(tile);
        expect(within(surface).getByText('registry:hand-emerald')).toBeInTheDocument();
    });

    it('clears the readout when the pointer leaves the surface', () => {
        renderTab();
        const tile = screen.getAllByTitle('move — native move')[0];
        const surface = tile.closest('.rounded-xl') as HTMLElement;

        fireEvent.mouseOver(tile);
        expect(within(surface).getByText('native move')).toBeInTheDocument();

        fireEvent.mouseOut(surface);
        expect(within(surface).getByText('Hover to test')).toBeInTheDocument();
    });

    it('falls back to native cursors when no cursors are configured', () => {
        renderTab('{}');
        expect(screen.getAllByText('0/10 themed')).toHaveLength(2);
        expect(screen.getAllByTitle('default — native default')).toHaveLength(2);
    });
});
