/**
 * Resume export utilities — PDF (server-side DOM capture) and Plain Text (.txt).
 *
 * PDF strategy:
 *  - `exportAsPdfServerSide()` — serializes the live rendered DOM + all page CSS
 *    into a self-contained HTML string, POSTs it to `POST /api/resume/pdf`, and
 *    Puppeteer produces a pixel-perfect PDF.
 *  - Requires Cloudflare Browser Rendering API (`OBCF_BROWSER` binding).
 */

import type { ResumeTemplateData } from '@/pages/resume/types';
import { formatDateRange } from '@/pages/resume/types';

// ---------------------------------------------------------------------------
// PDF metadata
// ---------------------------------------------------------------------------

/** Structured PDF document metadata injected via pdf-lib after Puppeteer renders. */
export interface PdfMetadata {
    /** e.g. "Jane Doe - Software Engineer" */
    title: string;
    /** Always "ResumeMe" */
    author: string;
    /** Short description of the document, e.g. "Software Engineer Resume" */
    subject: string;
    /** Comma-separated keywords drawn from skills, titles, tech stack, certs, etc. */
    keywords: string;
}

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

// ---------------------------------------------------------------------------
// Server-side PDF export — DOM capture → Cloudflare Browser Rendering API
// ---------------------------------------------------------------------------

/**
 * Converts a CSS `zoom` property on an element to an equivalent
 * `transform: scale()` — `zoom` is a non-standard property that behaves
 * inconsistently in Puppeteer's print/PDF context. `transform: scale()`
 * is standards-based and produces reliable results.
 *
 * Also adjusts the container's `transform-origin` and width so the scaled
 * content fills the page correctly.
 */
export function convertZoomToTransform(element: HTMLElement): void {
    const zoomValue = element.style.zoom;
    if (!zoomValue) return;

    const zoom = parseFloat(zoomValue);
    if (isNaN(zoom) || zoom === 0) return;

    // Remove the non-standard zoom property
    element.style.zoom = '';

    // Apply standards-based transform instead
    element.style.transform = `scale(${zoom})`;
    element.style.transformOrigin = 'top left';

    // When an element is scaled with transform, it still occupies its
    // original layout box. Widen the container so the scaled content
    // can fill the full page width.
    if (zoom !== 1) {
        element.style.width = `${100 / zoom}%`;
    }
}

/**
 * Serialises the live rendered resume DOM (identified by `captureId`) together
 * with every CSS rule loaded on the page into a fully self-contained HTML string.
 *
 * The string is sent to `POST /api/resume/pdf` where Puppeteer renders it and
 * returns a PDF that is a pixel-perfect replica of what the user sees on screen.
 *
 * Key design decisions:
 *  - CSS `zoom` is converted to `transform: scale()` for reliable PDF rendering.
 *  - `@page` CSS is injected for explicit page size control inside Puppeteer.
 *  - External font `<link>` tags (Google Fonts etc.) are re-attached so Puppeteer's
 *    Chromium can fetch them with full network access.
 *  - `@media print` blocks from the app shell are stripped — they contain rules
 *    like `header { display:none }` that would hide the resume template's own
 *    `<header>` element.
 */
function captureResumeHtml(captureId: string, docTitle?: string): string {
    const el = document.getElementById(captureId);
    if (!el) {
        throw new Error('Resume preview element not found. Ensure the resume is fully rendered before exporting.');
    }

    // Clone the element so decorative wrapper styles can be stripped without
    // mutating the live DOM (shadow, ring, rounded corners look odd in a PDF).
    const clone = el.cloneNode(true) as HTMLElement;
    clone.style.boxShadow = 'none';
    clone.style.borderRadius = '0';
    clone.style.outline = 'none';
    clone.style.maxWidth = 'none'; // let Puppeteer control page width
    clone.style.aspectRatio = 'auto'; // allow content to flow across PDF pages
    clone.style.overflow = 'visible';

    // Convert CSS zoom → transform:scale() on the resume container and any
    // child elements that use it (template root divs apply zoom for the
    // proportional scaling feature). zoom is non-standard and Puppeteer's
    // print context handles it inconsistently.
    convertZoomToTransform(clone);
    for (const child of Array.from(clone.querySelectorAll<HTMLElement>('[style*="zoom"]'))) {
        convertZoomToTransform(child);
    }

    // ── Collect CSS ──────────────────────────────────────────────────────────
    // Iterate every stylesheet loaded on the page:
    //  • Skip cross-origin sheets (Google Fonts etc.) — they throw SecurityError.
    //    We re-attach those via <link> tags below so Puppeteer can fetch them.
    //  • Skip @media print blocks entirely — they were written for window.print()
    //    from the full app shell and contain rules like `header { display:none }`
    //    that would hide the resume template's <header> element when Puppeteer
    //    renders the PDF (which also uses the print media context).
    //  • Rewrite any inline `zoom:` declarations to their `transform: scale()`
    //    equivalents so CSS class-based zoom also works correctly in PDF.
    let css = '';
    for (const sheet of Array.from(document.styleSheets)) {
        try {
            for (const rule of Array.from(sheet.cssRules ?? [])) {
                // Drop @media print blocks — destructive in PDF context
                if (rule instanceof CSSMediaRule && rule.media.mediaText.includes('print')) {
                    continue;
                }
                css += rule.cssText + '\n';
            }
        } catch {
            // SecurityError from cross-origin sheet — handled via <link> below
        }
    }

    // ── Re-attach external font <link> tags ──────────────────────────────────
    // Google Fonts (and any other stylesheet <link>s) are cross-origin and
    // therefore skipped above. We include them directly so Puppeteer (which
    // has full network access) can fetch the font files and render correct
    // typefaces instead of falling back to system serif.
    //
    // We also add <link rel="preconnect"> hints for Google Fonts' CDN domains
    // so Chromium can start the TLS handshake early and reduce font load time.
    const fontLinks: string[] = [];
    const seenHrefs = new Set<string>();
    for (const linkEl of Array.from(document.head.querySelectorAll('link[rel="stylesheet"], link[rel="preconnect"]'))) {
        const href = linkEl.getAttribute('href') ?? '';
        if (seenHrefs.has(href)) continue;
        seenHrefs.add(href);
        fontLinks.push(linkEl.outerHTML);
    }

    // Ensure Google Fonts preconnect hints are always present — even if the
    // page didn't include them, Puppeteer benefits from early DNS + TLS.
    const preconnectDomains = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'];
    for (const domain of preconnectDomains) {
        if (!seenHrefs.has(domain)) {
            fontLinks.unshift(`<link rel="preconnect" href="${domain}" crossorigin>`);
        }
    }

    // ── Capture :root font CSS variables ────────────────────────────────────
    // Brand theme (BrandThemeApplicator) sets --font-heading, --font-body,
    // --font-handwriting etc. on document.documentElement.style. These are NOT
    // in any stylesheet — they're inline. Without them, var(--font-heading)
    // resolves to fallback (system fonts) and Google Fonts never apply in PDF.
    const rootVars: string[] = [];
    const rootStyle = document.documentElement.style;
    for (let i = 0; i < rootStyle.length; i++) {
        const prop = rootStyle[i];
        if (prop.startsWith('--font-') || prop.startsWith('--typography-')) {
            const val = rootStyle.getPropertyValue(prop).trim();
            if (val) rootVars.push(`${prop}: ${val}`);
        }
    }
    const rootVarsCss = rootVars.length > 0 ? `:root {\n  ${rootVars.join(';\n  ')};\n}\n\n` : '';

    // Escape any HTML entities that could break the <title> tag.
    const safeTitle = (docTitle ?? 'Resume').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${safeTitle}</title>
  ${fontLinks.join('\n  ')}
  <style>
    /* ── Page geometry — explicit @page tells Puppeteer's Chromium exactly
       how to lay out the page, independent of the Puppeteer API options. ── */
    @page {
      size: letter;
      margin: 0;
    }

    /* Ensure colors/backgrounds print exactly as shown on screen */
    *, *::before, *::after {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    html, body {
      margin: 0;
      padding: 0;
      background: white;
      /* Force light mode in Puppeteer — avoids inheriting prefers-color-scheme:dark */
      color-scheme: light;
    }

    /* Override any app-shell height utilities (e.g. Tailwind's h-full / min-h-screen)
       that would force body to be exactly one viewport-page tall, causing Chromium's
       PDF renderer to emit a trailing blank page when content is shorter than a page.
       Placed here AND repeated after ${css} so it wins regardless of specificity. */
    html, body {
      height: fit-content !important;
      min-height: unset !important;
    }

    /* Prevent sections from being split across page breaks */
    section, .break-inside-avoid {
      break-inside: avoid;
    }

    /* Template roots use max-w-[794px] etc. — override for edge-to-edge PDF */
    #resume-capture > div {
      max-width: 100% !important;
      width: 100% !important;
    }

    /* Font/typography vars from brand theme — required for Google Fonts in PDF */
    ${rootVarsCss}
    ${css}

    /* ── Trailing-blank-page guard (must come AFTER collected CSS to win) ──
       App-shell CSS (e.g. Tailwind base) often sets html/body height to 100%
       or min-height: 100vh.  In Puppeteer's print context this forces the body
       to fill exactly one letter-page, so any resume whose content is shorter
       than 1 full page (or lands exactly at a page boundary) gets an empty
       trailing page.  Resetting to fit-content lets Chromium size to content. */
    html, body {
      height: fit-content !important;
      min-height: unset !important;
    }
  </style>
</head>
<body>
  ${clone.outerHTML}
</body>
</html>`;
}

/**
 * Generate a PDF server-side via `POST /api/resume/pdf` (Cloudflare Puppeteer).
 *
 * Captures the live rendered DOM + all CSS and ships it to the worker where
 * Puppeteer renders an exact visual replica as a PDF.
 *
 * Fallback behavior:
 *  - `503 BROWSER_BINDING_UNAVAILABLE` — throws with a clear message (Browser
 *    Rendering binding not configured in this environment).
 *  - Any other error — throws so the caller can surface a toast.
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

    // Capture the DOM + CSS synchronously before going async — the UI must
    // still be fully rendered and visible at the point of capture.
    const html = captureResumeHtml(captureElementId, metadata?.title);

    const response = await fetch('/api/resume/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // forward session cookie
        body: JSON.stringify({ html, fileName, metadata }),
    });

    if (!response.ok) {
        let errorMessage = `PDF generation failed (HTTP ${response.status})`;
        try {
            const json = (await response.json()) as { error?: string; message?: string };
            errorMessage = json.error ?? json.message ?? errorMessage;
        } catch {
            // ignore JSON parse failure
        }
        throw new Error(errorMessage);
    }

    // Trigger download of the returned PDF blob.
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    const safeName = (fileName ?? 'resume').replace(/[\\/:*?"<>|]/g, '_');
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `${safeName}.pdf`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
}
