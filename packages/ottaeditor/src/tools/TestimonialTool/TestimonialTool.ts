import type { API, BlockTool, BlockToolConstructorOptions } from '@editorjs/editorjs';
import type { FileSource } from '@ottabase/utils/media';
import { toolboxEntry } from '../../blocks';
import { field, mediaInput, row, select, stack, stars, textInput, textarea, toggle } from '../../ui/kit';
import { BlockShell } from '../../ui/shell';

export type TestimonialVariant = 'card' | 'minimal' | 'featured' | 'quote-bubble' | 'side-by-side';

export interface TestimonialData {
    quote: string;
    authorName: string;
    authorRole?: string;
    authorCompany?: string;
    /** A stored file, or an outside address */
    authorAvatar?: FileSource;
    /** Optional company/product logo: a stored file, or an outside address */
    companyLogo?: FileSource;
    /** Rating 0-5 (0 = no rating shown) */
    rating?: number;
    variant: TestimonialVariant;
    /** Link to the original testimonial source */
    sourceUrl?: string;
    /** Whether the testimonial is verified */
    verified?: boolean;
}

export interface TestimonialToolConfig {
    defaultVariant?: TestimonialVariant;
}

const VARIANTS: ReadonlyArray<{ value: TestimonialVariant; label: string }> = [
    { value: 'card', label: 'Card' },
    { value: 'minimal', label: 'Minimal' },
    { value: 'featured', label: 'Featured (large)' },
    { value: 'quote-bubble', label: 'Quote bubble' },
    { value: 'side-by-side', label: 'Side by side' },
];

/** Testimonial block: quote, author, media and rating fields; preview is the renderer's card. */
export default class TestimonialTool implements BlockTool {
    private readonly api: API;
    private readonly config: TestimonialToolConfig;
    private data: Required<Omit<TestimonialData, 'authorAvatar' | 'companyLogo'>> &
        Pick<TestimonialData, 'authorAvatar' | 'companyLogo'>;
    private shell: BlockShell | null = null;
    private cleanups: Array<() => void> = [];

    static get toolbox() {
        return toolboxEntry('testimonial');
    }

    static get enableLineBreaks() {
        return true;
    }

    constructor({ data, config, api }: BlockToolConstructorOptions<Partial<TestimonialData>, TestimonialToolConfig>) {
        this.api = api;
        this.config = config || {};
        this.data = {
            quote: data?.quote ?? '',
            authorName: data?.authorName ?? '',
            authorRole: data?.authorRole ?? '',
            authorCompany: data?.authorCompany ?? '',
            authorAvatar: data?.authorAvatar || undefined,
            companyLogo: data?.companyLogo || undefined,
            rating: data?.rating ?? 0,
            variant: data?.variant ?? this.config.defaultVariant ?? 'card',
            sourceUrl: data?.sourceUrl ?? '',
            verified: data?.verified ?? false,
        };
    }

    render(): HTMLElement {
        const shell = new BlockShell({
            type: 'testimonial',
            hasContent: Boolean(this.data.quote.trim() && this.data.authorName.trim()),
            summary: this.summary(),
        });
        this.shell = shell;

        const text = (
            key: 'authorName' | 'authorRole' | 'authorCompany' | 'sourceUrl',
            placeholder: string,
            type: 'text' | 'url' = 'text',
        ) => textInput({ value: this.data[key], placeholder, type, onInput: (v) => this.update({ [key]: v }) });

        const avatar = mediaInput({
            value: this.data.authorAvatar,
            ariaLabel: 'Avatar',
            onChange: (value) => this.update({ authorAvatar: value }),
        });
        const logo = mediaInput({
            value: this.data.companyLogo,
            ariaLabel: 'Company logo',
            onChange: (value) => this.update({ companyLogo: value }),
        });
        this.cleanups.push(avatar.destroy, logo.destroy);

        shell.fields.append(
            stack(
                row(
                    field({
                        label: 'Variant',
                        control: select<TestimonialVariant>({
                            value: this.data.variant,
                            options: VARIANTS,
                            onChange: (v) => this.update({ variant: v }),
                        }),
                    }),
                    toggle({
                        checked: this.data.verified,
                        label: 'Verified',
                        onChange: (v) => this.update({ verified: v }),
                    }),
                ),
                field({
                    label: 'Quote',
                    control: textarea({
                        value: this.data.quote,
                        rows: 3,
                        placeholder: 'What the customer said',
                        onInput: (v) => this.update({ quote: v }),
                    }),
                }),
                row(
                    field({ label: 'Author', control: text('authorName', 'Jane Doe') }),
                    field({ label: 'Role', control: text('authorRole', 'CEO') }),
                    field({ label: 'Company', control: text('authorCompany', 'Acme Inc.') }),
                ),
                row(
                    field({ label: 'Avatar', control: avatar.element, grow: true }),
                    field({ label: 'Company logo', control: logo.element, grow: true }),
                ),
                row(
                    field({ label: 'Source link', control: text('sourceUrl', 'https://…', 'url'), grow: true }),
                    field({
                        label: 'Rating',
                        hint: 'None hides the stars',
                        control: stars({ value: this.data.rating, onChange: (v) => this.update({ rating: v }) }),
                    }),
                ),
            ),
        );
        shell.preview(this.previewData());
        return shell.element;
    }

    private update(patch: Partial<TestimonialData>) {
        this.data = { ...this.data, ...patch } as Required<TestimonialData>;
        this.shell?.setSummary(this.summary());
        this.shell?.preview(this.previewData());
    }

    private summary(): string {
        const variant = VARIANTS.find((v) => v.value === this.data.variant)?.label ?? this.data.variant;
        return this.data.rating > 0 ? `${variant} · ${this.data.rating}/5` : variant;
    }

    private previewData(): Record<string, unknown> {
        const saved = this.save();
        return {
            ...saved,
            quote: saved.quote || 'The quote goes here.',
            authorName: saved.authorName || 'Author name',
        };
    }

    save(): TestimonialData {
        return {
            quote: this.data.quote.trim(),
            authorName: this.data.authorName.trim(),
            authorRole: this.data.authorRole?.trim() || undefined,
            authorCompany: this.data.authorCompany?.trim() || undefined,
            // mediaInput already trims a typed address and gives undefined for an empty field
            authorAvatar: this.data.authorAvatar || undefined,
            companyLogo: this.data.companyLogo || undefined,
            rating: this.data.rating > 0 ? this.data.rating : undefined,
            variant: this.data.variant,
            sourceUrl: this.data.sourceUrl?.trim() || undefined,
            verified: this.data.verified || undefined,
        };
    }

    validate(data: TestimonialData): boolean {
        return data.quote.trim().length > 0 && data.authorName.trim().length > 0;
    }

    destroy(): void {
        this.cleanups.splice(0).forEach((fn) => fn());
        this.shell?.destroy();
        this.shell = null;
    }
}
