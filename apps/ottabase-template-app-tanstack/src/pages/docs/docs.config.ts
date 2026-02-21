import type { DocsConfig, DocsSource } from '@ottabase/docs';
import { extractTitle, fileNameToSlug, slugToTitle } from '@ottabase/docs';

/**
 * Load markdown files from Vite's import.meta.glob result into a DocsSource.
 * Usage: createDocsSource('Guides', import.meta.glob('/docs/*.md', { eager: true, query: '?raw', import: 'default' }))
 */
export function createDocsSource(
    label: string,
    modules: Record<string, string | (() => Promise<string>)>,
    options?: { basePath?: string; order?: number },
): DocsSource {
    const pages = Object.entries(modules)
        .map(([filePath, content]) => {
            const fileName = filePath.split('/').pop() || '';
            const slug = fileNameToSlug(fileName);
            let title = slugToTitle(slug);
            if (typeof content === 'string') {
                const extracted = extractTitle(content);
                if (extracted !== 'Untitled') title = extracted;
            }
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

/**
 * Create a DocsSource from package README files.
 * @param modules - Vite glob result for package READMEs
 * @param options.prefix - Package name prefix (default: '@ottabase/')
 * @param options.order - Sort order for this source
 */
export function createPackageSource(
    modules: Record<string, string | (() => Promise<string>)>,
    options?: { prefix?: string; order?: number },
): DocsSource {
    const prefix = options?.prefix ?? '@ottabase/';
    const pages = Object.entries(modules)
        .map(([filePath, content]) => {
            const parts = filePath.split('/');
            const pkgIndex = parts.indexOf('packages');
            const pkgName = pkgIndex >= 0 ? parts[pkgIndex + 1] : 'unknown';

            let title = `${prefix}${pkgName}`;
            if (typeof content === 'string') {
                const extracted = extractTitle(content);
                if (extracted !== 'Untitled') title = extracted;
            }

            return { slug: pkgName, title, content, sourcePath: filePath, order: 50 };
        })
        .sort((a, b) => a.title.localeCompare(b.title));

    return {
        label: 'Packages',
        basePath: 'packages',
        order: options?.order ?? 10,
        pages,
    };
}

// --- Load documentation sources ---

// 1. Docs directory (repo root /docs/)
const guidesModules = import.meta.glob('/../../docs/*.md', { query: '?raw', import: 'default' }) as Record<
    string,
    () => Promise<string>
>;

// 2. Package READMEs (toggle on/off by commenting this line)
const packageModules = import.meta.glob('/../../packages/*/README.md', {
    query: '?raw',
    import: 'default',
}) as Record<string, () => Promise<string>>;

export const docsConfig: DocsConfig = {
    title: 'Ottabase Docs',
    basePath: '/docs',
    theme: 'spacious',
    codeRenderMode: 'ui-code-highlight',
    sources: [
        createDocsSource('Guides', guidesModules, { basePath: 'guides', order: 0 }),
        // Set to empty {} to disable package READMEs
        createPackageSource(packageModules, { prefix: '@ottabase/', order: 10 }),
    ],
};
