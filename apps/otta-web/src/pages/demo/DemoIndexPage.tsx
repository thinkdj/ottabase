import { APP_META } from '@/ottabase/config';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ottabase/ui-shadcn';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { DEMO_ITEMS } from './demoItems';

export function DemoIndexPage() {
    return (
        <div className="space-y-8">
            <div className="space-y-4">
                <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit gap-1.5 text-muted-foreground">
                    <Link to="/">
                        <ArrowLeft className="h-4 w-4" />
                        Back to Home
                    </Link>
                </Button>

                <div className="space-y-1.5">
                    <h1 className="text-3xl font-bold tracking-tight">{APP_META.appName} — Demo Gallery</h1>
                    <p className="max-w-3xl text-muted-foreground">
                        Explore the UI component libraries and features integrated into this template.
                    </p>
                </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {DEMO_ITEMS.map((item) => (
                    <Link
                        key={item.to}
                        to={item.to}
                        className="group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                        <Card className="h-full rounded-xl border-transparent bg-muted/40 transition-colors duration-200 group-hover:bg-muted/70">
                            <CardHeader className="gap-2">
                                <div className="flex items-center justify-between">
                                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-background text-muted-foreground ring-1 ring-border transition-colors group-hover:text-foreground">
                                        <item.icon className="h-[1.125rem] w-[1.125rem]" />
                                    </span>
                                    {item.buttonVariant === 'default' ? (
                                        <Badge
                                            variant="secondary"
                                            className="bg-background/60 text-[0.625rem] font-medium uppercase tracking-wide text-muted-foreground"
                                        >
                                            Featured
                                        </Badge>
                                    ) : null}
                                </div>
                                <CardTitle className="text-[0.9375rem] font-semibold">{item.title}</CardTitle>
                                <CardDescription className="line-clamp-2 leading-relaxed">
                                    {item.description}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <span className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors group-hover:text-foreground">
                                    View demo
                                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                                </span>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>

            <div className="rounded-xl bg-muted/40 p-6">
                <h2 className="mb-1.5 text-sm font-semibold">About this template</h2>
                <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
                    This template uses <strong className="font-medium text-foreground">UI Base</strong> as the
                    foundation, with optional UI libraries layered on top. The main app providers only include UI Base,
                    fonts, state management, and shadcn/ui.
                </p>
            </div>
        </div>
    );
}
