import { describe, it, expect } from 'vitest';
import {
    parseCurrencyValue,
    formatCurrencyValue,
    getCurrencySymbol,
    getCurrencyInfo,
    getSupportedCurrencies,
} from '../currency';

describe('Currency Utilities', () => {
    describe('parseCurrencyValue', () => {
        it('should parse currency strings with symbols', () => {
            expect(parseCurrencyValue('₹1,112.78')).toBe(1112.78);
            expect(parseCurrencyValue('$1,000.00')).toBe(1000);
            expect(parseCurrencyValue('€500,50')).toBe(50050);
        });

        it('should parse plain numbers', () => {
            expect(parseCurrencyValue(1000)).toBe(1000);
            expect(parseCurrencyValue(99.99)).toBe(99.99);
        });

        it('should handle negative numbers', () => {
            expect(parseCurrencyValue('-$100')).toBe(100);
        });

        it('should return null for invalid inputs', () => {
            expect(parseCurrencyValue('invalid')).toBeNull();
            expect(parseCurrencyValue(null as any)).toBeNull();
            expect(parseCurrencyValue(undefined as any)).toBeNull();
        });
    });

    describe('getCurrencySymbol', () => {
        it('should return correct symbols for valid currencies', () => {
            expect(getCurrencySymbol('USD')).toBe('$');
            expect(getCurrencySymbol('EUR')).toBe('€');
            expect(getCurrencySymbol('INR')).toBe('₹');
            expect(getCurrencySymbol('GBP')).toBe('£');
        });

        it('should return empty string for unknown currencies', () => {
            expect(getCurrencySymbol('XYZ')).toBe('');
            expect(getCurrencySymbol('')).toBe('');
        });
    });

    describe('getCurrencyInfo', () => {
        it('should return currency info for valid codes', () => {
            const usdInfo = getCurrencyInfo('USD');
            expect(usdInfo).not.toBeNull();
            expect(usdInfo?.cur).toBe('USD');
            expect(usdInfo?.symbol).toBe('$');
            expect(usdInfo?.locale).toBe('en-US');
        });

        it('should return null for unknown currencies', () => {
            expect(getCurrencyInfo('XYZ')).toBeNull();
            expect(getCurrencyInfo('')).toBeNull();
        });
    });

    describe('getSupportedCurrencies', () => {
        it('should return array of all currencies', () => {
            const currencies = getSupportedCurrencies();
            expect(Array.isArray(currencies)).toBe(true);
            expect(currencies.length).toBeGreaterThan(0);
        });

        it('should include common currencies', () => {
            const currencies = getSupportedCurrencies();
            const codes = currencies.map((c) => c.cur);
            expect(codes).toContain('USD');
            expect(codes).toContain('EUR');
            expect(codes).toContain('INR');
        });

        it('should return independent copy', () => {
            const currencies1 = getSupportedCurrencies();
            const currencies2 = getSupportedCurrencies();
            currencies1.pop();
            expect(currencies1.length).not.toBe(currencies2.length);
        });
    });

    describe('formatCurrencyValue', () => {
        it('should format valid currency values', () => {
            const formatted = formatCurrencyValue(1000, 'USD');
            expect(formatted).toContain('1,000');
            expect(formatted).toContain('$');
        });

        it('should handle invalid currencies gracefully', () => {
            expect(formatCurrencyValue(100, 'XYZ')).toBe('');
            expect(formatCurrencyValue(NaN, 'USD')).toBe('');
        });

        it('should respect decimal places parameter', () => {
            const formatted2 = formatCurrencyValue(100.5, 'USD', 2);
            const formatted0 = formatCurrencyValue(100.5, 'USD', 0);
            expect(formatted2).toContain('100');
            expect(formatted0).toContain('101');
        });
    });
});
