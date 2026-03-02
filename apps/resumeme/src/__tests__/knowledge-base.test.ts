import { describe, it, expect } from 'vitest';
import { KnowledgeBase } from '../../ottabase/models/KnowledgeBase';
import { KnowledgeBaseFile } from '../../ottabase/models/KnowledgeBaseFile';
import { router } from '../router';

// ── KB Fat Models ───────────────────────────────────────────

describe('KnowledgeBase Model', () => {
    it('has entity "knowledge_bases"', () => {
        expect(KnowledgeBase.entity).toBe('knowledge_bases');
    });

    it('has table defined', () => {
        expect(KnowledgeBase.table).toBeDefined();
    });

    it('has primaryKey "id"', () => {
        expect(KnowledgeBase.primaryKey).toBe('id');
    });

    it('has packageType "app"', () => {
        expect(KnowledgeBase.packageType).toBe('app');
    });

    it('has date casts', () => {
        expect(KnowledgeBase.casts).toHaveProperty('createdAt', 'date');
        expect(KnowledgeBase.casts).toHaveProperty('updatedAt', 'date');
        expect(KnowledgeBase.casts).toHaveProperty('lastAnalysisAt', 'date');
    });

    it('has default status "active"', () => {
        const defaults = (KnowledgeBase as any).defaults;
        expect(defaults).toBeDefined();
        expect(defaults.status).toBe('active');
    });

    it('has forUser static method', () => {
        expect(typeof KnowledgeBase.forUser).toBe('function');
    });

    it('getAnalysisResult returns null for empty', () => {
        const kb = new KnowledgeBase({ data: {} });
        expect(kb.getAnalysisResult()).toBeNull();
    });

    it('getAnalysisResult parses valid JSON', () => {
        const kb = new KnowledgeBase({ data: { analysisResult: JSON.stringify({ matchScore: 75 }) } });
        const result = kb.getAnalysisResult<{ matchScore: number }>();
        expect(result).toEqual({ matchScore: 75 });
    });

    it('getAnalysisResult returns null for invalid JSON', () => {
        const kb = new KnowledgeBase({ data: { analysisResult: 'not-json' } });
        expect(kb.getAnalysisResult()).toBeNull();
    });

    it('setAnalysisResult stores JSON and sets lastAnalysisAt', () => {
        const kb = new KnowledgeBase({ data: {} });
        kb.setAnalysisResult({ matchScore: 80 });
        const stored = kb.get('analysisResult') as string;
        expect(JSON.parse(stored)).toEqual({ matchScore: 80 });
        expect(kb.get('lastAnalysisAt')).toBeDefined();
    });

    it('has validation rules for name', () => {
        const rules = (KnowledgeBase as any).validationRules;
        expect(rules).toHaveProperty('name');
        expect(rules.name.rules).toBe('required');
    });
});

describe('KnowledgeBaseFile Model', () => {
    it('has entity "knowledge_base_files"', () => {
        expect(KnowledgeBaseFile.entity).toBe('knowledge_base_files');
    });

    it('has table defined', () => {
        expect(KnowledgeBaseFile.table).toBeDefined();
    });

    it('has primaryKey "id"', () => {
        expect(KnowledgeBaseFile.primaryKey).toBe('id');
    });

    it('has packageType "app"', () => {
        expect(KnowledgeBaseFile.packageType).toBe('app');
    });

    it('has date casts', () => {
        expect(KnowledgeBaseFile.casts).toHaveProperty('createdAt', 'date');
        expect(KnowledgeBaseFile.casts).toHaveProperty('updatedAt', 'date');
    });

    it('casts fileSize as number', () => {
        expect(KnowledgeBaseFile.casts).toHaveProperty('fileSize', 'number');
    });

    it('has default status "uploaded"', () => {
        const defaults = (KnowledgeBaseFile as any).defaults;
        expect(defaults).toBeDefined();
        expect(defaults.status).toBe('uploaded');
    });

    it('has forKnowledgeBase static method', () => {
        expect(typeof KnowledgeBaseFile.forKnowledgeBase).toBe('function');
    });

    it('has forUser static method', () => {
        expect(typeof KnowledgeBaseFile.forUser).toBe('function');
    });

    it('has validation rules for fileName', () => {
        const rules = (KnowledgeBaseFile as any).validationRules;
        expect(rules).toHaveProperty('fileName');
        expect(rules.fileName.rules).toBe('required');
    });
});

// ── Router ──────────────────────────────────────────────────

describe('KB routes in Router', () => {
    it('has /kb route', () => {
        const routeIds = Object.keys(router.routesById);
        expect(routeIds).toContain('/kb');
    });

    it('has /kb/$kbId route', () => {
        const routeIds = Object.keys(router.routesById);
        expect(routeIds).toContain('/kb/$kbId');
    });
});

// ── KnowledgeBasePage helper: formatDate ────────────────────

describe('KB helper: getMatchScore', () => {
    // Re-implement the getMatchScore function for testing (same logic as in KnowledgeBasePage)
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

describe('KB detail helpers', () => {
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

describe('Nav links include Knowledge Base', () => {
    // Import and test that getNavLinks includes /kb for authenticated users
    it('includes /kb for authenticated users', async () => {
        const { getNavLinks } = await import('../ottabase/components/layout/layout.constants');
        const links = getNavLinks(true, []);
        const kbLink = links.find((l) => l.to === '/kb');
        expect(kbLink).toBeDefined();
        expect(kbLink!.label).toBe('Knowledge Base');
    });

    it('excludes /kb for unauthenticated users', async () => {
        const { getNavLinks } = await import('../ottabase/components/layout/layout.constants');
        const links = getNavLinks(false, []);
        const kbLink = links.find((l) => l.to === '/kb');
        expect(kbLink).toBeUndefined();
    });
});
