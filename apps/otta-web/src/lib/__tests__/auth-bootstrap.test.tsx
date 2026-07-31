import { renderHook } from '@testing-library/react';
import { Provider } from 'jotai';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { globalStore } from '@/ottabase/state/appState';

vi.mock('@ottabase/auth/react', () => {
    const sessionState = {
        session: null,
        user: null,
        isAuthenticated: false,
        isInitialized: true,
        isLoading: false,
        sessionError: null,
        login: vi.fn(),
        logout: vi.fn(),
        updateUser: vi.fn(),
        refreshSession: vi.fn(),
    };

    return {
        AUTH_SESSION_INVALIDATED_EVENT: 'ottabase:auth-session-invalidated',
        AUTH_STORAGE_KEY: 'ottabase.auth-session',
        useSession: () => sessionState,
        useSessionBootstrap: () => sessionState,
    };
});

import { useSessionBootstrap } from '../auth';

describe('useSessionBootstrap', () => {
    it('can own app auth state without requiring a QueryClient', () => {
        const wrapper = ({ children }: { children: ReactNode }) => <Provider store={globalStore}>{children}</Provider>;

        expect(() => renderHook(() => useSessionBootstrap(), { wrapper })).not.toThrow();
    });
});
