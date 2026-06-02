// ============================================================
// Payport Admin — Generic config-driven CRUD page
// ============================================================
//
// Thin wrapper around `<ModelCrud />` that renders the right entity
// for the current URL segment. Plug-and-play: register one route per
// entity in your router and pass the entity key. All field metadata,
// validation, search and pagination are inherited from the model.
// ============================================================

import { ModelCrud } from '@ottabase/forms';
import { getPayportEntity, type PayportEntityDescriptor } from '../entities';

export interface PayportEntityCrudPageProps {
    /** Entity slug (e.g. 'payment_plans'). Resolved via `getPayportEntity`. */
    entityKey: string;
}

export function PayportEntityCrudPage({ entityKey }: PayportEntityCrudPageProps) {
    let entity: PayportEntityDescriptor;
    try {
        entity = getPayportEntity(entityKey);
    } catch (err) {
        return (
            <div className="p-6">
                <p className="text-sm text-destructive">{(err as Error).message}</p>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-4">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight">{entity.title}</h1>
                <p className="text-sm text-muted-foreground">{entity.description}</p>
                {entity.readOnly ? (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                        Read-only — managed by Payport. The provider is the source of truth.
                    </p>
                ) : null}
            </header>
            <ModelCrud config={entity.config} />
        </div>
    );
}
