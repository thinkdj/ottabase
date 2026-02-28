import { lazy, Suspense } from 'react';
import type { ResumeTemplateData, SectionKey } from './types';

const TemplateClassic = lazy(() => import('./TemplateClassic'));
const TemplateModern = lazy(() => import('./TemplateModern'));

interface ResumePreviewProps {
    data: ResumeTemplateData;
    templateId: string;
    accentColor: string;
    fontSize: number;
    sectionOrder: SectionKey[];
}

/**
 * Renders the selected resume template with given data.
 * Lazy-loads templates so only the active one is bundled on first paint.
 */
export default function ResumePreview({ data, templateId, accentColor, fontSize, sectionOrder }: ResumePreviewProps) {
    const Template = templateId === 'modern' ? TemplateModern : TemplateClassic;
    return (
        <Suspense
            fallback={<div className="flex items-center justify-center py-20 text-gray-400">Loading template…</div>}
        >
            <Template data={data} accentColor={accentColor} fontSize={fontSize} sectionOrder={sectionOrder} />
        </Suspense>
    );
}
