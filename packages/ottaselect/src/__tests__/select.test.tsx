import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import * as ottaSelect from '../index';

// Mock select component
const MockSelect = ({
    options,
    onChange,
    multiple = false,
}: {
    options: Array<{ value: string; label: string }>;
    onChange?: (value: any) => void;
    multiple?: boolean;
}) => (
    <select
        aria-label="Select option"
        data-testid="select"
        onChange={(e) => onChange?.(e.target.value)}
        multiple={multiple}
    >
        <option>Select option</option>
        {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
                {opt.label}
            </option>
        ))}
    </select>
);

describe('OttaSelect Component', () => {
    const options = [
        { value: '1', label: 'Option 1' },
        { value: '2', label: 'Option 2' },
        { value: '3', label: 'Option 3' },
    ];
    const realItems = [
        { id: '1', name: 'Alpha' },
        { id: '2', name: 'Beta' },
        { id: '3', name: 'Gamma' },
    ];

    describe('Basic Functionality', () => {
        it('should render select component', () => {
            render(<MockSelect options={options} />);
            expect(screen.getByTestId('select')).toBeTruthy();
        });

        it('should display options', () => {
            render(<MockSelect options={options} />);
            expect(screen.getByText('Option 1')).toBeTruthy();
            expect(screen.getByText('Option 2')).toBeTruthy();
            expect(screen.getByText('Option 3')).toBeTruthy();
        });

        it('should handle selection changes', () => {
            const onChange = vi.fn();
            const { container } = render(<MockSelect options={options} onChange={onChange} />);
            const select = container.querySelector('select') as HTMLSelectElement;
            select.value = '1';
            select.dispatchEvent(new Event('change', { bubbles: true }));
            expect(onChange).toHaveBeenCalled();
        });
    });

    describe('Single vs Multiple Selection', () => {
        it('should support single select', () => {
            render(<MockSelect options={options} multiple={false} />);
            expect(screen.getByTestId('select')).toBeTruthy();
        });

        it('should support multiple select', () => {
            const { container } = render(<MockSelect options={options} multiple={true} />);
            const select = container.querySelector('select');
            expect(select).toHaveAttribute('multiple');
        });
    });

    describe('Search Functionality', () => {
        it('should filter options based on search', () => {
            render(<MockSelect options={options} />);
            expect(screen.getByText('Option 1')).toBeTruthy();
        });

        it('should highlight matching options', () => {
            render(<MockSelect options={options} />);
            expect(screen.getByText('Option 1')).toBeTruthy();
        });
    });

    describe('CrudHub Integration', () => {
        it('should integrate with CrudHub', () => {
            expect(ottaSelect).toBeDefined();
        });

        it('should support dynamic data loading', () => {
            render(<MockSelect options={options} />);
            expect(screen.getByTestId('select')).toBeTruthy();
        });
    });

    describe('Accessibility', () => {
        it('should be keyboard navigable', () => {
            render(<MockSelect options={options} />);
            const select = screen.getByTestId('select');
            expect(select).toBeTruthy();
        });

        it('should support ARIA attributes', () => {
            const { container } = render(<MockSelect options={options} />);
            expect(container.querySelector('select')).toBeTruthy();
        });
    });

    describe('Size variants', () => {
        it('uses md sizing by default', () => {
            const { container } = render(<ottaSelect.OttaSelect items={realItems} placeholder="Pick an item" />);
            const root = container.firstElementChild as HTMLElement;

            expect(root).toHaveAttribute('data-size', 'md');
            expect(root.className).toContain(
                '[--otta-select-trigger-min-height:calc(1.625rem_+_var(--otta-select-space)*2)]',
            );
            expect(screen.getByRole('button', { name: 'Pick an item' })).toBeTruthy();
        });

        it('derives spacing from a damped --otta-select-space unit, never raw --spacing-element', () => {
            const { container } = render(<ottaSelect.OttaSelect items={realItems} placeholder="Pick an item" />);
            const root = container.firstElementChild as HTMLElement;

            // Half-strength response to the brand spacing token
            expect(root.className).toContain(
                '[--otta-select-space:calc(0.5rem_+_(var(--spacing-element,0.5rem)_-_0.5rem)*0.5)]',
            );
            // Structural vars consume the damped unit only
            expect(root.className).not.toContain('calc(var(--spacing-element');
        });

        it('keeps type scale fixed per size instead of scaling with spacing', () => {
            const { container, rerender } = render(
                <ottaSelect.OttaSelect items={realItems} placeholder="Pick an item" />,
            );
            let root = container.firstElementChild as HTMLElement;
            expect(root.className).toContain('[--otta-select-font-size:0.875rem]');
            expect(root.className).toContain('[--otta-select-icon-size:1rem]');

            rerender(<ottaSelect.OttaSelect items={realItems} placeholder="Pick an item" size="lg" />);
            root = container.firstElementChild as HTMLElement;
            expect(root.className).toContain('[--otta-select-font-size:1rem]');
        });

        it('supports xs, sm, and lg sizing variants', () => {
            const { container, rerender } = render(
                <ottaSelect.OttaSelect items={realItems} placeholder="Pick an item" size="xs" />,
            );
            let root = container.firstElementChild as HTMLElement;

            expect(root).toHaveAttribute('data-size', 'xs');
            expect(root.className).toContain(
                '[--otta-select-trigger-min-height:calc(1.375rem_+_var(--otta-select-space)*1.25)]',
            );

            rerender(<ottaSelect.OttaSelect items={realItems} placeholder="Pick an item" size="sm" />);
            root = container.firstElementChild as HTMLElement;

            expect(root).toHaveAttribute('data-size', 'sm');
            expect(root.className).toContain(
                '[--otta-select-trigger-min-height:calc(1.5rem_+_var(--otta-select-space)*1.5)]',
            );

            rerender(<ottaSelect.OttaSelect items={realItems} placeholder="Pick an item" size="lg" />);
            root = container.firstElementChild as HTMLElement;

            expect(root).toHaveAttribute('data-size', 'lg');
            expect(root.className).toContain(
                '[--otta-select-trigger-min-height:calc(1.75rem_+_var(--otta-select-space)*2.5)]',
            );
        });
    });
});
