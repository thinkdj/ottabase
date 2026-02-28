import type { ResumeTemplateProps } from './types';
import { formatDateRange, formatResumeDate, resolveHeadingLabel, type SectionKey } from './types';
import type { ReactNode } from 'react';

/**
 * Minimal template — ultra-clean, typography-focused design.
 *
 * Single-column layout with maximum whitespace. No backgrounds, no borders,
 * no colour blocks — just clean text hierarchy with thin hairline dividers.
 * The accent colour is used sparingly: name and section headings only.
 */

function SectionDivider() {
    return <hr className="my-5 border-0 border-t border-gray-200" />;
}

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
            className="mb-3 text-sm font-semibold tracking-wider text-[var(--resume-accent)]"
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

export default function TemplateMinimal({ data, accentColor, fontSize, sectionOrder, headingLabels, onHeadingChange }: ResumeTemplateProps) {
    const { fullName, profile, skillSets, workExperiences, educations, projects, certifications } = data;

    // Contact items as minimal comma-separated line
    const contactItems: string[] = [];
    if (profile?.email) contactItems.push(profile.email);
    if (profile?.phone) contactItems.push(profile.phone);
    if (profile?.location) contactItems.push(profile.location);
    if (profile?.website) contactItems.push(profile.website.replace(/^https?:\/\//, ''));
    if (profile?.linkedinUrl) contactItems.push('LinkedIn');
    if (profile?.githubUrl) contactItems.push('GitHub');

    const sectionRenderers: Record<SectionKey, () => ReactNode> = {
        summary: () =>
            profile?.summary ? (
                <div key="summary">
                    <SectionDivider />
                    <section>
                        <SectionHeading title={resolveHeadingLabel('summary', headingLabels, 'About')} sectionKey="summary" onHeadingChange={onHeadingChange} />
                        <p className="max-w-prose text-sm leading-relaxed text-gray-500">{profile.summary}</p>
                    </section>
                </div>
            ) : null,

        workExperiences: () =>
            workExperiences.length > 0 ? (
                <div key="workExperiences">
                    <SectionDivider />
                    <section>
                        <SectionHeading title={resolveHeadingLabel('workExperiences', headingLabels, 'Experience')} sectionKey="workExperiences" onHeadingChange={onHeadingChange} />
                        <div className="space-y-5">
                            {workExperiences.map((exp) => (
                                <div key={exp.id}>
                                    <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                                        <h3 className="text-sm font-semibold text-gray-800">{exp.designation}</h3>
                                        <span className="shrink-0 text-xs text-gray-400">
                                            {formatDateRange(exp.startDate, exp.endDate, exp.isCurrent)}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-400">
                                        {exp.company}
                                        {exp.location && ` · ${exp.location}`}
                                    </p>
                                    {exp.description && (
                                        <p className="mt-1.5 text-sm text-gray-500">{exp.description}</p>
                                    )}
                                    {exp.highlights.length > 0 && (
                                        <ul className="mt-1.5 space-y-0.5 text-sm text-gray-500">
                                            {exp.highlights.map((h, i) => (
                                                <li key={i} className="flex gap-2">
                                                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-gray-300" />
                                                    <span>{h}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            ) : null,

        educations: () =>
            educations.length > 0 ? (
                <div key="educations">
                    <SectionDivider />
                    <section>
                        <SectionHeading title={resolveHeadingLabel('educations', headingLabels, 'Education')} sectionKey="educations" onHeadingChange={onHeadingChange} />
                        <div className="space-y-3">
                            {educations.map((edu) => (
                                <div key={edu.id}>
                                    <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                                        <h3 className="text-sm font-semibold text-gray-800">
                                            {edu.degree}
                                            {edu.field && (
                                                <span className="font-normal text-gray-500"> — {edu.field}</span>
                                            )}
                                        </h3>
                                        <span className="shrink-0 text-xs text-gray-400">
                                            {formatDateRange(edu.startDate, edu.endDate)}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-400">
                                        {edu.institution}
                                        {edu.grade && ` · ${edu.grade}`}
                                    </p>
                                    {edu.description && (
                                        <p className="mt-0.5 text-sm text-gray-500">{edu.description}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            ) : null,

        skillSets: () =>
            skillSets.length > 0 ? (
                <div key="skillSets">
                    <SectionDivider />
                    <section>
                        <SectionHeading title={resolveHeadingLabel('skillSets', headingLabels, 'Skills')} sectionKey="skillSets" onHeadingChange={onHeadingChange} />
                        <div className="flex flex-wrap gap-x-8 gap-y-2">
                            {skillSets.map((set) => (
                                <div key={set.id}>
                                    <span className="text-xs font-medium text-gray-700">{set.name}: </span>
                                    <span className="text-xs text-gray-400">{set.skills.join(', ')}</span>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            ) : null,

        projects: () =>
            projects.length > 0 ? (
                <div key="projects">
                    <SectionDivider />
                    <section>
                        <SectionHeading title={resolveHeadingLabel('projects', headingLabels, 'Projects')} sectionKey="projects" onHeadingChange={onHeadingChange} />
                        <div className="space-y-3">
                            {projects.map((proj) => (
                                <div key={proj.id}>
                                    <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                                        <h3 className="text-sm font-semibold text-gray-800">
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
                                            <span className="shrink-0 text-xs text-gray-400">
                                                {formatDateRange(proj.startDate, proj.endDate)}
                                            </span>
                                        )}
                                    </div>
                                    {proj.description && (
                                        <p className="mt-0.5 text-sm text-gray-500">{proj.description}</p>
                                    )}
                                    {proj.techStack.length > 0 && (
                                        <p className="mt-0.5 text-xs text-gray-400">{proj.techStack.join(', ')}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            ) : null,

        certifications: () =>
            certifications.length > 0 ? (
                <div key="certifications">
                    <SectionDivider />
                    <section>
                        <SectionHeading title={resolveHeadingLabel('certifications', headingLabels, 'Certifications')} sectionKey="certifications" onHeadingChange={onHeadingChange} />
                        <div className="space-y-2">
                            {certifications.map((cert) => (
                                <div key={cert.id} className="flex flex-wrap items-baseline justify-between gap-x-4">
                                    <p className="text-sm text-gray-700">
                                        {cert.credentialUrl ? (
                                            <a
                                                href={cert.credentialUrl}
                                                className="font-semibold hover:text-[var(--resume-accent)] hover:underline"
                                            >
                                                {cert.name}
                                            </a>
                                        ) : (
                                            <span className="font-semibold">{cert.name}</span>
                                        )}
                                        <span className="text-gray-400"> — {cert.issuer}</span>
                                    </p>
                                    {cert.issueDate && (
                                        <span className="shrink-0 text-xs text-gray-400">
                                            {formatResumeDate(cert.issueDate)}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            ) : null,
    };

    return (
        <div
            className="resume-minimal mx-auto max-w-[794px] bg-white px-12 py-10 text-gray-800 shadow-sm print:max-w-none print:px-0 print:py-0 print:shadow-none"
            style={
                {
                    '--resume-accent': accentColor,
                    zoom: fontSize / 100,
                } as React.CSSProperties
            }
        >
            {/* ── Header ── */}
            <header className="mb-2">
                <h1 className="text-3xl font-light tracking-tight text-[var(--resume-accent)]">{fullName}</h1>
                {profile?.headline && <p className="mt-1 text-sm text-gray-400">{profile.headline}</p>}
                {contactItems.length > 0 && <p className="mt-2 text-xs text-gray-400">{contactItems.join('  ·  ')}</p>}
            </header>

            {/* ── Sections in user-defined order ── */}
            {sectionOrder.map((key) => sectionRenderers[key]?.())}

            {/* ── Print styles ── */}
            <style>{`
                @media print {
                    .resume-minimal { zoom: ${fontSize / 100}; color: #1a1a1a; }
                    .resume-minimal a { color: inherit; text-decoration: none; }
                    .resume-minimal section { break-inside: avoid; }
                }
            `}</style>
        </div>
    );
}
