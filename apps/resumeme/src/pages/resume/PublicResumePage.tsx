import { IconEyeOff } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import ResumePreview from './ResumePreview';
import type { ResumeTemplateData, SectionKey } from './types';
import { DEFAULT_SECTION_ORDER } from './types';

interface PublicResumeData {
    id: string;
    name: string;
    templateId: string;
    accentColor: string;
    fontSize: number;
    sectionOrder: string | null;
    headingLabels: string | null;
    snapshotData: string;
}

function safeJsonParse<T>(json: string | null | undefined, fallback: T): T {
    if (!json) return fallback;
    try {
        return JSON.parse(json);
    } catch {
        return fallback;
    }
}

export function PublicResumePage({ code }: { code: string }) {
    const [data, setData] = useState<PublicResumeData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);

        fetch(`/api/resume/public/code/${encodeURIComponent(code)}`)
            .then(async (res) => {
                const json = await res.json().catch(() => ({}));
                if (!res.ok) {
                    const codeMsg = (json as any)?.code === 'SHARE_DISABLED' ? 'disabled' : null;
                    if (codeMsg) throw new Error('SHARE_DISABLED');
                    throw new Error((json as any)?.error || 'Failed to load resume');
                }
                return json;
            })
            .then((json: any) => {
                if (!cancelled) setData(json.data);
            })
            .catch((err) => {
                if (!cancelled) setError(err.message);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [code]);

    // Parse JSON fields
    const templateData = data ? safeJsonParse<ResumeTemplateData | null>(data.snapshotData, null) : null;
    const sectionOrder = safeJsonParse<SectionKey[]>(data?.sectionOrder, DEFAULT_SECTION_ORDER);
    const headingLabels = safeJsonParse<Record<string, string>>(data?.headingLabels, {});

    if (loading) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 dark:bg-gray-950">
                <div className="w-full max-w-[850px] animate-pulse px-4 py-8">
                    <div className="mx-auto h-6 w-48 rounded bg-gray-200 dark:bg-gray-800" />
                    <div className="mt-8 space-y-4">
                        <div className="h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-800" />
                        <div className="h-4 w-1/2 rounded bg-gray-200 dark:bg-gray-800" />
                        <div className="h-4 w-5/6 rounded bg-gray-200 dark:bg-gray-800" />
                    </div>
                </div>
            </div>
        );
    }

    if (error === 'SHARE_DISABLED') {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 text-center dark:bg-gray-950">
                <div className="flex flex-col items-center gap-3">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-200">
                        <IconEyeOff className="h-7 w-7" />
                    </div>
                    <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-50">This resume is private</h1>
                    <p className="max-w-md text-sm text-gray-500 dark:text-gray-400">
                        The owner has disabled sharing for this link. Ask them to re-enable sharing to view the resume.
                    </p>
                    <a
                        href="/"
                        className="mt-2 inline-block rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
                    >
                        Build your own resume
                    </a>
                </div>
            </div>
        );
    }

    if (error || !templateData) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Resume Not Found</h1>
                    <p className="mt-2 text-gray-500 dark:text-gray-400">
                        {error || 'This share link may have expired or the resume may have been removed.'}
                    </p>
                    <a
                        href="/"
                        className="mt-4 inline-block rounded-md bg-gray-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
                    >
                        Create Your Own Resume
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-950">
            {/* Minimal header with resume name and branding */}
            <header className="border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
                <div className="mx-auto flex max-w-[850px] items-center justify-between">
                    <h1 className="truncate text-sm font-medium text-gray-700 dark:text-gray-300">{data!.name}</h1>
                    <a
                        href="/"
                        className="text-xs text-gray-400 transition hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                    >
                        Built with <span className="font-semibold">ResumeMe</span>
                    </a>
                </div>
            </header>

            {/* Resume content */}
            <main className="mx-auto max-w-[850px] px-4 py-8">
                <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <ResumePreview
                        templateId={data!.templateId}
                        data={templateData}
                        accentColor={data!.accentColor}
                        fontSize={data!.fontSize}
                        sectionOrder={sectionOrder}
                        headingLabels={headingLabels}
                    />
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t border-gray-200 bg-white px-4 py-4 text-center dark:border-gray-800 dark:bg-gray-900">
                <p className="text-xs text-gray-400 dark:text-gray-500">
                    Shared via{' '}
                    <a
                        href="/"
                        className="font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                        ResumeMe
                    </a>{' '}
                    — Professional resume builder
                </p>
            </footer>
        </div>
    );
}
