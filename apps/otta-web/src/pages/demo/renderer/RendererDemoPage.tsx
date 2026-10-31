import { MediaLightboxProvider } from '@ottabase/medialibrary/react';
import { HtmlRenderer, OttaRenderer } from '@ottabase/ottarenderer';
import '@ottabase/ottarenderer/styles';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@ottabase/ui';
import { DemoPageHeader } from '../DemoPageHeader';

// Sample EditorJS data with rich content
const sampleEditorJSData = {
    time: 1672531200000,
    blocks: [
        {
            id: 'header1',
            type: 'header',
            data: {
                text: 'Welcome to OttaRenderer',
                level: 1,
            },
        },
        {
            id: 'para1',
            type: 'paragraph',
            data: {
                text: 'This is a comprehensive demonstration of the <code class="inline-code">@ottabase/ottarenderer</code> package. It showcases various EditorJS block types with <mark class="cdx-marker">highlighted text</mark> and <b>bold formatting</b>.',
            },
        },
        {
            id: 'advimg1',
            type: 'advancedImage',
            data: {
                image: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=800&q=80',
                caption: 'Stellar nursery – the cosmic birthplace of stars',
                alt: 'Nebula in deep space',
                withBorder: true,
                stretched: false,
                aspectRatio: '16:9',
            },
        },
        {
            id: 'header2',
            type: 'header',
            data: {
                text: 'Key Features',
                level: 2,
            },
        },
        {
            id: 'list1',
            type: 'list',
            data: {
                style: 'unordered',
                items: [
                    { content: 'EditorJS block rendering with custom styles', items: [] },
                    {
                        content: 'Advanced image support with borders, backgrounds, and aspect ratios',
                        items: [],
                    },
                    { content: 'Interactive checklists and nested lists', items: [] },
                    { content: 'Code blocks with syntax highlighting', items: [] },
                    { content: 'Tables with headers and responsive design', items: [] },
                    { content: 'Quotes, warnings, and more', items: [] },
                ],
            },
        },
        {
            id: 'advimg2',
            type: 'advancedImage',
            data: {
                image: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=1200&q=80',
                caption: 'Earth from orbit – pale blue dot in the cosmic ocean',
                alt: 'Earth from space',
                withBackground: true,
                featuredImage: true,
                stretched: true,
            },
        },
        {
            id: 'header-media-gallery',
            type: 'header',
            data: {
                text: 'Media Gallery Block',
                level: 2,
            },
        },
        {
            id: 'mediagallery1',
            type: 'mediaGallery',
            data: {
                title: 'Space Media Gallery',
                caption: 'Click any item to open the immersive lightbox.',
                layout: 'grid-featured',
                items: [
                    {
                        media: 'https://images.unsplash.com/photo-1614732414444-096e5f1122d5?w=1200&q=80',
                        title: 'Milky Way Core',
                        caption: 'Our galactic center',
                        mediaKind: 'image',
                    },
                    {
                        media: 'https://www.w3schools.com/html/mov_bbb.mp4',
                        title: 'Big Buck Bunny',
                        caption: 'Sample video',
                        mediaKind: 'video',
                        mimeType: 'video/mp4',
                    },
                    {
                        media: 'https://images.unsplash.com/photo-1454789548928-9efd52dc4031?w=1200&q=80',
                        title: 'Astronaut',
                        caption: 'Spacewalk',
                        mediaKind: 'image',
                    },
                    {
                        media: 'https://images.unsplash.com/photo-1516339901601-2e1b62dc0c45?w=1200&q=80',
                        title: 'Saturn Rings',
                        caption: 'Gas giant',
                        mediaKind: 'image',
                    },
                ],
            },
        },
        {
            id: 'header3',
            type: 'header',
            data: {
                text: 'Interactive Elements',
                level: 2,
            },
        },
        {
            id: 'checklist1',
            type: 'checklist',
            data: {
                items: [
                    { text: 'Create ottarenderer package ✨', checked: true },
                    { text: 'Port EditorJS renderer with all block types', checked: true },
                    { text: 'Add HTML renderer for basic content', checked: true },
                    { text: 'Remove Mantine dependencies', checked: true },
                    { text: 'Use shadcn design tokens', checked: true },
                    { text: 'Create comprehensive demo', checked: true },
                    { text: 'Test dark mode compatibility', checked: false },
                    { text: 'Deploy to production', checked: false },
                ],
            },
        },
        {
            id: 'steps1',
            type: 'steps',
            data: {
                items: [
                    {
                        title: 'Choose the right block mix',
                        content:
                            'Start with headers, paragraphs, and supporting media so the content structure is clear.',
                    },
                    {
                        title: 'Layer in guided actions',
                        content: 'Use steps when readers need a clear sequence instead of a dense paragraph wall.',
                    },
                    {
                        title: 'Ship a polished walkthrough',
                        content:
                            'Render the same saved block as a clean timeline in your frontend with minimal styling work.',
                    },
                ],
            },
        },
        {
            id: 'quote1',
            type: 'quote',
            data: {
                text: 'Good design is as little design as possible. Less, but better – because it concentrates on the essential aspects.',
                caption: 'Dieter Rams - Ten Principles of Good Design',
                alignment: 'left',
            },
        },
        {
            id: 'header4',
            type: 'header',
            data: {
                text: 'Code Example',
                level: 2,
            },
        },
        {
            id: 'para2',
            type: 'paragraph',
            data: {
                text: "Here's how to use the renderer in your React application:",
            },
        },
        {
            id: 'code1',
            type: 'code',
            data: {
                code: `import { HtmlRenderer, OttaRenderer } from "@ottabase/ottarenderer";
import "@ottabase/ottarenderer/styles";

// Render Editor.js content: no prose wrapper, the renderer owns its typography
function MyContent({ editorData }) {
  return <OttaRenderer data={editorData} />;
}

// Render HTML content
function MyHtmlContent({ htmlString }) {
  return <HtmlRenderer content={htmlString} />;
}`,
                language: 'tsx',
            },
        },
        {
            id: 'warning1',
            type: 'warning',
            data: {
                title: 'Important Note',
                message:
                    'This package uses shadcn design tokens for theming. Make sure your application has the necessary CSS variables defined for proper styling and dark mode support.',
            },
        },
        {
            id: 'header5',
            type: 'header',
            data: {
                text: 'Feature Comparison',
                level: 2,
            },
        },
        {
            id: 'table1',
            type: 'table',
            data: {
                withHeadings: true,
                content: [
                    ['Feature', 'EditorJS', 'HTML', 'Markdown'],
                    ['Block Rendering', '✓', '✓', '✗'],
                    ['Custom Styles', '✓', '✓', 'Limited'],
                    ['Dark Mode', '✓', '✓', '✓'],
                    ['TypeScript', '✓', '✓', '✓'],
                    ['Interactive Elements', '✓', 'Limited', '✗'],
                    ['Image Optimization', '✓', '✗', '✗'],
                ],
            },
        },
        {
            id: 'advimg3',
            type: 'advancedImage',
            data: {
                image: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1000&q=80',
                caption: 'Earth at night – the glow of human civilization from orbit',
                alt: 'Earth at night from space',
                withBorder: true,
                aspectRatio: '4:3',
            },
        },
        {
            id: 'header6',
            type: 'header',
            data: {
                text: 'Nested Lists',
                level: 2,
            },
        },
        {
            id: 'list2',
            type: 'list',
            data: {
                style: 'ordered',
                items: [
                    {
                        content: 'Getting Started',
                        items: [
                            { content: 'Install the package', items: [] },
                            { content: 'Import components', items: [] },
                            { content: 'Configure renderers', items: [] },
                        ],
                    },
                    {
                        content: 'Advanced Usage',
                        items: [
                            { content: 'Custom block renderers', items: [] },
                            { content: 'Styling customization', items: [] },
                            { content: 'Block injection', items: [] },
                        ],
                    },
                    {
                        content: 'Deployment',
                        items: [
                            { content: 'Build the package', items: [] },
                            { content: 'Test in production', items: [] },
                        ],
                    },
                ],
            },
        },
        {
            id: 'quote2',
            type: 'quote',
            data: {
                text: 'First, solve the problem. Then, write the code.',
                caption: 'John Johnson',
                alignment: 'center',
            },
        },
        {
            id: 'delimiter1',
            type: 'delimiter',
            data: {},
        },
        {
            id: 'para3',
            type: 'paragraph',
            data: {
                text: 'The <code class="inline-code">@ottabase/ottarenderer</code> package is lightweight, flexible, and designed to work seamlessly with modern React applications. It uses <mark class="cdx-marker">shadcn design tokens</mark> for consistent theming and supports both light and dark modes out of the box.',
            },
        },
    ],
    version: '2.28.0',
};

// Sample HTML content
const sampleHtmlContent = `
<h2>HTML Renderer Demo</h2>
<p>The <strong>HtmlRenderer</strong> component can render basic HTML content with the same typography the block renderer uses.</p>
<h3>Supported Elements</h3>
<ul>
    <li>Headings (h1-h6)</li>
    <li>Paragraphs with <em>emphasis</em> and <strong>strong</strong> text</li>
    <li>Lists (ordered and unordered)</li>
    <li>Links and <code>inline code</code></li>
    <li>Code blocks and blockquotes</li>
</ul>
<blockquote>
    <p>This is a blockquote rendered from HTML. It demonstrates how the HtmlRenderer handles quoted content with proper styling.</p>
</blockquote>
<h3>Code Example</h3>
<pre><code>const example = "HTML code block";
console.log(example);

// Styled by the renderer's own stylesheet
function greet(name) {
  return \`Hello, \${name}!\`;
}</code></pre>
<p>The renderer automatically applies appropriate styles for light and dark modes, ensuring your content looks great in any theme.</p>
`;

export function RendererDemoPage() {
    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <DemoPageHeader
                title="OttaRenderer"
                description="Comprehensive demonstration of EditorJS and HTML content rendering with advanced features."
            />

            <Tabs defaultValue="editorjs" className="w-full">
                <TabsList>
                    <TabsTrigger value="editorjs">EditorJS Renderer</TabsTrigger>
                    <TabsTrigger value="html">HTML Renderer</TabsTrigger>
                </TabsList>

                <TabsContent value="editorjs" className="space-y-4 py-4">
                    <Card className="rounded-xl border-border/60 shadow-none">
                        <CardHeader>
                            <CardTitle className="text-[0.9375rem] font-semibold">EditorJS Content</CardTitle>
                            <CardDescription>
                                Rich content rendering with advanced images, interactive checklists, code blocks,
                                tables, and more.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <MediaLightboxProvider variant="immersive">
                                <OttaRenderer data={sampleEditorJSData} />
                            </MediaLightboxProvider>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="html" className="space-y-4 py-4">
                    <Card className="rounded-xl border-border/60 shadow-none">
                        <CardHeader>
                            <CardTitle className="text-[0.9375rem] font-semibold">HTML Content</CardTitle>
                            <CardDescription>
                                Sanitized HTML rendered with the renderer's typography contract and dark mode support.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <HtmlRenderer content={sampleHtmlContent} />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <Card>
                <CardHeader>
                    <CardTitle className="text-[0.9375rem] font-semibold">Package Features</CardTitle>
                    <CardDescription>What's included in @ottabase/ottarenderer</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <h3 className="font-semibold">EditorJS Renderers</h3>
                            <ul className="text-sm text-muted-foreground space-y-1">
                                <li>• Advanced Image Block (with borders, backgrounds, aspect ratios)</li>
                                <li>• Interactive Checklist</li>
                                <li>• Steps timeline / walkthrough block</li>
                                <li>• Code Block (with language labels)</li>
                                <li>• Embeds, link previews, delimiters</li>
                                <li>• List (ordered/unordered with nesting)</li>
                                <li>• Quote (with alignment options)</li>
                                <li>• Table (with headers)</li>
                                <li>• Warning/Alert boxes</li>
                            </ul>
                        </div>
                        <div className="space-y-2">
                            <h3 className="font-semibold">Additional Features</h3>
                            <ul className="text-sm text-muted-foreground space-y-1">
                                <li>• HTML content rendering</li>
                                <li>• Injections: place anything between blocks</li>
                                <li>• Design tokens end to end: colours, radii, motion, type scale</li>
                                <li>• Dark mode compatible</li>
                                <li>• TypeScript support</li>
                                <li>• Zero third-party renderer or HTML parser</li>
                                <li>• Customizable styles</li>
                            </ul>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
