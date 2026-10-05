import { TaxonomyCrudPage } from './TaxonomyCrudPage';
import { categoriesConfig } from './taxonomyConfigs';

export function AdminBlogCategoriesPage() {
    return (
        <TaxonomyCrudPage
            path="/admin/content/blog/categories"
            title="Categories"
            description="The sections of the blog. A category can sit under another one."
            config={categoriesConfig}
        />
    );
}
