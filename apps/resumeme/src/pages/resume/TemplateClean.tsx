import type { ReactNode } from 'react';
import type { ResumeTemplateProps } from './types';
import { formatDateRange, formatResumeDate, resolveHeadingLabel, type SectionKey } from './types';

/**
 * Clean template — structured two-column body below a full-width header.
 *
 * Inspired by the "Felix Driscoll" style: large bold name, subtitle with
 * headline + contact on one line separated by pipes, a summary paragraph,
 * thin horizontal rule, then a 60/40 two-column grid with Experience on the
 * left and Education + Skills + Certifications on the right.
 * Minimal decoration — no colour blocks, just clean type hierarchy.
 */

// ── Section heading — small uppercase with accent bottom border ──
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
            className="mb-3 text-base font-bold text-[var(--resume-accent)]"
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

export default function TemplateClean({
    data,
    accentColor,
    fontSize,
    sectionOrder,
    headingLabels,
    onHeadingChange,
}: ResumeTemplateProps) {
    const { fullName, profile, skillSets, workExperiences, educations, projects, certifications } = data;

    // Contact items joined by pipes
    const contactItems: Array<{ label: string; href?: string }> = [];
    if (profile?.email) contactItems.push({ label: profile.email, href: `mailto:${profile.email}` });
    if (profile?.phone) contactItems.push({ label: profile.phone, href: `tel:${profile.phone}` });
    if (profile?.location) contactItems.push({ label: profile.location });
    if (profile?.website)
        contactItems.push({ label: profile.website.replace(/^https?:\/\//, ''), href: profile.website });
    if (profile?.linkedinUrl) contactItems.push({ label: 'LinkedIn', href: profile.linkedinUrl });
    if (profile?.githubUrl) contactItems.push({ label: 'GitHub', href: profile.githubUrl });

    // Sections that go in the right (narrower) column
    const RIGHT_SECTIONS = new Set<SectionKey>(['educations', 'skillSets', 'certifications']);
    const leftOrder = sectionOrder.filter((k) => !RIGHT_SECTIONS.has(k) && k !== 'summary');
    const rightOrder = sectionOrder.filter((k) => RIGHT_SECTIONS.has(k));

    // ── Left column renderers (experience, projects) ──
    const leftRenderers: Record<string, () => ReactNode> = {
        workExperiences: () =>
            workExperiences.length > 0 ? (
                <section key="workExperiences" className="mb-6">
                    <SectionHeading
                        title={resolveHeadingLabel('workExperiences', headingLabels, 'Experience')}
                        sectionKey="workExperiences"
                        onHeadingChange={onHeadingChange}
                    />
                    <div className="space-y-5">
                        {workExperiences.map((exp) => (
                            <div key={exp.id}>
                                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                                    <h3 className="text-sm font-bold text-gray-800">{exp.company}</h3>
                                    <span className="shrink-0 text-xs text-gray-400">
                                        {formatDateRange(exp.startDate, exp.endDate, exp.isCurrent)}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500">
                                    {exp.designation}
                                    {exp.location && (
                                        <>
                                            <span className="mx-1.5 text-gray-300">|</span>
                                            {exp.location}
                                        </>
                                    )}
                                </p>
                                {exp.description && (
                                    <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{exp.description}</p>
                                )}
                                {exp.highlights.length > 0 && (
                                    <ul className="mt-1.5 space-y-0.5 text-sm text-gray-600">
                                        {exp.highlights.map((h, i) => (
                                            <li key={i} className="flex gap-2">
                                                <span className="shrink-0 text-gray-400">–</span>
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

        projects: () =>
            projects.length > 0 ? (
                <section key="projects" className="mb-6">
                    <SectionHeading
                        title={resolveHeadingLabel('projects', headingLabels, 'Projects')}
                        sectionKey="projects"
                        onHeadingChange={onHeadingChange}
                    />
                    <div className="space-y-4">
                        {projects.map((proj) => (
                            <div key={proj.id}>
                                <div className="flex items-baseline justify-between gap-2">
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
    };

    // ── Right column renderers (education, skills, certifications) ──
    const rightRenderers: Record<string, () => ReactNode> = {
        educations: () =>
            educations.length > 0 ? (
                <section key="educations" className="mb-6">
                    <SectionHeading
                        title={resolveHeadingLabel('educations', headingLabels, 'Education')}
                        sectionKey="educations"
                        onHeadingChange={onHeadingChange}
                    />
                    <div className="space-y-4">
                        {educations.map((edu) => (
                            <div key={edu.id}>
                                <h3 className="text-sm font-bold text-gray-800">{edu.institution}</h3>
                                <p className="text-xs text-gray-600">
                                    {edu.degree}
                                    {edu.field && ` — ${edu.field}`}
                                </p>
                                <p className="text-xs text-gray-400">{formatDateRange(edu.startDate, edu.endDate)}</p>
                                {edu.grade && <p className="text-xs text-gray-400">Grade: {edu.grade}</p>}
                                {edu.description && <p className="mt-0.5 text-xs text-gray-500">{edu.description}</p>}
                            </div>
                        ))}
                    </div>
                </section>
            ) : null,

        skillSets: () =>
            skillSets.length > 0 ? (
                <section key="skillSets" className="mb-6">
                    <SectionHeading
                        title={resolveHeadingLabel('skillSets', headingLabels, 'Skills')}
                        sectionKey="skillSets"
                        onHeadingChange={onHeadingChange}
                    />
                    <div className="space-y-3">
                        {skillSets.map((set) => (
                            <div key={set.id}>
                                <p className="text-xs font-semibold text-gray-700 mb-0.5">{set.name}</p>
                                <p className="text-xs text-gray-500 leading-relaxed">{set.skills.join(', ')}</p>
                            </div>
                        ))}
                    </div>
                </section>
            ) : null,

        certifications: () =>
            certifications.length > 0 ? (
                <section key="certifications" className="mb-6">
                    <SectionHeading
                        title={resolveHeadingLabel('certifications', headingLabels, 'Achievements')}
                        sectionKey="certifications"
                        onHeadingChange={onHeadingChange}
                    />
                    <div className="space-y-2">
                        {certifications.map((cert) => (
                            <div key={cert.id}>
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
                                    <p className="text-xs text-gray-400">{formatResumeDate(cert.issueDate)}</p>
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            ) : null,
    };

    return (
        <div
            className="resume-clean mx-auto max-w-[794px] bg-white px-10 py-10 text-gray-800 shadow-sm print:max-w-none print:px-0 print:py-0 print:shadow-none"
            style={
                {
                    '--resume-accent': accentColor,
                    zoom: fontSize / 100,
                } as React.CSSProperties
            }
        >
            {/* ── Full-width header ── */}
            <header className="mb-6 text-center">
                <h1 className="text-3xl font-bold tracking-tight text-gray-900">{fullName}</h1>
                {profile?.headline && <p className="mt-1 text-sm text-gray-500">{profile.headline}</p>}
                {contactItems.length > 0 && (
                    <div className="mt-2 flex flex-wrap justify-center gap-x-1 text-xs text-gray-500">
                        {contactItems.map((item, i) => (
                            <span key={i} className="flex items-center gap-1">
                                {i > 0 && <span className="text-gray-300 mx-1">|</span>}
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
                )}
            </header>

            {/* ── Summary (full-width, above divider) ── */}
            {profile?.summary && (
                <section className="mb-6">
                    <p className="text-sm leading-relaxed text-gray-600">{profile.summary}</p>
                </section>
            )}

            {/* ── Divider ── */}
            <hr className="mb-6 border-gray-200" />

            {/* ── Two-column body: 60% left / 40% right ── */}
            <div className="grid grid-cols-[3fr_2fr] gap-8">
                {/* Left column — Experience & Projects */}
                <div>{leftOrder.map((key) => leftRenderers[key]?.())}</div>

                {/* Right column — Education, Skills, Certifications */}
                <div>{rightOrder.map((key) => rightRenderers[key]?.())}</div>
            </div>

            {/* ── Print styles ── */}
            <style>{`
                @media print {
                    .resume-clean { zoom: ${fontSize / 100}; color: #1a1a1a; }
                    .resume-clean a { color: inherit; text-decoration: none; }
                    .resume-clean section { break-inside: avoid; }
                }
            `}</style>
        </div>
    );
}
