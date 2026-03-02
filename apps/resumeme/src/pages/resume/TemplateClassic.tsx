import type { ResumeTemplateProps } from './types';
import { formatDateRange, formatResumeDate, resolveHeadingLabel, type SectionKey } from './types';
import type { ReactNode } from 'react';

/** Section heading with accent-colored left border — supports inline editing */
function SectionHeading({
    title,
    sectionKey,
    onHeadingChange,
}: {
    title: string;
    sectionKey?: SectionKey;
    onHeadingChange?: (key: SectionKey, label: string) => void;
}) {
    return (
        <h2
            className="mb-3 border-l-[3px] border-[var(--resume-accent)] pl-3 text-lg font-bold uppercase tracking-wide text-gray-800 dark:text-gray-100"
            contentEditable={!!onHeadingChange}
            suppressContentEditableWarning
            onBlur={(e) => {
                if (onHeadingChange && sectionKey) {
                    const text = e.currentTarget.textContent?.trim() || title;
                    onHeadingChange(sectionKey, text);
                }
            }}
            style={onHeadingChange ? { cursor: 'text', outline: 'none' } : undefined}
            title={onHeadingChange ? 'Click to edit heading' : undefined}
        >
            {title}
        </h2>
    );
}

/** Inline contact items separated by dots */
function ContactRow({ profile }: { profile: ResumeTemplateProps['data']['profile'] }) {
    if (!profile) return null;

    const items: Array<{ label: string; href?: string }> = [];
    if (profile.email) items.push({ label: profile.email, href: `mailto:${profile.email}` });
    if (profile.phone) items.push({ label: profile.phone, href: `tel:${profile.phone}` });
    if (profile.location) items.push({ label: profile.location });
    if (profile.website) items.push({ label: profile.website.replace(/^https?:\/\//, ''), href: profile.website });
    if (profile.linkedinUrl) items.push({ label: 'LinkedIn', href: profile.linkedinUrl });
    if (profile.githubUrl) items.push({ label: 'GitHub', href: profile.githubUrl });

    if (items.length === 0) return null;

    return (
        <div className="flex flex-wrap justify-center gap-x-1 gap-y-0.5 text-sm text-gray-600 dark:text-gray-400">
            {items.map((item, i) => (
                <span key={i} className="flex items-center gap-1">
                    {i > 0 && <span className="text-gray-400 dark:text-gray-500">·</span>}
                    {item.href ? (
                        <a
                            href={item.href}
                            className="hover:text-[var(--resume-accent)] hover:underline print:text-gray-600"
                        >
                            {item.label}
                        </a>
                    ) : (
                        <span>{item.label}</span>
                    )}
                </span>
            ))}
        </div>
    );
}

export default function TemplateClassic({
    data,
    accentColor,
    fontSize,
    sectionOrder,
    headingLabels,
    onHeadingChange,
}: ResumeTemplateProps) {
    const { fullName, profile, skillSets, workExperiences, educations, projects, certifications } = data;

    /** Map each section key to its JSX — returns null if the section is empty */
    const sectionRenderers: Record<SectionKey, () => ReactNode> = {
        summary: () =>
            profile?.summary ? (
                <section className="mb-5" key="summary">
                    <SectionHeading
                        title={resolveHeadingLabel('summary', headingLabels, 'Summary')}
                        sectionKey="summary"
                        onHeadingChange={onHeadingChange}
                    />
                    <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                        {profile.summary}
                    </p>
                </section>
            ) : null,

        workExperiences: () =>
            workExperiences.length > 0 ? (
                <section className="mb-5" key="workExperiences">
                    <SectionHeading
                        title={resolveHeadingLabel('workExperiences', headingLabels, 'Experience')}
                        sectionKey="workExperiences"
                        onHeadingChange={onHeadingChange}
                    />
                    <div className="space-y-4">
                        {workExperiences.map((exp) => (
                            <div key={exp.id}>
                                <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                                    <h3 className="text-sm font-semibold">
                                        {exp.designation}
                                        <span className="font-normal text-gray-500 dark:text-gray-400">
                                            {' '}
                                            — {exp.company}
                                        </span>
                                    </h3>
                                    <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
                                        {formatDateRange(exp.startDate, exp.endDate, exp.isCurrent)}
                                        {exp.location && ` · ${exp.location}`}
                                    </span>
                                </div>
                                {exp.description && (
                                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{exp.description}</p>
                                )}
                                {exp.highlights.length > 0 && (
                                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-gray-700 dark:text-gray-300">
                                        {exp.highlights.map((h, i) => (
                                            <li key={i}>{h}</li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            ) : null,

        educations: () =>
            educations.length > 0 ? (
                <section className="mb-5" key="educations">
                    <SectionHeading
                        title={resolveHeadingLabel('educations', headingLabels, 'Education')}
                        sectionKey="educations"
                        onHeadingChange={onHeadingChange}
                    />
                    <div className="space-y-3">
                        {educations.map((edu) => (
                            <div key={edu.id}>
                                <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                                    <h3 className="text-sm font-semibold">
                                        {edu.degree}
                                        {edu.field && <span className="font-normal"> in {edu.field}</span>}
                                    </h3>
                                    <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
                                        {formatDateRange(edu.startDate, edu.endDate)}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    {edu.institution}
                                    {edu.grade && ` · ${edu.grade}`}
                                </p>
                                {edu.description && (
                                    <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">{edu.description}</p>
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            ) : null,

        skillSets: () =>
            skillSets.length > 0 ? (
                <section className="mb-5" key="skillSets">
                    <SectionHeading
                        title={resolveHeadingLabel('skillSets', headingLabels, 'Skills')}
                        sectionKey="skillSets"
                        onHeadingChange={onHeadingChange}
                    />
                    <div className="space-y-2">
                        {skillSets.map((set) => (
                            <div key={set.id}>
                                <span className="text-sm font-semibold">{set.name}: </span>
                                <span className="text-sm text-gray-700 dark:text-gray-300">
                                    {set.skills.join(', ')}
                                </span>
                            </div>
                        ))}
                    </div>
                </section>
            ) : null,

        projects: () =>
            projects.length > 0 ? (
                <section className="mb-5" key="projects">
                    <SectionHeading
                        title={resolveHeadingLabel('projects', headingLabels, 'Projects')}
                        sectionKey="projects"
                        onHeadingChange={onHeadingChange}
                    />
                    <div className="space-y-3">
                        {projects.map((proj) => (
                            <div key={proj.id}>
                                <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                                    <h3 className="text-sm font-semibold">
                                        {proj.url ? (
                                            <a
                                                href={proj.url}
                                                className="hover:text-[var(--resume-accent)] hover:underline"
                                            >
                                                {proj.title}
                                            </a>
                                        ) : (
                                            proj.title
                                        )}
                                    </h3>
                                    {(proj.startDate || proj.endDate) && (
                                        <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
                                            {formatDateRange(proj.startDate, proj.endDate)}
                                        </span>
                                    )}
                                </div>
                                {proj.description && (
                                    <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
                                        {proj.description}
                                    </p>
                                )}
                                {proj.techStack.length > 0 && (
                                    <div className="mt-1 flex flex-wrap gap-1">
                                        {proj.techStack.map((tech) => (
                                            <span
                                                key={tech}
                                                className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600 print:border print:border-gray-300 dark:bg-gray-800 dark:text-gray-400"
                                            >
                                                {tech}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            ) : null,

        certifications: () =>
            certifications.length > 0 ? (
                <section className="mb-5" key="certifications">
                    <SectionHeading
                        title={resolveHeadingLabel('certifications', headingLabels, 'Certifications')}
                        sectionKey="certifications"
                        onHeadingChange={onHeadingChange}
                    />
                    <div className="space-y-2">
                        {certifications.map((cert) => (
                            <div key={cert.id} className="flex flex-wrap items-baseline justify-between gap-x-2">
                                <h3 className="text-sm font-semibold">
                                    {cert.credentialUrl ? (
                                        <a
                                            href={cert.credentialUrl}
                                            className="hover:text-[var(--resume-accent)] hover:underline"
                                        >
                                            {cert.name}
                                        </a>
                                    ) : (
                                        cert.name
                                    )}
                                    <span className="font-normal text-gray-500 dark:text-gray-400">
                                        {' '}
                                        — {cert.issuer}
                                    </span>
                                </h3>
                                {cert.issueDate && (
                                    <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
                                        {formatResumeDate(cert.issueDate)}
                                        {cert.expiryDate && ` — ${formatResumeDate(cert.expiryDate)}`}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            ) : null,
    };

    return (
        <div
            className="resume-classic mx-auto max-w-[794px] bg-white py-8 text-gray-800 shadow-sm print:max-w-none print:py-0 print:shadow-none dark:bg-gray-900 dark:text-gray-100"
            style={
                {
                    '--resume-accent': accentColor,
                    zoom: fontSize / 100,
                } as React.CSSProperties
            }
        >
            {/* ── Header ── */}
            <header className="mb-6 text-center">
                <h1 className="text-3xl font-bold tracking-tight">{fullName}</h1>
                <div className="mx-auto mt-1.5 h-[3px] w-16 rounded-full bg-[var(--resume-accent)]" />
                {profile?.headline && (
                    <p className="mt-2 text-base text-gray-500 dark:text-gray-400">{profile.headline}</p>
                )}
                <div className="mt-2">
                    <ContactRow profile={profile} />
                </div>
            </header>

            {/* ── Sections in user-defined order ── */}
            {sectionOrder.map((key) => sectionRenderers[key]?.())}

            {/* ── Print styles ── */}
            <style>{`
                @media print {
                    .resume-classic { zoom: ${fontSize / 100}; color: #1a1a1a; }
                    .resume-classic a { color: inherit; text-decoration: none; }
                    .resume-classic section { break-inside: avoid; }
                }
            `}</style>
        </div>
    );
}
