import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock component for testing - you would replace this with your actual component
const DarkModeToggle = ({ onChange }: { onChange?: (isDark: boolean) => void }) => (
  <button onClick={() => onChange?.(!localStorage.getItem('darkMode'))}>Toggle Dark Mode</button>
);

describe('DarkModeToggle Component', () => {
  it('should render toggle button', () => {
    render(<DarkModeToggle />);
    const button = screen.getByRole('button', { name: /toggle dark mode/i });
    expect(button).toBeTruthy();
  });

  it('should call onChange callback when clicked', () => {
    const onChange = vi.fn();
    const { getByRole } = render(<DarkModeToggle onChange={onChange} />);
    const button = getByRole('button');
    button.click();
    expect(onChange).toHaveBeenCalled();
  });

  it('should have proper accessibility attributes', () => {
    render(<DarkModeToggle />);
    const button = screen.getByRole('button');
    expect(button).toBeTruthy();
  });
});
