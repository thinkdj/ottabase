import { describe, expect, it } from 'vitest';
import { handleNoticeLocation } from '../UrlNotices';

describe('handleNoticeLocation', () => {
    it('resolves a known code and strips only the notice parameter', () => {
        const result = handleNoticeLocation('/anything', '?notice=coming-soon&x=1', '#h');
        expect(result?.code).toBe('coming-soon');
        expect(result?.notice?.type).toBe('info');
        expect(result?.cleanHref).toBe('/anything?x=1#h');
    });

    it('ignores an unknown code but still strips it, and does nothing without the parameter', () => {
        const unknown = handleNoticeLocation('/x', '?notice=no-such-code', '');
        expect(unknown?.notice).toBeNull();
        expect(unknown?.cleanHref).toBe('/x');
        expect(handleNoticeLocation('/x', '?other=1', '')).toBeNull();
    });

    it('marks the login codes inline so the page renders them itself', () => {
        expect(handleNoticeLocation('/login', '?notice=email-verified', '')?.notice?.inline).toBe(true);
        expect(handleNoticeLocation('/login', '?notice=auth.oauth-signin', '')?.notice?.type).toBe('error');
    });
});
