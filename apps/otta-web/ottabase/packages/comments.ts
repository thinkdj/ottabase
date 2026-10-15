// Comments: tables and models from the package; the API is the generic OttaORM CRUD route.
import { createCommentsPackage } from '@ottabase/comments';

export const commentsPackage = createCommentsPackage<CloudflareEnv>();
