/**
 * CRUD configs for the blog taxonomy, built from the models' own field
 * metadata. The only extra is a slug that follows the name unless typed.
 */

import { createModelConfig } from '@ottabase/forms';
import { generateSlug, PostCategory, PostSeries, PostTag } from '@ottabase/ottablog';

const slugFrom = (nameKey: string) => (data: Record<string, unknown>) => {
    const name = String(data[nameKey] ?? '').trim();
    const slug = String(data.slug ?? '').trim();
    return name && !slug ? { ...data, slug: generateSlug(name) } : data;
};

export const tagsConfig = createModelConfig(PostTag, { displayName: 'Tag', prepare: slugFrom('name') });
export const categoriesConfig = createModelConfig(PostCategory, { displayName: 'Category', prepare: slugFrom('name') });
export const seriesConfig = createModelConfig(PostSeries, {
    displayName: 'Series',
    displayNamePlural: 'Series',
    prepare: slugFrom('title'),
});
