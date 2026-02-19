import { RenderFn } from 'editorjs-blocks-react-renderer';
import { CodeBlock } from '@ottabase/ui-code-highlight';

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

const Code: RenderFn<CodeBlockData> = ({ data }) => {
    const { code, language = 'plaintext' } = data;
    return (
        <div className="cdc-content-code my-4 pt-1">
            <CodeBlock
                code={code}
                language={language || 'plaintext'}
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
                className="cdc-content-code-block"
            />
        </div>
    );
};

export default Code;
