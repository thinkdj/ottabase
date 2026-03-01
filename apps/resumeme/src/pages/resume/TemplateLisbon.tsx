import type { ResumeTemplateProps } from './types';
import { formatDateRange, formatResumeDate, resolveHeadingLabel, type SectionKey } from './types';
import type { ReactNode } from 'react';

/**
 * Lisbon template — inspired by resume.io's Lisbon design.
 *
 * Two-column layout: narrow light-tinted left sidebar (contact, skills,
 * education, certifications) + wide right column for experience/projects.
 * Accent colour used for name, skill dots, and section icons.
 * Clean sans-serif typography with generous spacing.
 */

// ─── Sidebar helpers ────────────────────────────────────────────────────────

/** Small icon circle used next to sidebar section headings */
function SidebarIcon({ children }: { children: ReactNode }) {
    return (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--resume-accent)] text-[10px] text-white">
            {children}
        </span>
    );
}

function SidebarSection({ icon, title, children }: { icon: string; title: string; children: ReactNode }) {
    return (
        <div className="mb-5">
            <div className="mb-2 flex items-center gap-2">
                <SidebarIcon>{icon}</SidebarIcon>
                <h2 className="text-xs font-bold uppercase tracking-widest text-gray-700">{title}</h2>
            </div>
            {children}
        </div>
    );
}

/** Skill dots — decorative proficiency indicator (fixed 4/5 for all skills) */
function SkillDots() {
    const total = 5;
    const filled = 4;
    return (
        <div className="flex gap-1">
            {Array.from({ length: total }).map((_, i) => (
                <span
                    key={i}
                    className={`h-2 w-2 rounded-full ${i < filled ? 'bg-[var(--resume-accent)]' : 'bg-gray-300'}`}
                />
            ))}
        </div>
    );
}

// ─── Main-area helpers ──────────────────────────────────────────────────────

function MainSectionHeading({
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
            className="mb-3 text-sm font-bold uppercase tracking-widest text-[var(--resume-accent)]"
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
            <div className="mt-1 h-px w-full bg-gray-200" />
        </h2>
    );
}

// ─── Template ───────────────────────────────────────────────────────────────

export default function TemplateLisbon({
    data,
    accentColor,
    fontSize,
    sectionOrder,
    headingLabels,
    onHeadingChange,
}: ResumeTemplateProps) {
    const { fullName, profile, skillSets, workExperiences, educations, projects, certifications } = data;

    // Sidebar sections: skills, educations, certifications (always in sidebar)
    const SIDEBAR_SECTIONS = new Set<SectionKey>(['skillSets', 'educations', 'certifications']);
    const mainOrder = sectionOrder.filter((key) => !SIDEBAR_SECTIONS.has(key));

    const mainRenderers: Record<string, () => ReactNode> = {
        summary: () =>
            profile?.summary ? (
                <section className="mb-5" key="summary">
                    <MainSectionHeading
                        title={resolveHeadingLabel('summary', headingLabels, 'Profile')}
                        sectionKey="summary"
                        onHeadingChange={onHeadingChange}
                    />
                    <p className="whitespace-pre-line text-sm leading-relaxed text-gray-600">{profile.summary}</p>
                </section>
            ) : null,

        workExperiences: () =>
            workExperiences.length > 0 ? (
                <section className="mb-5" key="workExperiences">
                    <MainSectionHeading
                        title={resolveHeadingLabel('workExperiences', headingLabels, 'Employment History')}
                        sectionKey="workExperiences"
                        onHeadingChange={onHeadingChange}
                    />
                    <div className="space-y-4">
                        {workExperiences.map((exp) => (
                            <div key={exp.id}>
                                <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                                    <h3 className="text-sm font-semibold text-gray-800">
                                        {exp.designation}
                                        <span className="font-normal text-gray-500"> at {exp.company}</span>
                                    </h3>
                                    <span className="shrink-0 text-xs text-gray-400">
                                        {formatDateRange(exp.startDate, exp.endDate, exp.isCurrent)}
                                    </span>
                                </div>
                                {exp.location && <p className="text-xs text-gray-400">{exp.location}</p>}
                                {exp.description && <p className="mt-1 text-sm text-gray-600">{exp.description}</p>}
                                {exp.highlights.length > 0 && (
                                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-gray-600">
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

        projects: () =>
            projects.length > 0 ? (
                <section className="mb-5" key="projects">
                    <MainSectionHeading
                        title={resolveHeadingLabel('projects', headingLabels, 'Projects')}
                        sectionKey="projects"
                        onHeadingChange={onHeadingChange}
                    />
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
                                {proj.description && <p className="mt-0.5 text-sm text-gray-600">{proj.description}</p>}
                                {proj.techStack.length > 0 && (
                                    <div className="mt-1 flex flex-wrap gap-1">
                                        {proj.techStack.map((tech) => (
                                            <span
                                                key={tech}
                                                className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500"
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
            className="resume-lisbon mx-auto flex max-w-[794px] overflow-hidden bg-white shadow-sm print:max-w-none print:shadow-none"
            style={
                {
                    '--resume-accent': accentColor,
                    zoom: fontSize / 100,
                } as React.CSSProperties
            }
        >
            {/* ── Left Sidebar ── */}
            {/* Sidebar background uses accent colour at ~5% opacity for a subtle tint */}
            <aside className="w-[34%] shrink-0 px-5 py-8" style={{ backgroundColor: `${accentColor}0D` }}>
                {/* Avatar */}
                {profile?.avatarUrl && (
                    <div className="mb-5 flex justify-center">
                        <img
                            src={profile.avatarUrl}
                            alt={fullName}
                            className="h-28 w-28 rounded-full border-[3px] border-[var(--resume-accent)] object-cover"
                        />
                    </div>
                )}

                {/* Contact */}
                {profile && (
                    <SidebarSection icon="✉" title="Details">
                        <div className="space-y-1.5 text-xs text-gray-600">
                            {profile.location && <p>{profile.location}</p>}
                            {profile.phone && (
                                <p>
                                    <a href={`tel:${profile.phone}`} className="hover:text-[var(--resume-accent)]">
                                        {profile.phone}
                                    </a>
                                </p>
                            )}
                            {profile.email && (
                                <p>
                                    <a href={`mailto:${profile.email}`} className="hover:text-[var(--resume-accent)]">
                                        {profile.email}
                                    </a>
                                </p>
                            )}
                            {profile.website && (
                                <p>
                                    <a href={profile.website} className="hover:text-[var(--resume-accent)]">
                                        {profile.website.replace(/^https?:\/\//, '')}
                                    </a>
                                </p>
                            )}
                            {profile.linkedinUrl && (
                                <p>
                                    <a href={profile.linkedinUrl} className="hover:text-[var(--resume-accent)]">
                                        LinkedIn
                                    </a>
                                </p>
                            )}
                            {profile.githubUrl && (
                                <p>
                                    <a href={profile.githubUrl} className="hover:text-[var(--resume-accent)]">
                                        GitHub
                                    </a>
                                </p>
                            )}
                        </div>
                    </SidebarSection>
                )}

                {/* Skills */}
                {skillSets.length > 0 && (
                    <SidebarSection icon="★" title="Skills">
                        <div className="space-y-2.5">
                            {skillSets.map((set) => (
                                <div key={set.id}>
                                    <p className="mb-1 text-xs font-semibold text-gray-700">{set.name}</p>
                                    <div className="space-y-1">
                                        {set.skills.map((skill) => (
                                            <div key={skill} className="flex items-center justify-between gap-2">
                                                <span className="text-xs text-gray-600">{skill}</span>
                                                <SkillDots
                                                    count={Math.min(5, Math.max(2, Math.floor(skill.length / 2)))}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </SidebarSection>
                )}

                {/* Education */}
                {educations.length > 0 && (
                    <SidebarSection icon="🎓" title="Education">
                        <div className="space-y-2.5">
                            {educations.map((edu) => (
                                <div key={edu.id}>
                                    <p className="text-xs font-semibold text-gray-700">
                                        {edu.degree}
                                        {edu.field && ` in ${edu.field}`}
                                    </p>
                                    <p className="text-xs text-gray-500">{edu.institution}</p>
                                    <p className="text-[11px] text-gray-400">
                                        {formatDateRange(edu.startDate, edu.endDate)}
                                        {edu.grade && ` · ${edu.grade}`}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </SidebarSection>
                )}

                {/* Certifications */}
                {certifications.length > 0 && (
                    <SidebarSection icon="✓" title="Certifications">
                        <div className="space-y-2">
                            {certifications.map((cert) => (
                                <div key={cert.id}>
                                    <p className="text-xs font-semibold text-gray-700">
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
                                    <p className="text-[11px] text-gray-400">
                                        {cert.issuer}
                                        {cert.issueDate && ` · ${formatResumeDate(cert.issueDate)}`}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </SidebarSection>
                )}
            </aside>

            {/* ── Main Content ── */}
            <main className="flex-1 px-6 py-8">
                {/* Header */}
                <header className="mb-6">
                    <h1 className="text-3xl font-bold text-[var(--resume-accent)]">{fullName}</h1>
                    {profile?.headline && (
                        <p className="mt-1 text-sm font-medium tracking-wide text-gray-500">{profile.headline}</p>
                    )}
                </header>

                {/* Sections in user-defined order */}
                {mainOrder.map((key) => mainRenderers[key]?.())}
            </main>

            {/* ── Print styles ── */}
            <style>{`
                @media print {
                    .resume-lisbon { zoom: ${fontSize / 100}; }
                    .resume-lisbon a { color: inherit; text-decoration: none; }
                    .resume-lisbon section { break-inside: avoid; }
                    .resume-lisbon aside {
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                }
            `}</style>
        </div>
    );
}
