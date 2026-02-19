import { describe, expect, it } from 'vitest';
import { RBACError } from '../types';

describe('RBACError', () => {
    it('creates error with message and default code FORBIDDEN', () => {
        const err = new RBACError('Access denied');
        expect(err.message).toBe('Access denied');
        expect(err.name).toBe('RBACError');
        expect(err.code).toBe('FORBIDDEN');
        expect(err.details).toBeUndefined();
    });

    it('accepts code UNAUTHORIZED', () => {
        const err = new RBACError('Not logged in', 'UNAUTHORIZED');
        expect(err.code).toBe('UNAUTHORIZED');
    });

    it('accepts details', () => {
        const err = new RBACError('Invalid permission', 'INVALID_PERMISSION', { permission: 'x:y' });
        expect(err.details).toEqual({ permission: 'x:y' });
    });
});
