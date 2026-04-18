import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DocsLayout } from '../components/DocsLayout';

const mockConfig = {
    title: 'Test Docs',
    basePath: '/docs',
    theme: 'standard' as const,
    sources: [
        {
            label: 'Guides',
            basePath: 'guides',
            pages: [{ slug: 'intro', title: 'Intro', content: '# Intro\nHello world.' }],
        },
    ],
};

describe('DocsLayout', () => {
    it('renders sidebar with theme switcher', () => {
        render(<DocsLayout config={mockConfig} activeSlug="guides/intro" />);

        const switcher = screen.getByRole('group', { name: /layout density/i });
        expect(switcher).toBeInTheDocument();

        const buttons = switcher.querySelectorAll('button');
        expect(buttons).toHaveLength(3);
        expect(buttons[0]).toHaveAttribute('title', 'Compact');
        expect(buttons[1]).toHaveAttribute('title', 'Standard');
        expect(buttons[2]).toHaveAttribute('title', 'Spacious');
    });

    it('calls onNavigate when clicking nav link', () => {
        const onNavigate = vi.fn();
        render(<DocsLayout config={mockConfig} activeSlug="guides/intro" onNavigate={onNavigate} />);

        fireEvent.click(screen.getByRole('button', { name: 'Intro' }));
        expect(onNavigate).toHaveBeenCalledWith('guides/intro');
    });

    it('persists theme to localStorage when switching', () => {
        const setItem = vi.spyOn(Storage.prototype, 'setItem');
        render(<DocsLayout config={mockConfig} activeSlug="guides/intro" />);

        const switcher = screen.getByRole('group', { name: /layout density/i });
        const compactBtn = switcher.querySelectorAll('button')[0];

        fireEvent.click(compactBtn!);
        expect(setItem).toHaveBeenCalledWith('ottabase.docs.theme', 'compact');

        setItem.mockRestore();
    });

    it('toggles mobile nav and closes on Escape', () => {
        const { container } = render(<DocsLayout config={mockConfig} activeSlug="guides/intro" />);

        const toggle = screen.getByRole('button', { name: /toggle navigation/i });
        const sidebar = container.querySelector('aside.otta-docs-sidebar');
        expect(sidebar).not.toHaveClass('otta-docs-sidebar-open');

        fireEvent.click(toggle);
        expect(sidebar).toHaveClass('otta-docs-sidebar-open');

        fireEvent.keyDown(window, { key: 'Escape' });
        expect(sidebar).not.toHaveClass('otta-docs-sidebar-open');
    });

    it('locks body scroll while mobile nav is open', () => {
        render(<DocsLayout config={mockConfig} activeSlug="guides/intro" />);

        const toggle = screen.getByRole('button', { name: /toggle navigation/i });
        expect(document.body.style.overflow).toBe('');

        fireEvent.click(toggle);
        expect(document.body.style.overflow).toBe('hidden');

        fireEvent.click(toggle);
        expect(document.body.style.overflow).toBe('');
    });
});
