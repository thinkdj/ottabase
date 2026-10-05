/**
 * Words for people, derived from entity and field keys.
 * `post_tags` reads "Post tag" / "Post tags", `createdAt` reads "Created at".
 */

export function humanize(key: string): string {
    const words = key
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[_-]+/g, ' ')
        .trim()
        .toLowerCase();
    return words.charAt(0).toUpperCase() + words.slice(1);
}

export function singularize(word: string): string {
    if (/[^aeiou]ies$/.test(word)) return word.slice(0, -3) + 'y';
    if (/(ses|xes|zes|ches|shes)$/.test(word)) return word.slice(0, -2);
    if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
    return word;
}

export function pluralize(word: string): string {
    if (/[^aeiou]y$/.test(word)) return word.slice(0, -1) + 'ies';
    if (/(s|x|z|ch|sh)$/.test(word)) return word + 'es';
    return word + 's';
}

/** Singular and plural display names: the config's own, else humanized from the entity. */
export function entityNames(config: { entity: string; displayName?: string; displayNamePlural?: string }) {
    const singular = config.displayName || humanize(singularize(config.entity));
    const plural =
        config.displayNamePlural || (config.displayName ? pluralize(config.displayName) : humanize(config.entity));
    return { singular, plural };
}
