/**
 * Global URL notices. Mounted once at the router root.
 *
 * On every navigation: read `?notice=<code>`, show the registered toast (unless a page claims
 * the code inline), then replace the URL without the parameter so a refresh, Back or a copied
 * link never re-fires it. Unknown codes are ignored and still stripped.
 */
import { resolveNotice, type NoticeDefinition } from '@/ottabase/config/notices';
import { toast } from '@ottabase/ui';
import { claimNotice, parkNotice } from '@ottabase/kernel/client';
import { readNotice } from '@ottabase/utils/url';
import { useLocation, useRouter } from '@tanstack/react-router';
import { useEffect, useMemo, useRef } from 'react';

export interface HandledNotice {
    code: string;
    notice: NoticeDefinition | null;
    /** The same location without the notice parameter. */
    cleanHref: string;
}

/**
 * Pure core of the handler: what to show and where to replace to. Null when the URL carries
 * no notice parameter at all.
 */
export function handleNoticeLocation(pathname: string, search: string, hash: string): HandledNotice | null {
    if (!search.includes('notice')) return null;
    const { code, search: cleaned } = readNotice(search);
    if (code === null && cleaned === search) return null;
    return {
        code: code ?? '',
        notice: resolveNotice(code),
        cleanHref: `${pathname}${cleaned}${hash}`,
    };
}

export function showNoticeToast(notice: NoticeDefinition, code: string): void {
    const options = { id: `notice:${code}`, description: notice.title ? notice.message : undefined };
    const text = notice.title ?? notice.message;
    toast[notice.type](text, options);
}

export function UrlNotices() {
    const router = useRouter();
    const location = useLocation();
    const handled = useRef<string | null>(null);

    useEffect(() => {
        const hash = location.hash ? `#${location.hash}` : '';
        const href = `${location.pathname}${location.searchStr}${hash}`;
        if (handled.current === href) return; // StrictMode double-run and same-location re-renders
        handled.current = href;
        const result = handleNoticeLocation(location.pathname, location.searchStr, hash);
        if (!result) return;
        // Toast what the registry says to toast. Park everything else (inline codes, and codes a
        // package page owns that the app registry does not list) for the page to claim.
        if (result.notice && !result.notice.inline) showNoticeToast(result.notice, result.code);
        else if (result.code) parkNotice(result.code, location.pathname);
        router.history.replace(result.cleanHref);
    }, [location.pathname, location.searchStr, location.hash, router]);

    return null;
}

/**
 * A page claims an inline notice: the definition when the URL carries one of `codes` (or any
 * `inline` code when none are given), or when the root handler already parked it for this page.
 * Captured on first render, so it survives the parameter being stripped.
 */
export function useNotice(codes?: readonly string[]): (NoticeDefinition & { code: string }) | null {
    const location = useLocation();
    const captured = useRef<(NoticeDefinition & { code: string }) | null | undefined>(undefined);
    return useMemo(() => {
        if (captured.current !== undefined) return captured.current;
        const code = claimNotice(
            (candidate) => {
                const notice = resolveNotice(candidate);
                return Boolean(notice) && (codes ? codes.includes(candidate) : Boolean(notice?.inline));
            },
            { pathname: location.pathname, search: location.searchStr },
        );
        const notice = resolveNotice(code);
        captured.current = code && notice ? { ...notice, code } : null;
        return captured.current;
    }, [location.searchStr, location.pathname, codes]);
}
