import { BrandScope } from '@ottabase/ui-shadcn';
import { BlogListPage } from '@/pages/blog/BlogListPage';

/**
 * Personal-blog homepage: a short intro and the writing index.
 * The SaaS landing (OttabaseHero + EditorJS blocks) is intentionally gone —
 * this deploy is a standalone site, not a framework demo.
 */
export function HomePage() {
    return (
        <BrandScope name="blog">
            <BlogListPage variant="home" />
        </BrandScope>
    );
}
