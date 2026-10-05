import { TaxonomyCrudPage } from './TaxonomyCrudPage';
import { seriesConfig } from './taxonomyConfigs';

export function AdminBlogSeriesPage() {
    return (
        <TaxonomyCrudPage
            path="/admin/content/blog/series"
            title="Series"
            description="Ordered runs of posts that belong together."
            config={seriesConfig}
        />
    );
}
