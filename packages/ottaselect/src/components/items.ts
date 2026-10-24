// Output format - always standardized with id and name
export interface OttaSelectItem extends Record<string, any> {
    id: string;
    name: string;
}

// Input can be any object with id and name/label/title
export type OttaSelectInputItem = Record<string, any>;

/** What `onCreate` may return: the new item, or null/undefined to refuse the text. */
export type OttaCreateResult = OttaSelectInputItem | null | undefined;

// Helper function to normalize input items to standard format
export const normalizeItem = (item: OttaSelectInputItem): OttaSelectItem => {
    // Extract id - must exist
    const id = item.id?.toString() || '';

    // Extract display name with fallbacks: name -> label -> title
    const name = item.name || item.label || item.title || '';

    // Return the original object with normalized id and name
    return {
        ...item,
        id,
        name: String(name),
    };
};

/** Case- and space-insensitive key for comparing a typed label with item names. */
export const labelKey = (label: string) => label.trim().toLowerCase();
