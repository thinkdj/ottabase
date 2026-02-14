import { lazy, Suspense } from 'react';

const EditorClient = lazy(() => import('./EditorClient').then((mod) => ({ default: mod.EditorClient })));

export function OttaEditorDemoPage() {
    return (
        <Suspense
            fallback={
                <div className="py-12 text-center">
                    <p className="text-lg text-muted-foreground">Loading editor...</p>
                </div>
            }
        >
            <EditorClient />
        </Suspense>
    );
}
