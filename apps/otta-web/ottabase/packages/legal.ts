// Legal pages (@ottabase/legal). The SPA renders the pages at /legal/* from the same config (src/pages/legal), so the
// Worker serves the machine-readable forms beside it: /api/legal (the list), /api/legal/<slug> (JSON),
// /api/legal/<slug>.md and /api/legal/<slug>.html. The health probe reports config gaps as legal:config.
import { createLegalPackage } from '@ottabase/legal';
import { legalConfig } from '../legal.config';

export const legalPackage = createLegalPackage<CloudflareEnv>({
    config: legalConfig,
    basePath: '/api/legal',
    serve: 'api',
});
