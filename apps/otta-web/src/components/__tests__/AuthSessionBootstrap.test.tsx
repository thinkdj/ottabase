import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const { useSessionBootstrap } = vi.hoisted(() => ({ useSessionBootstrap: vi.fn() }));

vi.mock('@/lib/auth', () => ({ useSessionBootstrap }));

import { AuthSessionBootstrap } from '../AuthSessionBootstrap';

describe('AuthSessionBootstrap', () => {
    it('is the sole app-root owner of session initialization', () => {
        render(<AuthSessionBootstrap />);

        expect(useSessionBootstrap).toHaveBeenCalledOnce();
        expect(useSessionBootstrap).toHaveBeenCalledWith();
    });
});
