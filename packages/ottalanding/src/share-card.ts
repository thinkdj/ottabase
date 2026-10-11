/**
 * The social image: the 1200×630 card shown when a page is shared on X, LinkedIn, Slack, …
 *
 * Its content is typed like everything else (`SHARE_FIELDS`). The admin draws it on a canvas
 * with `drawShareCard` — the same function for the live preview and the uploaded PNG, so what
 * the editor shows is exactly what gets shared.
 */

import { defineFields, type Data } from './fields';
import { readableOn } from './themes';

export const SHARE_FIELDS = defineFields({
    heading: { kind: 'text', label: 'Heading' },
    subtext: { kind: 'textarea', label: 'Supporting text' },
    color: { kind: 'color', label: 'Background color', help: 'Defaults to the brand color.' },
    backgroundUrl: {
        kind: 'image',
        label: 'Background image',
        help: 'Shown behind the text, darkened so the text stays readable.',
    },
    /** The rendered PNG, written by the admin when the card is saved; never typed in. */
    imageUrl: { kind: 'image', label: 'Rendered image' },
});

export type ShareCard = Data<typeof SHARE_FIELDS>;

export const SHARE_CARD_SIZE = { width: 1200, height: 630 } as const;

/** What `drawShareCard` needs: the card's text and colors, already-loaded images, and font families. */
export type ShareCardScene = {
    heading: string;
    subtext?: string;
    /** `#rrggbb` */
    color: string;
    background?: CanvasImageSource & { width: number; height: number };
    logo?: CanvasImageSource & { width: number; height: number };
    siteName: string;
    /** Shown top-right, e.g. `acme.dev`. */
    domain?: string;
    fonts: { heading: string; body: string };
};

/** The slice of CanvasRenderingContext2D the card uses (lets tests pass a fake). */
type Ctx = Pick<
    CanvasRenderingContext2D,
    | 'fillStyle'
    | 'font'
    | 'globalAlpha'
    | 'textBaseline'
    | 'fillRect'
    | 'fillText'
    | 'measureText'
    | 'drawImage'
    | 'createLinearGradient'
    | 'beginPath'
    | 'arc'
    | 'fill'
    | 'save'
    | 'restore'
    | 'textAlign'
>;

/**
 * Break `text` into at most `maxLines` lines that fit `maxWidth` in the context's current font.
 * Words never split; a word longer than a line overflows rather than breaking mid-word, and text
 * past the last line is cut with an ellipsis.
 */
export function wrapLines(ctx: Pick<Ctx, 'measureText'>, text: string, maxWidth: number, maxLines: number): string[] {
    const words = text.trim().split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = '';
    for (let i = 0; i < words.length; i++) {
        const next = line ? `${line} ${words[i]}` : words[i];
        if (!line || ctx.measureText(next).width <= maxWidth) {
            line = next;
            continue;
        }
        if (lines.length === maxLines - 1) {
            lines.push(ellipsize(ctx, `${line} ${words.slice(i).join(' ')}`, maxWidth));
            return lines;
        }
        lines.push(line);
        line = words[i];
    }
    if (line) lines.push(line);
    return lines;
}

function ellipsize(ctx: Pick<Ctx, 'measureText'>, text: string, maxWidth: number): string {
    let t = text;
    while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1).trimEnd();
    return `${t}…`;
}

/** Scale-to-cover source rectangle for drawing `img` into a w×h box without distortion. */
function cover(img: { width: number; height: number }, w: number, h: number) {
    const scale = Math.max(w / img.width, h / img.height);
    const sw = w / scale;
    const sh = h / scale;
    return [(img.width - sw) / 2, (img.height - sh) / 2, sw, sh] as const;
}

const PAD = 80;

/** Draw the card onto a 1200×630 context. Pure: everything it needs arrives in `scene`. */
export function drawShareCard(ctx: Ctx, scene: ShareCardScene): void {
    const { width: W, height: H } = SHARE_CARD_SIZE;
    const withImage = Boolean(scene.background?.width);
    const ink = withImage ? '#ffffff' : readableOn(scene.color);

    ctx.save();
    ctx.globalAlpha = 1;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillStyle = scene.color;
    ctx.fillRect(0, 0, W, H);

    if (withImage && scene.background) {
        ctx.drawImage(scene.background, ...cover(scene.background, W, H), 0, 0, W, H);
        // Darken toward the text side so white type always reads, whatever the photo.
        const shade = ctx.createLinearGradient(0, 0, W, 0);
        shade.addColorStop(0, 'rgba(0,0,0,0.78)');
        shade.addColorStop(0.65, 'rgba(0,0,0,0.45)');
        shade.addColorStop(1, 'rgba(0,0,0,0.2)');
        ctx.fillStyle = shade;
        ctx.fillRect(0, 0, W, H);
    } else {
        // A quiet tint circle so a flat color still feels designed.
        ctx.globalAlpha = 0.08;
        ctx.fillStyle = ink;
        ctx.beginPath();
        ctx.arc(W - 120, 90, 300, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    // Brand row: logo (or just the name) on the left, the domain on the right.
    ctx.fillStyle = ink;
    let x = PAD;
    const rowY = 72;
    if (scene.logo?.width) {
        const h = 56;
        const w = Math.min((scene.logo.width / scene.logo.height) * h, 280);
        ctx.drawImage(scene.logo, x, rowY, w, h);
        x += w + 18;
    }
    // When the heading already is the site's name (the site's default card), don't say it twice.
    if (scene.heading.trim() !== scene.siteName.trim()) {
        ctx.font = `600 30px "${scene.fonts.body}", system-ui, sans-serif`;
        ctx.fillText(scene.siteName, x, rowY + 39);
    }
    if (scene.domain) {
        ctx.globalAlpha = 0.75;
        ctx.font = `400 26px "${scene.fonts.body}", system-ui, sans-serif`;
        ctx.textAlign = 'right';
        ctx.fillText(scene.domain, W - PAD, rowY + 38);
        ctx.textAlign = 'left';
        ctx.globalAlpha = 1;
    }

    // Heading: the largest size (76 → 48px) at which it fits in three lines.
    const maxWidth = W - PAD * 2;
    let size = 76;
    let lines: string[] = [];
    for (; size >= 48; size -= 4) {
        ctx.font = `700 ${size}px "${scene.fonts.heading}", system-ui, sans-serif`;
        lines = wrapLines(ctx, scene.heading, maxWidth, 3);
        if (lines.length <= 3 && !lines.at(-1)?.endsWith('…')) break;
    }
    size = Math.max(size, 48);
    const lineHeight = Math.round(size * 1.12);

    const sub = scene.subtext?.trim();
    ctx.font = `400 32px "${scene.fonts.body}", system-ui, sans-serif`;
    const subLines = sub ? wrapLines(ctx, sub, maxWidth, 2) : [];

    // Sit the text block in the lower part of the card, under a short accent bar.
    const blockHeight = lines.length * lineHeight + (subLines.length ? 28 + subLines.length * 44 : 0);
    let y = Math.max(210, H - PAD - blockHeight);
    ctx.fillRect(PAD, y - 40, 72, 6);

    ctx.font = `700 ${size}px "${scene.fonts.heading}", system-ui, sans-serif`;
    for (const line of lines) {
        y += lineHeight;
        ctx.fillText(line, PAD, y - Math.round(size * 0.22));
    }
    if (subLines.length) {
        y += 28;
        ctx.globalAlpha = 0.85;
        ctx.font = `400 32px "${scene.fonts.body}", system-ui, sans-serif`;
        for (const line of subLines) {
            y += 44;
            ctx.fillText(line, PAD, y - 10);
        }
    }
    ctx.restore();
}
