/**
 * A custom block written against the editor's kit: the shape a third-party block takes.
 *
 * The alert is edited where it lives: the block shows the alert card itself in the chosen tone,
 * with the title and message typed straight into it, and a row of tone chips above. There is no
 * renderer for this block, so the shell runs without the Preview switch; the card already is the
 * preview.
 */
import {
    BlockShell,
    kit,
    type API,
    type BlockTool,
    type BlockToolConstructorOptions,
    type IconName,
} from '@ottabase/ottaeditor';
import './CustomAlertPlugin.css';

type AlertType = 'info' | 'success' | 'warning' | 'error';

interface AlertConfig {
    defaultType?: AlertType;
}

interface AlertData {
    type: AlertType;
    title?: string;
    message: string;
}

const TONES: ReadonlyArray<{ value: AlertType; label: string; icon: IconName }> = [
    { value: 'info', label: 'Info', icon: 'callout' },
    { value: 'success', label: 'Success', icon: 'check' },
    { value: 'warning', label: 'Warning', icon: 'warning' },
    { value: 'error', label: 'Error', icon: 'x' },
];

export default class CustomAlertPlugin implements BlockTool {
    private api: API;
    private data: AlertData;
    private config: AlertConfig;
    private shell: BlockShell | null = null;

    static get toolbox() {
        return { title: 'Alert', icon: kit.iconEl('callout').innerHTML };
    }

    static get enableLineBreaks() {
        return true;
    }

    constructor({ data, config, api }: BlockToolConstructorOptions<AlertData, AlertConfig>) {
        this.api = api;
        this.config = config || {};
        this.data = {
            type: data?.type || this.config.defaultType || 'info',
            title: data?.title || '',
            message: data?.message || '',
        };
    }

    render(): HTMLElement {
        const shell = new BlockShell({ type: 'alert', previewable: false, summary: this.tone().label });
        this.shell = shell;

        const card = kit.h('div', { className: 'demo-alert', dataset: { tone: this.data.type } });
        const iconWell = kit.h(
            'span',
            { className: 'demo-alert__icon', 'aria-hidden': 'true' },
            kit.iconEl(this.tone().icon, 18),
        );

        const title = kit.h('input', {
            className: 'demo-alert__title',
            type: 'text',
            value: this.data.title ?? '',
            placeholder: 'Title (optional)',
            'aria-label': 'Alert title',
        });
        title.addEventListener('input', () => {
            this.data.title = title.value;
        });

        const message = kit.h('textarea', {
            className: 'demo-alert__message',
            value: this.data.message,
            placeholder: 'What should the reader know?',
            rows: 2,
            'aria-label': 'Alert message',
        });
        const grow = () => {
            message.style.height = 'auto';
            message.style.height = `${message.scrollHeight}px`;
        };
        message.addEventListener('input', () => {
            this.data.message = message.value;
            grow();
        });
        requestAnimationFrame(grow);

        card.append(iconWell, kit.h('div', { className: 'demo-alert__body' }, title, message));

        // Tone chips: a coloured dot and a word each, radio semantics, arrow keys move
        const tones = kit.h('div', { className: 'demo-alert__tones', role: 'radiogroup', 'aria-label': 'Alert tone' });
        const chips = TONES.map((t) => {
            const chip = kit.h(
                'button',
                {
                    type: 'button',
                    role: 'radio',
                    className: 'demo-alert__tone',
                    dataset: { tone: t.value },
                    'aria-checked': String(t.value === this.data.type),
                    tabIndex: t.value === this.data.type ? 0 : -1,
                },
                kit.h('span', { className: 'demo-alert__dot', 'aria-hidden': 'true' }),
                t.label,
            );
            chip.addEventListener('click', () => select(t.value));
            return chip;
        });
        const select = (type: AlertType) => {
            this.data.type = type;
            card.dataset.tone = type;
            iconWell.replaceChildren(kit.iconEl(this.tone().icon, 18));
            chips.forEach((c) => {
                const on = c.dataset.tone === type;
                c.setAttribute('aria-checked', String(on));
                c.tabIndex = on ? 0 : -1;
            });
            shell.setSummary(this.tone().label);
        };
        tones.addEventListener('keydown', (e) => {
            if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
            e.preventDefault();
            const i = TONES.findIndex((t) => t.value === this.data.type);
            const next = (i + (e.key === 'ArrowRight' ? 1 : -1) + TONES.length) % TONES.length;
            select(TONES[next]!.value);
            chips[next]!.focus();
        });
        tones.append(...chips);

        shell.fields.append(kit.stack(tones, card));
        return shell.element;
    }

    private tone() {
        return TONES.find((t) => t.value === this.data.type) ?? TONES[0]!;
    }

    save(): AlertData {
        const title = this.data.title?.trim();
        return { type: this.data.type, ...(title ? { title } : {}), message: this.data.message };
    }

    validate(savedData: AlertData): boolean {
        return savedData.message.trim() !== '';
    }

    destroy(): void {
        this.shell?.destroy();
    }
}
