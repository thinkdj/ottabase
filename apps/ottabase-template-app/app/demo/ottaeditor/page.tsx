'use client';

import dynamic from 'next/dynamic';

// Dynamically import the editor client component to avoid SSR
// Editor.js wont work with SSR as it relies on browser APIs
const EditorClient = dynamic(() => import('./EditorClient').then((mod) => ({ default: mod.EditorClient })), {
    ssr: false,
    loading: () => (
        <div className="max-w-7xl mx-auto p-6">
            <div className="text-center py-12">
                <p className="text-lg text-muted-foreground">Loading editor...</p>
            </div>
        </div>
    ),
});

export default function OttaEditorDemo() {
    return <EditorClient />;
}
