import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { BlogPagination } from '../components/BlogPagination';

const labels = () =>
    Array.from(screen.getByRole('navigation', { name: 'Pagination' }).querySelectorAll('button, span')).map((el) =>
        el.textContent?.trim(),
    );

describe('BlogPagination', () => {
    it('lists every page when there are seven or fewer', () => {
        render(<BlogPagination page={2} lastPage={5} onPageChange={vi.fn()} />);
        expect(labels()).toEqual(['Previous', '1', '2', '3', '4', '5', 'Next']);
    });

    it('collapses a long range around the current page', () => {
        render(<BlogPagination page={6} lastPage={12} onPageChange={vi.fn()} />);
        expect(labels()).toEqual(['Previous', '1', '...', '5', '6', '7', '...', '12', 'Next']);
        expect(screen.getByRole('button', { name: '6' })).toHaveAttribute('aria-current', 'page');
    });

    it('moves by one page and stops at the ends', () => {
        const onPageChange = vi.fn();
        render(<BlogPagination page={1} lastPage={3} onPageChange={onPageChange} />);

        expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
        fireEvent.click(screen.getByRole('button', { name: 'Next' }));
        expect(onPageChange).toHaveBeenCalledWith(2);
        // Buttons never submit an enclosing form
        expect(screen.getByRole('button', { name: 'Next' })).toHaveAttribute('type', 'button');
    });
});
