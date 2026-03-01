// Knowledge Base hooks — client-side TanStack Query hooks for knowledge base entities

import { createModelHooks } from '@ottabase/ottaorm/client';
import type { KnowledgeBaseType } from '../../../ottabase/models/KnowledgeBase';
import type { KnowledgeBaseFileType } from '../../../ottabase/models/KnowledgeBaseFile';

// ── KnowledgeBase ──────────────────────────────────────────
export const {
    useList: useKnowledgeBases,
    useDetail: useKnowledgeBase,
    useCreate: useCreateKnowledgeBase,
    useUpdate: useUpdateKnowledgeBase,
    useDelete: useDeleteKnowledgeBase,
} = createModelHooks<KnowledgeBaseType>({ entityName: 'knowledge_bases' });

// ── KnowledgeBaseFile ──────────────────────────────────────
export const {
    useList: useKnowledgeBaseFiles,
    useDetail: useKnowledgeBaseFile,
    useCreate: useCreateKnowledgeBaseFile,
    useUpdate: useUpdateKnowledgeBaseFile,
    useDelete: useDeleteKnowledgeBaseFile,
} = createModelHooks<KnowledgeBaseFileType>({ entityName: 'knowledge_base_files' });
