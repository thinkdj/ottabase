import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { MarketingPage, PageAction, PageFeature, PageSection } from '../../ottabase/models/MarketingPage';
import type { ApiRouteContext } from './router';

type BlockDefinition = {
    id: string;
    label: string;
    category: 'layout' | 'navigation' | 'custom';
    variants: Array<{ id: string; label: string }>;
    fields: Array<{ id: string; label: string; type: 'text' | 'textarea' | 'url' | 'boolean' }>;
};

/** Built-in block definitions. Apps can register additional blocks via registerCustomBlock(). */
const BUILT_IN_BLOCKS: BlockDefinition[] = [
    {
        id: 'hero',
        label: 'Hero',
        category: 'layout',
        variants: [
            { id: 'centered', label: 'Centered' },
            { id: 'split', label: 'Split' },
            { id: 'minimal', label: 'Minimal' },
        ],
        fields: [
            { id: 'title', label: 'Title', type: 'text' },
            { id: 'subtitle', label: 'Subtitle', type: 'text' },
            { id: 'body', label: 'Body', type: 'textarea' },
        ],
    },
    {
        id: 'features',
        label: 'Features',
        category: 'layout',
        variants: [
            { id: 'grid', label: 'Grid' },
            { id: 'cards', label: 'Cards' },
            { id: 'list', label: 'List' },
        ],
        fields: [
            { id: 'title', label: 'Title', type: 'text' },
            { id: 'subtitle', label: 'Subtitle', type: 'text' },
        ],
    },
    {
        id: 'cta',
        label: 'CTA',
        category: 'layout',
        variants: [
            { id: 'default', label: 'Default' },
            { id: 'banner', label: 'Banner' },
            { id: 'minimal', label: 'Minimal' },
        ],
        fields: [
            { id: 'title', label: 'Title', type: 'text' },
            { id: 'body', label: 'Body', type: 'textarea' },
        ],
    },
    {
        id: 'about',
        label: 'About',
        category: 'layout',
        variants: [
            { id: 'default', label: 'Default' },
            { id: 'minimal', label: 'Minimal' },
            { id: 'detailed', label: 'Detailed' },
        ],
        fields: [
            { id: 'title', label: 'Title', type: 'text' },
            { id: 'subtitle', label: 'Subtitle', type: 'text' },
            { id: 'body', label: 'Body', type: 'textarea' },
        ],
    },
    {
        id: 'navbar',
        label: 'Navbar',
        category: 'navigation',
        variants: [
            { id: 'default', label: 'Default' },
            { id: 'centered', label: 'Centered' },
            { id: 'minimal', label: 'Minimal' },
        ],
        fields: [{ id: 'title', label: 'Site Name', type: 'text' }],
    },
    {
        id: 'footer',
        label: 'Footer',
        category: 'navigation',
        variants: [
            { id: 'default', label: 'Default' },
            { id: 'minimal', label: 'Minimal' },
            { id: 'columns', label: 'Columns' },
        ],
        fields: [{ id: 'title', label: 'Footer Title', type: 'text' }],
    },
];

/** Runtime-registered custom blocks from the app. */
const customBlocks: BlockDefinition[] = [
    {
        id: 'app-value-grid',
        label: 'App: Value Grid',
        category: 'custom',
        variants: [{ id: 'default', label: 'Default' }],
        fields: [
            { id: 'title', label: 'Title', type: 'text' },
            { id: 'body', label: 'Body', type: 'textarea' },
        ],
    },
];

/**
 * Register a custom block from app code. This allows each app
 * to extend the block registry with its own components.
 */
export function registerCustomBlock(block: BlockDefinition): void {
    if (!customBlocks.some((b) => b.id === block.id)) {
        customBlocks.push(block);
    }
}

/** Combined block registry (built-in + custom). Dynamically includes runtime-registered blocks. */
export function getBlockRegistry(): BlockDefinition[] {
    return [...BUILT_IN_BLOCKS, ...customBlocks];
}

/** @deprecated Use getBlockRegistry() for a live snapshot. Kept for backward compat. */
export const BLOCK_REGISTRY = BUILT_IN_BLOCKS;

export async function handleBlocksRegistry(context: ApiRouteContext): Promise<Response> {
    return jsonResponse({ blocks: getBlockRegistry(), updatedAt: Date.now() });
}

export async function handleMarketingPageNav(context: ApiRouteContext): Promise<Response> {
    const appId = context.request.headers.get('x-app-id') || 'ottabase-template-app';
    const pages = await MarketingPage.where(
        { appId, status: 'published' },
        { orderBy: 'updatedAt', orderDirection: 'desc' },
    );

    return jsonResponse({
        pages: pages.map((page) => ({
            id: page.get('id'),
            slug: page.get('slug'),
            title: page.get('title'),
            status: page.get('status'),
            updatedAt: page.get('updatedAt'),
        })),
    });
}

export async function handleMarketingPageBySlug(context: ApiRouteContext, slug: string): Promise<Response> {
    const appId = context.request.headers.get('x-app-id') || 'ottabase-template-app';
    const preview = context.url.searchParams.get('preview') === 'true';

    const page = await MarketingPage.first({ slug, appId });
    if (!page) {
        return errorResponse('Page not found', 404);
    }

    const status = String(page.get('status') || 'draft');
    if (status !== 'published' && !preview) {
        return errorResponse('Page not found', 404);
    }

    const sections = await PageSection.where({ pageId: page.get('id') });
    const sortedSections = sections
        .filter((section) => Boolean(section.get('enabled')))
        .sort((a, b) => Number(a.get('sortOrder')) - Number(b.get('sortOrder')));

    const fullSections = await Promise.all(
        sortedSections.map(async (section) => {
            const sectionId = String(section.get('id'));
            const features = await PageFeature.where({ sectionId });
            const actions = await PageAction.where({ sectionId });
            return {
                id: sectionId,
                slot: section.get('slot'),
                variant: section.get('variant'),
                title: section.get('title'),
                subtitle: section.get('subtitle'),
                body: section.get('body'),
                enabled: section.get('enabled'),
                sortOrder: section.get('sortOrder'),
                features: features
                    .sort((a, b) => Number(a.get('sortOrder')) - Number(b.get('sortOrder')))
                    .map((feature) => feature.toJSON()),
                actions: actions
                    .sort((a, b) => Number(a.get('sortOrder')) - Number(b.get('sortOrder')))
                    .map((action) => action.toJSON()),
            };
        }),
    );

    return jsonResponse({
        page: {
            ...page.toJSON(),
            sections: fullSections,
        },
    });
}
