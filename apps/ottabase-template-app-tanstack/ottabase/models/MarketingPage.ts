import { BaseModel, type ModelFields, type PackageType } from '@ottabase/ottaorm';
import { pageActionsTable, pageFeaturesTable, pagesTable, pageSectionsTable } from './MarketingPage.schema';

export {
    pageActionsTable,
    pageFeaturesTable,
    pagesTable,
    pageSectionsTable,
    type MarketingPageActionRow,
    type MarketingPageFeatureRow,
    type MarketingPageRow,
    type MarketingPageSectionRow,
} from './MarketingPage.schema';

export class MarketingPage extends BaseModel {
    static entity = 'pages';
    static table = pagesTable;
    static primaryKey = 'id';
    static packageName = 'app';
    static packageType: PackageType = 'app';

    protected static fields: ModelFields = {
        id: { type: 'id', primaryKey: true, editable: false },
        appId: { type: 'string', editable: true, filterable: true },
        organizationId: { type: 'string', editable: true, filterable: true },
        userId: { type: 'string', editable: true, filterable: true },
        slug: { type: 'string', editable: true, searchable: true, sortable: true },
        title: { type: 'string', editable: true, searchable: true, sortable: true },
        status: { type: 'string', editable: true, sortable: true, filterable: true },
        createdAt: { type: 'date', editable: false, sortable: true },
        updatedAt: { type: 'date', editable: false, sortable: true },
    };

    protected static validationRules = {
        title: { rules: 'required|max:100', fieldName: 'Title' },
        slug: {
            rules: 'required',
            fieldName: 'Slug',
            custom: (value: unknown) => /^[a-z0-9-]+$/.test(String(value ?? '')),
            customMessage: 'Slug can only contain lowercase letters, numbers, and hyphens',
        },
    };
}

export class PageSection extends BaseModel {
    static entity = 'page_sections';
    static table = pageSectionsTable;
    static primaryKey = 'id';
    static packageName = 'app';
    static packageType: PackageType = 'app';

    static casts = {
        enabled: 'boolean' as const,
    };

    protected static fields: ModelFields = {
        id: { type: 'id', primaryKey: true, editable: false },
        pageId: { type: 'string', editable: true, filterable: true },
        appId: { type: 'string', editable: true, filterable: true },
        organizationId: { type: 'string', editable: true, filterable: true },
        userId: { type: 'string', editable: true, filterable: true },
        slot: { type: 'string', editable: true, searchable: true },
        variant: { type: 'string', editable: true },
        title: { type: 'string', editable: true, searchable: true },
        subtitle: { type: 'string', editable: true },
        body: { type: 'string', editable: true },
        mediaUrl: { type: 'string', editable: true },
        mediaAlt: { type: 'string', editable: true },
        enabled: { type: 'boolean', editable: true, filterable: true },
        sortOrder: { type: 'number', editable: true, sortable: true },
        createdAt: { type: 'date', editable: false, sortable: true },
        updatedAt: { type: 'date', editable: false, sortable: true },
    };
}

export class PageFeature extends BaseModel {
    static entity = 'page_features';
    static table = pageFeaturesTable;
    static primaryKey = 'id';
    static packageName = 'app';
    static packageType: PackageType = 'app';

    protected static fields: ModelFields = {
        id: { type: 'id', primaryKey: true, editable: false },
        sectionId: { type: 'string', editable: true, filterable: true },
        appId: { type: 'string', editable: true, filterable: true },
        organizationId: { type: 'string', editable: true, filterable: true },
        userId: { type: 'string', editable: true, filterable: true },
        title: { type: 'string', editable: true, searchable: true },
        description: { type: 'string', editable: true },
        icon: { type: 'string', editable: true },
        link: { type: 'string', editable: true },
        mediaUrl: { type: 'string', editable: true },
        mediaAlt: { type: 'string', editable: true },
        sortOrder: { type: 'number', editable: true, sortable: true },
        createdAt: { type: 'date', editable: false, sortable: true },
    };
}

export class PageAction extends BaseModel {
    static entity = 'page_actions';
    static table = pageActionsTable;
    static primaryKey = 'id';
    static packageName = 'app';
    static packageType: PackageType = 'app';

    static casts = {
        external: 'boolean' as const,
    };

    protected static fields: ModelFields = {
        id: { type: 'id', primaryKey: true, editable: false },
        sectionId: { type: 'string', editable: true, filterable: true },
        appId: { type: 'string', editable: true, filterable: true },
        organizationId: { type: 'string', editable: true, filterable: true },
        userId: { type: 'string', editable: true, filterable: true },
        label: { type: 'string', editable: true, searchable: true },
        href: { type: 'string', editable: true },
        variant: { type: 'string', editable: true },
        icon: { type: 'string', editable: true },
        external: { type: 'boolean', editable: true, filterable: true },
        sortOrder: { type: 'number', editable: true, sortable: true },
        createdAt: { type: 'date', editable: false, sortable: true },
    };
}
