import { describe, expect, it } from 'vitest';
import { HttpTransport, MultiTransport } from '../index';
import { HttpTransport as DirectHttpTransport, MultiTransport as DirectMultiTransport } from '../transports';

describe('root transport exports', () => {
    it('exposes the transports documented for the primary entrypoint', () => {
        expect(HttpTransport).toBe(DirectHttpTransport);
        expect(MultiTransport).toBe(DirectMultiTransport);
    });
});
