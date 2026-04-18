import type { API, BlockTool } from '@editorjs/editorjs';
import './TestimonialTool.css';

// ─── Types ─────────────────────────────────────────────────────────────────

export type TestimonialVariant = 'card' | 'minimal' | 'featured' | 'quote-bubble' | 'side-by-side';

export interface TestimonialData {
    quote: string;
    authorName: string;
    authorRole?: string;
    authorCompany?: string;
    authorAvatar?: string;
    /** Optional URL to company/product logo */
    companyLogo?: string;
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

// ─── SVG icons ──────────────────────────────────────────────────────────────

const TESTIMONIAL_TOOLBOX_ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg>';

const STAR_FILLED =
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';

const STAR_EMPTY =
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';

// ─── Tool ───────────────────────────────────────────────────────────────────

export default class TestimonialTool implements BlockTool {
    private api: API;
    private data: Required<TestimonialData>;
    private config: TestimonialToolConfig;
    private wrapper: HTMLElement | null = null;

    // ── Static EditorJS metadata ────────────────────────────────────────────

    static get toolbox() {
        return {
            title: 'Testimonial',
            icon: TESTIMONIAL_TOOLBOX_ICON,
        };
    }

    static get enableLineBreaks() {
        return true;
    }

    // ── Constructor ─────────────────────────────────────────────────────────

    constructor({ data, config, api }: { data?: Partial<TestimonialData>; config?: TestimonialToolConfig; api: API }) {
        this.api = api;
        this.config = config || {};

        this.data = {
            quote: data?.quote ?? '',
            authorName: data?.authorName ?? '',
            authorRole: data?.authorRole ?? '',
            authorCompany: data?.authorCompany ?? '',
            authorAvatar: data?.authorAvatar ?? '',
            companyLogo: data?.companyLogo ?? '',
            rating: data?.rating ?? 0,
            variant: data?.variant ?? this.config.defaultVariant ?? 'card',
            sourceUrl: data?.sourceUrl ?? '',
            verified: data?.verified ?? false,
        };
    }

    // ── render ──────────────────────────────────────────────────────────────

    render(): HTMLElement {
        const wrapper = document.createElement('div');
        wrapper.classList.add('cdx-testimonial', 'cdx-testimonial__wrapper', 'ob-plugin');

        // Toolbar row
        wrapper.appendChild(this.createToolbar());

        // Form body
        const form = document.createElement('div');
        form.classList.add('cdx-testimonial__form', 'ob-form');

        // Quote textarea (most important — shown first)
        form.appendChild(this.createTextarea('quote', 'Quote *', 'What the customer said...', 4));

        // Author info row
        const authorRow = document.createElement('div');
        authorRow.classList.add('cdx-testimonial__author-row');
        authorRow.appendChild(this.createInput('authorName', 'Author Name *', 'Jane Doe'));
        authorRow.appendChild(this.createInput('authorRole', 'Role / Title', 'CEO'));
        authorRow.appendChild(this.createInput('authorCompany', 'Company', 'Acme Inc.'));
        form.appendChild(authorRow);

        // Avatar + logo row
        const mediaRow = document.createElement('div');
        mediaRow.classList.add('cdx-testimonial__media-row');
        mediaRow.appendChild(this.createInput('authorAvatar', 'Avatar URL (optional)', 'https://...'));
        mediaRow.appendChild(this.createInput('companyLogo', 'Company Logo URL (optional)', 'https://...'));
        form.appendChild(mediaRow);

        // Source URL
        form.appendChild(this.createInput('sourceUrl', 'Source URL (optional)', 'https://...'));

        // Rating row
        form.appendChild(this.createRatingSection());

        wrapper.appendChild(form);
        this.wrapper = wrapper;

        return wrapper;
    }

    // ── Toolbar (label + variant select) ──────────────────────────────────────

    private createToolbar(): HTMLElement {
        const toolbar = document.createElement('div');
        toolbar.classList.add('cdx-testimonial__toolbar');

        const label = document.createElement('span');
        label.classList.add('cdx-testimonial__toolbar-label', 'ob-section-label');
        label.textContent = 'Testimonial';
        toolbar.appendChild(label);

        const variantGroup = document.createElement('div');
        variantGroup.classList.add('cdx-testimonial__variant-group');

        const variantLabel = document.createElement('span');
        variantLabel.classList.add('ob-label');
        variantLabel.textContent = 'Variant:';
        variantGroup.appendChild(variantLabel);

        const variantSelect = document.createElement('select');
        variantSelect.classList.add('cdx-testimonial__variant-select', 'ob-select');
        variantSelect.title = 'Display variant';

        const variants: { value: TestimonialVariant; label: string }[] = [
            { value: 'card', label: 'Card' },
            { value: 'minimal', label: 'Minimal' },
            { value: 'featured', label: 'Featured (large)' },
            { value: 'quote-bubble', label: 'Quote Bubble' },
            { value: 'side-by-side', label: 'Side by Side' },
        ];
        variants.forEach(({ value, label }) => {
            const opt = document.createElement('option');
            opt.value = value;
            opt.textContent = label;
            opt.selected = value === this.data.variant;
            variantSelect.appendChild(opt);
        });
        variantSelect.addEventListener('change', () => {
            this.data.variant = variantSelect.value as TestimonialVariant;
        });
        variantGroup.appendChild(variantSelect);
        toolbar.appendChild(variantGroup);

        // Verified checkbox
        const verifiedGroup = document.createElement('label');
        verifiedGroup.classList.add('cdx-testimonial__verified-group');

        const verifiedCheckbox = document.createElement('input');
        verifiedCheckbox.type = 'checkbox';
        verifiedCheckbox.classList.add('ob-checkbox');
        verifiedCheckbox.checked = this.data.verified;
        verifiedCheckbox.addEventListener('change', () => {
            this.data.verified = verifiedCheckbox.checked;
        });

        const verifiedLabel = document.createElement('span');
        verifiedLabel.classList.add('ob-checkbox-label');
        verifiedLabel.textContent = 'Verified';

        verifiedGroup.appendChild(verifiedCheckbox);
        verifiedGroup.appendChild(verifiedLabel);
        toolbar.appendChild(verifiedGroup);

        return toolbar;
    }

    // ── Reusable field helpers ───────────────────────────────────────────────

    private createInput(key: keyof TestimonialData, labelText: string, placeholder: string): HTMLElement {
        const group = document.createElement('div');
        group.classList.add('ob-input-group', 'cdx-testimonial__field');

        const label = document.createElement('label');
        label.classList.add('ob-label');
        label.textContent = labelText;

        const input = document.createElement('input');
        input.type = 'text';
        input.classList.add('ob-input');
        input.placeholder = placeholder;
        input.value = (this.data[key] as string) ?? '';
        input.addEventListener('input', () => {
            (this.data as Record<string, unknown>)[key] = input.value;
        });

        group.appendChild(label);
        group.appendChild(input);
        return group;
    }

    private createTextarea(
        key: keyof TestimonialData,
        labelText: string,
        placeholder: string,
        rows: number,
    ): HTMLElement {
        const group = document.createElement('div');
        group.classList.add('ob-input-group');

        const label = document.createElement('label');
        label.classList.add('ob-label');
        label.textContent = labelText;

        const textarea = document.createElement('textarea');
        textarea.classList.add('ob-textarea', 'cdx-testimonial__quote-input');
        textarea.placeholder = placeholder;
        textarea.value = (this.data[key] as string) ?? '';
        textarea.rows = rows;
        textarea.addEventListener('input', () => {
            (this.data as Record<string, unknown>)[key] = textarea.value;
        });

        group.appendChild(label);
        group.appendChild(textarea);
        return group;
    }

    // ── Rating section ───────────────────────────────────────────────────────

    private createRatingSection(): HTMLElement {
        const group = document.createElement('div');
        group.classList.add('ob-input-group', 'cdx-testimonial__rating-group');

        const label = document.createElement('label');
        label.classList.add('ob-label');
        label.textContent = 'Rating (0 = hidden)';
        group.appendChild(label);

        const starsRow = document.createElement('div');
        starsRow.classList.add('cdx-testimonial__stars-row');

        // Clickable star buttons (0-5)
        const starsContainer = document.createElement('div');
        starsContainer.classList.add('cdx-testimonial__stars');
        starsContainer.setAttribute('role', 'group');
        starsContainer.setAttribute('aria-label', 'Rating');

        const renderStars = (current: number) => {
            starsContainer.innerHTML = '';
            for (let i = 1; i <= 5; i++) {
                const star = document.createElement('button');
                star.type = 'button';
                star.classList.add('cdx-testimonial__star');
                if (i <= current) star.classList.add('cdx-testimonial__star--filled');
                star.innerHTML = i <= current ? STAR_FILLED : STAR_EMPTY;
                star.setAttribute('aria-label', `Rate ${i} out of 5`);
                star.addEventListener('click', () => {
                    // Clicking the same star toggles off (reset to 0)
                    this.data.rating = this.data.rating === i ? 0 : i;
                    renderStars(this.data.rating);
                    ratingValue.textContent = this.data.rating > 0 ? `${this.data.rating}/5` : 'None';
                });
                starsContainer.appendChild(star);
            }
        };

        const ratingValue = document.createElement('span');
        ratingValue.classList.add('cdx-testimonial__rating-value', 'ob-hint');
        ratingValue.textContent = this.data.rating > 0 ? `${this.data.rating}/5` : 'None';

        renderStars(this.data.rating);

        starsRow.appendChild(starsContainer);
        starsRow.appendChild(ratingValue);
        group.appendChild(starsRow);

        return group;
    }

    // ── save ─────────────────────────────────────────────────────────────────

    save(): TestimonialData {
        return {
            quote: this.data.quote.trim(),
            authorName: this.data.authorName.trim(),
            authorRole: this.data.authorRole?.trim() || undefined,
            authorCompany: this.data.authorCompany?.trim() || undefined,
            authorAvatar: this.data.authorAvatar?.trim() || undefined,
            companyLogo: this.data.companyLogo?.trim() || undefined,
            rating: this.data.rating > 0 ? this.data.rating : undefined,
            variant: this.data.variant,
            sourceUrl: this.data.sourceUrl?.trim() || undefined,
            verified: this.data.verified || undefined,
        };
    }

    // ── validate ─────────────────────────────────────────────────────────────

    validate(data: TestimonialData): boolean {
        return data.quote.trim().length > 0 && data.authorName.trim().length > 0;
    }
}
