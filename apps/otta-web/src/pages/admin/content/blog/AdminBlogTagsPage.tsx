import { TaxonomyCrudPage } from './TaxonomyCrudPage';
import { tagsConfig } from './taxonomyConfigs';

export function AdminBlogTagsPage() {
    return (
        <TaxonomyCrudPage
            path="/admin/content/blog/tags"
            title="Tags"
            description="Labels readers can browse by. Click one to edit it."
            config={tagsConfig}
        />
    );
}
