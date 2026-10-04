/**
 * Navigate from code that sits above <RouterProvider> (global providers such as
 * the command palette), where router hooks are unavailable. router.tsx registers
 * the real implementation at startup; until then it falls back to a full load.
 */

type Navigate = (href: string) => void;

let navigateImpl: Navigate = (href) => window.location.assign(href);

export function registerAppNavigate(navigate: Navigate): void {
    navigateImpl = navigate;
}

export function appNavigate(href: string): void {
    navigateImpl(href);
}
