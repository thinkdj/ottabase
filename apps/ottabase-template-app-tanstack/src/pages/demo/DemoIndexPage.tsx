import { APP_META } from '@/ottabase/config/app.config';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ottabase/ui-shadcn';
import { Link } from '@tanstack/react-router';
import { DEMO_ITEMS } from './demoItems';

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
                {DEMO_ITEMS.map((item) => (
                    <Card key={item.to}>
                        <CardHeader>
                            <CardTitle>{item.title}</CardTitle>
                            <CardDescription>{item.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button asChild variant={item.buttonVariant ?? 'outline'} className="w-full">
                                <Link to={item.to}>View {item.title}</Link>
                            </Button>
                        </CardContent>
                    </Card>
                ))}
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
