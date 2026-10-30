import { CodeBlock } from '@ottabase/ui-code-highlight';
import type { BlockRenderer } from '../types';

export interface CodeBlockData {
    code: string;
    language?: string;
    showLineNumbers?: boolean;
    lineNumberStart?: number;
    maxHeight?: string;
    wrapLongLines?: boolean;
    hideHeader?: boolean;
    hideCopyButton?: boolean;
    highlightLines?: string;
    tabSize?: number;
    collapsible?: boolean;
    collapsibleThreshold?: number;
}

/** Syntax-highlighted code via @ottabase/ui-code-highlight; the host imports that package's stylesheet. */
const Code: BlockRenderer<CodeBlockData> = ({ data }) => {
    if (!data?.code) return null;
    return (
        <div className="otta-code not-prose">
            <CodeBlock
                code={data.code}
                language={data.language || 'plaintext'}
                showLineNumbers={data.showLineNumbers}
                lineNumberStart={data.lineNumberStart}
                maxHeight={data.maxHeight}
                wrapLongLines={data.wrapLongLines}
                hideHeader={data.hideHeader}
                hideCopyButton={data.hideCopyButton}
                highlightLines={data.highlightLines}
                tabSize={data.tabSize}
                collapsible={data.collapsible}
                collapsibleThreshold={data.collapsibleThreshold}
                className="otta-code__block"
            />
        </div>
    );
};

export default Code;
