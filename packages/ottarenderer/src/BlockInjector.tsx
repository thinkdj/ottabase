import React from 'react';
import Blocks, { DataProp } from 'editorjs-blocks-react-renderer';
import { customRenderers, defaultEJSRConfigs } from './EditorJsRenderer';

type Injection = {
    position?: 'index' | 'beginning' | 'end' | 'middle' | 'random';
    index: number;
    component: React.ReactNode;
};

type BlockInjectorProps = {
    injections?: Injection[];
    blocksData: DataProp;
    config?: any;
    renderers?: any;
    blocksProps?: any;
};

const BlockInjector: React.FC<BlockInjectorProps> = ({ blocksData, injections, ...blocksProps }) => {
    const renderBlocks = (blockData: DataProp) => (
        <>
            <Blocks data={blockData} config={defaultEJSRConfigs} renderers={customRenderers} {...blocksProps} />
        </>
    );

    const renderInjection = (injection: Injection, index: number | undefined) => (
        <React.Fragment key={index ?? injection.index}>{injection.component}</React.Fragment>
    );

    /* Nothing to inject; Render all blocks */
    if (!injections || (Array.isArray(injections) && !injections.length)) return renderBlocks(blocksData);

    /* No blocks to render; Render all injections */
    if (!blocksData?.blocks?.length) {
        return injections?.map((injection, index) => renderInjection(injection, index));
    }

    return (
        <>
            {blocksData?.blocks?.map((block, index) => {
                const toBeInjected = injections.find((injection) => injection.index === index);
                return (
                    <React.Fragment key={block.id || index}>
                        {/* Render component to be injected */}
                        {toBeInjected && renderInjection(toBeInjected, index)}
                        {/* Render the blocks */}
                        {renderBlocks({ ...blocksData, blocks: [block] })}
                    </React.Fragment>
                );
            })}
        </>
    );
};

export default BlockInjector;

/* @@todo -- optimize and render blocks[] as sets instead of individual renders */
