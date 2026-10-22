import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    session: { isAuthenticated: false, isInitialized: true },
    signInWithProvider: vi.fn(),
    rememberReturnPath: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ useSession: () => mocks.session }));
vi.mock('@/lib/auth-api', () => ({ signInWithProvider: mocks.signInWithProvider }));
vi.mock('@/lib/auth-redirect', () => ({ rememberReturnPath: mocks.rememberReturnPath }));
vi.mock('@/components/RouteLoadingFallback', () => ({ RouteLoadingFallback: () => <div>loading</div> }));
vi.mock('@ottabase/ottaorm/client', () => ({
    useApiQuery: () => ({ data: { socialProviders: [{ id: 'github', name: 'GitHub' }] } }),
}));
vi.mock('@tanstack/react-router', () => ({
    Link: ({ to, children, onClick, className }: any) => (
        <a
            href={to}
            className={className}
            onClick={(event) => {
                event.preventDefault();
                onClick?.(event);
            }}
        >
            {children}
        </a>
    ),
}));

import { DemoAccountGate } from '../DemoAccountGate';
import { DEMO_ACCOUNT_GATES } from '../demoAccountGates';

const gate = DEMO_ACCOUNT_GATES['/demo/cloudflare/realtime'];

function renderGate() {
    return render(
        <DemoAccountGate gate={gate}>
            <p>the realtime demo</p>
        </DemoAccountGate>,
    );
}

describe('DemoAccountGate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.session.isAuthenticated = false;
        mocks.session.isInitialized = true;
        mocks.signInWithProvider.mockResolvedValue({ success: true });
    });

    it('renders the demo itself for a signed-in visitor', () => {
        mocks.session.isAuthenticated = true;
        renderGate();
        expect(screen.getByText('the realtime demo')).toBeInTheDocument();
    });

    it('shows an anonymous visitor the teaser instead of the demo', () => {
        renderGate();

        expect(screen.queryByText('the realtime demo')).not.toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Realtime pub/sub needs a free account' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Create a free account' })).toHaveAttribute('href', '/register');
        expect(screen.getAllByRole('img')[0]).toHaveAttribute('src', '/ottabase-demo/screenshots/realtime.webp');
    });

    it('remembers this page before sending the visitor to sign up or sign in', () => {
        renderGate();

        fireEvent.click(screen.getByRole('link', { name: 'Create a free account' }));
        fireEvent.click(screen.getByRole('link', { name: 'Sign in' }));

        expect(mocks.rememberReturnPath).toHaveBeenCalledTimes(2);
    });

    it('signs in with a configured provider and comes back to this page', () => {
        window.history.replaceState(null, '', '/demo/cloudflare/realtime');
        renderGate();

        fireEvent.click(screen.getByRole('button', { name: 'Continue with GitHub' }));

        expect(mocks.signInWithProvider).toHaveBeenCalledWith('github', { redirectTo: '/demo/cloudflare/realtime' });
    });

    it('waits for the session before deciding', () => {
        mocks.session.isInitialized = false;
        renderGate();
        expect(screen.getByText('loading')).toBeInTheDocument();
    });
});
