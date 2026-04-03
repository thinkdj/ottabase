# @ottabase/ottarenderer

React renderer for [Editor.js](https://editorjs.io/) content and generic HTML.

## Features

- **Editor.js Support**: Renders blocks from Editor.js (headers, paragraphs, lists, images, etc.).
- **Custom Blocks**: Includes renderers for `@ottabase/ottaeditor` custom blocks (AdvancedImage, CTA, Disclosure,
  Layout, Review, Spoiler, Steps, etc.).
- **HTML Renderer**: Safe HTML rendering utility.
- **Tailwind Configured**: Styled with Tailwind CSS via `@ottabase/ui-base`.
- **Global Theming**: Components use semantic theme token classes (`bg-primary`, `text-foreground`, `border-border`) and
  adapt to light/dark mode.
- **Extensible**: Supports custom block injectors.

## Installation

```bash
pnpm add @ottabase/ottarenderer
```

Code blocks use `@ottabase/ui-code-highlight`. Import its styles in your app (e.g. in `globals.css`):

```css
@import '@ottabase/ui-code-highlight/styles.css';
```

## Usage

### Rendering Editor.js Data

```tsx
import { default as Renderer } from 'editorjs-blocks-react-renderer';
import { blockClass, customRenderers, defaultEJSRConfigs } from '@ottabase/ottarenderer';

function BlogPost({ content }) {
    return (
        <article className="prose dark:prose-invert max-w-none">
            <Renderer
                data={content}
                config={{
                    ...defaultEJSRConfigs,
                }}
                renderers={customRenderers}
            />
        </article>
    );
}
```

### Rendering HTML

```tsx
import { HtmlRenderer } from '@ottabase/ottarenderer';

function SafeContent({ htmlString }) {
    return <HtmlRenderer html={htmlString} className="my-content" />;
}
```

## Supported Blocks

### Standard Editor.js Blocks

Header, Paragraph, List, Quote, Code, Table, Delimiter, Attaches.

### Custom Blocks

| Component            | Description                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| `AdvancedImageBlock` | Enhanced image with caption and layout options                                                    |
| `BeforeAfter`        | Drag-to-compare image slider with orientation, height, imageFit, and per-image position           |
| `Checklist`          | Interactive checklist items                                                                       |
| `Code`               | Syntax-highlighted code block                                                                     |
| `CTA`                | Call-to-action button with alignment (left/center/right) and four theme-aware styles              |
| `Disclosure`         | Transparency notice block: AI usage disclosure and/or sponsored-content disclaimer                |
| `Faq`                | FAQ accordion (`accordion` / `flat` style) with `FAQPage` schema.org structured data              |
| `ImageHotspots`      | Interactive image with clickable numbered markers and tooltips                                    |
| `Layout`             | Multi-column layout (6 presets) with recursive block rendering per column                         |
| `List`               | Nested ordered/unordered list                                                                     |
| `Map`                | Embedded map (OpenStreetMap / Google Maps)                                                        |
| `MediaEmbed`         | Embedded media (video, audio, PDF, document) with native playback via `MediaPreview`              |
| `MediaGallery`       | Gallery block with 5 presets (`grid-balanced`, `grid-featured`, `masonry`, `filmstrip`, `mosaic`) |
| `Quote`              | Styled pull-quote with attribution                                                                |
| `Review`             | Product/service review card with star rating, pros/cons, CTA link, and verdict                    |
| `Spoiler`            | Click-to-reveal blurred text                                                                      |
| `Steps`              | Minimal numbered timeline for tutorials, onboarding, and walkthroughs                             |
| `Table`              | Data table                                                                                        |
| `Testimonial`        | Social-proof quote card (`card` / `minimal` / `featured`) with avatar, stars, `Review` schema     |
| `Warning`            | Alert/callout box                                                                                 |

## Customization

Override or extend renderers:

```typescript
import { customRenderers } from '@ottabase/ottarenderer';

const myRenderers = {
    ...customRenderers,
    header: MyCustomHeaderComponent,
};
```

## Disclosure Block

The `Disclosure` component renders a styled notice that can include:

- **AI Disclosure**: Communicates how much AI was involved in producing the content.
    - Presets: `slight`, `mid`, `high` — each with standardised wording
    - Custom: percentage value (e.g. "Approximately 60% of this content was created with AI assistance.")
- **Sponsored Disclosure**: Notes commercial relationships.
    - Preset standard wording or author-supplied custom text.

```tsx
import { Disclosure } from '@ottabase/ottarenderer';

<Disclosure
    data={{
        aiEnabled: true,
        aiLevel: 'mid',
        sponsoredEnabled: true,
        sponsoredType: 'preset',
    }}
/>;
```

## CTA Block

The `CTA` component uses semantic theme token classes (`bg-primary`, `text-primary-foreground`, `border-border`), so it
inherits app-level theming and light/dark mode.

```tsx
import { CTA } from '@ottabase/ottarenderer';

<CTA
    data={{
        text: 'Get Started',
        url: 'https://example.com',
        style: 'primary', // 'primary' | 'secondary' | 'outline' | 'ghost'
        alignment: 'center', // 'left' | 'center' | 'right'
        openInNewTab: false,
    }}
/>;
```

## Steps Block

The `Steps` component renders a compact vertical timeline with numbered markers and theme-safe light/dark styling.

```tsx
import { Steps } from '@ottabase/ottarenderer';

<Steps
    data={{
        items: [
            { title: 'Choose a template', content: 'Pick the layout that fits your guide.' },
            { title: 'Add the details', content: 'Write short, scannable content for each step.' },
            { title: 'Publish', content: 'Render the saved steps data in your frontend.' },
        ],
    }}
/>;
```

## BeforeAfter Block

Drag-to-compare slider for before/after image pairs. Supports horizontal/vertical orientation, custom height, cover mode
with per-image position, and smart interactions (double-click toggling).

```tsx
import { BeforeAfter } from '@ottabase/ottarenderer';

<BeforeAfter
    data={{
        beforeUrl: '/images/before.jpg',
        afterUrl: '/images/after.jpg',
        beforeLabel: 'Before', // optional, null hides label
        afterLabel: 'After', // optional, null hides label
        orientation: 'horizontal', // 'horizontal' | 'vertical'
        sliderPosition: 50, // initial slider position 0-100
        caption: 'Room renovation comparison',
        height: '400px', // optional fixed height
        imageFit: 'cover', // 'contain' | 'cover'
        beforePosition: 'center', // ImagePosition (9 presets)
        afterPosition: 'top', // ImagePosition (9 presets)
    }}
/>;
```

**ImagePosition presets:** `'top-left'`, `'top'`, `'top-right'`, `'left'`, `'center'`, `'right'`, `'bottom-left'`,
`'bottom'`, `'bottom-right'`.

## ImageHotspots Block

Interactive image with numbered clickable markers that reveal tooltips on click.

```tsx
import { ImageHotspots } from '@ottabase/ottarenderer';

<ImageHotspots
    data={{
        imageUrl: '/images/product.jpg',
        alt: 'Product overview',
        caption: 'Click markers to learn more',
        hotspots: [
            { id: '1', x: 25, y: 30, title: 'Power Button', content: 'Press to turn on/off' },
            { id: '2', x: 75, y: 50, title: 'USB Port', content: 'Supports USB 3.0' },
        ],
        height: '500px', // optional fixed height
        imageFit: 'cover', // 'contain' | 'cover'
        imagePosition: 'center', // ImagePosition (9 presets)
    }}
/>;
```
