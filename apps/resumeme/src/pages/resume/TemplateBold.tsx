import type { ReactNode } from 'react';
import type { ResumeTemplateProps } from './types';
import { formatDateRange, formatResumeDate, resolveHeadingLabel, type SectionKey } from './types';

/**
 * Bold template — structured two-column design with prominent name and accent highlights.
 *
 * Features a hero header with avatar (accent blob) and large name typography,
 * then a two-column body: left has education + skills, right has experience.
 * Accent-colored bars highlight job titles and section headings.
 */

// ── Heading with spaced uppercase letters ──
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
            className="mb-4 text-sm font-bold uppercase tracking-[0.25em] text-gray-800"
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

/** Contact item with icon placeholder */
function ContactItem({ icon, label, href }: { icon: string; label: string; href?: string }) {
    const content = href ? (
        <a href={href} className="hover:text-[var(--resume-accent)] hover:underline">
            {label}
        </a>
    ) : (
        <span>{label}</span>
    );
    return (
        <div className="flex items-center gap-2 text-xs text-gray-600">
            <span className="text-gray-400">{icon}</span>
            {content}
        </div>
    );
}

/** Job entry with accent bar on title */
function JobEntry({
    title,
    company,
    dateRange,
    description,
    highlights,
}: {
    title: string;
    company: string;
    dateRange: string;
    description?: string | null;
    highlights: string[];
}) {
    return (
        <div className="mb-5">
            {dateRange && <p className="text-xs text-gray-400 mb-1">{dateRange}</p>}
            <div className="flex items-center gap-2 mb-1">
                {/* Accent bar before job title */}
                <div className="h-4 w-1 rounded-full bg-[var(--resume-accent)] shrink-0" />
                <h3 className="text-sm font-bold text-gray-800">
                    {title}
                    <span className="font-normal text-gray-400"> | </span>
                    <span className="font-semibold text-gray-600">{company}</span>
                </h3>
            </div>
            {description && <p className="ml-3 text-sm text-gray-600 leading-relaxed">{description}</p>}
            {highlights.length > 0 && (
                <ul className="ml-3 mt-1 space-y-0.5 text-sm text-gray-600">
                    {highlights.map((h, i) => (
                        <li key={i} className="flex gap-1.5">
                            <span className="mt-2 shrink-0 text-gray-400">·</span>
                            <span>{h}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default function TemplateBold({
    data,
    accentColor,
    fontSize,
    sectionOrder,
    headingLabels,
    onHeadingChange,
}: ResumeTemplateProps) {
    const { fullName, profile, summary, skillSets, workExperiences, educations, projects, certifications } = data;

    const [firstName, ...restName] = fullName.split(' ');
    const lastName = restName.join(' ');

    // Sections that go in the left column
    const LEFT_SECTIONS = new Set<SectionKey>(['educations', 'skillSets', 'certifications']);
    const leftOrder = sectionOrder.filter((k) => LEFT_SECTIONS.has(k));
    const rightOrder = sectionOrder.filter((k) => !LEFT_SECTIONS.has(k));

    // ── Left column renderers (education, skills, certifications) ──
    const leftRenderers: Record<string, () => ReactNode> = {
        educations: () =>
            educations.length > 0 ? (
                <section key="educations" className="mb-6">
                    <SectionHeading
                        title={resolveHeadingLabel('educations', headingLabels, 'Education')}
                        sectionKey="educations"
                        onHeadingChange={onHeadingChange}
                    />
                    <div className="space-y-3">
                        {educations.map((edu) => (
                            <div key={edu.id}>
                                <p className="text-xs text-gray-400">{formatDateRange(edu.startDate, edu.endDate)}</p>
                                <p className="text-sm font-semibold text-gray-700">{edu.degree}</p>
                                {edu.field && <p className="text-xs text-gray-500">{edu.field}</p>}
                                <p className="text-xs text-gray-400">{edu.institution}</p>
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
                                <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-gray-500">
                                    {set.name}
                                </p>
                                <ul className="space-y-0.5">
                                    {set.skills.map((skill) => (
                                        <li key={skill} className="flex items-center gap-2 text-xs text-gray-600">
                                            <span
                                                className="h-1.5 w-1.5 rounded-full shrink-0"
                                                style={{ backgroundColor: accentColor }}
                                            />
                                            {skill}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </section>
            ) : null,

        certifications: () =>
            certifications.length > 0 ? (
                <section key="certifications" className="mb-6">
                    <SectionHeading
                        title={resolveHeadingLabel('certifications', headingLabels, 'Certifications')}
                        sectionKey="certifications"
                        onHeadingChange={onHeadingChange}
                    />
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
                </section>
            ) : null,
    };

    // ── Right column renderers (summary, experience, projects) ──
    const rightRenderers: Record<string, () => ReactNode> = {
        summary: () =>
            summary?.content ? (
                <section key="summary" className="mb-6">
                    <SectionHeading
                        title={resolveHeadingLabel('summary', headingLabels, 'Profile')}
                        sectionKey="summary"
                        onHeadingChange={onHeadingChange}
                    />
                    <p className="text-sm leading-relaxed text-gray-600">{summary.content}</p>
                </section>
            ) : null,

        workExperiences: () =>
            workExperiences.length > 0 ? (
                <section key="workExperiences" className="mb-6">
                    <SectionHeading
                        title={resolveHeadingLabel('workExperiences', headingLabels, 'Experience')}
                        sectionKey="workExperiences"
                        onHeadingChange={onHeadingChange}
                    />
                    {workExperiences.map((exp) => (
                        <JobEntry
                            key={exp.id}
                            title={exp.designation}
                            company={exp.company}
                            dateRange={formatDateRange(exp.startDate, exp.endDate, exp.isCurrent)}
                            description={exp.description}
                            highlights={exp.highlights}
                        />
                    ))}
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
                                        <span className="text-xs text-gray-400 shrink-0">
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

    return (
        <div
            className="resume-bold mx-auto max-w-[794px] bg-white text-gray-800 shadow-sm print:max-w-none print:shadow-none"
            style={
                {
                    '--resume-accent': accentColor,
                    zoom: fontSize / 100,
                } as React.CSSProperties
            }
        >
            {/* ── Hero header ── */}
            <header className="relative px-10 pt-10 pb-8 text-center">
                {/* Avatar with accent blob */}
                <div className="relative mx-auto mb-4 w-fit">
                    {/* Blob accent circle — slightly offset for visual interest */}
                    <div
                        className="absolute -top-2 -right-3 h-28 w-28 rounded-full opacity-70"
                        style={{ backgroundColor: accentColor }}
                    />
                    {profile?.avatarUrl ? (
                        <img
                            src={profile.avatarUrl}
                            alt={fullName}
                            className="relative h-24 w-24 rounded-full object-cover border-2 border-white shadow-md"
                        />
                    ) : (
                        <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gray-100 text-2xl font-bold text-gray-400 border-2 border-white shadow-md">
                            {(firstName?.[0] ?? '?') + (lastName?.[0] ?? '')}
                        </div>
                    )}
                </div>

                {/* Name — large two-line treatment */}
                <h1 className="text-lg font-light tracking-wider text-gray-500">{firstName}</h1>
                <p className="text-3xl font-extrabold tracking-tight text-gray-900 -mt-0.5">{lastName || firstName}</p>

                {/* Headline */}
                {profile?.headline && (
                    <p className="mt-1.5 text-sm font-medium uppercase tracking-widest text-gray-400">
                        {profile.headline}
                    </p>
                )}

                {/* Contact info row */}
                {profile && (
                    <div className="mt-4 flex flex-wrap justify-center gap-4">
                        {profile.phone && <ContactItem icon="☎" label={profile.phone} href={`tel:${profile.phone}`} />}
                        {profile.email && (
                            <ContactItem icon="✉" label={profile.email} href={`mailto:${profile.email}`} />
                        )}
                        {profile.location && <ContactItem icon="📍" label={profile.location} />}
                        {profile.website && (
                            <ContactItem
                                icon="🌐"
                                label={profile.website.replace(/^https?:\/\//, '')}
                                href={profile.website}
                            />
                        )}
                    </div>
                )}
            </header>

            {/* ── Two-column body ── */}
            <div className="grid grid-cols-[220px_1fr] gap-8 px-10 pb-10">
                {/* Left column */}
                <div>
                    {/* Contact info */}
                    {profile && (
                        <section className="mb-6">
                            <SectionHeading title="Contact Info" />
                            <div className="space-y-1.5">
                                {profile.phone && (
                                    <ContactItem icon="☎" label={profile.phone} href={`tel:${profile.phone}`} />
                                )}
                                {profile.email && (
                                    <ContactItem icon="✉" label={profile.email} href={`mailto:${profile.email}`} />
                                )}
                                {profile.location && <ContactItem icon="📍" label={profile.location} />}
                                {profile.website && (
                                    <ContactItem
                                        icon="🌐"
                                        label={profile.website.replace(/^https?:\/\//, '')}
                                        href={profile.website}
                                    />
                                )}
                                {profile.linkedinUrl && (
                                    <ContactItem icon="in" label="LinkedIn" href={profile.linkedinUrl} />
                                )}
                                {profile.githubUrl && <ContactItem icon="⌨" label="GitHub" href={profile.githubUrl} />}
                            </div>
                        </section>
                    )}

                    {/* Left-column sections in order */}
                    {leftOrder.map((key) => leftRenderers[key]?.())}
                </div>

                {/* Right column */}
                <div>{rightOrder.map((key) => rightRenderers[key]?.())}</div>
            </div>

            {/* ── Print styles ── */}
            <style>{`
                @media print {
                    .resume-bold { zoom: ${fontSize / 100}; color: #1a1a1a; }
                    .resume-bold a { color: inherit; text-decoration: none; }
                    .resume-bold section { break-inside: avoid; }
                    .resume-bold header {
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                }
            `}</style>
        </div>
    );
}
