import { nodesToText, renderNodes, useInline } from '../inline';
import type { BlockRenderer } from '../types';

export interface ParagraphData {
    text?: string;
}

/** A paragraph of rich text. An empty one keeps its line so authored spacing survives. */
const Paragraph: BlockRenderer<ParagraphData> = ({ data }) => {
    const nodes = useInline(data?.text);
    const hasBreak = nodes.some((n) => typeof n !== 'string' && n.tag === 'br');
    if (!hasBreak && nodesToText(nodes) === '') {
        return <p className="otta-paragraph otta-paragraph--empty" aria-hidden="true" />;
    }
    return <p className="otta-paragraph">{renderNodes(nodes)}</p>;
};

export default Paragraph;
