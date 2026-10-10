'use client';

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return (
        <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 px-6 py-20 font-sans">
            <h1 className="font-heading text-3xl font-semibold">This page didn’t load</h1>
            <p className="text-muted-foreground">Something went wrong on our side. Try again in a moment.</p>
            <button
                type="button"
                onClick={reset}
                className="mt-2 w-fit rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
                Try again
            </button>
        </main>
    );
}
