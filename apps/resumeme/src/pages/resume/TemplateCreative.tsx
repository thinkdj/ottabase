import type { ReactNode } from 'react';
import type { ResumeTemplateProps } from './types';
import { formatDateRange, formatResumeDate, resolveHeadingLabel, type SectionKey } from './types';

/**
 * Creative template — editorial portfolio-style design.
 *
 * Inspired by designer resumes: large avatar with accent blob backdrop,
 * bold serif "Hi, I'm [name]" hero, italic contact row, two-column summary,
 * timeline-style experience with accent dots, and airy whitespace throughout.
 */

// ── Helpers ──

/** Serif section heading with bottom rule */
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
            className="mb-5 text-xl font-bold italic text-gray-800"
            contentEditable={!!onHeadingChange}
            suppressContentEditableWarning
            onBlur={(e) => {
                if (onHeadingChange && sectionKey) {
                    const text = e.currentTarget.textContent?.trim() || title;
                    onHeadingChange(sectionKey, text);
                }
            }}
            style={{
                fontFamily: "'Georgia', 'Times New Roman', serif",
                ...(onHeadingChange ? { cursor: 'text', outline: 'none' } : {}),
            }}
            {...(onHeadingChange
                ? { role: 'textbox', 'aria-label': `Edit ${title} heading`, title: 'Click to edit heading' }
                : {})}
        >
            {title}
        </h2>
    );
}

/** Contact row in italic style */
function ContactRow({ profile }: { profile: ResumeTemplateProps['data']['profile'] }) {
    if (!profile) return null;
    const items: string[] = [];
    if (profile.email) items.push(profile.email);
    if (profile.phone) items.push(profile.phone);
    if (profile.location) items.push(profile.location);
    if (profile.website) items.push(profile.website.replace(/^https?:\/\//, ''));
    if (profile.linkedinUrl) items.push('@linkedin');
    if (profile.githubUrl) items.push('@github');
    if (items.length === 0) return null;
    return (
        <p className="mt-3 text-sm italic text-gray-500" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
            {items.join('    ·    ')}
        </p>
    );
}

/** Timeline entry: date/company on left, details on right, accent dot in centre */
function TimelineEntry({
    leftTop,
    leftMiddle,
    leftBottom,
    title,
    description,
    highlights,
    accentColor,
}: {
    leftTop: string;
    leftMiddle: string;
    leftBottom?: string;
    title: string;
    description?: string | null;
    highlights: string[];
    accentColor: string;
}) {
    return (
        <div className="grid grid-cols-[140px_24px_1fr] gap-x-2 gap-y-0 mb-6">
            {/* Left column — date & company */}
            <div className="text-right pt-0.5">
                <p className="text-sm font-semibold text-gray-700">{leftTop}</p>
                <p className="text-xs font-medium text-gray-500 italic">{leftMiddle}</p>
                {leftBottom && <p className="text-xs text-gray-400">{leftBottom}</p>}
            </div>

            {/* Centre dot & line */}
            <div className="flex flex-col items-center">
                <div className="mt-1.5 h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: accentColor }} />
                <div className="w-px flex-1 bg-gray-200 mt-1" />
            </div>

            {/* Right column — title, desc, highlights */}
            <div className="pb-2">
                <h3 className="text-sm font-bold text-gray-800 italic">{title}</h3>
                {description && <p className="mt-1 text-sm text-gray-600 leading-relaxed">{description}</p>}
                {highlights.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5 text-sm text-gray-600">
                        {highlights.map((h, i) => (
                            <li key={i} className="flex gap-1.5">
                                <span className="mt-2 shrink-0 text-gray-400">·</span>
                                <span>{h}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}

// ── Main Component ──

export default function TemplateCreative({
    data,
    accentColor,
    fontSize,
    sectionOrder,
    headingLabels,
    onHeadingChange,
}: ResumeTemplateProps) {
    const { fullName, profile, skillSets, workExperiences, educations, projects, certifications } = data;

    // Split name for the big hero typography
    const firstName = fullName.split(' ')[0] || fullName;

    const sectionRenderers: Record<SectionKey, () => ReactNode> = {
        // ── Summary — two-column prose ──
        summary: () =>
            profile?.summary ? (
                <section key="summary" className="mb-8">
                    <div className="flex items-start gap-8">
                        <SectionHeading
                            title={resolveHeadingLabel('summary', headingLabels, 'About me')}
                            sectionKey="summary"
                            onHeadingChange={onHeadingChange}
                        />
                        <div className="flex-1 columns-2 gap-8 text-sm leading-relaxed text-gray-600">
                            {profile.summary}
                        </div>
                    </div>
                    <hr className="mt-6 border-gray-200" />
                </section>
            ) : null,

        // ── Work Experience — timeline layout ──
        workExperiences: () =>
            workExperiences.length > 0 ? (
                <section key="workExperiences" className="mb-8">
                    <SectionHeading
                        title={resolveHeadingLabel('workExperiences', headingLabels, 'Experience')}
                        sectionKey="workExperiences"
                        onHeadingChange={onHeadingChange}
                    />
                    {workExperiences.map((exp) => (
                        <TimelineEntry
                            key={exp.id}
                            leftTop={formatDateRange(exp.startDate, exp.endDate, exp.isCurrent)}
                            leftMiddle={exp.company}
                            leftBottom={exp.location ?? undefined}
                            title={exp.designation}
                            description={exp.description}
                            highlights={exp.highlights}
                            accentColor={accentColor}
                        />
                    ))}
                </section>
            ) : null,

        // ── Education — timeline layout ──
        educations: () =>
            educations.length > 0 ? (
                <section key="educations" className="mb-8">
                    <SectionHeading
                        title={resolveHeadingLabel('educations', headingLabels, 'Education')}
                        sectionKey="educations"
                        onHeadingChange={onHeadingChange}
                    />
                    {educations.map((edu) => (
                        <TimelineEntry
                            key={edu.id}
                            leftTop={formatDateRange(edu.startDate, edu.endDate)}
                            leftMiddle={edu.institution}
                            title={`${edu.degree}${edu.field ? ` — ${edu.field}` : ''}`}
                            description={edu.description}
                            highlights={edu.grade ? [`Grade: ${edu.grade}`] : []}
                            accentColor={accentColor}
                        />
                    ))}
                </section>
            ) : null,

        // ── Skills — inline grouped ──
        skillSets: () =>
            skillSets.length > 0 ? (
                <section key="skillSets" className="mb-8">
                    <SectionHeading
                        title={resolveHeadingLabel('skillSets', headingLabels, 'Skills')}
                        sectionKey="skillSets"
                        onHeadingChange={onHeadingChange}
                    />
                    <div className="space-y-3">
                        {skillSets.map((set) => (
                            <div key={set.id}>
                                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                                    {set.name}
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                    {set.skills.map((skill) => (
                                        <span
                                            key={skill}
                                            className="rounded-full border border-gray-300 px-2.5 py-0.5 text-xs text-gray-600"
                                        >
                                            {skill}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            ) : null,

        // ── Projects ──
        projects: () =>
            projects.length > 0 ? (
                <section key="projects" className="mb-8">
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
                                    <p className="mt-0.5 text-xs italic text-gray-400">{proj.techStack.join(' · ')}</p>
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            ) : null,

        // ── Certifications ──
        certifications: () =>
            certifications.length > 0 ? (
                <section key="certifications" className="mb-8">
                    <SectionHeading
                        title={resolveHeadingLabel('certifications', headingLabels, 'Certifications')}
                        sectionKey="certifications"
                        onHeadingChange={onHeadingChange}
                    />
                    <div className="space-y-2">
                        {certifications.map((cert) => (
                            <div key={cert.id} className="flex items-baseline justify-between gap-4">
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
                                    <span className="text-xs text-gray-400 shrink-0">
                                        {formatResumeDate(cert.issueDate)}
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
            className="resume-creative mx-auto max-w-[794px] bg-white text-gray-800 shadow-sm print:max-w-none print:shadow-none"
            style={
                {
                    '--resume-accent': accentColor,
                    zoom: fontSize / 100,
                } as React.CSSProperties
            }
        >
            {/* ── Hero Section ── */}
            <header className="relative px-10 pt-10 pb-6 overflow-hidden">
                <div className="flex items-end gap-6">
                    {/* Avatar with accent blob backdrop */}
                    <div className="relative shrink-0">
                        <div
                            className="absolute -inset-3 rounded-full opacity-80"
                            style={{ backgroundColor: accentColor }}
                        />
                        {profile?.avatarUrl ? (
                            <img
                                src={profile.avatarUrl}
                                alt={fullName}
                                className="relative h-32 w-32 rounded-full object-cover"
                            />
                        ) : (
                            <div className="relative flex h-32 w-32 items-center justify-center rounded-full bg-gray-100 text-3xl font-bold text-gray-400">
                                {firstName[0]}
                            </div>
                        )}
                    </div>

                    {/* Big serif hero text */}
                    <div className="pb-2">
                        <h1
                            className="text-4xl font-bold leading-tight text-gray-900"
                            style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
                        >
                            Hi,
                            <br />
                            I&apos;m {firstName}
                            {profile?.headline && (
                                <>
                                    <br />
                                    <span className="text-3xl">&amp; {profile.headline.toLowerCase()}.</span>
                                </>
                            )}
                        </h1>
                    </div>
                </div>

                {/* Contact row */}
                <ContactRow profile={profile} />
            </header>

            {/* ── Sections in user-defined order ── */}
            <div className="px-10 pb-10">
                <hr className="mb-8 border-gray-200" />
                {sectionOrder.map((key) => sectionRenderers[key]?.())}
            </div>

            {/* ── Print styles ── */}
            <style>{`
                @media print {
                    .resume-creative { zoom: ${fontSize / 100}; color: #1a1a1a; }
                    .resume-creative a { color: inherit; text-decoration: none; }
                    .resume-creative section { break-inside: avoid; }
                    .resume-creative header {
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                }
            `}</style>
        </div>
    );
}
