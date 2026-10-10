/** Shown until otta-web has created the landing tables and starter content in the shared D1. */
export function SetupNotice() {
    return (
        <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-5 px-6 py-20 font-sans">
            <h1 className="font-heading text-3xl font-semibold">This landing site has no content yet</h1>
            <p className="leading-relaxed text-muted-foreground">
                Pages are stored in the database shared with otta-web. Run its migrations once, then edit everything in
                the admin:
            </p>
            <ol className="list-decimal space-y-2 pl-5 leading-relaxed">
                <li>
                    Start otta-web and run{' '}
                    <code className="rounded bg-muted px-1.5 py-0.5 text-sm">
                        curl -X POST http://localhost:3004/api/ottaorm/init
                    </code>
                </li>
                <li>
                    Reload this page. A starter site appears, editable at{' '}
                    <code className="rounded bg-muted px-1.5 py-0.5 text-sm">/admin/content/landing</code>.
                </li>
            </ol>
        </main>
    );
}
