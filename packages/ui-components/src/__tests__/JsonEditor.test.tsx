import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { JsonEditor } from '../index';

describe('JsonEditor', () => {
    it('renders tree mode by default with keys and values', () => {
        render(<JsonEditor value={{ name: 'Otta', count: 42, enabled: true }} />);
        expect(screen.getByText('"name"', { exact: false })).toBeTruthy();
        expect(screen.getByText('"Otta"')).toBeTruthy();
        expect(screen.getByText('42')).toBeTruthy();
        expect(screen.getByText('true')).toBeTruthy();
    });

    it('edits a string value inline and emits onChange with the new object', () => {
        const onChange = vi.fn();
        render(<JsonEditor value={{ title: 'hello' }} onChange={onChange} />);

        // Click the value to enter edit mode
        fireEvent.click(screen.getByText('"hello"'));
        const input = screen.getByDisplayValue('hello') as HTMLInputElement;
        fireEvent.change(input, { target: { value: 'world' } });
        fireEvent.keyDown(input, { key: 'Enter' });

        expect(onChange).toHaveBeenCalledWith({ title: 'world' });
    });

    it('toggles a boolean on click', () => {
        const onChange = vi.fn();
        render(<JsonEditor value={{ enabled: false }} onChange={onChange} />);
        fireEvent.click(screen.getByText('false'));
        expect(onChange).toHaveBeenCalledWith({ enabled: true });
    });

    it('switches to raw mode and shows a validation error for bad JSON', () => {
        const onChange = vi.fn();
        render(<JsonEditor value={{ a: 1 }} onChange={onChange} />);
        fireEvent.click(screen.getByRole('button', { name: 'Raw' }));
        const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
        fireEvent.change(textarea, { target: { value: '{"a": 1,' } });
        expect(screen.getByText('Invalid JSON')).toBeTruthy();
    });

    it('emits parsed value when raw JSON is valid', () => {
        const onChange = vi.fn();
        render(<JsonEditor value={{}} onChange={onChange} />);
        fireEvent.click(screen.getByRole('button', { name: 'Raw' }));
        const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
        fireEvent.change(textarea, { target: { value: '{"x": 2}' } });
        expect(onChange).toHaveBeenCalledWith({ x: 2 });
    });

    it('respects readOnly by not calling onChange on boolean click', () => {
        const onChange = vi.fn();
        render(<JsonEditor value={{ enabled: true }} onChange={onChange} readOnly />);
        const btn = screen.getByText('true') as HTMLButtonElement;
        expect(btn.disabled).toBe(true);
        fireEvent.click(btn);
        expect(onChange).not.toHaveBeenCalled();
    });
});
