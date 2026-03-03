/**
 * ATS (Applicant Tracking System) Friendliness Scorer
 *
 * Pure local intelligence — analyses resume data and returns a
 * score (0–100) plus categorised improvement tips. No AI APIs needed.
 *
 * Scoring categories:
 *  1. Contact completeness     (15 pts)
 *  2. Summary / objective      (10 pts)
 *  3. Work experience quality  (25 pts)
 *  4. Education                (10 pts)
 *  5. Skills                   (15 pts)
 *  6. Measurable impact        (10 pts)
 *  7. Formatting & structure   (10 pts)
 *  8. Length & keyword density  ( 5 pts)
 */

import type { ResumeTemplateData } from '@/pages/resume/types';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface AtsTip {
    /** Category the tip belongs to */
    category: string;
    /** Human-readable improvement suggestion */
    message: string;
    /** Severity: 'critical' (red), 'warning' (amber), 'info' (blue) */
    severity: 'critical' | 'warning' | 'info';
}

export interface AtsScoreResult {
    /** Overall score 0–100 */
    score: number;
    /** Label: Poor / Fair / Good / Excellent */
    label: string;
    /** Breakdown per category (category → points earned / max points) */
    breakdown: Record<string, { earned: number; max: number }>;
    /** Actionable improvement tips sorted by severity */
    tips: AtsTip[];
}

/** Analyse resume data and produce an ATS friendliness score. */
export function calculateAtsScore(data: ResumeTemplateData): AtsScoreResult {
    const tips: AtsTip[] = [];
    const breakdown: Record<string, { earned: number; max: number }> = {};

    // 1. Contact completeness — 15 pts
    const contactScore = scoreContact(data, tips);
    breakdown['Contact Info'] = { earned: contactScore, max: 15 };

    // 2. Summary — 10 pts
    const summaryScore = scoreSummary(data, tips);
    breakdown['Summary'] = { earned: summaryScore, max: 10 };

    // 3. Work experience — 25 pts
    const workScore = scoreWorkExperience(data, tips);
    breakdown['Work Experience'] = { earned: workScore, max: 25 };

    // 4. Education — 10 pts
    const eduScore = scoreEducation(data, tips);
    breakdown['Education'] = { earned: eduScore, max: 10 };

    // 5. Skills — 15 pts
    const skillsScore = scoreSkills(data, tips);
    breakdown['Skills'] = { earned: skillsScore, max: 15 };

    // 6. Measurable impact — 10 pts
    const impactScore = scoreImpact(data, tips);
    breakdown['Measurable Impact'] = { earned: impactScore, max: 10 };

    // 7. Formatting & structure — 10 pts
    const structScore = scoreStructure(data, tips);
    breakdown['Structure'] = { earned: structScore, max: 10 };

    // 8. Length & keyword density — 5 pts
    const lengthScore = scoreLength(data, tips);
    breakdown['Content Length'] = { earned: lengthScore, max: 5 };

    const total =
        contactScore + summaryScore + workScore + eduScore + skillsScore + impactScore + structScore + lengthScore;

    const score = Math.min(100, Math.max(0, Math.round(total)));

    // Sort tips: critical → warning → info
    const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
    tips.sort((a, b) => severityOrder[a.severity]! - severityOrder[b.severity]!);

    return {
        score,
        label: scoreLabel(score),
        breakdown,
        tips,
    };
}

/** Map numeric score to a human-readable label */
export function scoreLabel(score: number): string {
    if (score >= 85) return 'Excellent';
    if (score >= 70) return 'Good';
    if (score >= 50) return 'Fair';
    return 'Needs Work';
}

// ---------------------------------------------------------------------------
// Category scorers
// ---------------------------------------------------------------------------

function scoreContact(data: ResumeTemplateData, tips: AtsTip[]): number {
    let pts = 0;
    const p = data.profile;

    // Full name — 3 pts
    if (data.fullName && data.fullName.trim().length > 1) {
        pts += 3;
    } else {
        tips.push({ category: 'Contact Info', message: 'Add your full name.', severity: 'critical' });
    }

    // Email — 3 pts
    if (p?.email) {
        pts += 3;
    } else {
        tips.push({ category: 'Contact Info', message: 'Include an email address.', severity: 'critical' });
    }

    // Phone — 2 pts
    if (p?.phone) {
        pts += 2;
    } else {
        tips.push({
            category: 'Contact Info',
            message: 'Add a phone number for recruiter callbacks.',
            severity: 'warning',
        });
    }

    // Location — 2 pts
    if (p?.location) {
        pts += 2;
    } else {
        tips.push({
            category: 'Contact Info',
            message: 'Include your city/region — many ATS filters by location.',
            severity: 'warning',
        });
    }

    // LinkedIn — 3 pts
    if (p?.linkedinUrl) {
        pts += 3;
    } else {
        tips.push({ category: 'Contact Info', message: 'Add your LinkedIn profile URL.', severity: 'info' });
    }

    // Website or GitHub — 2 pts
    if (p?.website || p?.githubUrl) {
        pts += 2;
    } else {
        tips.push({
            category: 'Contact Info',
            message: 'Consider adding a portfolio or GitHub link.',
            severity: 'info',
        });
    }

    return Math.min(15, pts);
}

function scoreSummary(data: ResumeTemplateData, tips: AtsTip[]): number {
    const content = data.summary?.content?.trim() ?? '';

    if (!content) {
        tips.push({
            category: 'Summary',
            message: 'Add a professional summary — ATS and recruiters scan it first.',
            severity: 'critical',
        });
        return 0;
    }

    let pts = 5; // base for having a summary
    const wordCount = content.split(/\s+/).length;

    if (wordCount >= 30 && wordCount <= 80) {
        pts += 5;
    } else if (wordCount < 30) {
        pts += 2;
        tips.push({
            category: 'Summary',
            message: `Summary is short (${wordCount} words). Aim for 30–80 words.`,
            severity: 'warning',
        });
    } else {
        pts += 3;
        tips.push({
            category: 'Summary',
            message: `Summary is long (${wordCount} words). Keep it under 80 words for quick scanning.`,
            severity: 'info',
        });
    }

    return Math.min(10, pts);
}

function scoreWorkExperience(data: ResumeTemplateData, tips: AtsTip[]): number {
    const jobs = data.workExperiences;

    if (jobs.length === 0) {
        tips.push({
            category: 'Work Experience',
            message: 'Add at least one work experience entry.',
            severity: 'critical',
        });
        return 0;
    }

    let pts = 5; // base for having work

    // Number of roles — up to 5 pts (1 pt per role, max 5)
    pts += Math.min(5, jobs.length);
    if (jobs.length < 2) {
        tips.push({
            category: 'Work Experience',
            message: 'Include 2–4 relevant roles to show career progression.',
            severity: 'warning',
        });
    }

    // Dates present — 5 pts
    const withDates = jobs.filter((j) => j.startDate).length;
    if (withDates === jobs.length) {
        pts += 5;
    } else {
        const missing = jobs.length - withDates;
        pts += Math.round((withDates / jobs.length) * 5);
        tips.push({
            category: 'Work Experience',
            message: `${missing} role(s) missing start dates — ATS may flag gaps.`,
            severity: 'warning',
        });
    }

    // Highlights / bullet points — 10 pts
    const totalHighlights = jobs.reduce((sum, j) => sum + j.highlights.length, 0);
    if (totalHighlights >= jobs.length * 2) {
        pts += 10;
    } else if (totalHighlights > 0) {
        pts += Math.min(10, Math.round((totalHighlights / (jobs.length * 2)) * 10));
        tips.push({
            category: 'Work Experience',
            message: 'Add 2–4 bullet-point highlights per role for better ATS matching.',
            severity: 'warning',
        });
    } else {
        tips.push({
            category: 'Work Experience',
            message: 'Add achievement-based bullet points to each role.',
            severity: 'critical',
        });
    }

    return Math.min(25, pts);
}

function scoreEducation(data: ResumeTemplateData, tips: AtsTip[]): number {
    const edu = data.educations;

    if (edu.length === 0) {
        tips.push({
            category: 'Education',
            message: 'Add education details — many ATS require a degree field.',
            severity: 'warning',
        });
        return 0;
    }

    let pts = 5; // base for having education

    // Degree + institution — 3 pts
    const complete = edu.filter((e) => e.degree && e.institution).length;
    if (complete === edu.length) {
        pts += 3;
    } else {
        pts += Math.round((complete / edu.length) * 3);
        tips.push({
            category: 'Education',
            message: 'Ensure every education entry has both degree and institution.',
            severity: 'info',
        });
    }

    // Dates — 2 pts
    const withDates = edu.filter((e) => e.endDate || e.startDate).length;
    if (withDates === edu.length) {
        pts += 2;
    } else {
        pts += Math.round((withDates / edu.length) * 2);
    }

    return Math.min(10, pts);
}

function scoreSkills(data: ResumeTemplateData, tips: AtsTip[]): number {
    const skills = data.skillSets;
    const totalSkills = skills.reduce((sum, s) => sum + s.skills.length, 0);

    if (totalSkills === 0) {
        tips.push({
            category: 'Skills',
            message: 'Add a skills section — ATS heavily relies on keyword matching.',
            severity: 'critical',
        });
        return 0;
    }

    let pts = 5; // base

    // Skill count — up to 5 pts
    if (totalSkills >= 8) {
        pts += 5;
    } else {
        pts += Math.round((totalSkills / 8) * 5);
        tips.push({
            category: 'Skills',
            message: `You have ${totalSkills} skills listed. Aim for 8+ relevant skills.`,
            severity: 'warning',
        });
    }

    // Multiple categories — up to 5 pts
    if (skills.length >= 2) {
        pts += 5;
    } else {
        pts += 2;
        tips.push({
            category: 'Skills',
            message: 'Group skills into 2+ categories (e.g. Languages, Tools, Soft Skills).',
            severity: 'info',
        });
    }

    return Math.min(15, pts);
}

/** Check for numbers/metrics in work highlights — signals measurable impact */
function scoreImpact(data: ResumeTemplateData, tips: AtsTip[]): number {
    const allHighlights = data.workExperiences.flatMap((j) => j.highlights);

    if (allHighlights.length === 0) return 0;

    // Count highlights containing numbers (e.g. "40%", "10M", "$500K", "200+")
    const quantified = allHighlights.filter((h) => /\d/.test(h)).length;
    const ratio = quantified / allHighlights.length;

    let pts: number;
    if (ratio >= 0.5) {
        pts = 10;
    } else if (ratio >= 0.25) {
        pts = 7;
        tips.push({
            category: 'Measurable Impact',
            message: 'Quantify more achievements with numbers (e.g. "reduced costs by 30%").',
            severity: 'info',
        });
    } else if (quantified > 0) {
        pts = 4;
        tips.push({
            category: 'Measurable Impact',
            message: `Only ${quantified} of ${allHighlights.length} bullet points include metrics. Add numbers to show impact.`,
            severity: 'warning',
        });
    } else {
        pts = 0;
        tips.push({
            category: 'Measurable Impact',
            message:
                'None of your bullet points contain numbers. Quantify achievements (revenue, %, users, time saved).',
            severity: 'critical',
        });
    }

    return Math.min(10, pts);
}

/** Check structural completeness */
function scoreStructure(data: ResumeTemplateData, tips: AtsTip[]): number {
    let pts = 0;

    // Has headline — 3 pts
    if (data.profile?.headline) {
        pts += 3;
    } else {
        tips.push({
            category: 'Structure',
            message: 'Add a professional headline (e.g. "Senior Software Engineer").',
            severity: 'warning',
        });
    }

    // Has projects or certifications — 4 pts
    const hasExtras = data.projects.length > 0 || data.certifications.length > 0;
    if (hasExtras) {
        pts += 4;
    } else {
        tips.push({
            category: 'Structure',
            message: 'Add projects or certifications to strengthen your profile.',
            severity: 'info',
        });
    }

    // All sections populated — 3 pts
    const sectionsFilled = [
        data.summary !== null,
        data.workExperiences.length > 0,
        data.educations.length > 0,
        data.skillSets.length > 0,
    ].filter(Boolean).length;

    if (sectionsFilled === 4) {
        pts += 3;
    } else {
        pts += Math.round((sectionsFilled / 4) * 3);
    }

    return Math.min(10, pts);
}

/** Check overall content length is neither too sparse nor bloated */
function scoreLength(data: ResumeTemplateData, tips: AtsTip[]): number {
    // Estimate total word count across all text fields
    const texts: string[] = [];
    if (data.summary?.content) texts.push(data.summary.content);
    if (data.profile?.headline) texts.push(data.profile.headline);
    for (const j of data.workExperiences) {
        if (j.description) texts.push(j.description);
        texts.push(...j.highlights);
    }
    for (const e of data.educations) {
        if (e.description) texts.push(e.description);
    }
    for (const p of data.projects) {
        if (p.description) texts.push(p.description);
    }

    const wordCount = texts.join(' ').split(/\s+/).filter(Boolean).length;

    if (wordCount < 50) {
        tips.push({
            category: 'Content Length',
            message: `Resume is very thin (~${wordCount} words). Aim for 200–600 words of content.`,
            severity: 'critical',
        });
        return 1;
    }

    if (wordCount < 200) {
        tips.push({
            category: 'Content Length',
            message: `Resume has ~${wordCount} words. Expand descriptions to 200–600 for better ATS matching.`,
            severity: 'warning',
        });
        return 3;
    }

    if (wordCount > 800) {
        tips.push({
            category: 'Content Length',
            message: `Resume has ~${wordCount} words. Consider trimming to keep it focused (aim for 200–600).`,
            severity: 'info',
        });
        return 4;
    }

    return 5;
}
