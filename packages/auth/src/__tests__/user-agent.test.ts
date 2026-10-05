import { describe, expect, it } from 'vitest';
import { describeUserAgent } from '../user-agent';

describe('describeUserAgent', () => {
    it.each([
        [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
            'Chrome on Windows',
        ],
        [
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Version/17.4 Safari/604.1',
            'Safari on iPhone',
        ],
        ['Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) Gecko/20100101 Firefox/125.0', 'Firefox on macOS'],
        ['Mozilla/5.0 (Windows NT 10.0) Chrome/124.0 Safari/537.36 Edg/124.0', 'Edge on Windows'],
        ['Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/124.0 Mobile Safari/537.36', 'Chrome on Android'],
        ['curl/8.4.0', 'Unknown device'],
        [null, 'Unknown device'],
    ])('reads %s', (ua, expected) => {
        expect(describeUserAgent(ua)).toBe(expected);
    });
});
