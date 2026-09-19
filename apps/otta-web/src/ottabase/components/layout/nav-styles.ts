/**
 * Quiet text-link styles for the personal-blog chrome.
 * No pills, no rings — an underline is enough.
 */
export function navLinkClass(isActive: boolean): string {
    return [
        'px-0 py-1 text-[0.9375rem] tracking-[-0.01em] transition-colors duration-normal',
        isActive
            ? 'text-foreground underline decoration-foreground/30 underline-offset-[6px]'
            : 'text-muted-foreground hover:text-foreground hover:underline hover:decoration-foreground/20 hover:underline-offset-[6px]',
    ].join(' ');
}

export function isNavActive(pathname: string, to: string): boolean {
    if (to === '/') return pathname === '/' || pathname.startsWith('/blog');
    if (to === '/about') return pathname === '/about';
    return pathname === to || pathname.startsWith(`${to}/`);
}

export function drawerLinkClass(isActive: boolean): string {
    return [
        'px-1 py-2 text-base tracking-[-0.01em] transition-colors duration-normal',
        isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
    ].join(' ');
}
