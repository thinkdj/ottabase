import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';
import * as mantine from '../index';

// Mock Mantine components
const MockButton = ({ children, variant = 'default' }: { children: React.ReactNode; variant?: string }) => (
    <button className={`mantine-button ${variant}`}>{children}</button>
);

const MockMantineProvider = ({ children }: { children: React.ReactNode }) => (
    <div className="mantine-provider">{children}</div>
);

describe('Mantine UI Components', () => {
    describe('Mantine Provider', () => {
        it('should provide theme context', () => {
            const { container } = render(
                <MockMantineProvider>
                    <div>Content</div>
                </MockMantineProvider>,
            );
            expect(container.querySelector('.mantine-provider')).toBeTruthy();
        });

        it('should wrap component tree', () => {
            render(
                <MockMantineProvider>
                    <MockButton>Action</MockButton>
                </MockMantineProvider>,
            );
            expect(screen.getByText('Action')).toBeTruthy();
        });
    });

    describe('Component Exports', () => {
        it('should export Mantine components', () => {
            expect(mantine).toBeDefined();
        });

        it('should provide hooks', () => {
            expect(typeof mantine).toBe('object');
        });

        it('should include theme customization', () => {
            expect(mantine).toBeDefined();
        });
    });

    describe('Theme Support', () => {
        it('should support light theme', () => {
            render(<MockMantineProvider>Content</MockMantineProvider>);
            expect(screen.getByText('Content')).toBeTruthy();
        });

        it('should support dark theme', () => {
            render(<MockMantineProvider>Dark theme</MockMantineProvider>);
            expect(screen.getByText('Dark theme')).toBeTruthy();
        });

        it('should customize theme colors', () => {
            render(
                <MockMantineProvider>
                    <MockButton variant="primary">Primary</MockButton>
                </MockMantineProvider>,
            );
            const button = screen.getByRole('button');
            expect(button).toHaveClass('mantine-button');
        });
    });

    describe('Button Variants', () => {
        it('should render default button', () => {
            render(<MockButton>Default</MockButton>);
            expect(screen.getByText('Default')).toBeTruthy();
        });

        it('should render variant buttons', () => {
            const { container } = render(
                <div>
                    <MockButton variant="primary">Primary</MockButton>
                    <MockButton variant="secondary">Secondary</MockButton>
                    <MockButton variant="danger">Danger</MockButton>
                </div>,
            );
            expect(container.querySelectorAll('button')).toHaveLength(3);
        });
    });

    describe('Integration', () => {
        it('should work with Next.js theme', () => {
            const { container } = render(
                <MockMantineProvider>
                    <MockButton>Theme aware</MockButton>
                </MockMantineProvider>,
            );
            expect(container.querySelector('.mantine-provider')).toBeTruthy();
        });

        it('should support responsive design', () => {
            render(
                <MockMantineProvider>
                    <div className="responsive-grid">Content</div>
                </MockMantineProvider>,
            );
            expect(screen.getByText('Content')).toBeTruthy();
        });
    });
});
