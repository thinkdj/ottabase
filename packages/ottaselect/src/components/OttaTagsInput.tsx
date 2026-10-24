import { clsx } from 'clsx';
import { Loader2, Plus, X } from 'lucide-react';
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { labelKey, normalizeItem, type OttaCreateResult, type OttaSelectInputItem, type OttaSelectItem } from './items';

/*
 * A field of tags: pick from suggestions or type something new. It looks and
 * behaves like a Design System v1 field (36px, the strong edge, the surface,
 * the shared focus halo from @ottabase/ui's stylesheet), with each tag a DS
 * Tag chip inside it.
 *
 * Typing filters the suggestions, exact and prefix matches first, with
 * "Create" last. Enter takes the highlighted row, which starts on the best
 * match (so a prefix picks the existing tag instead of minting a near
 * duplicate) or on "Create" when nothing matches. A delimiter (a comma by
 * default) commits the text exactly as typed, and a paste with delimiters or
 * line breaks adds every part.
 * With the text empty, Backspace highlights the last tag and a second press
 * removes it; Left/Right walk the tags and Delete removes the highlighted one.
 *
 * The input is an ARIA combobox over a listbox, and every add or remove is
 * announced in a polite live region.
 *
 * Theming hooks: data-slot="tags-input" (the field), "tags-input-control"
 * (the text input), "tags-input-tag" (with data-active), "tags-input-list" and
 * "tags-input-option" (with data-active).
 */

export interface OttaTagsInputProps {
    /** Controlled tags. Leave undefined and use `defaultValue` to let the field hold them. */
    value?: OttaSelectItem[];
    defaultValue?: OttaSelectItem[];
    onChange?: (value: OttaSelectItem[]) => void;

    /** Suggestions: any objects with an id and a name, label or title. */
    items?: OttaSelectInputItem[];
    /** Suggestions from an API, called with the typed text (debounced). */
    fetchCollection?: (query: string) => Promise<OttaSelectInputItem[]>;
    searchDebounceMs?: number;
    maxSuggestions?: number;

    /** Typed text that matches no suggestion may become a tag. Default true. */
    creatable?: boolean;
    /**
     * Turns typed text into a tag: return the item (a promise works too, e.g. a POST), or null to
     * refuse it. Without it a new tag is `{ id: text, name: text }`.
     */
    onCreate?: (label: string) => OttaCreateResult | Promise<OttaCreateResult>;
    /** The create row's text. Default: Create "label" */
    createLabel?: (label: string) => React.ReactNode;

    /** Most tags the field takes; the field shows "n/max" when set. */
    maxTags?: number;
    /** Keys that commit the typed text, besides Enter. A paste is split on them and on line breaks. */
    delimiters?: string[];

    placeholder?: string;
    disabled?: boolean;
    renderTag?: (item: OttaSelectItem) => React.ReactNode;
    renderItem?: (item: OttaSelectItem) => React.ReactNode;
    emptyMessage?: string;
    loadingMessage?: string;
    errorMessage?: string;

    /** Each tag id is submitted with a form under this name. */
    name?: string;
    id?: string;
    autoFocus?: boolean;
    className?: string;
    'aria-label'?: string;
    'aria-labelledby'?: string;
    'aria-describedby'?: string;
    'aria-invalid'?: boolean | 'true' | 'false';
}

type Option = { type: 'create'; label: string } | { type: 'item'; item: OttaSelectItem };

/** The name with the typed text picked out, so a person sees why a row matched. */
function highlight(name: string, query: string) {
    const at = query ? name.toLowerCase().indexOf(query) : -1;
    if (at < 0) return name;
    return (
        <>
            {name.slice(0, at)}
            <span className="font-semibold text-foreground">{name.slice(at, at + query.length)}</span>
            {name.slice(at + query.length)}
        </>
    );
}

export function OttaTagsInput({
    value,
    defaultValue,
    onChange,
    items = [],
    fetchCollection,
    searchDebounceMs = 300,
    maxSuggestions = 50,
    creatable = true,
    onCreate,
    createLabel,
    maxTags,
    delimiters = [','],
    placeholder = 'Add a tag…',
    disabled = false,
    renderTag,
    renderItem,
    emptyMessage = 'No matches',
    loadingMessage = 'Loading…',
    errorMessage = 'Could not load suggestions',
    name,
    id,
    autoFocus,
    className,
    'aria-invalid': ariaInvalid,
    ...ariaProps
}: OttaTagsInputProps) {
    const [innerTags, setInnerTags] = useState<OttaSelectItem[]>(defaultValue ?? []);
    const tags = value ?? innerTags;
    // Latest tags for async commits (onCreate may resolve after another change)
    const tagsRef = useRef(tags);
    tagsRef.current = tags;

    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [activeTag, setActiveTag] = useState<number | null>(null);
    const [fetched, setFetched] = useState<OttaSelectItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [announcement, setAnnouncement] = useState('');

    const inputRef = useRef<HTMLInputElement>(null);
    const baseId = useId();
    const inputId = id ?? `${baseId}-input`;
    const listId = `${baseId}-list`;
    const optionId = (index: number) => `${baseId}-option-${index}`;

    const canAdd = !disabled && (maxTags === undefined || tags.length < maxTags);
    const invalid = ariaInvalid === true || ariaInvalid === 'true';
    const search = labelKey(query);

    const setTags = useCallback(
        (next: OttaSelectItem[]) => {
            if (value === undefined) setInnerTags(next);
            onChange?.(next);
        },
        [value, onChange],
    );

    // Suggestions come from the API while one is wired, else from `items`
    const staticItems = useMemo(() => items.map(normalizeItem), [items]);
    const source = fetchCollection ? fetched : staticItems;

    useEffect(() => {
        if (!fetchCollection || !open) return;
        let live = true;
        const timer = setTimeout(async () => {
            setLoading(true);
            setError(null);
            try {
                const results = await fetchCollection(query.trim());
                if (live) setFetched(results.map(normalizeItem));
            } catch (err) {
                if (live) {
                    setError(err instanceof Error ? err.message : errorMessage);
                    setFetched([]);
                }
            } finally {
                if (live) setLoading(false);
            }
        }, searchDebounceMs);
        return () => {
            live = false;
            clearTimeout(timer);
        };
    }, [fetchCollection, open, query, searchDebounceMs, errorMessage]);

    const isTagged = useCallback(
        (label: string) => tagsRef.current.some((tag) => labelKey(tag.name) === labelKey(label)),
        [],
    );

    const options = useMemo<Option[]>(() => {
        const taken = new Set(tags.map((tag) => tag.id));
        const takenNames = new Set(tags.map((tag) => labelKey(tag.name)));
        const rank = (item: OttaSelectItem) => {
            const key = labelKey(item.name);
            return key === search ? 0 : key.startsWith(search) ? 1 : 2;
        };
        const matches = source
            .filter((item) => !taken.has(item.id) && !takenNames.has(labelKey(item.name)))
            .filter((item) => fetchCollection || !search || labelKey(item.name).includes(search))
            .map((item, order) => ({ item, order, rank: search ? rank(item) : 0 }))
            .sort((a, b) => a.rank - b.rank || a.order - b.order)
            .slice(0, maxSuggestions)
            .map(({ item }): Option => ({ type: 'item', item }));

        const exact = matches.some((option) => option.type === 'item' && labelKey(option.item.name) === search);
        const offerCreate = creatable && !!search && !exact && !takenNames.has(search);
        // Create comes last: the best match is armed first, so a prefix never mints a near-duplicate tag
        return offerCreate ? [...matches, { type: 'create', label: query.trim() }] : matches;
    }, [source, tags, search, query, creatable, fetchCollection, maxSuggestions]);

    // With text typed the first row is armed, so Enter means what you typed; with none, nothing is
    useEffect(() => {
        setActiveIndex(search ? 0 : -1);
    }, [search, options.length]);

    useEffect(() => {
        if (activeIndex < 0) return;
        document.getElementById(`${baseId}-option-${activeIndex}`)?.scrollIntoView?.({ block: 'nearest' });
    }, [activeIndex, baseId]);

    const showMessage = (fetchCollection && (loading || error)) || (!!search && options.length === 0);
    const listOpen = open && canAdd && (options.length > 0 || !!showMessage);

    const addTags = useCallback(
        (incoming: OttaSelectItem[]) => {
            const next = [...tagsRef.current];
            const added: string[] = [];
            for (const item of incoming) {
                if (maxTags !== undefined && next.length >= maxTags) break;
                const duplicate = next.some((tag) => tag.id === item.id || labelKey(tag.name) === labelKey(item.name));
                if (duplicate) continue;
                next.push(item);
                added.push(item.name);
            }
            if (added.length > 0) {
                setTags(next);
                setAnnouncement(`Added ${added.join(', ')}`);
            }
            return added.length;
        },
        [maxTags, setTags],
    );

    const removeTag = useCallback(
        (index: number) => {
            const tag = tagsRef.current[index];
            if (!tag) return;
            setTags(tagsRef.current.filter((_, at) => at !== index));
            setAnnouncement(`Removed ${tag.name}`);
            setActiveTag(null);
        },
        [setTags],
    );

    /** A typed label becomes the suggestion it names, or a new tag, or nothing (refused / not creatable). */
    const resolveLabel = useCallback(
        async (label: string): Promise<OttaSelectItem | null> => {
            const text = label.trim();
            if (!text) return null;
            const known = source.find((item) => labelKey(item.name) === labelKey(text));
            if (known) return known;
            if (!creatable) return null;
            const created = onCreate ? await onCreate(text) : { id: text, name: text };
            return created ? normalizeItem(created) : null;
        },
        [source, creatable, onCreate],
    );

    /** Commits typed text. Clears the field when everything it named is now a tag. */
    const commitLabels = useCallback(
        async (labels: string[]) => {
            const parts = labels.map((label) => label.trim()).filter(Boolean);
            if (parts.length === 0 || creating) return;
            setCreating(true);
            try {
                const resolved: OttaSelectItem[] = [];
                const refused: string[] = [];
                const already: string[] = [];
                for (const part of parts) {
                    if (isTagged(part)) {
                        already.push(part);
                        continue;
                    }
                    const item = await resolveLabel(part);
                    if (item) resolved.push(item);
                    else refused.push(part);
                }
                const added = addTags(resolved);
                // Refused text stays in the field to be fixed; everything else is done with
                if (refused.length === 0) setQuery('');
                if (added === 0) {
                    setAnnouncement(
                        refused.length > 0
                            ? `${refused.join(', ')} was not added`
                            : `${already.join(', ')} is already added`,
                    );
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : errorMessage);
            } finally {
                setCreating(false);
            }
        },
        [creating, isTagged, resolveLabel, addTags, errorMessage],
    );

    const choose = (option: Option) => {
        if (option.type === 'item') {
            addTags([option.item]);
            setQuery('');
        } else {
            void commitLabels([option.label]);
        }
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        const input = event.currentTarget;
        const atStart = input.selectionStart === 0 && input.selectionEnd === 0;

        if (delimiters.indexOf(event.key) !== -1) {
            event.preventDefault();
            void commitLabels([query]);
            return;
        }

        switch (event.key) {
            case 'Enter':
                if (listOpen && activeIndex >= 0 && options[activeIndex]) {
                    event.preventDefault();
                    choose(options[activeIndex]);
                } else if (query.trim()) {
                    event.preventDefault();
                    void commitLabels([query]);
                }
                return;
            case 'ArrowDown':
                event.preventDefault();
                setOpen(true);
                setActiveIndex((index) => Math.min(options.length - 1, index + 1));
                return;
            case 'ArrowUp':
                event.preventDefault();
                setActiveIndex((index) => Math.max(0, index - 1));
                return;
            case 'Escape':
                if (listOpen) {
                    event.preventDefault();
                    setOpen(false);
                } else if (activeTag !== null) {
                    setActiveTag(null);
                }
                return;
            case 'Backspace':
                if (query || disabled || tags.length === 0) return;
                event.preventDefault();
                if (activeTag === null) highlightTag(tags.length - 1);
                else removeTag(activeTag);
                return;
            case 'Delete':
                if (activeTag !== null) {
                    event.preventDefault();
                    removeTag(activeTag);
                }
                return;
            case 'ArrowLeft':
                if (tags.length === 0 || !(atStart || activeTag !== null)) return;
                event.preventDefault();
                highlightTag(activeTag === null ? tags.length - 1 : Math.max(0, activeTag - 1));
                return;
            case 'ArrowRight':
                if (activeTag === null) return;
                event.preventDefault();
                if (activeTag + 1 < tags.length) highlightTag(activeTag + 1);
                else setActiveTag(null);
                return;
        }
    };

    const highlightTag = (index: number) => {
        setActiveTag(index);
        setOpen(false);
        setAnnouncement(`${tags[index].name}. Press Backspace or Delete to remove it.`);
    };

    const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
        const text = event.clipboardData.getData('text');
        const separators = ['\n', '\r', '\t', ...delimiters].map((d) => d.replace(/[\\\]^-]/g, '\\$&')).join('');
        const parts = text.split(new RegExp(`[${separators}]`));
        if (parts.length < 2) return;
        event.preventDefault();
        // The first part finishes whatever was already typed
        void commitLabels([query + parts[0], ...parts.slice(1)]);
    };

    return (
        <div className={clsx('relative w-full', className)}>
            <div
                data-slot="tags-input"
                data-disabled={disabled ? '' : undefined}
                aria-invalid={invalid || undefined}
                className={clsx(
                    'flex min-h-9 w-full flex-wrap items-center gap-1 rounded-md border bg-card px-1.5 py-1.5 text-sm text-foreground shadow-xs transition duration-fast ease-theme',
                    invalid ? 'border-destructive' : 'border-input',
                    disabled
                        ? 'cursor-not-allowed bg-muted text-faint-foreground'
                        : 'cursor-text hover:border-faint-foreground',
                )}
                onMouseDown={(event) => {
                    // A press on the field's padding puts the caret in the text input
                    if (event.target === event.currentTarget && !disabled) {
                        event.preventDefault();
                        inputRef.current?.focus();
                    }
                }}
            >
                {tags.length > 0 ? (
                    <ul className="contents">
                        {tags.map((tag, index) => (
                            <li
                                key={tag.id || `${tag.name}-${index}`}
                                data-slot="tags-input-tag"
                                data-active={activeTag === index ? '' : undefined}
                                className={clsx(
                                    'inline-flex h-[22px] min-w-0 max-w-full items-center gap-1 rounded-sm border pl-1.5 text-xs font-medium transition duration-fast ease-theme',
                                    disabled ? 'pr-1.5' : 'pr-0.5',
                                    activeTag === index
                                        ? 'border-[color:var(--focus-ring-color,hsl(var(--ring)))] bg-accent text-accent-foreground'
                                        : 'border-border bg-muted text-subtle-foreground',
                                )}
                            >
                                <span className="truncate">{renderTag ? renderTag(tag) : tag.name}</span>
                                {!disabled && (
                                    <button
                                        type="button"
                                        tabIndex={-1}
                                        aria-label={`Remove ${tag.name}`}
                                        className="grid size-4 shrink-0 place-items-center rounded-[3px] text-muted-foreground transition duration-fast ease-theme hover:bg-secondary hover:text-foreground"
                                        onMouseDown={(event) => event.preventDefault()}
                                        onClick={() => {
                                            removeTag(index);
                                            inputRef.current?.focus();
                                        }}
                                    >
                                        <X aria-hidden="true" className="size-3 [stroke-width:2.25]" />
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                ) : null}
                <input
                    ref={inputRef}
                    id={inputId}
                    type="text"
                    role="combobox"
                    data-slot="tags-input-control"
                    autoComplete="off"
                    autoFocus={autoFocus}
                    disabled={disabled}
                    readOnly={!canAdd && !disabled}
                    value={query}
                    placeholder={tags.length === 0 ? placeholder : undefined}
                    aria-autocomplete="list"
                    aria-expanded={listOpen}
                    aria-controls={listId}
                    aria-activedescendant={listOpen && activeIndex >= 0 ? optionId(activeIndex) : undefined}
                    aria-invalid={invalid || undefined}
                    aria-busy={creating || undefined}
                    {...ariaProps}
                    className="h-[22px] min-w-16 flex-1 bg-transparent px-1 text-sm text-foreground placeholder:text-faint-foreground focus-visible:outline-hidden disabled:cursor-not-allowed"
                    onChange={(event) => {
                        if (!canAdd) return;
                        setQuery(event.target.value);
                        setActiveTag(null);
                        setOpen(true);
                    }}
                    onFocus={() => setOpen(true)}
                    onBlur={() => {
                        setOpen(false);
                        setActiveTag(null);
                    }}
                    onClick={() => setOpen(true)}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                />
                {creating ? (
                    <Loader2 aria-hidden="true" className="mr-1 size-3.5 shrink-0 animate-spin text-muted-foreground" />
                ) : null}
                {maxTags !== undefined ? (
                    <span
                        aria-hidden="true"
                        className="ml-auto shrink-0 pr-1 text-xs tabular-nums text-muted-foreground"
                    >
                        {tags.length}/{maxTags}
                    </span>
                ) : null}
            </div>

            {listOpen ? (
                <ul
                    id={listId}
                    role="listbox"
                    data-slot="tags-input-list"
                    aria-label="Suggestions"
                    className="absolute inset-x-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 duration-fast"
                    // Keep focus in the input while a row is clicked
                    onMouseDown={(event) => event.preventDefault()}
                >
                    {options.map((option, index) => (
                        <li
                            key={option.type === 'create' ? '__create' : option.item.id}
                            id={optionId(index)}
                            role="option"
                            aria-selected={index === activeIndex}
                            data-slot="tags-input-option"
                            data-active={index === activeIndex ? '' : undefined}
                            className={clsx(
                                'flex cursor-pointer select-none items-center gap-2 rounded-sm px-2.5 py-2 text-sm',
                                index === activeIndex ? 'bg-muted text-foreground' : 'text-popover-foreground',
                            )}
                            onMouseMove={() => index !== activeIndex && setActiveIndex(index)}
                            onClick={() => choose(option)}
                        >
                            {option.type === 'create' ? (
                                <>
                                    <Plus aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                                    <span className="min-w-0 truncate text-muted-foreground">
                                        {createLabel ? (
                                            createLabel(option.label)
                                        ) : (
                                            <>
                                                Create{' '}
                                                <span className="font-medium text-foreground">
                                                    &ldquo;{option.label}&rdquo;
                                                </span>
                                            </>
                                        )}
                                    </span>
                                </>
                            ) : (
                                <span className="min-w-0 flex-1 truncate">
                                    {renderItem ? renderItem(option.item) : highlight(option.item.name, search)}
                                </span>
                            )}
                        </li>
                    ))}
                    {showMessage && options.length === 0 ? (
                        <li
                            role="presentation"
                            className={clsx(
                                'flex items-center gap-2 px-2.5 py-2 text-sm',
                                error ? 'text-destructive-text' : 'text-muted-foreground',
                            )}
                        >
                            {loading ? (
                                <>
                                    <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                                    {loadingMessage}
                                </>
                            ) : (
                                (error ?? emptyMessage)
                            )}
                        </li>
                    ) : null}
                </ul>
            ) : null}

            <span role="status" aria-live="polite" className="sr-only">
                {announcement}
            </span>
            {name ? tags.map((tag) => <input key={tag.id} type="hidden" name={name} value={tag.id} />) : null}
        </div>
    );
}

export default OttaTagsInput;
