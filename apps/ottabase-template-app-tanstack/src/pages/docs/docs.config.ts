import type { DocsConfig, DocsSource } from '@ottabase/docs';
import { extractTitle, fileNameToSlug } from '@ottabase/docs';

/**
 * Load markdown files from Vite's import.meta.glob result into a DocsSource.
 * Usage: createDocsSource('Guides', import.meta.glob('/docs/*.md', { eager: true, query: '?raw', import: 'default' }))
 */
export function createDocsSource(
    label: string,
    modules: Record<string, string>,
    options?: { basePath?: string; order?: number },
): DocsSource {
    const pages = Object.entries(modules)
        .map(([filePath, content]) => {
            const fileName = filePath.split('/').pop() || '';
            const slug = fileNameToSlug(fileName);
            const title = extractTitle(content) || fileName.replace(/\.(md|mdx)$/i, '');
            return { slug, title, content, sourcePath: filePath, order: slug === 'index' ? 0 : 50 };
        })
        .sort((a, b) => a.order - b.order);

    return {
        label,
        basePath: options?.basePath,
        order: options?.order ?? 0,
        pages,
    };
}

// --- Load documentation sources ---

// 1. Docs directory (repo root /docs/)
const guidesModules = import.meta.glob('/docs/*.md', { eager: true, query: '?raw', import: 'default' }) as Record<
    string,
    string
>;

// 2. Package READMEs
const packageModules = import.meta.glob('/../../packages/*/README.md', {
    eager: true,
    query: '?raw',
    import: 'default',
}) as Record<string, string>;

// Transform package README paths to use package name as slug
function createPackageSource(): DocsSource {
    const pages = Object.entries(packageModules)
        .map(([filePath, content]) => {
            // Extract package name from path like /../../packages/utils/README.md
            const parts = filePath.split('/');
            const pkgIndex = parts.indexOf('packages');
            const pkgName = pkgIndex >= 0 ? parts[pkgIndex + 1] : 'unknown';
            const title = extractTitle(content) || pkgName;
            return { slug: pkgName, title, content, sourcePath: filePath, order: 50 };
        })
        .sort((a, b) => a.title.localeCompare(b.title));

    return {
        label: 'Packages',
        basePath: 'packages',
        order: 10,
        pages,
    };
}

export const docsConfig: DocsConfig = {
    title: 'Ottabase Docs',
    basePath: '/docs',
    sources: [createDocsSource('Guides', guidesModules, { basePath: 'guides', order: 0 }), createPackageSource()],
};
