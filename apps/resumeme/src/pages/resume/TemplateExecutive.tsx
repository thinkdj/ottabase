import type { ResumeTemplateProps } from './types';
import { formatDateRange, formatResumeDate, resolveHeadingLabel, type SectionKey } from './types';
import type { ReactNode } from 'react';

/**
 * Executive template — premium corporate design for senior professionals.
 *
 * Full-width single-column layout with elegant serif-influenced headings,
 * thin hairline dividers between sections, and a refined typographic hierarchy.
 * Accent colour used for name, divider lines, and subtle highlights.
 */

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
        <div className="mb-3">
            <h2
                className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--resume-accent)]"
                contentEditable={!!onHeadingChange}
                suppressContentEditableWarning
                onBlur={(e) => {
                    if (onHeadingChange && sectionKey) {
                        const text = e.currentTarget.textContent?.trim() || title;
                        onHeadingChange(sectionKey, text);
                    }
                }}
                role={onHeadingChange ? 'textbox' : undefined}
                aria-label={onHeadingChange ? `Edit ${title} heading` : undefined}
                style={onHeadingChange ? { cursor: 'text', outline: 'none' } : undefined}
                title={onHeadingChange ? 'Click to edit heading' : undefined}
            >
                {title}
            </h2>
            <div className="mt-1 h-px bg-[var(--resume-accent)] opacity-30" />
        </div>
    );
}

/** Compact contact bar with vertical pipe separators */
function ContactBar({ profile }: { profile: ResumeTemplateProps['data']['profile'] }) {
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
        <div className="flex flex-wrap justify-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
            {items.map((item, i) => (
                <span key={i} className="flex items-center gap-3">
                    {i > 0 && <span className="text-gray-300">|</span>}
                    {item.href ? (
                        <a
                            href={item.href}
                            className="hover:text-[var(--resume-accent)] hover:underline print:text-gray-500"
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

export default function TemplateExecutive({ data, accentColor, fontSize, sectionOrder, headingLabels, onHeadingChange }: ResumeTemplateProps) {
    const { fullName, profile, skillSets, workExperiences, educations, projects, certifications } = data;

    const sectionRenderers: Record<SectionKey, () => ReactNode> = {
        summary: () =>
            profile?.summary ? (
                <section className="mb-6" key="summary">
                    <SectionHeading title={resolveHeadingLabel('summary', headingLabels, 'Professional Summary')} sectionKey="summary" onHeadingChange={onHeadingChange} />
                    <p className="whitespace-pre-line text-sm leading-relaxed text-gray-600">{profile.summary}</p>
                </section>
            ) : null,

        workExperiences: () =>
            workExperiences.length > 0 ? (
                <section className="mb-6" key="workExperiences">
                    <SectionHeading title={resolveHeadingLabel('workExperiences', headingLabels, 'Professional Experience')} sectionKey="workExperiences" onHeadingChange={onHeadingChange} />
                    <div className="space-y-5">
                        {workExperiences.map((exp) => (
                            <div key={exp.id}>
                                <div className="flex flex-wrap items-start justify-between gap-x-4">
                                    <div>
                                        <h3 className="text-sm font-bold text-gray-800">{exp.designation}</h3>
                                        <p className="text-sm text-gray-500">
                                            {exp.company}
                                            {exp.location && `, ${exp.location}`}
                                        </p>
                                    </div>
                                    <span className="mt-0.5 shrink-0 rounded-sm bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                                        {formatDateRange(exp.startDate, exp.endDate, exp.isCurrent)}
                                    </span>
                                </div>
                                {exp.description && <p className="mt-1.5 text-sm text-gray-600">{exp.description}</p>}
                                {exp.highlights.length > 0 && (
                                    <ul className="mt-1.5 space-y-0.5 text-sm text-gray-600">
                                        {exp.highlights.map((h, i) => (
                                            <li key={i} className="flex gap-2">
                                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--resume-accent)]" />
                                                <span>{h}</span>
                                            </li>
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
                <section className="mb-6" key="educations">
                    <SectionHeading title={resolveHeadingLabel('educations', headingLabels, 'Education')} sectionKey="educations" onHeadingChange={onHeadingChange} />
                    <div className="space-y-3">
                        {educations.map((edu) => (
                            <div key={edu.id} className="flex flex-wrap items-start justify-between gap-x-4">
                                <div>
                                    <h3 className="text-sm font-bold text-gray-800">
                                        {edu.degree}
                                        {edu.field && <span className="font-normal text-gray-600"> — {edu.field}</span>}
                                    </h3>
                                    <p className="text-sm text-gray-500">
                                        {edu.institution}
                                        {edu.grade && ` · ${edu.grade}`}
                                    </p>
                                    {edu.description && (
                                        <p className="mt-0.5 text-sm text-gray-500">{edu.description}</p>
                                    )}
                                </div>
                                <span className="mt-0.5 shrink-0 text-xs text-gray-400">
                                    {formatDateRange(edu.startDate, edu.endDate)}
                                </span>
                            </div>
                        ))}
                    </div>
                </section>
            ) : null,

        skillSets: () =>
            skillSets.length > 0 ? (
                <section className="mb-6" key="skillSets">
                    <SectionHeading title={resolveHeadingLabel('skillSets', headingLabels, 'Core Competencies')} sectionKey="skillSets" onHeadingChange={onHeadingChange} />
                    <div className="flex flex-wrap gap-x-6 gap-y-2">
                        {skillSets.map((set) => (
                            <div key={set.id} className="min-w-[180px]">
                                <p className="mb-0.5 text-xs font-bold uppercase tracking-wide text-gray-700">
                                    {set.name}
                                </p>
                                <p className="text-sm text-gray-500">{set.skills.join(' · ')}</p>
                            </div>
                        ))}
                    </div>
                </section>
            ) : null,

        projects: () =>
            projects.length > 0 ? (
                <section className="mb-6" key="projects">
                    <SectionHeading title={resolveHeadingLabel('projects', headingLabels, 'Key Projects')} sectionKey="projects" onHeadingChange={onHeadingChange} />
                    <div className="space-y-3">
                        {projects.map((proj) => (
                            <div key={proj.id}>
                                <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                                    <h3 className="text-sm font-bold text-gray-800">
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
                                {proj.description && <p className="mt-0.5 text-sm text-gray-600">{proj.description}</p>}
                                {proj.techStack.length > 0 && (
                                    <p className="mt-0.5 text-xs text-gray-400">{proj.techStack.join(' · ')}</p>
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            ) : null,

        certifications: () =>
            certifications.length > 0 ? (
                <section className="mb-6" key="certifications">
                    <SectionHeading title={resolveHeadingLabel('certifications', headingLabels, 'Certifications')} sectionKey="certifications" onHeadingChange={onHeadingChange} />
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {certifications.map((cert) => (
                            <div key={cert.id} className="flex items-start gap-2">
                                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--resume-accent)]" />
                                <div>
                                    <p className="text-sm font-semibold text-gray-700">
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
                                    </p>
                                    <p className="text-xs text-gray-400">
                                        {cert.issuer}
                                        {cert.issueDate && ` · ${formatResumeDate(cert.issueDate)}`}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            ) : null,
    };

    return (
        <div
            className="resume-executive mx-auto max-w-[794px] bg-white px-12 py-10 text-gray-800 shadow-sm print:max-w-none print:px-0 print:py-0 print:shadow-none"
            style={
                {
                    '--resume-accent': accentColor,
                    zoom: fontSize / 100,
                } as React.CSSProperties
            }
        >
            {/* ── Header ── */}
            <header className="mb-8 text-center">
                <h1 className="text-3xl font-bold uppercase tracking-wide text-[var(--resume-accent)]">{fullName}</h1>
                {profile?.headline && (
                    <p className="mt-1.5 text-sm font-light uppercase tracking-wider text-gray-500">
                        {profile.headline}
                    </p>
                )}
                <div className="mx-auto mt-3 h-px w-24 bg-[var(--resume-accent)]" />
                <div className="mt-3">
                    <ContactBar profile={profile} />
                </div>
            </header>

            {/* ── Sections in user-defined order ── */}
            {sectionOrder.map((key) => sectionRenderers[key]?.())}

            {/* ── Print styles ── */}
            <style>{`
                @media print {
                    .resume-executive { zoom: ${fontSize / 100}; color: #1a1a1a; }
                    .resume-executive a { color: inherit; text-decoration: none; }
                    .resume-executive section { break-inside: avoid; }
                }
            `}</style>
        </div>
    );
}
