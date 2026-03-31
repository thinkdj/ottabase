import { api } from '@/lib/api';
import type {
    BlockDefinition,
    MarketingAction,
    MarketingFeature,
    MarketingPage,
    MarketingSection,
} from '@/types/marketing-pages';
import { createModelHooks } from '@ottabase/ottaorm/client';
import { useQuery } from '@tanstack/react-query';

export const pageHooks = createModelHooks<MarketingPage>({ entityName: 'pages' });
export const sectionHooks = createModelHooks<MarketingSection>({ entityName: 'page_sections' });
export const featureHooks = createModelHooks<MarketingFeature>({ entityName: 'page_features' });
export const actionHooks = createModelHooks<MarketingAction>({ entityName: 'page_actions' });

export function useBlocksRegistry() {
    return useQuery({
        queryKey: ['blocks-registry'],
        queryFn: () => api<{ blocks: BlockDefinition[] }>('/api/blocks'),
    });
}
