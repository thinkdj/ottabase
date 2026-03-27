import type { API, BlockTool } from '@editorjs/editorjs';
import './StepsTool.css';

export interface StepsItem {
	title: string;
	content: string;
}

export interface StepsData {
	items: StepsItem[];
}

export interface StepsToolConfig {
	titlePlaceholder?: string;
	contentPlaceholder?: string;
	defaultItems?: StepsItem[];
}

const PLUS_ICON =
	'<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>';

const MENU_ICON =
	'<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.75"/><circle cx="12" cy="12" r="1.75"/><circle cx="12" cy="19" r="1.75"/></svg>';

const MOVE_UP_ICON =
	'<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="m6 11 6-6 6 6"/></svg>';

const MOVE_DOWN_ICON =
	'<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="m18 13-6 6-6-6"/></svg>';

const DELETE_ICON =
	'<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"/><path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/></svg>';

const STEPS_TOOLBOX_ICON =
	'<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="2"/><circle cx="6" cy="12" r="2"/><circle cx="6" cy="18" r="2"/><path d="M10 6h8"/><path d="M10 12h8"/><path d="M10 18h8"/></svg>';

export default class StepsTool implements BlockTool {
	private data: StepsData;
	private config: StepsToolConfig;
	private wrapper: HTMLElement | null = null;
	private listEl: HTMLElement | null = null;
	private openMenuIndex: number | null = null;
	private handleDocumentClickBound: (event: MouseEvent) => void;

	static get CSS() {
		return {
			baseClass: 'cdx-steps',
			wrapper: 'cdx-steps__wrapper',
			toolbar: 'cdx-steps__toolbar',
			addButton: 'cdx-steps__add-button',
			addButtonSecondary: 'cdx-steps__add-button--secondary',
			list: 'cdx-steps__list',
			item: 'cdx-steps__item',
			rail: 'cdx-steps__rail',
			badge: 'cdx-steps__badge',
			line: 'cdx-steps__line',
			card: 'cdx-steps__card',
			itemHeader: 'cdx-steps__item-header',
			titleInput: 'cdx-steps__title-input',
			contentInput: 'cdx-steps__content-input',
			menuWrap: 'cdx-steps__menu-wrap',
			iconButton: 'cdx-steps__icon-button',
			menu: 'cdx-steps__menu',
			menuItem: 'cdx-steps__menu-item',
			menuItemDanger: 'cdx-steps__menu-item--danger',
			footer: 'cdx-steps__footer',
		};
	}

	static get toolbox() {
		return {
			title: 'Steps',
			icon: STEPS_TOOLBOX_ICON,
		};
	}

	static get enableLineBreaks() {
		return true;
	}

	constructor({
		data,
		config,
	}: {
		data?: Partial<StepsData>;
		config?: StepsToolConfig;
		api: API;
		block?: { id?: string };
	}) {
		this.config = config || {};
		this.handleDocumentClickBound = this.handleDocumentClick.bind(this);

		const initialItems = this.toEditableItems(data?.items);
		this.data = {
			items: initialItems.length ? initialItems : this.getDefaultItems(),
		};
	}

	private getDefaultItems(): StepsItem[] {
		const configuredItems = this.toEditableItems(this.config.defaultItems);
		return configuredItems.length ? configuredItems : [{ title: '', content: '' }];
	}

	private toEditableItems(items?: Array<Partial<StepsItem>>): StepsItem[] {
		return (items || []).map((item) => ({
			title: String(item?.title ?? ''),
			content: String(item?.content ?? ''),
		}));
	}

	private toSavedItems(): StepsItem[] {
		return this.data.items
			.map((item) => ({
				title: item.title.trim(),
				content: item.content.trim(),
			}))
			.filter((item) => item.title !== '' || item.content !== '');
	}

	render(): HTMLElement {
		document.removeEventListener('click', this.handleDocumentClickBound);

		const wrapper = document.createElement('div');
		wrapper.classList.add(StepsTool.CSS.baseClass, StepsTool.CSS.wrapper, 'ob-plugin');

		const toolbar = document.createElement('div');
		toolbar.classList.add(StepsTool.CSS.toolbar);
		toolbar.appendChild(this.createAddButton('Add step', false));

		const list = document.createElement('div');
		list.classList.add(StepsTool.CSS.list);

		const footer = document.createElement('div');
		footer.classList.add(StepsTool.CSS.footer);
		footer.appendChild(this.createAddButton('Add step', true));

		wrapper.appendChild(toolbar);
		wrapper.appendChild(list);
		wrapper.appendChild(footer);

		this.wrapper = wrapper;
		this.listEl = list;

		this.renderItems();
		document.addEventListener('click', this.handleDocumentClickBound);

		return wrapper;
	}

	private createAddButton(label: string, secondary: boolean): HTMLButtonElement {
		const button = document.createElement('button');
		button.type = 'button';
		button.classList.add(StepsTool.CSS.addButton);
		if (secondary) {
			button.classList.add(StepsTool.CSS.addButtonSecondary);
		}
		button.innerHTML = `${PLUS_ICON}<span>${label}</span>`;
		button.setAttribute('aria-label', label);
		button.addEventListener('click', (event) => {
			event.preventDefault();
			event.stopPropagation();
			this.addStep();
		});
		return button;
	}

	private renderItems(): void {
		if (!this.listEl) {
			return;
		}

		this.listEl.innerHTML = '';

		this.data.items.forEach((item, index) => {
			this.listEl?.appendChild(this.buildItem(index, item));
		});
	}

	private buildItem(index: number, item: StepsItem): HTMLElement {
		const itemEl = document.createElement('div');
		itemEl.classList.add(StepsTool.CSS.item);

		const rail = document.createElement('div');
		rail.classList.add(StepsTool.CSS.rail);

		const badge = document.createElement('div');
		badge.classList.add(StepsTool.CSS.badge);
		badge.textContent = String(index + 1);
		rail.appendChild(badge);

		if (index < this.data.items.length - 1) {
			const line = document.createElement('div');
			line.classList.add(StepsTool.CSS.line);
			rail.appendChild(line);
		}

		const card = document.createElement('div');
		card.classList.add(StepsTool.CSS.card);

		const header = document.createElement('div');
		header.classList.add(StepsTool.CSS.itemHeader);

		const titleInput = document.createElement('input');
		titleInput.type = 'text';
		titleInput.classList.add(StepsTool.CSS.titleInput);
		titleInput.placeholder = this.config.titlePlaceholder || 'Step title';
		titleInput.value = item.title;
		titleInput.setAttribute('aria-label', `Step ${index + 1} title`);
		titleInput.setAttribute('data-step-title-index', String(index));
		titleInput.addEventListener('input', (event) => {
			this.data.items[index].title = (event.target as HTMLInputElement).value;
		});

		const menuWrap = document.createElement('div');
		menuWrap.classList.add(StepsTool.CSS.menuWrap);

		const menuButton = document.createElement('button');
		menuButton.type = 'button';
		menuButton.classList.add(StepsTool.CSS.iconButton);
		menuButton.innerHTML = MENU_ICON;
		menuButton.setAttribute('aria-label', `Open actions for step ${index + 1}`);
		menuButton.setAttribute('aria-expanded', String(this.openMenuIndex === index));
		menuButton.addEventListener('click', (event) => {
			event.preventDefault();
			event.stopPropagation();
			this.openMenuIndex = this.openMenuIndex === index ? null : index;
			this.renderItems();
		});
		menuWrap.appendChild(menuButton);

		if (this.openMenuIndex === index) {
			menuWrap.appendChild(this.buildMenu(index));
		}

		header.appendChild(titleInput);
		header.appendChild(menuWrap);

		const contentInput = document.createElement('textarea');
		contentInput.classList.add(StepsTool.CSS.contentInput, 'ob-textarea');
		contentInput.placeholder = this.config.contentPlaceholder || 'Describe this step...';
		contentInput.rows = 3;
		contentInput.value = item.content;
		contentInput.setAttribute('aria-label', `Step ${index + 1} content`);
		contentInput.setAttribute('data-step-content-index', String(index));
		contentInput.addEventListener('input', (event) => {
			this.data.items[index].content = (event.target as HTMLTextAreaElement).value;
		});

		card.appendChild(header);
		card.appendChild(contentInput);

		itemEl.appendChild(rail);
		itemEl.appendChild(card);

		return itemEl;
	}

	private buildMenu(index: number): HTMLElement {
		const menu = document.createElement('div');
		menu.classList.add(StepsTool.CSS.menu);
		menu.setAttribute('role', 'menu');

		menu.appendChild(
			this.createMenuItem('Move up', MOVE_UP_ICON, index === 0, () => {
				this.moveStep(index, -1);
			}),
		);
		menu.appendChild(
			this.createMenuItem('Move down', MOVE_DOWN_ICON, index === this.data.items.length - 1, () => {
				this.moveStep(index, 1);
			}),
		);
		menu.appendChild(
			this.createMenuItem(
				'Delete step',
				DELETE_ICON,
				false,
				() => {
					this.removeStep(index);
				},
				true,
			),
		);

		return menu;
	}

	private createMenuItem(
		label: string,
		icon: string,
		disabled: boolean,
		onClick: () => void,
		isDanger = false,
	): HTMLButtonElement {
		const button = document.createElement('button');
		button.type = 'button';
		button.classList.add(StepsTool.CSS.menuItem);
		if (isDanger) {
			button.classList.add(StepsTool.CSS.menuItemDanger);
		}
		button.innerHTML = `${icon}<span>${label}</span>`;
		button.disabled = disabled;
		button.setAttribute('role', 'menuitem');
		button.addEventListener('click', (event) => {
			event.preventDefault();
			event.stopPropagation();
			if (button.disabled) {
				return;
			}
			onClick();
		});
		return button;
	}

	private addStep(): void {
		this.data.items.push({ title: '', content: '' });
		this.openMenuIndex = null;
		this.renderItems();
	}

	private moveStep(index: number, direction: -1 | 1): void {
		const nextIndex = index + direction;
		if (nextIndex < 0 || nextIndex >= this.data.items.length) {
			return;
		}

		const [movedItem] = this.data.items.splice(index, 1);
		this.data.items.splice(nextIndex, 0, movedItem);
		this.openMenuIndex = null;
		this.renderItems();
	}

	private removeStep(index: number): void {
		if (this.data.items.length === 1) {
			this.data.items = [{ title: '', content: '' }];
		} else {
			this.data.items.splice(index, 1);
		}
		this.openMenuIndex = null;
		this.renderItems();
	}

	private handleDocumentClick(event: MouseEvent): void {
		if (!this.wrapper || !this.wrapper.contains(event.target as Node)) {
			if (this.openMenuIndex !== null) {
				this.openMenuIndex = null;
				this.renderItems();
			}
		}
	}

	save(): StepsData {
		return {
			items: this.toSavedItems(),
		};
	}

	validate(savedData: StepsData): boolean {
		return Array.isArray(savedData.items) && savedData.items.some((item) => item.title.trim() || item.content.trim());
	}

	destroy(): void {
		document.removeEventListener('click', this.handleDocumentClickBound);
	}
}
