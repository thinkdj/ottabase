// ============================================================
// Entrypoint boundaries.
//
// The root export must stay headless: a Worker bundle that accidentally pulls a
// component library in through `@ottabase/premium` fails at DEPLOY time, in a stack
// trace about `document`, long after the import that caused it was reviewed.
// ============================================================

import { describe, expect, it } from 'vitest';
import * as root from '../index';
import * as server from '../server/index';
import * as licenseTools from '../license-tools';

describe('root entrypoint', () => {
    it('exports the headless surface', () => {
        expect(typeof root.definePremiumPackage).toBe('function');
        expect(typeof root.createPremiumRegistry).toBe('function');
        expect(typeof root.verifyLicense).toBe('function');
        expect(typeof root.checkFeature).toBe('function');
    });

    it('exports no rendered React', () => {
        const rendered = Object.keys(root).filter((name) =>
            /^(Premium(Gate|Badge|Upsell|Provider)|use[A-Z])/.test(name),
        );
        expect(rendered).toEqual([]);
    });

    it('does not leak the license MINTING helpers — those belong to the vendor', () => {
        expect('issueLicense' in root).toBe(false);
        expect('generateLicenseKeypair' in root).toBe(false);
        expect(typeof licenseTools.issueLicense).toBe('function');
        expect(typeof licenseTools.generateLicenseKeypair).toBe('function');
    });
});

describe('server entrypoint', () => {
    it('exposes the guards and the mounting helpers', () => {
        expect(typeof server.requirePremium).toBe('function');
        expect(typeof server.requirePremiumFeature).toBe('function');
        expect(typeof server.requirePremiumLimit).toBe('function');
        expect(typeof server.mountPremiumPackages).toBe('function');
        expect(typeof server.createPremiumAdminRouter).toBe('function');
    });
});
