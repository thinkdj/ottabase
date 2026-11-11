import { describe, expect, it } from 'vitest';
import { rejectScannerProbe } from '../killswitch';

describe('rejectScannerProbe', () => {
    it('404s scanner paths', () => {
        for (const p of [
            '/wp-login.php',
            '/wp-admin/index.php',
            '/wp-admin',
            '/blog/xmlrpc.php',
            '/.env',
            '/api/.env.local',
            '/.git/config',
            '/WordPress/',
            '/cgi-bin/x',
        ])
            expect(rejectScannerProbe(p)?.status, p).toBe(404);
    });

    it('passes real app paths', () => {
        for (const p of [
            '/',
            '/blog/wp-tips',
            '/api/auth/session',
            '/.well-known/security.txt',
            '/assets/app.js',
            '/environment',
            '/wpa',
        ])
            expect(rejectScannerProbe(p), p).toBeNull();
    });
});
