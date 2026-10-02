import { describe, expect, it } from 'vitest';
import { BufferedTransport, FilterTransport, HttpTransport, MultiTransport } from '../index';
import {
    BufferedTransport as DirectBufferedTransport,
    FilterTransport as DirectFilterTransport,
    HttpTransport as DirectHttpTransport,
    MultiTransport as DirectMultiTransport,
} from '../transports';

describe('root transport exports', () => {
    it('exposes the transports documented for the primary entrypoint', () => {
        expect(HttpTransport).toBe(DirectHttpTransport);
        expect(MultiTransport).toBe(DirectMultiTransport);
        expect(BufferedTransport).toBe(DirectBufferedTransport);
        expect(FilterTransport).toBe(DirectFilterTransport);
    });
});
