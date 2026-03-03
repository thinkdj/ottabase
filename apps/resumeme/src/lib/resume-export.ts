/**
 * Resume export utilities — PDF (server-side DOM capture) and Plain Text (.txt).
 *
 * PDF strategy:
 *  - `exportAsPdfServerSide()` — uses `@ottabase/cf-pdf/client` to serialise
 *    the live rendered DOM + all page CSS into a self-contained HTML string,
 *    POSTs it to `POST /api/resume/pdf`, and Puppeteer produces a pixel-perfect PDF.
 *  - Requires Cloudflare Browser Rendering API (`OBCF_BROWSER` binding).
 *
 * Generic PDF utilities (DOM capture, metadata injection, download helpers) live
 * in `@ottabase/cf-pdf`. This file contains only resume-specific logic:
 *  - `buildPdfMetadata()` — derives metadata from `ResumeTemplateData`
 *  - `buildPlainText()` / `exportAsPlainText()` — plain-text resume export
 *  - `exportAsPdfServerSide()` — orchestrates capture + POST + download
 */

import type { ResumeTemplateData } from '@/pages/resume/types';
import { formatDateRange } from '@/pages/resume/types';
import type { PdfMetadata } from '@ottabase/cf-pdf';
import { captureDomAsHtml, fetchAndDownloadPdf } from '@ottabase/cf-pdf/client';

// Re-export PdfMetadata so existing imports from this file still work
export type { PdfMetadata } from '@ottabase/cf-pdf';

// ---------------------------------------------------------------------------
// PDF metadata (resume-specific)
// ---------------------------------------------------------------------------

/**
 * Derives meaningful PDF metadata from the resolved resume data.
 *
 * - **Title**: `{fullName} - {headline}` (or just fullName when no headline)
 * - **Author**: `ResumeMe` (constant)
 * - **Subject**: `{headline || firstDesignation || "Professional"} Resume`
 * - **Keywords**: deduplicated bag of skills, job titles, tech stack, cert names,
 *   degree fields, and location — trimmed to the 30 most-significant tokens.
 */
export function buildPdfMetadata(data: ResumeTemplateData): PdfMetadata {
    const headline = data.profile?.headline?.trim() ?? '';
    const fullName = data.fullName?.trim() || 'Resume';

    // ── Title ────────────────────────────────────────────────────────────────
    const title = headline ? `${fullName} - ${headline}` : fullName;

    // ── Subject ──────────────────────────────────────────────────────────────
    // Use headline if present; otherwise fall back to the first job designation.
    const firstDesignation = data.workExperiences[0]?.designation?.trim() ?? '';
    const subjectRole = headline || firstDesignation || 'Professional';
    const subject = `${subjectRole} Resume`;

    // ── Keywords ─────────────────────────────────────────────────────────────
    // Gather tokens from every section of the resume that signals domain/tech.
    const tokens: string[] = [];

    // Individual skills (most granular and ATS-relevant)
    data.skillSets.forEach((ss) => tokens.push(...ss.skills));

    // Skill set category names (e.g. "Frontend", "DevOps")
    data.skillSets.forEach((ss) => ss.name && tokens.push(ss.name));

    // Job designations
    data.workExperiences.forEach((w) => w.designation && tokens.push(w.designation));

    // Tech stack entries across all projects
    data.projects.forEach((p) => tokens.push(...p.techStack));

    // Certification names
    data.certifications.forEach((c) => c.name && tokens.push(c.name));

    // Education degrees and fields
    data.educations.forEach((e) => {
        e.degree && tokens.push(e.degree);
        e.field && tokens.push(e.field);
    });

    // Location — useful for geo-targeted searches
    if (data.profile?.location) tokens.push(data.profile.location);

    // Deduplicate (case-insensitive), strip blanks, cap at 30 keywords.
    const seen = new Set<string>();
    const keywords = tokens
        .map((t) => t.trim())
        .filter((t) => {
            if (!t) return false;
            const key = t.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        })
        .slice(0, 30)
        .join(', ');

    return { title, author: 'ResumeMe', subject, keywords };
}

// ---------------------------------------------------------------------------
// Plain text export
// ---------------------------------------------------------------------------

/** Pads `text` to `width` characters with `char` (default '-') */
function sectionRule(text: string, char = '=') {
    return text + '\n' + char.repeat(text.length);
}

/**
 * Serialises a `ResumeTemplateData` snapshot into a plain-text resume
 * suitable for pasting into job portals or ATS systems.
 */
export function buildPlainText(data: ResumeTemplateData): string {
    const lines: string[] = [];
    const sep = () => lines.push('');

    // ---- Header ----
    lines.push(data.fullName.toUpperCase());

    const contactParts = [
        data.profile?.email,
        data.profile?.phone,
        data.profile?.location,
        data.profile?.linkedinUrl,
        data.profile?.githubUrl,
        data.profile?.website,
    ].filter(Boolean);

    if (data.profile?.headline) {
        lines.push(data.profile.headline);
    }
    if (contactParts.length) {
        lines.push(contactParts.join(' | '));
    }

    // ---- Summary ----
    if (data.summary?.content) {
        sep();
        lines.push(sectionRule('SUMMARY'));
        sep();
        lines.push(data.summary.content);
    }

    // ---- Work Experience ----
    if (data.workExperiences.length) {
        sep();
        lines.push(sectionRule('EXPERIENCE'));

        data.workExperiences.forEach((job) => {
            sep();
            const dateRange = formatDateRange(job.startDate, job.endDate, job.isCurrent);
            lines.push(`${job.designation} — ${job.company}${job.location ? ` · ${job.location}` : ''}`);
            if (dateRange) lines.push(dateRange);
            if (job.description) lines.push(job.description);
            job.highlights.forEach((h) => lines.push(`• ${h}`));
        });
    }

    // ---- Education ----
    if (data.educations.length) {
        sep();
        lines.push(sectionRule('EDUCATION'));

        data.educations.forEach((edu) => {
            sep();
            const fieldStr = edu.field ? ` in ${edu.field}` : '';
            const dateRange = formatDateRange(edu.startDate, edu.endDate);
            lines.push(`${edu.degree}${fieldStr} — ${edu.institution}`);
            if (dateRange) lines.push(dateRange);
            if (edu.grade) lines.push(`Grade: ${edu.grade}`);
            if (edu.description) lines.push(edu.description);
        });
    }

    // ---- Skills ----
    if (data.skillSets.length) {
        sep();
        lines.push(sectionRule('SKILLS'));
        sep();
        data.skillSets.forEach((ss) => {
            lines.push(`${ss.name}: ${ss.skills.join(', ')}`);
        });
    }

    // ---- Projects ----
    if (data.projects.length) {
        sep();
        lines.push(sectionRule('PROJECTS'));

        data.projects.forEach((proj) => {
            sep();
            const dateRange = formatDateRange(proj.startDate, proj.endDate);
            lines.push(proj.title);
            if (dateRange) lines.push(dateRange);
            if (proj.techStack.length) lines.push(`Tech: ${proj.techStack.join(', ')}`);
            if (proj.description) lines.push(proj.description);
            if (proj.url) lines.push(proj.url);
        });
    }

    // ---- Certifications ----
    if (data.certifications.length) {
        sep();
        lines.push(sectionRule('CERTIFICATIONS'));

        data.certifications.forEach((cert) => {
            sep();
            const issued = cert.issueDate ? `Issued: ${cert.issueDate}` : '';
            const expires = cert.expiryDate ? `Expires: ${cert.expiryDate}` : '';
            lines.push(`${cert.name} — ${cert.issuer}`);
            if (issued || expires) lines.push([issued, expires].filter(Boolean).join(' | '));
            if (cert.credentialUrl) lines.push(cert.credentialUrl);
        });
    }

    return lines.join('\n');
}

/**
 * Triggers a plain-text download of the resume.
 *
 * @param data     Full resolved resume data (snapshot or live).
 * @param fileName Suggested file name (extension is appended automatically).
 */
export function exportAsPlainText(data: ResumeTemplateData, fileName?: string): void {
    const text = buildPlainText(data);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `${(fileName || 'resume').replace(/[\\/:*?"<>|]/g, '_')}.txt`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Release object URL after download is triggered.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// Re-export convertZoomToTransform so existing imports still work
export { convertZoomToTransform } from '@ottabase/cf-pdf/client';

// ---------------------------------------------------------------------------
// Server-side PDF export — DOM capture → Cloudflare Browser Rendering API
// ---------------------------------------------------------------------------

/**
 * Generate a PDF server-side via `POST /api/resume/pdf` (Cloudflare Puppeteer).
 *
 * Uses `@ottabase/cf-pdf/client` for generic DOM capture and download, adding
 * only the resume-specific metadata derivation layer on top.
 *
 * @param captureElementId  `id` attribute of the resume preview wrapper div.
 * @param fileName          Suggested download filename (no extension).
 * @param resumeData        Resolved template data used to derive PDF metadata.
 */
export async function exportAsPdfServerSide(
    captureElementId: string,
    fileName?: string,
    resumeData?: ResumeTemplateData,
): Promise<void> {
    // Build PDF metadata from resume data before touching the DOM so the
    // title can be injected into the captured HTML as a <title> tag.
    const metadata: PdfMetadata | undefined = resumeData ? buildPdfMetadata(resumeData) : undefined;

    // Capture the DOM + CSS via @ottabase/cf-pdf — handles zoom conversion,
    // @media print stripping, font link re-attachment, blank-page prevention.
    const html = captureDomAsHtml(captureElementId, {
        title: metadata?.title ?? 'Resume',
        pageSize: 'letter',
        containerSelector: '#resume-capture > div',
    });

    // POST to the worker and trigger browser download
    await fetchAndDownloadPdf('/api/resume/pdf', { html, fileName, metadata }, fileName ?? 'resume');
}
