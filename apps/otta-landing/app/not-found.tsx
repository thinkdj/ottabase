import { Button } from '@ottabase/ui-shadcn';
import Link from 'next/link';

export default function NotFound() {
    return (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-20 text-center">
            <h1 className="font-heading text-6xl font-bold text-foreground">404</h1>
            <p className="text-lg text-muted-foreground">The page you&apos;re looking for doesn&apos;t exist.</p>
            <Button asChild className="mt-4">
                <Link href="/">Go Home</Link>
            </Button>
        </div>
    );
}
