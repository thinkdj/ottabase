/**
 * The audit timeline's data side: the URL state, the API query it maps to, day grouping and the
 * one-line summary of a row.
 */
import type { PaginatedResponse } from '@/lib/api-types';
import type { AuditLogRecord } from '@/types/rbac';
import { toCsv } from '@ottabase/utils/browser';

export type AuditStatus = AuditLogRecord['status'];

/** The view, as it lives in the URL */
export interface AuditSearch {
    q?: string;
    action?: string;
    type?: string;
    status?: AuditStatus;
    user?: string;
    org?: string;
    page?: number;
}

export interface AuditFacet {
    value: string;
    count: number;
}

export interface AuditLogsResponse extends PaginatedResponse<AuditLogRecord> {
    /** What exists in the caller's scope, for the filters */
    facets: { actions: AuditFacet[]; resourceTypes: AuditFacet[] };
}

export interface DayGroup {
    key: string;
    label: string;
    logs: AuditLogRecord[];
}

const STATUSES = new Set<string>(['success', 'failure', 'error']);
const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value : undefined);

/** Cleans the URL state: blanks drop out, page only past the first */
export function auditSearch(s: Record<string, unknown>): AuditSearch {
    const out: AuditSearch = {};
    for (const key of ['q', 'action', 'type', 'user', 'org'] as const) {
        const value = text(s[key]);
        if (value) out[key] = value;
    }
    if (typeof s.status === 'string' && STATUSES.has(s.status)) out.status = s.status as AuditStatus;
    const page = Number(s.page);
    if (Number.isInteger(page) && page > 1) out.page = page;
    return out;
}

const PARAM: Record<Exclude<keyof AuditSearch, 'page'>, string> = {
    q: 'search',
    action: 'action',
    type: 'entityType',
    status: 'status',
    user: 'userId',
    org: 'organizationId',
};

/** The API query for a view; the export walks it page by page */
export function auditQuery(search: AuditSearch, page: number, perPage: number): string {
    const params = new URLSearchParams({ page: String(page), per_page: String(perPage) });
    for (const key of Object.keys(PARAM) as Array<keyof typeof PARAM>) {
        if (search[key]) params.set(PARAM[key], search[key]!);
    }
    return params.toString();
}

export const shortId = (id: string) => (id.length > 12 ? `${id.slice(0, 8)}…` : id);
export const humanizeAction = (action: string) => action.replace(/[._-]+/g, ' ');
export const isDestructive = (action: string) => /delete|remove|revoke|security|violation/.test(action);

export function parseJson(raw: string | null | undefined): Record<string, unknown> | null {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

const TELLING = ['violationType', 'method', 'reason', 'error', 'url', 'kitId', 'logoType'];

/** One line for the row: the error, else the two most telling metadata fields */
export function summarize(log: AuditLogRecord): string {
    if (log.error_message) return log.error_message;
    const meta = parseJson(log.metadata);
    if (!meta) return '';
    const present = (key: string) => meta[key] != null;
    const keys = [...TELLING.filter(present), ...Object.keys(meta).filter((k) => !TELLING.includes(k) && present(k))];
    return keys
        .slice(0, 2)
        .map((key) => {
            const value = meta[key];
            const shown = typeof value === 'string' ? value : JSON.stringify(value);
            return `${key}: ${shown.length > 40 ? `${shown.slice(0, 40)}…` : shown}`;
        })
        .join(', ');
}

export const clock = (ms: number) =>
    new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
export const fullDate = (ms: number) =>
    new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'medium' });

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** Rows by local day in the order they arrive, with Today and Yesterday named */
export function dayGroups(logs: AuditLogRecord[], now = new Date()): DayGroup[] {
    const today = dayKey(now);
    const yesterday = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
    const groups: DayGroup[] = [];
    for (const log of logs) {
        const date = new Date(log.created_at);
        const key = dayKey(date);
        let group = groups[groups.length - 1];
        if (!group || group.key !== key) {
            const label =
                key === today
                    ? 'Today'
                    : key === yesterday
                      ? 'Yesterday'
                      : date.toLocaleDateString(undefined, {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                            year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
                        });
            group = { key, label, logs: [] };
            groups.push(group);
        }
        group.logs.push(log);
    }
    return groups;
}

export function auditCsv(rows: AuditLogRecord[]): string {
    return toCsv(
        [
            'time',
            'status',
            'action',
            'resource_type',
            'resource_id',
            'user_email',
            'user_id',
            'organization_id',
            'ip_address',
            'error_message',
        ],
        rows.map((l) => [
            new Date(l.created_at).toISOString(),
            l.status,
            l.action,
            l.resource_type,
            l.resource_id,
            l.user_email,
            l.user_id,
            l.organization_id,
            l.ip_address,
            l.error_message,
        ]),
    );
}
