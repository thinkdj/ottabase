import './styles.css';

import { baseRenderers } from './baseRenderers';
import Layout from './components/Layout';
import { blockClass, defaultEJSRConfigs, shouldRenderContentBlocks } from './rendererConfig';

/** All block renderers including Layout (for top-level Blocks) */
export const customRenderers = {
    ...baseRenderers,
    layout: Layout,
};

export { blockClass, defaultEJSRConfigs, shouldRenderContentBlocks };
