const DEFAULT_API_URL = 'http://localhost:3004';

export function getWorkerApiUrl() {
    return process.env.NEXT_PUBLIC_TANSTACK_API_URL || DEFAULT_API_URL;
}

export async function fetchMarketingPage(slug: string, preview: boolean) {
    const url = `${getWorkerApiUrl()}/api/pages/${slug}${preview ? '?preview=true' : ''}`;
    const response = await fetch(url, {
        next: { revalidate: preview ? 0 : 60 },
    });

    if (!response.ok) {
        return null;
    }

    return (await response.json()) as { page: any };
}

export async function fetchMarketingNav() {
    const response = await fetch(`${getWorkerApiUrl()}/api/pages/nav`, {
        next: { revalidate: 60 },
    });

    if (!response.ok) {
        return { pages: [] as Array<{ slug: string }> };
    }

    return (await response.json()) as { pages: Array<{ slug: string }> };
}
