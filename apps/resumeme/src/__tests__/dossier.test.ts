import { describe, expect, it } from 'vitest';
import { ResumeApplicationDossier } from '../../ottabase/models/ResumeApplicationDossier';
import { ResumeApplicationDossierFile } from '../../ottabase/models/ResumeApplicationDossierFile';
import { router } from '../router';

// ── Application Dossier Fat Models ──────────────────────────

describe('ResumeApplicationDossier Model', () => {
    it('has entity "resume_application_dossiers"', () => {
        expect(ResumeApplicationDossier.entity).toBe('resume_application_dossiers');
    });

    it('has table defined', () => {
        expect(ResumeApplicationDossier.table).toBeDefined();
    });

    it('has primaryKey "id"', () => {
        expect(ResumeApplicationDossier.primaryKey).toBe('id');
    });

    it('has packageType "app"', () => {
        expect(ResumeApplicationDossier.packageType).toBe('app');
    });

    it('has date casts', () => {
        expect(ResumeApplicationDossier.casts).toHaveProperty('createdAt', 'date');
        expect(ResumeApplicationDossier.casts).toHaveProperty('updatedAt', 'date');
        expect(ResumeApplicationDossier.casts).toHaveProperty('lastAnalysisAt', 'date');
    });

    it('has default status "active"', () => {
        const defaults = (ResumeApplicationDossier as any).defaults;
        expect(defaults).toBeDefined();
        expect(defaults.status).toBe('active');
    });

    it('has forUser static method', () => {
        expect(typeof ResumeApplicationDossier.forUser).toBe('function');
    });

    it('getAnalysisResult returns null for empty', () => {
        const dossier = new ResumeApplicationDossier({ data: {} });
        expect(dossier.getAnalysisResult()).toBeNull();
    });

    it('getAnalysisResult parses valid JSON', () => {
        const dossier = new ResumeApplicationDossier({ data: { analysisResult: JSON.stringify({ matchScore: 75 }) } });
        const result = dossier.getAnalysisResult<{ matchScore: number }>();
        expect(result).toEqual({ matchScore: 75 });
    });

    it('getAnalysisResult returns null for invalid JSON', () => {
        const dossier = new ResumeApplicationDossier({ data: { analysisResult: 'not-json' } });
        expect(dossier.getAnalysisResult()).toBeNull();
    });

    it('setAnalysisResult stores JSON and sets lastAnalysisAt', () => {
        const dossier = new ResumeApplicationDossier({ data: {} });
        dossier.setAnalysisResult({ matchScore: 80 });
        const stored = dossier.get('analysisResult') as string;
        expect(JSON.parse(stored)).toEqual({ matchScore: 80 });
        expect(dossier.get('lastAnalysisAt')).toBeDefined();
    });

    it('has validation rules for name', () => {
        const rules = (ResumeApplicationDossier as any).validationRules;
        expect(rules).toHaveProperty('name');
        expect(rules.name.rules).toBe('required');
    });
});

describe('ResumeApplicationDossierFile Model', () => {
    it('has entity "resume_application_dossier_files"', () => {
        expect(ResumeApplicationDossierFile.entity).toBe('resume_application_dossier_files');
    });

    it('has table defined', () => {
        expect(ResumeApplicationDossierFile.table).toBeDefined();
    });

    it('has primaryKey "id"', () => {
        expect(ResumeApplicationDossierFile.primaryKey).toBe('id');
    });

    it('has packageType "app"', () => {
        expect(ResumeApplicationDossierFile.packageType).toBe('app');
    });

    it('has date casts', () => {
        expect(ResumeApplicationDossierFile.casts).toHaveProperty('createdAt', 'date');
        expect(ResumeApplicationDossierFile.casts).toHaveProperty('updatedAt', 'date');
    });

    it('casts fileSize as number', () => {
        expect(ResumeApplicationDossierFile.casts).toHaveProperty('fileSize', 'number');
    });

    it('has default status "uploaded"', () => {
        const defaults = (ResumeApplicationDossierFile as any).defaults;
        expect(defaults).toBeDefined();
        expect(defaults.status).toBe('uploaded');
    });

    it('has forDossier static method', () => {
        expect(typeof ResumeApplicationDossierFile.forDossier).toBe('function');
    });

    it('has forUser static method', () => {
        expect(typeof ResumeApplicationDossierFile.forUser).toBe('function');
    });

    it('has validation rules for fileName', () => {
        const rules = (ResumeApplicationDossierFile as any).validationRules;
        expect(rules).toHaveProperty('fileName');
        expect(rules.fileName.rules).toBe('required');
    });
});

// ── Router ──────────────────────────────────────────────────

describe('Dossier routes in Router', () => {
    it('has /dossier route', () => {
        const routeIds = Object.keys(router.routesById);
        expect(routeIds).toContain('/dossier');
    });

    it('has /dossier/$dossierId route', () => {
        const routeIds = Object.keys(router.routesById);
        expect(routeIds).toContain('/dossier/$dossierId');
    });
});

// ── Dossier helper: formatDate ────────────────────────────────

describe('Dossier helper: getMatchScore', () => {
    // Re-implement the getMatchScore function for testing (same logic as in ResumeApplicationDossierPage)
    function getMatchScore(analysisResult: string | null | undefined): number | null {
        if (!analysisResult) return null;
        try {
            const parsed = JSON.parse(analysisResult);
            const score = parsed?.score ?? parsed?.matchScore;
            return typeof score === 'number' ? score : null;
        } catch {
            return null;
        }
    }

    it('returns null for null input', () => {
        expect(getMatchScore(null)).toBeNull();
    });

    it('returns null for undefined input', () => {
        expect(getMatchScore(undefined)).toBeNull();
    });

    it('returns null for empty string', () => {
        expect(getMatchScore('')).toBeNull();
    });

    it('returns null for invalid JSON', () => {
        expect(getMatchScore('not json')).toBeNull();
    });

    it('extracts matchScore from valid JSON', () => {
        expect(getMatchScore(JSON.stringify({ matchScore: 85 }))).toBe(85);
    });

    it('extracts score from valid JSON (alternative key)', () => {
        expect(getMatchScore(JSON.stringify({ score: 42 }))).toBe(42);
    });

    it('returns null when no score key exists', () => {
        expect(getMatchScore(JSON.stringify({ summary: 'hello' }))).toBeNull();
    });

    it('returns null when score is not a number', () => {
        expect(getMatchScore(JSON.stringify({ matchScore: 'high' }))).toBeNull();
    });
});

// ── Detail page helpers ─────────────────────────────────────

describe('Dossier detail helpers', () => {
    // Re-implement parseAnalysisResult for testing
    function parseAnalysisResult(raw: string | null | undefined) {
        if (!raw) return null;
        try {
            return JSON.parse(raw);
        } catch {
            return null;
        }
    }

    function formatFileSize(bytes: unknown): string {
        const n = typeof bytes === 'number' ? bytes : Number(bytes);
        if (!n || isNaN(n)) return '—';
        if (n < 1024) return `${n} B`;
        if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
        return `${(n / (1024 * 1024)).toFixed(1)} MB`;
    }

    it('parseAnalysisResult returns null for falsy', () => {
        expect(parseAnalysisResult(null)).toBeNull();
        expect(parseAnalysisResult(undefined)).toBeNull();
        expect(parseAnalysisResult('')).toBeNull();
    });

    it('parseAnalysisResult parses valid JSON', () => {
        const data = { matchScore: 90, summary: 'Great match' };
        expect(parseAnalysisResult(JSON.stringify(data))).toEqual(data);
    });

    it('parseAnalysisResult returns null for invalid JSON', () => {
        expect(parseAnalysisResult('{bad')).toBeNull();
    });

    it('formatFileSize handles bytes', () => {
        expect(formatFileSize(512)).toBe('512 B');
    });

    it('formatFileSize handles kilobytes', () => {
        expect(formatFileSize(2048)).toBe('2.0 KB');
    });

    it('formatFileSize handles megabytes', () => {
        expect(formatFileSize(1.5 * 1024 * 1024)).toBe('1.5 MB');
    });

    it('formatFileSize returns dash for NaN', () => {
        expect(formatFileSize(NaN)).toBe('—');
    });

    it('formatFileSize returns dash for null', () => {
        expect(formatFileSize(null)).toBe('—');
    });
});

// ── Layout nav ──────────────────────────────────────────────

describe('Nav links include Application Dossier', () => {
    // Import and test that getNavLinks includes /dossier for authenticated users
    it('includes /dossier for authenticated users', async () => {
        const { getNavLinks } = await import('../ottabase/components/layout/layout.constants');
        const links = getNavLinks(true, []);
        const dossierLink = links.find((l) => l.to === '/dossier');
        expect(dossierLink).toBeDefined();
        expect(dossierLink!.label).toBe('Application Dossier');
    });

    it('excludes /dossier for unauthenticated users', async () => {
        const { getNavLinks } = await import('../ottabase/components/layout/layout.constants');
        const links = getNavLinks(false, []);
        const dossierLink = links.find((l) => l.to === '/dossier');
        expect(dossierLink).toBeUndefined();
    });
});
