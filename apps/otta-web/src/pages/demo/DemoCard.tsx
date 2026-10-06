import { Badge, Card, CardDescription, CardHeader, CardTitle } from '@ottabase/ui-shadcn';
import { Link } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';
import type { DemoItem } from './demoItems';

/** One gallery entry as a whole-card link: the index and the group overviews share it */
export function DemoCard({ item }: { item: DemoItem }) {
    return (
        <Link
            to={item.to}
            className="group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
            <Card className="h-full transition-colors duration-normal group-hover:bg-muted/70">
                <CardHeader className="gap-2">
                    <div className="flex items-center justify-between">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-background text-muted-foreground ring-1 ring-border transition-colors group-hover:text-foreground">
                            <item.icon className="h-[1.125rem] w-[1.125rem]" />
                        </span>
                        {item.featured && (
                            <Badge
                                variant="secondary"
                                className="bg-background/60 text-[0.625rem] font-medium uppercase tracking-wide text-muted-foreground"
                            >
                                Featured
                            </Badge>
                        )}
                    </div>
                    <CardTitle className="flex items-center gap-1.5 text-[0.9375rem] font-semibold">
                        {item.label}
                        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-normal group-hover:translate-x-0.5 group-hover:text-foreground" />
                    </CardTitle>
                    <CardDescription className="line-clamp-2 leading-relaxed">{item.description}</CardDescription>
                </CardHeader>
            </Card>
        </Link>
    );
}
