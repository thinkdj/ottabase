import type { ResumeTemplateProps } from './types';
import { formatDateRange, formatResumeDate, type SectionKey } from './types';
import type { ReactNode } from 'react';

/** Section heading with accent-colored bottom border */
function SectionHeading({ title }: { title: string }) {
    return (
        <h2 className="mb-3 border-b-2 border-[var(--resume-accent)] pb-1 text-base font-bold uppercase tracking-wide text-gray-800 dark:text-gray-100">
            {title}
        </h2>
    );
}

/** Sidebar section heading — lighter, compact */
function SidebarHeading({ title }: { title: string }) {
    return <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-gray-200">{title}</h2>;
}

/** Stacked contact item */
function ContactItem({ label, href }: { label: string; href?: string }) {
    const content = href ? (
        <a href={href} className="break-all text-gray-300 hover:text-white hover:underline print:text-gray-200">
            {label}
        </a>
    ) : (
        <span className="text-gray-300">{label}</span>
    );
    return <div className="text-xs leading-relaxed">{content}</div>;
}

export default function TemplateModern({ data, accentColor, fontSize, sectionOrder }: ResumeTemplateProps) {
    const { fullName, profile, skillSets, workExperiences, educations, projects, certifications } = data;

    // Sections that live in the sidebar (fixed position)
    const SIDEBAR_SECTIONS = new Set<SectionKey>(['skillSets', 'certifications']);
    // Main-area sections rendered in user-defined order
    const mainOrder = sectionOrder.filter((key) => !SIDEBAR_SECTIONS.has(key));

    /** Map each main-area section key to its JSX */
    const mainRenderers: Record<string, () => ReactNode> = {
        summary: () =>
            profile?.summary ? (
                <section className="mb-5" key="summary">
                    <SectionHeading title="Summary" />
                    <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                        {profile.summary}
                    </p>
                </section>
            ) : null,

        workExperiences: () =>
            workExperiences.length > 0 ? (
                <section className="mb-5" key="workExperiences">
                    <SectionHeading title="Experience" />
                    <div className="space-y-4">
                        {workExperiences.map((exp) => (
                            <div key={exp.id}>
                                <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                        {exp.designation}
                                    </h3>
                                    <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
                                        {formatDateRange(exp.startDate, exp.endDate, exp.isCurrent)}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {exp.company}
                                    {exp.location && ` · ${exp.location}`}
                                </p>
                                {exp.description && (
                                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{exp.description}</p>
                                )}
                                {exp.highlights.length > 0 && (
                                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-gray-700 dark:text-gray-300">
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
                    <SectionHeading title="Education" />
                    <div className="space-y-3">
                        {educations.map((edu) => (
                            <div key={edu.id}>
                                <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                        {edu.degree}
                                        {edu.field && <span className="font-normal"> in {edu.field}</span>}
                                    </h3>
                                    <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
                                        {formatDateRange(edu.startDate, edu.endDate)}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
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

        projects: () =>
            projects.length > 0 ? (
                <section className="mb-5" key="projects">
                    <SectionHeading title="Projects" />
                    <div className="space-y-3">
                        {projects.map((proj) => (
                            <div key={proj.id}>
                                <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
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
                                                className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600 print:border print:border-gray-300 dark:bg-gray-800 dark:text-gray-400"
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
    };

    return (
        <div
            className="resume-modern mx-auto flex max-w-[794px] overflow-hidden bg-white shadow-sm print:max-w-none print:shadow-none dark:bg-gray-900"
            style={
                {
                    '--resume-accent': accentColor,
                    '--resume-font-size': `${fontSize}pt`,
                    fontSize: `${fontSize}pt`,
                } as React.CSSProperties
            }
        >
            {/* ── Sidebar ── */}
            <aside className="w-[30%] shrink-0 bg-gray-800 px-5 py-8 text-gray-100 print:bg-gray-800 print:text-gray-100 dark:bg-gray-950">
                {/* Avatar */}
                {profile?.avatarUrl && (
                    <div className="mb-4 flex justify-center">
                        <img
                            src={profile.avatarUrl}
                            alt={fullName}
                            className="h-24 w-24 rounded-full border-2 border-[var(--resume-accent)] object-cover"
                        />
                    </div>
                )}

                {/* Contact */}
                {profile && (
                    <div className="mb-6">
                        <SidebarHeading title="Contact" />
                        <div className="space-y-1">
                            {profile.email && <ContactItem label={profile.email} href={`mailto:${profile.email}`} />}
                            {profile.phone && <ContactItem label={profile.phone} href={`tel:${profile.phone}`} />}
                            {profile.location && <ContactItem label={profile.location} />}
                            {profile.website && (
                                <ContactItem
                                    label={profile.website.replace(/^https?:\/\//, '')}
                                    href={profile.website}
                                />
                            )}
                            {profile.linkedinUrl && <ContactItem label="LinkedIn" href={profile.linkedinUrl} />}
                            {profile.githubUrl && <ContactItem label="GitHub" href={profile.githubUrl} />}
                        </div>
                    </div>
                )}

                {/* Skills */}
                {skillSets.length > 0 && (
                    <div className="mb-6">
                        <SidebarHeading title="Skills" />
                        <div className="space-y-3">
                            {skillSets.map((set) => (
                                <div key={set.id}>
                                    <p className="mb-1 text-xs font-semibold text-gray-300">{set.name}</p>
                                    <div className="flex flex-wrap gap-1">
                                        {set.skills.map((skill) => (
                                            <span
                                                key={skill}
                                                className="rounded bg-gray-700 px-1.5 py-0.5 text-[11px] text-gray-200 print:border print:border-gray-500"
                                            >
                                                {skill}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Certifications */}
                {certifications.length > 0 && (
                    <div className="mb-6">
                        <SidebarHeading title="Certifications" />
                        <div className="space-y-2">
                            {certifications.map((cert) => (
                                <div key={cert.id}>
                                    <p className="text-xs font-semibold text-gray-200">
                                        {cert.credentialUrl ? (
                                            <a href={cert.credentialUrl} className="hover:text-white hover:underline">
                                                {cert.name}
                                            </a>
                                        ) : (
                                            cert.name
                                        )}
                                    </p>
                                    <p className="text-[11px] text-gray-400">
                                        {cert.issuer}
                                        {cert.issueDate && ` · ${formatResumeDate(cert.issueDate)}`}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </aside>

            {/* ── Main Content ── */}
            <main className="flex-1 px-6 py-8">
                {/* Header */}
                <header className="mb-5">
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-50">{fullName}</h1>
                    {profile?.headline && (
                        <p className="mt-0.5 text-sm text-[var(--resume-accent)]">{profile.headline}</p>
                    )}
                    <div className="mt-2 h-[3px] w-12 rounded-full bg-[var(--resume-accent)]" />
                </header>

                {/* Sections in user-defined order (sidebar sections filtered out) */}
                {mainOrder.map((key) => mainRenderers[key]?.())}
            </main>

            {/* ── Print styles ── */}
            <style>{`
                @media print {
                    .resume-modern { font-size: ${fontSize}pt; }
                    .resume-modern a { text-decoration: none; }
                    .resume-modern section { break-inside: avoid; }
                    .resume-modern aside {
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                }
            `}</style>
        </div>
    );
}
