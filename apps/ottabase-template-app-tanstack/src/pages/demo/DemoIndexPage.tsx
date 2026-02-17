import { APP_META } from '@/ottabase/config/app.config';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ottabase/ui-shadcn';
import { Link } from '@tanstack/react-router';

export function DemoIndexPage() {
    return (
        <div className="flex min-h-[calc(100vh-10rem)] flex-col gap-8">
            <div className="flex flex-col gap-4">
                <Button asChild variant="ghost" className="w-fit">
                    <Link to="/">← Back to Home</Link>
                </Button>

                <h1 className="text-4xl font-bold tracking-tight">{APP_META.appName} - Demo Gallery</h1>
                <p className="text-lg text-muted-foreground">
                    Explore different UI component libraries and features integrated into this template.
                </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Mantine Demo</CardTitle>
                        <CardDescription>
                            Full-featured demo showcasing Mantine components, theme switching, state management, and
                            more
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button asChild className="w-full">
                            <Link to="/demo/mantine">View Mantine Demo</Link>
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>shadcn/ui Demo</CardTitle>
                        <CardDescription>
                            Explore shadcn/ui primitives with Tailwind utilities and shared theme providers
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button asChild variant="outline" className="w-full">
                            <Link to="/demo/shadcn">View shadcn/ui Demo</Link>
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>OttaEditor</CardTitle>
                        <CardDescription>
                            Rich text editor with custom plugins and formatting capabilities
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button asChild variant="outline" className="w-full">
                            <Link to="/demo/ottaeditor">View OttaEditor</Link>
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Image Cropper</CardTitle>
                        <CardDescription>
                            Vanilla image cropper: crop, flip, rotate. Square/rect/circle viewfinder. PNG/JPEG. Zero
                            React. ~2–3 KB gzipped.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button asChild variant="outline" className="w-full">
                            <Link to="/demo/cropper">View Cropper Demo</Link>
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>File Upload Package</CardTitle>
                        <CardDescription>
                            Drag-and-drop file uploader with progress tracking, validation, and Cloudflare R2/Images
                            integration
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button asChild variant="outline" className="w-full">
                            <Link to="/demo/cloudflare/file-upload">View File Upload Demo</Link>
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Cloudflare Services</CardTitle>
                        <CardDescription>
                            Type-safe wrappers for Cloudflare infrastructure: KV, D1, R2, Queues, Images, PubSub, and
                            Rate Limiting
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button asChild variant="outline" className="w-full">
                            <Link to="/demo/cloudflare">View Cloudflare Demo</Link>
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Timezone Utilities</CardTitle>
                        <CardDescription>
                            Production-ready timezone standardization: always store in UTC, display in user's timezone.
                            Lightweight and type-safe.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button asChild variant="outline" className="w-full">
                            <Link to="/demo/timezone">View Timezone Demo</Link>
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>OttaORM</CardTitle>
                        <CardDescription>
                            Class-based Drizzle ORM demo running on D1 via Worker endpoints
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button asChild variant="outline" className="w-full">
                            <Link to="/demo/ottaorm">View OttaORM Demo</Link>
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>OttaForms</CardTitle>
                        <CardDescription>
                            Auto-generated CRUD forms from OttaORM model metadata. List, detail, create, and edit views
                            with relationship field support.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button asChild variant="outline" className="w-full">
                            <Link to="/demo/ottaforms">View OttaForms Demo</Link>
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Logger</CardTitle>
                        <CardDescription>
                            Extensible logger with levels, transports, formatters, child loggers, and config-based setup
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button asChild variant="outline" className="w-full">
                            <Link to="/demo/logger">View Logger Demo</Link>
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Smart Breadcrumbs</CardTitle>
                        <CardDescription>
                            Automatic breadcrumb navigation with intelligent route metadata and human-readable labels.
                            Fully TanStack Router integrated.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button asChild variant="outline" className="w-full">
                            <Link to="/demo/breadcrumbs">View Breadcrumbs Demo</Link>
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>API Client</CardTitle>
                        <CardDescription>
                            Type-safe fetch wrapper with error handling, auth injection, and shorthand method syntax
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button asChild variant="outline" className="w-full">
                            <Link to="/demo/api">View API Demo</Link>
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>OttaRenderer</CardTitle>
                        <CardDescription>
                            Content renderer for EditorJS and HTML with custom block renderers and dark mode support
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button asChild variant="outline" className="w-full">
                            <Link to="/demo/renderer">View Renderer Demo</Link>
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Email Templates</CardTitle>
                        <CardDescription>
                            Preview Handlebars email templates and replacement data with the @ottabase/email package
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button asChild variant="outline" className="w-full">
                            <Link to="/demo/email">View Email Demo</Link>
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Notifications</CardTitle>
                        <CardDescription>
                            Multi-channel notification system with email, WebSocket, and system alerts via
                            @ottabase/notifications
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button asChild variant="outline" className="w-full">
                            <Link to="/demo/notifications">View Notifications Demo</Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>

            <div className="mt-2 rounded-lg border bg-muted/50 p-6">
                <h2 className="mb-2 text-xl font-semibold">About This Template</h2>
                <p className="text-sm text-muted-foreground">
                    This template uses <strong>UI Base</strong> as the foundation, with optional UI libraries layered on
                    top. The main app providers only include UI Base, fonts, state management, and shadcn/ui.
                </p>
            </div>
        </div>
    );
}
