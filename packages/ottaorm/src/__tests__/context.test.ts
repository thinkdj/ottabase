import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAllConnections, getConnection, hasConnection, registerConnection } from '../context';

describe('OttaORM Connection Registry (globalThis)', () => {
    beforeEach(() => {
        clearAllConnections();
    });

    afterEach(() => {
        clearAllConnections();
    });

    it('stores connections on globalThis', () => {
        const driver = { name: 'driver' };
        registerConnection('default', driver);

        const globalConnections = (globalThis as any).__OTTAORM_CONNECTIONS__;
        expect(globalConnections).toBeInstanceOf(Map);
        expect(globalConnections.has('default')).toBe(true);
        expect(globalConnections.get('default')).toBe(driver);
    });

    it('persists connections across module reloads', async () => {
        const driver = { name: 'driver' };
        registerConnection('default', driver);

        expect(hasConnection('default')).toBe(true);
        expect(getConnection('default')).toBe(driver);

        vi.resetModules();

        const reloaded = await import('../context');

        expect(reloaded.hasConnection('default')).toBe(true);
        expect(reloaded.getConnection('default')).toBe(driver);
    });
});
