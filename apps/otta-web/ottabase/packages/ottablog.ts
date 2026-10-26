// The blog package: the package owns its tables, models, migrations and policies
// (`createOttablogPackage`); this app adds the routes, whose handlers own sessions and SEO.
// The route table itself is canonical in @ottabase/ottablog/router.
import { createOttablogPackage } from '@ottabase/ottablog';
import { buildBlogRouter } from '@ottabase/ottablog/router';
import { ctxOf } from '../../worker/lib/api-context';
import { blogHandlers } from '../../worker/routes/blog';

export const ottablogPackage = createOttablogPackage<CloudflareEnv>({
    routes: {
        basePath: '/api/blog',
        build: () => buildBlogRouter<CloudflareEnv>(blogHandlers, { makeContext: ctxOf }),
    },
});
