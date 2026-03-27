/**
 * Shared EditorJS renderer configuration.
 * Extracted to avoid circular dependencies (Layout needs config for nested Blocks).
 */
export const blockClass = 'cdc-content-block';

export const defaultEJSRConfigs = {
    code: {
        className: `${blockClass} cdc-content-code`,
    },
    checklist: {
        className: `${blockClass} cdc-content-cl`,
    },
    simpleImage: {
        className: `${blockClass} cdc-content-simpleImage`,
    },
    delimiter: {
        className: `${blockClass} cdc-content-delimiter`,
    },
    embed: {
        className: `${blockClass} cdc-content-embed`,
        rel: 'noreferer nofollower external',
        sandbox: undefined,
    },
    header: {
        className: `${blockClass} cdc-content-header mt-2 text-gray-700 dark:text-gray-200 text-3xl/10`,
    },
    image: {
        className: `${blockClass} image-block cdc-content-image`,
        actionsClassNames: {
            stretched: 'image-block--stretched',
            withBorder: 'image-block--with-border',
            withBackground: 'image-block--with-background',
            featuredImage: 'image-block--featured-image',
        },
    },
    advancedImage: {
        className: `${blockClass} advanced-image-block cdc-content-advanced-image`,
        actionsClassNames: {
            stretched: 'advanced-image-block--stretched',
            withBorder: 'advanced-image-block--with-border',
            withBackground: 'advanced-image-block--with-background',
            featuredImage: 'advanced-image-block--featured-image',
        },
    },
    list: {
        className: `${blockClass} cdc-content-list`,
    },
    paragraph: {
        className: `${blockClass} cdc-content-paragraph my-4 text-gray-700 dark:text-gray-200 text-md leading-relaxed`,
    },
    quote: {
        className: `${blockClass} cdc-content-quote`,
        actionsClassNames: {
            alignment: 'text-align-{alignment}',
        },
    },
    table: {
        className: `${blockClass} cdc-content-table`,
    },
    warning: {
        className: `${blockClass} cdc-content-warning`,
    },
    spoiler: {
        className: `${blockClass} cdc-content-spoiler`,
    },
    cta: {
        className: `${blockClass} cdc-content-cta`,
    },
    disclosure: {
        className: `${blockClass} cdc-content-disclosure`,
    },
    review: {
        className: `${blockClass} cdc-content-review`,
    },
    map: {
        className: `${blockClass} cdc-content-map`,
    },
    layout: {
        className: `${blockClass} cdc-content-layout`,
    },
    steps: {
        className: `${blockClass} cdc-content-steps`,
    },
};

export const shouldRenderContentBlocks = (contentBlocks: {} | null) => {
    return contentBlocks !== null && Object.keys(contentBlocks).length > 0;
};
