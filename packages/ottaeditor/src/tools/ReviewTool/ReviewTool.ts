import type { API, BlockTool } from '@editorjs/editorjs';
import './ReviewTool.css';

export interface ReviewToolConfig {
    maxStars?: 5 | 10;
    allowHalfStars?: boolean;
}

export interface ReviewData {
    image?: string;
    title?: string;
    content?: string;
    linkUrl?: string;
    linkLabel?: string;
    pros?: string[];
    cons?: string[];
    rating?: number;
    maxStars?: 5 | 10;
    allowHalfStars?: boolean;
    summary?: string;
    compact?: boolean;
}

export default class ReviewTool implements BlockTool {
    private api: API;
    private data: Required<ReviewData>;
    private config: ReviewToolConfig;
    private wrapper: HTMLElement | null = null;
    private fileInput: HTMLInputElement | null = null;

    static get CSS() {
        return {
            baseClass: 'cdx-review',
            wrapper: 'cdx-review__wrapper',
            form: 'cdx-review__form',
            inputGroup: 'cdx-review__input-group',
            label: 'cdx-review__label',
            sectionLabel: 'cdx-review__section-label',
            input: 'cdx-review__input',
            textarea: 'cdx-review__textarea',
            select: 'cdx-review__select',
        };
    }

    static get toolbox() {
        return {
            title: 'Review',
            icon: '<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17.75l-5.2 2.73 1-5.79-4.2-4.09 5.81-.84L12 4.5l2.59 5.26 5.81.84-4.2 4.09 1 5.79z"/></svg>',
        };
    }

    static get enableLineBreaks() {
        return true;
    }

    constructor({ data, config, api }: { data?: Partial<ReviewData>; config?: ReviewToolConfig; api: API }) {
        this.api = api;
        this.config = config || {};
        this.data = {
            image: data?.image || '',
            title: data?.title || '',
            content: data?.content || '',
            linkUrl: data?.linkUrl || '',
            linkLabel: data?.linkLabel || '',
            pros: data?.pros?.length ? [...data.pros] : [''],
            cons: data?.cons?.length ? [...data.cons] : [''],
            rating: data?.rating ?? 0,
            maxStars: data?.maxStars || this.config.maxStars || 5,
            allowHalfStars: data?.allowHalfStars ?? this.config.allowHalfStars ?? true,
            summary: data?.summary || '',
            compact: data?.compact ?? false,
        };
    }

    render(): HTMLElement {
        const wrapper = document.createElement('div');
        wrapper.classList.add(ReviewTool.CSS.baseClass, ReviewTool.CSS.wrapper);

        const form = document.createElement('div');
        form.classList.add(ReviewTool.CSS.form);

        // Image upload
        form.appendChild(this.createImageSection());

        // Title
        form.appendChild(this.createInput('title', 'text', 'Title', 'Review title...'));

        // Content
        form.appendChild(this.createTextarea('content', 'Content', 'Write your review...'));

        // Link (URL + Label in one row)
        form.appendChild(this.createLinkSection());

        // Rating
        form.appendChild(this.createRatingSection());

        // Pros/Cons
        form.appendChild(this.createProsConsSection());

        // Summary
        form.appendChild(this.createTextarea('summary', 'Summary (optional)', 'Final verdict...'));

        // Compact mode checkbox
        form.appendChild(this.createCompactToggle());

        wrapper.appendChild(form);
        this.wrapper = wrapper;

        return wrapper;
    }

    private createInput(key: keyof ReviewData, type: string, labelText: string, placeholder: string): HTMLElement {
        const group = document.createElement('div');
        group.classList.add(ReviewTool.CSS.inputGroup);

        const label = document.createElement('label');
        label.classList.add(ReviewTool.CSS.label);
        label.textContent = labelText;

        const input = document.createElement('input');
        input.type = type;
        input.classList.add(ReviewTool.CSS.input);
        input.placeholder = placeholder;
        input.value = (this.data[key] as string) || '';

        input.addEventListener('input', () => {
            (this.data as any)[key] = input.value;
        });

        group.appendChild(label);
        group.appendChild(input);
        return group;
    }

    private createTextarea(key: keyof ReviewData, labelText: string, placeholder: string): HTMLElement {
        const group = document.createElement('div');
        group.classList.add(ReviewTool.CSS.inputGroup);

        const label = document.createElement('label');
        label.classList.add(ReviewTool.CSS.label);
        label.textContent = labelText;

        const textarea = document.createElement('textarea');
        textarea.classList.add(ReviewTool.CSS.textarea);
        textarea.placeholder = placeholder;
        textarea.value = (this.data[key] as string) || '';
        textarea.rows = 3;

        textarea.addEventListener('input', () => {
            (this.data as any)[key] = textarea.value;
        });

        group.appendChild(label);
        group.appendChild(textarea);
        return group;
    }

    private createImageSection(): HTMLElement {
        const group = document.createElement('div');
        group.classList.add(ReviewTool.CSS.inputGroup);

        const label = document.createElement('label');
        label.classList.add(ReviewTool.CSS.label);
        label.textContent = 'Image (optional)';
        group.appendChild(label);

        const area = document.createElement('div');
        area.classList.add('cdx-review__image-area');

        this.fileInput = document.createElement('input');
        this.fileInput.type = 'file';
        this.fileInput.accept = 'image/*';
        this.fileInput.style.display = 'none';
        this.fileInput.addEventListener('change', (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) this.handleFileSelect(file, area);
        });

        if (this.data.image) {
            this.renderImagePreview(area);
        } else {
            this.renderImagePlaceholder(area);
        }

        area.addEventListener('click', (e) => {
            if (!(e.target as HTMLElement).classList.contains('cdx-review__image-remove')) {
                this.fileInput?.click();
            }
        });

        group.appendChild(this.fileInput);
        group.appendChild(area);

        // URL input for image
        const urlRow = document.createElement('div');
        urlRow.style.display = 'flex';
        urlRow.style.gap = '4px';
        urlRow.style.marginTop = '4px';

        const urlInput = document.createElement('input');
        urlInput.type = 'url';
        urlInput.classList.add(ReviewTool.CSS.input);
        urlInput.placeholder = 'Or paste image URL...';
        urlInput.value = this.data.image || '';
        urlInput.style.flex = '1';
        urlInput.addEventListener('change', () => {
            const url = urlInput.value.trim();
            if (url) {
                this.data.image = url;
                this.renderImagePreview(area);
            }
        });

        urlRow.appendChild(urlInput);
        group.appendChild(urlRow);

        return group;
    }

    private renderImagePreview(area: HTMLElement): void {
        area.innerHTML = '';
        area.classList.add('cdx-review__image-area--has-image');

        const img = document.createElement('img');
        img.src = this.data.image;
        img.alt = 'Review image';
        area.appendChild(img);

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.classList.add('cdx-review__image-remove');
        removeBtn.textContent = '×';
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.data.image = '';
            area.classList.remove('cdx-review__image-area--has-image');
            this.renderImagePlaceholder(area);
        });
        area.appendChild(removeBtn);
    }

    private renderImagePlaceholder(area: HTMLElement): void {
        area.innerHTML = '';
        const placeholder = document.createElement('div');
        placeholder.classList.add('cdx-review__image-placeholder');
        placeholder.innerHTML = '<span>📷</span><span>Click to upload image</span>';
        area.appendChild(placeholder);
    }

    private handleFileSelect(file: File, area: HTMLElement): void {
        if (!file.type.startsWith('image/')) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            this.data.image = e.target?.result as string;
            this.renderImagePreview(area);
        };
        reader.readAsDataURL(file);
    }

    private createLinkSection(): HTMLElement {
        const row = document.createElement('div');
        row.classList.add('cdx-review__link-row');

        const urlGroup = document.createElement('div');
        urlGroup.classList.add(ReviewTool.CSS.inputGroup);
        const urlLabel = document.createElement('label');
        urlLabel.classList.add(ReviewTool.CSS.label);
        urlLabel.textContent = 'Link URL (optional)';
        const urlInput = document.createElement('input');
        urlInput.type = 'url';
        urlInput.classList.add(ReviewTool.CSS.input);
        urlInput.placeholder = 'https://...';
        urlInput.value = this.data.linkUrl;
        urlInput.addEventListener('input', () => {
            this.data.linkUrl = urlInput.value;
        });
        urlGroup.appendChild(urlLabel);
        urlGroup.appendChild(urlInput);

        const labelGroup = document.createElement('div');
        labelGroup.classList.add(ReviewTool.CSS.inputGroup);
        const labelLabel = document.createElement('label');
        labelLabel.classList.add(ReviewTool.CSS.label);
        labelLabel.textContent = 'Link Label';
        const labelInput = document.createElement('input');
        labelInput.type = 'text';
        labelInput.classList.add(ReviewTool.CSS.input);
        labelInput.placeholder = 'Visit website';
        labelInput.value = this.data.linkLabel;
        labelInput.addEventListener('input', () => {
            this.data.linkLabel = labelInput.value;
        });
        labelGroup.appendChild(labelLabel);
        labelGroup.appendChild(labelInput);

        row.appendChild(urlGroup);
        row.appendChild(labelGroup);
        return row;
    }

    private createRatingSection(): HTMLElement {
        const container = document.createElement('div');
        container.classList.add(ReviewTool.CSS.inputGroup);

        const label = document.createElement('label');
        label.classList.add(ReviewTool.CSS.label);
        label.textContent = 'Rating';
        container.appendChild(label);

        const row = document.createElement('div');
        row.classList.add('cdx-review__rating-row');

        // Stars display
        const starsContainer = document.createElement('div');
        starsContainer.classList.add('cdx-review__stars');
        this.renderStars(starsContainer);
        row.appendChild(starsContainer);

        // Rating number input
        const ratingGroup = document.createElement('div');
        ratingGroup.classList.add(ReviewTool.CSS.inputGroup);
        const ratingInput = document.createElement('input');
        ratingInput.type = 'number';
        ratingInput.classList.add(ReviewTool.CSS.input, 'cdx-review__rating-value');
        ratingInput.min = '0';
        ratingInput.max = String(this.data.maxStars);
        ratingInput.step = this.data.allowHalfStars ? '0.5' : '1';
        ratingInput.value = String(this.data.rating);
        ratingInput.addEventListener('input', () => {
            const val = parseFloat(ratingInput.value);
            if (Number.isFinite(val) && val >= 0 && val <= this.data.maxStars) {
                this.data.rating = val;
                this.renderStars(starsContainer);
            }
        });
        ratingGroup.appendChild(ratingInput);
        row.appendChild(ratingGroup);

        // Config: max stars select
        const configGroup = document.createElement('div');
        configGroup.classList.add('cdx-review__rating-config');

        const maxSelect = document.createElement('select');
        maxSelect.classList.add(ReviewTool.CSS.select);
        maxSelect.title = 'Max stars';
        [5, 10].forEach((n) => {
            const opt = document.createElement('option');
            opt.value = String(n);
            opt.textContent = `/${n}`;
            opt.selected = n === this.data.maxStars;
            maxSelect.appendChild(opt);
        });
        maxSelect.addEventListener('change', () => {
            this.data.maxStars = parseInt(maxSelect.value) as 5 | 10;
            ratingInput.max = maxSelect.value;
            if (this.data.rating > this.data.maxStars) {
                this.data.rating = this.data.maxStars;
                ratingInput.value = String(this.data.rating);
            }
            this.renderStars(starsContainer);
        });

        const halfCheck = document.createElement('input');
        halfCheck.type = 'checkbox';
        halfCheck.classList.add('cdx-review__checkbox');
        halfCheck.checked = this.data.allowHalfStars;
        halfCheck.title = 'Allow half stars';

        const halfLabel = document.createElement('label');
        halfLabel.classList.add('cdx-review__checkbox-label');
        halfLabel.textContent = '½';
        halfLabel.title = 'Allow half stars';
        halfLabel.style.cursor = 'pointer';

        halfCheck.addEventListener('change', () => {
            this.data.allowHalfStars = halfCheck.checked;
            ratingInput.step = halfCheck.checked ? '0.5' : '1';
            if (!halfCheck.checked) {
                this.data.rating = Math.round(this.data.rating);
                ratingInput.value = String(this.data.rating);
            }
            this.renderStars(starsContainer);
        });

        configGroup.appendChild(maxSelect);
        configGroup.appendChild(halfCheck);
        configGroup.appendChild(halfLabel);
        row.appendChild(configGroup);

        container.appendChild(row);
        return container;
    }

    private renderStars(container: HTMLElement): void {
        container.innerHTML = '';
        for (let i = 1; i <= this.data.maxStars; i++) {
            const star = document.createElement('span');
            star.classList.add('cdx-review__star');
            if (i <= Math.floor(this.data.rating)) {
                star.classList.add('cdx-review__star--filled');
            } else if (this.data.allowHalfStars && i - 0.5 <= this.data.rating) {
                star.classList.add('cdx-review__star--half');
            }
            star.textContent = '★';
            star.addEventListener('click', () => {
                // Toggle: if already this value, set half or zero
                if (this.data.rating === i) {
                    this.data.rating = this.data.allowHalfStars ? i - 0.5 : i - 1;
                } else if (this.data.allowHalfStars && this.data.rating === i - 0.5) {
                    this.data.rating = i - 1;
                } else {
                    this.data.rating = i;
                }
                // Ensure rating is never negative
                this.data.rating = Math.max(0, this.data.rating);
                this.renderStars(container);
                // Update the number input
                const ratingInput = this.wrapper?.querySelector('.cdx-review__rating-value') as HTMLInputElement;
                if (ratingInput) ratingInput.value = String(this.data.rating);
            });
            container.appendChild(star);
        }
    }

    private createProsConsSection(): HTMLElement {
        const container = document.createElement('div');

        const label = document.createElement('div');
        label.classList.add(ReviewTool.CSS.sectionLabel);
        label.textContent = 'Pros & Cons';
        container.appendChild(label);

        const grid = document.createElement('div');
        grid.classList.add('cdx-review__proscons');

        grid.appendChild(this.createProsConsList('pros', '✓ Pros', 'cdx-review__proscons-header--pro'));
        grid.appendChild(this.createProsConsList('cons', '✗ Cons', 'cdx-review__proscons-header--con'));

        container.appendChild(grid);
        return container;
    }

    private createProsConsList(key: 'pros' | 'cons', headerText: string, headerClass: string): HTMLElement {
        const col = document.createElement('div');
        col.classList.add('cdx-review__proscons-col');

        const header = document.createElement('div');
        header.classList.add('cdx-review__proscons-header', headerClass);
        header.textContent = headerText;
        col.appendChild(header);

        const listContainer = document.createElement('div');
        listContainer.dataset.listKey = key;

        const renderItems = () => {
            listContainer.innerHTML = '';
            this.data[key].forEach((item, index) => {
                const row = document.createElement('div');
                row.classList.add('cdx-review__proscons-item');

                const input = document.createElement('input');
                input.type = 'text';
                input.value = item;
                input.placeholder = key === 'pros' ? 'Add a pro...' : 'Add a con...';
                input.addEventListener('input', () => {
                    this.data[key][index] = input.value;
                });

                const removeBtn = document.createElement('button');
                removeBtn.type = 'button';
                removeBtn.classList.add('cdx-review__proscons-remove');
                removeBtn.textContent = '×';
                removeBtn.addEventListener('click', () => {
                    if (this.data[key].length > 1) {
                        this.data[key].splice(index, 1);
                        renderItems();
                    } else {
                        this.data[key][0] = '';
                        renderItems();
                    }
                });

                row.appendChild(input);
                row.appendChild(removeBtn);
                listContainer.appendChild(row);
            });
        };

        renderItems();
        col.appendChild(listContainer);

        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.classList.add('cdx-review__proscons-add');
        addBtn.textContent = `+ Add ${key === 'pros' ? 'pro' : 'con'}`;
        addBtn.addEventListener('click', () => {
            this.data[key].push('');
            renderItems();
            // Focus the new input
            const inputs = listContainer.querySelectorAll('input');
            inputs[inputs.length - 1]?.focus();
        });
        col.appendChild(addBtn);

        return col;
    }

    private createCompactToggle(): HTMLElement {
        const group = document.createElement('div');
        group.classList.add(ReviewTool.CSS.inputGroup);
        group.style.flexDirection = 'row';
        group.style.alignItems = 'center';
        group.style.gap = '8px';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = 'cdx-review-compact';
        checkbox.classList.add('cdx-review__checkbox');
        checkbox.checked = this.data.compact;
        checkbox.addEventListener('change', () => {
            this.data.compact = checkbox.checked;
        });

        const label = document.createElement('label');
        label.htmlFor = 'cdx-review-compact';
        label.classList.add(ReviewTool.CSS.label);
        label.textContent = 'Compact mode';
        label.title = 'Render as a smaller horizontal card';
        label.style.margin = '0';
        label.style.cursor = 'pointer';

        group.appendChild(checkbox);
        group.appendChild(label);
        return group;
    }

    save(): ReviewData {
        return {
            ...this.data,
            pros: this.data.pros.filter((p) => p.trim() !== ''),
            cons: this.data.cons.filter((c) => c.trim() !== ''),
        };
    }

    validate(savedData: ReviewData): boolean {
        return savedData.title.trim() !== '';
    }
}
