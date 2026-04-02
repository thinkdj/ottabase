'use client';

import { Blocks, customRenderers, defaultEJSRConfigs } from '@ottabase/ottarenderer';
import '@ottabase/ottarenderer/styles';
import type { PageData } from '../../../lib/api';

export function PageContent({ page }: { page: PageData }) {
    const hasContent = page.content?.blocks && page.content.blocks.length > 0;

    return (
        <article className="mx-auto max-w-4xl px-4 py-12">
            <header className="mb-8">
                <h1 className="text-4xl font-bold text-foreground md:text-5xl">{page.title}</h1>
                {page.excerpt && <p className="mt-4 text-lg text-muted-foreground">{page.excerpt}</p>}
            </header>

            {page.heroImage?.url && (
                <div className="mb-8 overflow-hidden rounded-lg">
                    <img
                        src={page.heroImage.url}
                        alt={page.heroImage.alt || page.title}
                        className="w-full object-cover"
                    />
                    {page.heroImage.caption && (
                        <p className="mt-2 text-center text-sm text-muted-foreground">{page.heroImage.caption}</p>
                    )}
                </div>
            )}

            {hasContent && (
                <div className="prose prose-slate dark:prose-invert max-w-none">
                    {/* Provide defaults for optional EditorJS fields (time, version) required by DataProp */}
                    <Blocks
                        data={{ ...page.content!, time: page.content!.time ?? 0, version: page.content!.version ?? '' }}
                        renderers={customRenderers}
                        config={defaultEJSRConfigs}
                    />
                </div>
            )}
        </article>
    );
}
