import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Warning from './Warning';

describe('Warning', () => {
    it('renders a note with an icon well, title and message stacked', () => {
        const { container } = render(
            <Warning
                data={{ title: 'Important <b>Note</b>', message: 'Always back up before changing production.' }}
            />,
        );
        const note = container.querySelector('aside[role="note"].otta-warning')!;
        expect(note).toBeTruthy();
        expect(note.querySelector('.otta-warning__icon svg')).toBeTruthy();
        const body = note.querySelector('.otta-warning__body')!;
        expect(body.querySelector('.otta-warning__title strong')?.textContent).toBe('Note');
        expect(body.querySelector('.otta-warning__text')?.textContent).toContain('Always back up');
        expect(screen.getByText(/Always back up/)).toBeTruthy();
    });

    it('renders nothing when both fields are empty', () => {
        const { container } = render(<Warning data={{}} />);
        expect(container.firstChild).toBeNull();
    });
});
