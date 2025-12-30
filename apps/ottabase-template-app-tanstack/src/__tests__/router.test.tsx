import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { APP_META } from '@/ottabase/config/app.config';

/**
 * Simple example test for the TanStack template app
 * This demonstrates how to test React components
 */

// Simple component from router for testing
function HomeRouteComponent() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-4xl font-bold">{APP_META.appName}</h1>
      <p className="text-muted-foreground">{APP_META.description}</p>

      <p className="text-sm text-muted-foreground">
        Built with <strong>Vite</strong>, <strong>TanStack Router</strong>, and
        <strong> TanStack Query</strong>. Deploys to{' '}
        <strong>Cloudflare Workers</strong> (assets served by the Worker).
      </p>
    </div>
  );
}

describe('HomeRouteComponent', () => {
  it('should render app name', () => {
    render(<HomeRouteComponent />);

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent(APP_META.appName);
  });

  it('should render app description', () => {
    render(<HomeRouteComponent />);

    expect(screen.getByText(APP_META.description)).toBeInTheDocument();
  });

  it('should mention TanStack Router', () => {
    render(<HomeRouteComponent />);

    expect(screen.getByText(/TanStack Router/i)).toBeInTheDocument();
  });

  it('should mention Cloudflare Workers', () => {
    render(<HomeRouteComponent />);

    const elements = screen.getAllByText(/Cloudflare Workers/i);
    expect(elements.length).toBeGreaterThan(0);
    expect(elements[0]).toBeInTheDocument();
  });
});
