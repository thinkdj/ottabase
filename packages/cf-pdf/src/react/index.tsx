// ============================================================
// @ottabase/cf-pdf/react — framework-agnostic rendered demo (TSX entrypoint)
// ============================================================
// This entrypoint intentionally uses plain HTML and Tailwind utility classes.
// It does not import Ottabase UI, routing, or API packages. The host
// supplies the authenticated request function through `requestPdf`.

'use client';

import { useState } from 'react';
import { captureDomAsHtml, DEFAULT_PDF_RESOURCE_ORIGINS, downloadBlob } from '../client';
import type { CfPdfRequest } from '../types';

const DEFAULT_DOCUMENT_ID = 'cf-pdf-package-demo-document';

export interface CfPdfDemoPageProps {
    /** Send the captured request through the host application's authenticated API client. */
    requestPdf: (request: CfPdfRequest) => Promise<Blob>;
    /** Optional plain anchor used to return to the host application's package primer. */
    backHref?: string;
    backLabel?: string;
    /** The id of the element to capture. Override when multiple instances are mounted. */
    documentId?: string;
    /** Small brand label shown in the sample document. */
    brandName?: string;
}

/**
 * A complete interactive PDF workbench with no Ottabase UI or router dependency.
 *
 * The host owns authentication and transport. This component only captures the
 * document, calls `requestPdf`, and downloads the returned Blob.
 */
export function CfPdfDemoPage({
    requestPdf,
    backHref = '#',
    backLabel = 'Back',
    documentId = DEFAULT_DOCUMENT_ID,
    brandName = 'Cloudflare PDF',
}: CfPdfDemoPageProps) {
    const [fileName, setFileName] = useState('cf-pdf-demo');
    const [isPending, setIsPending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const exportPdf = async () => {
        setError(null);
        setIsPending(true);

        try {
            const html = captureDomAsHtml(documentId, {
                title: `${brandName} demo`,
                pageSize: 'letter',
                fitWidth: true,
                fitHeight: true,
                resourceOrigins: DEFAULT_PDF_RESOURCE_ORIGINS,
            });
            const blob = await requestPdf({
                html,
                fileName: fileName.trim() || 'cf-pdf-demo',
                metadata: {
                    title: `${brandName} demo`,
                    author: brandName,
                    subject: 'Cloudflare Browser Rendering demo',
                    keywords: 'Cloudflare, PDF, Browser Rendering',
                },
            });
            downloadBlob(blob, `${fileName.trim() || 'cf-pdf-demo'}.pdf`);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not render the PDF.');
        } finally {
            setIsPending(false);
        }
    };

    return (
        <div className="space-y-8 text-slate-950 dark:text-slate-50">
            <div className="space-y-4">
                <a
                    href={backHref}
                    className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-50"
                >
                    <span aria-hidden="true">←</span>
                    {backLabel}
                </a>
                <div className="space-y-1.5">
                    <h1 className="text-3xl font-bold tracking-tight">{brandName} workbench</h1>
                    <p className="max-w-3xl text-slate-600 dark:text-slate-400">
                        Capture a live DOM document in the browser, render it through Cloudflare Browser Rendering, and
                        download a safe PDF attachment.
                    </p>
                </div>
            </div>

            {error ? (
                <div
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
                >
                    {error}
                </div>
            ) : null}

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
                <div className="space-y-1 border-b border-slate-200 p-6 dark:border-slate-800 sm:p-8">
                    <h2 className="text-base font-semibold">Live document preview</h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        The export captures this rendered element and sends only static HTML through the host API
                        client.
                    </p>
                </div>
                <div className="p-6 sm:p-8">
                    <div
                        id={documentId}
                        className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8 dark:bg-slate-950 dark:ring-slate-800"
                    >
                        <div className="mx-auto max-w-2xl space-y-6">
                            <div className="flex flex-col justify-between gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-start dark:border-slate-800">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                                        {brandName}
                                    </p>
                                    <h2 className="mt-2 text-2xl font-bold tracking-tight">Cloudflare PDF Export</h2>
                                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                                        A static, secure document preview
                                    </p>
                                </div>
                                <span className="w-fit rounded-full border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300">
                                    Browser Rendering
                                </span>
                            </div>

                            <div className="grid gap-4 text-sm sm:grid-cols-3">
                                {[
                                    ['Capture', 'DOM → HTML'],
                                    ['Render', 'Edge Chromium'],
                                    ['Output', 'PDF attachment'],
                                ].map(([label, value]) => (
                                    <div key={label} className="rounded-lg bg-slate-100 p-3 dark:bg-slate-900">
                                        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
                                        <p className="mt-1 font-medium">{value}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="space-y-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                                <p>
                                    This sample is rendered by the host application rather than assembled on the Worker.
                                    The browser capture pass removes scripts, event handlers, and unapproved external
                                    resources before the server applies its own policy.
                                </p>
                                <p>
                                    The resulting PDF receives conservative Info metadata and download headers, then the
                                    browser revokes its temporary object URL after the download.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
                <div className="space-y-1 border-b border-slate-200 p-6 dark:border-slate-800 sm:p-8">
                    <h2 className="text-base font-semibold">Export settings</h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        The host Worker should enforce authentication, request bounds, and rate limits.
                    </p>
                </div>
                <div className="space-y-4 p-6 sm:p-8">
                    <div className="space-y-2">
                        <label htmlFor={`${documentId}-file-name`} className="text-sm font-medium">
                            Download filename
                        </label>
                        <input
                            id={`${documentId}-file-name`}
                            value={fileName}
                            onChange={(event) => setFileName(event.target.value)}
                            placeholder="cf-pdf-demo"
                            disabled={isPending}
                            className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-400/30 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:placeholder:text-slate-500 sm:max-w-md"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={() => void exportPdf()}
                        disabled={isPending}
                        className="inline-flex h-10 items-center justify-center rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-50 dark:bg-slate-50 dark:text-slate-950 dark:hover:bg-slate-200"
                    >
                        {isPending ? 'Rendering PDF…' : 'Render and download PDF'}
                    </button>
                </div>
            </section>

            <div className="grid gap-4 md:grid-cols-3">
                {[
                    [
                        'Static by design',
                        'JavaScript is disabled, executable controls are stripped, and network requests use an explicit HTTPS origin allowlist.',
                    ],
                    [
                        'Host-controlled',
                        'The host Worker checks the verified session, request bounds, and rate limits before opening Browser Rendering.',
                    ],
                    [
                        'Safe delivery',
                        'Responses are no-store attachments with nosniff, same-origin resource policy, and sanitized filenames.',
                    ],
                ].map(([title, description]) => (
                    <section
                        key={title}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/40"
                    >
                        <h2 className="text-base font-semibold">{title}</h2>
                        <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{description}</p>
                    </section>
                ))}
            </div>
        </div>
    );
}
