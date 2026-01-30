// Re-export everything from the component
export { default as OttaSelect } from './components/OttaSelect';
export type { ItemRendererProps, OttaSelectInputItem, OttaSelectItem, OttaSelectProps } from './components/OttaSelect';

// OttaORM integration
export { createModelFetcher } from './ottaorm';
export type { ModelFetcherConfig, OttaORMConfig } from './ottaorm';
