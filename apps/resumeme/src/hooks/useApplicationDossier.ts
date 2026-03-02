// ============================================================
// Application Dossier Hooks (ResumeMe)
// ============================================================

import { createModelHooks } from '@ottabase/ottaorm/client';

export const {
    useList: useApplicationDossiers,
    useDetail: useApplicationDossier,
    useFind: useApplicationDossierBySlug,
    useCreate: useCreateApplicationDossier,
    useUpdate: useUpdateApplicationDossier,
    useDelete: useDeleteApplicationDossier,
    useInfiniteList: useApplicationDossiersInfinite,
} = createModelHooks({ entityName: 'resume_application_dossiers' });

export const {
    useList: useApplicationDossierFiles,
    useDetail: useApplicationDossierFile,
    useCreate: useCreateApplicationDossierFile,
    useUpdate: useUpdateApplicationDossierFile,
    useDelete: useDeleteApplicationDossierFile,
} = createModelHooks({ entityName: 'resume_application_dossier_files' });
