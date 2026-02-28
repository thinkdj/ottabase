import { lazy, Suspense } from 'react';
import type { ResumeTemplateData, SectionKey } from './types';

const TemplateClassic = lazy(() => import('./TemplateClassic'));
const TemplateModern = lazy(() => import('./TemplateModern'));
const TemplateLisbon = lazy(() => import('./TemplateLisbon'));
const TemplateExecutive = lazy(() => import('./TemplateExecutive'));
const TemplateMinimal = lazy(() => import('./TemplateMinimal'));

/** Map template IDs to their lazy-loaded components */
const TEMPLATE_MAP: Record<string, React.LazyExoticComponent<React.ComponentType<any>>> = {
    classic: TemplateClassic,
    modern: TemplateModern,
    lisbon: TemplateLisbon,
    executive: TemplateExecutive,
    minimal: TemplateMinimal,
};

interface ResumePreviewProps {
    data: ResumeTemplateData;
    templateId: string;
    accentColor: string;
    fontSize: number;
    sectionOrder: SectionKey[];
    headingLabels?: Partial<Record<SectionKey, string>>;
    onHeadingChange?: (key: SectionKey, label: string) => void;
}

/**
 * Renders the selected resume template with given data.
 * Lazy-loads templates so only the active one is bundled on first paint.
 */
export default function ResumePreview({
    data,
    templateId,
    accentColor,
    fontSize,
    sectionOrder,
    headingLabels,
    onHeadingChange,
}: ResumePreviewProps) {
    const Template = TEMPLATE_MAP[templateId] ?? TemplateClassic;
    return (
        <Suspense
            fallback={<div className="flex items-center justify-center py-20 text-gray-400">Loading template…</div>}
        >
            <Template
                data={data}
                accentColor={accentColor}
                fontSize={fontSize}
                sectionOrder={sectionOrder}
                headingLabels={headingLabels}
                onHeadingChange={onHeadingChange}
            />
        </Suspense>
    );
}
