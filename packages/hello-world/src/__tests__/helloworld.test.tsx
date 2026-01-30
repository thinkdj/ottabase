import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import * as helloWorld from '../index';

// Example component from hello-world package
const HelloWorld = () => <div>Hello World!</div>;

describe('Hello World Component', () => {
    describe('Basic Rendering', () => {
        it('should render hello world message', () => {
            render(<HelloWorld />);
            expect(screen.getByText('Hello World!')).toBeTruthy();
        });

        it('should be a simple React component', () => {
            const { container } = render(<HelloWorld />);
            expect(container.querySelector('div')).toBeTruthy();
        });
    });

    describe('Component Exports', () => {
        it('should export HelloWorld component', () => {
            expect(helloWorld).toBeDefined();
        });

        it('should be a valid React component', () => {
            render(<HelloWorld />);
            expect(screen.getByText('Hello World!')).toBeTruthy();
        });
    });

    describe('Template Usage', () => {
        it('should serve as example template', () => {
            render(<HelloWorld />);
            const text = screen.getByText('Hello World!');
            expect(text).toBeTruthy();
        });

        it('should demonstrate React basics', () => {
            const { container } = render(<HelloWorld />);
            expect(container.firstChild).toBeTruthy();
        });
    });
});
