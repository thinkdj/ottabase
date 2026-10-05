/**
 * One page for tags, categories and series: the blog admin tabs, a heading,
 * and a ModelCrud whose side panel follows ?edit=<id|new> in the URL.
 */

import type { ModelConfig, ModelCrudSelection } from '@ottabase/forms';
import { ModelCrud } from '@ottabase/forms/react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { BlogAdminNav } from './BlogAdminNav';

interface TaxonomyCrudPageProps {
    path: string;
    title: string;
    description: string;
    config: ModelConfig;
}

export function TaxonomyCrudPage({ path, title, description, config }: TaxonomyCrudPageProps) {
    const navigate = useNavigate();
    const { edit } = useSearch({ strict: false }) as { edit?: string };

    const setSelected = (id: ModelCrudSelection) =>
        navigate({
            to: path as never,
            search: { edit: id === null ? undefined : String(id) } as never,
            replace: true,
        });

    return (
        <div className="space-y-8">
            <BlogAdminNav />
            <div className="space-y-1.5">
                <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
                <p className="text-muted-foreground">{description}</p>
            </div>
            <ModelCrud
                config={config}
                apiBasePath="/api/ottaorm"
                perPage={25}
                selectedId={edit ?? null}
                onSelectedIdChange={setSelected}
            />
        </div>
    );
}
