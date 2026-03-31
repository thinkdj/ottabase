'use client';

import '@ottabase/ottarenderer/styles';
import { Blocks, customRenderers, defaultEJSRConfigs } from '@ottabase/ottarenderer';

type Props = {
    content: unknown;
};

function hasEditorBlocks(content: unknown): content is Record<string, unknown> {
    if (!content || typeof content !== 'object') return false;
    const blocks = (content as { blocks?: unknown }).blocks;
    return Array.isArray(blocks) && blocks.length > 0;
}

export function MarketingPageContent({ content }: Props) {
    if (!hasEditorBlocks(content)) {
        return null;
    }
    return (
        <div className="marketing-prose prose prose-neutral max-w-none dark:prose-invert prose-headings:scroll-mt-20 prose-p:leading-relaxed">
            <Blocks data={content as never} config={{ ...defaultEJSRConfigs }} renderers={customRenderers} />
        </div>
    );
}
