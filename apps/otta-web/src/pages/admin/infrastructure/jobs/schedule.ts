import { describeCron, getNextRun } from '@ottabase/cron';

/** The schedule in words, or null when it is not a valid five-field cron expression */
export function scheduleWords(expression: string): string | null {
    try {
        return describeCron(expression);
    } catch {
        return null;
    }
}

/** The next few times a schedule fires, in order */
export function nextRuns(expression: string, count = 3, after = new Date()): Date[] {
    const runs: Date[] = [];
    let cursor = after;
    for (let i = 0; i < count; i++) {
        try {
            cursor = getNextRun(expression, cursor);
        } catch {
            break;
        }
        runs.push(cursor);
    }
    return runs;
}

/** "2026-10-05 09:00 UTC" */
export function utcStamp(value: Date | string | number): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

/** Pretty JSON when it parses, the raw text when it does not */
export function formatJson(text: string): string {
    try {
        return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
        return text;
    }
}

const ms = (value: Date | string | number) => new Date(value).getTime();
export const toMs = ms;
