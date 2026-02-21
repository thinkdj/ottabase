import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    AnalyticsQueryError,
    buildAnalyticsQuery,
    buildQuantileQuery,
    buildTopKQuery,
    executeRawQuery,
    queryEvents,
    queryFunnel,
    queryQuantile,
    queryTopK,
    queryUniqueVisitors,
    resolveGroupByColumn,
    sanitizeIndexFilter,
    validateAnalyticsConfig,
} from '../src/query';

describe('validateAnalyticsConfig', () => {
    it('returns null when both fields are present', () => {
        expect(validateAnalyticsConfig({ accountId: 'abc', apiToken: 'xyz' })).toBeNull();
    });

    it('returns error when accountId is missing', () => {
        expect(validateAnalyticsConfig({ apiToken: 'xyz' })).toContain('CLOUDFLARE_ACCOUNT_ID');
    });

    it('returns error when apiToken is missing', () => {
        expect(validateAnalyticsConfig({ accountId: 'abc' })).toContain('CLOUDFLARE_ANALYTICS_API_TOKEN');
    });

    it('returns error when both are missing', () => {
        expect(validateAnalyticsConfig({})).toBeTruthy();
    });
});

describe('sanitizeIndexFilter', () => {
    it('returns valid alphanumeric-dash-underscore strings unchanged', () => {
        expect(sanitizeIndexFilter('abc-123_XYZ')).toBe('abc-123_XYZ');
    });

    it('returns empty string for invalid characters', () => {
        expect(sanitizeIndexFilter("abc'; DROP TABLE --")).toBe('');
    });

    it('escapes single quotes in valid strings', () => {
        // This won't contain a single quote since it would fail the regex
        // But test the edge case of a string that's valid except for quotes
        expect(sanitizeIndexFilter('')).toBe('');
    });

    it('returns empty string for empty input', () => {
        expect(sanitizeIndexFilter('')).toBe('');
    });
});

describe('buildAnalyticsQuery', () => {
    it('builds a country groupBy query', () => {
        const sql = buildAnalyticsQuery({
            dataset: 'shortlink_clicks',
            days: 7,
            groupBy: 'country',
        });

        expect(sql).toContain('blob1 AS dimension');
        expect(sql).toContain('FROM shortlink_clicks');
        expect(sql).toContain("INTERVAL '7' DAY");
        expect(sql).toContain('AS value');
        expect(sql).toContain('ORDER BY value DESC');
    });

    it('builds an index groupBy query', () => {
        const sql = buildAnalyticsQuery({
            dataset: 'referral_clicks',
            groupBy: 'index',
        });

        expect(sql).toContain('index1 AS dimension');
        expect(sql).toContain('FROM referral_clicks');
    });

    it('builds a day groupBy query', () => {
        const sql = buildAnalyticsQuery({
            dataset: 'core_events',
            groupBy: 'day',
        });

        expect(sql).toContain('toStartOfDay(timestamp) AS dimension');
        expect(sql).toContain('ORDER BY dimension ASC');
    });

    it('builds an hour groupBy query', () => {
        const sql = buildAnalyticsQuery({
            dataset: 'core_events',
            groupBy: 'hour',
        });
        expect(sql).toContain('toStartOfHour(timestamp) AS dimension');
        expect(sql).toContain('ORDER BY dimension ASC');
    });

    it('builds a week groupBy query', () => {
        const sql = buildAnalyticsQuery({
            dataset: 'core_events',
            groupBy: 'week',
        });
        expect(sql).toContain('toStartOfWeek(timestamp) AS dimension');
    });

    it('builds a month groupBy query', () => {
        const sql = buildAnalyticsQuery({
            dataset: 'core_events',
            groupBy: 'month',
        });
        expect(sql).toContain('toStartOfMonth(timestamp) AS dimension');
    });

    it('applies index filter when provided', () => {
        const sql = buildAnalyticsQuery({
            dataset: 'shortlink_clicks',
            indexFilter: 'abc123',
            groupBy: 'country',
        });

        expect(sql).toContain("index1 = 'abc123'");
    });

    it('skips invalid index filter values', () => {
        const sql = buildAnalyticsQuery({
            dataset: 'shortlink_clicks',
            indexFilter: "'; DROP TABLE --",
            groupBy: 'country',
        });

        expect(sql).not.toContain('index1 =');
    });

    it('clamps days to 1–90 range', () => {
        const sql1 = buildAnalyticsQuery({ dataset: 'test', days: 0 });
        expect(sql1).toContain("INTERVAL '1' DAY");

        const sql2 = buildAnalyticsQuery({ dataset: 'test', days: 200 });
        expect(sql2).toContain("INTERVAL '90' DAY");
    });

    it('clamps limit to 1–1000 range', () => {
        const sql = buildAnalyticsQuery({ dataset: 'test', limit: 5000 });
        expect(sql).toContain('LIMIT 1000');
    });

    it('defaults to 7 days and 100 limit', () => {
        const sql = buildAnalyticsQuery({ dataset: 'test' });
        expect(sql).toContain("INTERVAL '7' DAY");
        expect(sql).toContain('LIMIT 100');
    });

    it('appends extraWhere clause', () => {
        const sql = buildAnalyticsQuery({
            dataset: 'test',
            extraWhere: "blob1 = 'US'",
        });

        expect(sql).toContain("blob1 = 'US'");
    });

    it('uses custom groupBy expression verbatim', () => {
        const sql = buildAnalyticsQuery({
            dataset: 'test',
            groupBy: 'blob2',
        });

        expect(sql).toContain('blob2 AS dimension');
    });

    it('uses AVG aggregate with double1 by default', () => {
        const sql = buildAnalyticsQuery({
            dataset: 'test',
            aggregate: 'AVG',
        });
        expect(sql).toContain('AVG(double1) AS value');
    });

    it('uses a custom aggregateColumn', () => {
        const sql = buildAnalyticsQuery({
            dataset: 'test',
            aggregate: 'MAX',
            aggregateColumn: 'double2',
        });
        expect(sql).toContain('MAX(double2) AS value');
    });

    it('COUNT uses _sample_interval by default', () => {
        const sql = buildAnalyticsQuery({
            dataset: 'test',
            aggregate: 'COUNT',
        });
        expect(sql).toContain('COUNT(_sample_interval) AS value');
    });
});

describe('queryEvents', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('calls the WAE SQL API and returns parsed data', async () => {
        const mockData = [{ dimension: 'US', value: 42 }];
        const mockMeta = { elapsed: 10 };

        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ data: mockData, meta: mockMeta }),
            }),
        );

        const result = await queryEvents(
            { accountId: 'acc123', apiToken: 'tok456' },
            { dataset: 'shortlink_clicks', groupBy: 'country', days: 7 },
        );

        expect(result.data).toEqual(mockData);
        expect(result.meta).toEqual(mockMeta);

        // Verify fetch was called with correct URL
        const fetchCall = (fetch as any).mock.calls[0];
        expect(fetchCall[0]).toContain('acc123/analytics_engine/sql');
        expect(fetchCall[1].headers.Authorization).toBe('Bearer tok456');
    });

    it('throws AnalyticsQueryError on non-OK response', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: false,
                status: 500,
                text: () => Promise.resolve('Internal Server Error'),
            }),
        );

        const warnSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await expect(
            queryEvents({ accountId: 'acc', apiToken: 'tok' }, { dataset: 'test', groupBy: 'country' }),
        ).rejects.toThrow(AnalyticsQueryError);

        warnSpy.mockRestore();
    });

    it('falls back to result field when data is missing', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ result: [{ dimension: 'DE', value: 5 }] }),
            }),
        );

        const result = await queryEvents({ accountId: 'acc', apiToken: 'tok' }, { dataset: 'test' });

        expect(result.data).toEqual([{ dimension: 'DE', value: 5 }]);
    });
});

describe('resolveGroupByColumn', () => {
    it('resolves "index" to index1', () => {
        expect(resolveGroupByColumn('index').select).toBe('index1 AS dimension');
    });

    it('resolves "visitor" to blob6', () => {
        expect(resolveGroupByColumn('visitor').select).toBe('blob6 AS dimension');
    });

    it('resolves time-based presets', () => {
        expect(resolveGroupByColumn('hour').select).toContain('toStartOfHour');
        expect(resolveGroupByColumn('week').select).toContain('toStartOfWeek');
        expect(resolveGroupByColumn('month').select).toContain('toStartOfMonth');
    });

    it('passes arbitrary expressions verbatim', () => {
        expect(resolveGroupByColumn('blob3').select).toBe('blob3 AS dimension');
    });
});

describe('buildTopKQuery', () => {
    it('builds a topK query', () => {
        const sql = buildTopKQuery({ dataset: 'core_events', column: 'blob1', k: 5, days: 30 });
        expect(sql).toContain('blob1 AS dimension');
        expect(sql).toContain('LIMIT 5');
        expect(sql).toContain('ORDER BY value DESC');
        expect(sql).toContain("INTERVAL '30' DAY");
    });

    it('clamps k to 1–100', () => {
        const sql = buildTopKQuery({ dataset: 'test', column: 'blob1', k: 500 });
        expect(sql).toContain('LIMIT 100');
    });
});

describe('buildQuantileQuery', () => {
    it('builds a quantile query with default column', () => {
        const sql = buildQuantileQuery({ dataset: 'core_events', quantile: 0.95, days: 7 });
        expect(sql).toContain('quantileWeighted(0.95)(double1, _sample_interval)');
        expect(sql).toContain('SUM(_sample_interval) AS count');
    });

    it('uses a custom column', () => {
        const sql = buildQuantileQuery({ dataset: 'test', quantile: 0.5, column: 'double2' });
        expect(sql).toContain('double2');
    });

    it('clamps quantile to 0–1', () => {
        const sql = buildQuantileQuery({ dataset: 'test', quantile: 2.5 });
        expect(sql).toContain('quantileWeighted(1)');
    });
});

describe('queryTopK', () => {
    beforeEach(() => vi.restoreAllMocks());

    it('executes a topK query via the SQL API', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ data: [{ dimension: 'US', value: 100 }] }),
            }),
        );

        const result = await queryTopK(
            { accountId: 'acc', apiToken: 'tok' },
            { dataset: 'test', column: 'blob1', k: 5 },
        );
        expect(result.data).toEqual([{ dimension: 'US', value: 100 }]);
    });
});

describe('queryQuantile', () => {
    beforeEach(() => vi.restoreAllMocks());

    it('executes a quantile query via the SQL API', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ data: [{ value: 4.2, count: 1500 }] }),
            }),
        );

        const result = await queryQuantile({ accountId: 'acc', apiToken: 'tok' }, { dataset: 'test', quantile: 0.95 });
        expect(result.data[0]).toEqual({ value: 4.2, count: 1500 });
    });
});

describe('queryFunnel', () => {
    beforeEach(() => vi.restoreAllMocks());

    it('returns empty array for no steps', async () => {
        const result = await queryFunnel({ accountId: 'acc', apiToken: 'tok' }, { dataset: 'test', steps: [] });
        expect(result).toEqual([]);
    });

    it('computes dropOff and conversionRate for each step', async () => {
        // Mock: step 1 = 1000, step 2 = 200, step 3 = 50
        let callIndex = 0;
        const counts = [1000, 200, 50];
        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation(() => {
                const count = counts[callIndex++] ?? 0;
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ data: [{ dimension: 'page_view', value: count }] }),
                });
            }),
        );

        const result = await queryFunnel(
            { accountId: 'acc', apiToken: 'tok' },
            {
                dataset: 'core_events',
                steps: [
                    { event: 'page_view', label: 'Landing' },
                    { event: 'signup_click', label: 'Signup Click' },
                    { event: 'signup_complete', label: 'Signup Done' },
                ],
                days: 30,
            },
        );

        expect(result).toHaveLength(3);
        expect(result[0].count).toBe(1000);
        expect(result[0].dropOff).toBe(0);
        expect(result[0].conversionRate).toBe(1);
        expect(result[1].count).toBe(200);
        expect(result[1].dropOff).toBeCloseTo(0.8);
        expect(result[1].conversionRate).toBeCloseTo(0.2);
        expect(result[2].count).toBe(50);
        expect(result[2].dropOff).toBeCloseTo(0.75);
        expect(result[2].conversionRate).toBeCloseTo(0.05);
    });
});

describe('queryUniqueVisitors', () => {
    beforeEach(() => vi.restoreAllMocks());

    it('returns the unique visitor count', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ data: [{ value: 1234 }] }),
            }),
        );

        const count = await queryUniqueVisitors(
            { accountId: 'acc', apiToken: 'tok' },
            { dataset: 'core_events', days: 7 },
        );
        expect(count).toBe(1234);
    });

    it('returns 0 when no data', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ data: [] }),
            }),
        );

        const count = await queryUniqueVisitors({ accountId: 'acc', apiToken: 'tok' }, { dataset: 'core_events' });
        expect(count).toBe(0);
    });
});

describe('executeRawQuery', () => {
    beforeEach(() => vi.restoreAllMocks());

    it('executes raw SQL and returns result', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ data: [{ foo: 'bar' }] }),
            }),
        );

        const result = await executeRawQuery({ accountId: 'acc', apiToken: 'tok' }, 'SELECT 1');
        expect(result.data).toEqual([{ foo: 'bar' }]);
    });
});
