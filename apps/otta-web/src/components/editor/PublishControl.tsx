/**
 * PublishControl: one place to decide who sees a post and when, shared by the
 * blog, blurb, photo journal and translation editors.
 *
 * It edits the same `status` + `publishAt` (a datetime-local string) the
 * editors already keep, and always says in plain words what saving will do,
 * in the viewer's own time zone. PublishActions is the matching header pair:
 * a save button named after the choice, plus "Publish now" for drafts.
 */

import { POST_STATUSES, type PostStatus } from '@ottabase/ottablog';
import { Button, Input } from '@ottabase/ui-shadcn';
import { fromDateTimeLocalInput, toDateTimeLocalInput } from '@ottabase/utils/timezone';
import { Archive, CalendarClock, Loader2, Save, Send } from 'lucide-react';
import { useId } from 'react';

const ORDER: PostStatus[] = ['draft', 'published', 'scheduled', 'archived'];
const MINUTE = 60_000;

/** "Sat, 10 Oct, 09:00 BST" (the year only when it isn't this year) */
export function formatPublishTime(ms: number): string {
    const sameYear = new Date(ms).getFullYear() === new Date().getFullYear();
    return new Date(ms).toLocaleString(undefined, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        ...(sameYear ? {} : { year: 'numeric' }),
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
    });
}

/** "in 20 minutes", "in 5 hours", "tomorrow", "in 6 days" */
function fromNow(ms: number, now: number): string {
    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
    const minutes = Math.round((ms - now) / MINUTE);
    if (minutes < 60) return rtf.format(minutes, 'minute');
    const hours = Math.round(minutes / 60);
    if (hours < 36) return rtf.format(hours, 'hour');
    return rtf.format(Math.round(hours / 24), 'day');
}

/** What saving with this choice will do, in one sentence */
export function describePublish(
    status: PostStatus,
    opts: { publishAt?: string; savedStatus?: PostStatus; publishedAt?: number | null; now?: number } = {},
): string {
    const { savedStatus, publishedAt, now = Date.now() } = opts;
    switch (status) {
        case 'draft':
            return savedStatus === 'published'
                ? 'Saving takes it offline. Only editors will see it.'
                : 'Only editors can see it.';
        case 'published':
            if (savedStatus !== 'published') return 'Goes live as soon as you save.';
            return publishedAt ? `Live since ${formatPublishTime(publishedAt)}.` : 'Live now.';
        case 'scheduled': {
            const at = fromDateTimeLocalInput(opts.publishAt);
            if (at === null) return 'Pick when it goes live.';
            if (at <= now)
                return `That time has passed, so it goes live within a minute, dated ${formatPublishTime(at)}.`;
            return `Goes live ${formatPublishTime(at)} (${fromNow(at, now)}).`;
        }
        case 'archived':
            return 'Hidden from lists. The direct link still works.';
    }
}

/** Label for the save button, named after what it will do */
export function getSaveLabel(status: PostStatus, savedStatus?: PostStatus): string {
    if (status === savedStatus) return status === 'draft' ? 'Save draft' : 'Save changes';
    switch (status) {
        case 'draft':
            return savedStatus === 'published' ? 'Unpublish' : 'Save draft';
        case 'published':
            return 'Publish';
        case 'scheduled':
            return 'Schedule';
        case 'archived':
            return 'Archive';
    }
}

/** Tomorrow at 09:00 local: a sensible first guess when someone picks Schedule */
function defaultScheduleTime(): string {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return toDateTimeLocalInput(d);
}

export interface PublishControlProps {
    status: PostStatus;
    onStatusChange: (status: PostStatus) => void;
    /** datetime-local value (browser wall time) */
    publishAt: string;
    onPublishAtChange: (value: string) => void;
    /** Status as last saved, to tell "goes live" from "already live" */
    savedStatus?: PostStatus;
    /** When it went live (ms), for "Live since" */
    publishedAt?: number | null;
    disabled?: boolean;
    label?: string;
    /** Extra context under the result line (e.g. a translation waiting on its original) */
    note?: string;
}

export function PublishControl({
    status,
    onStatusChange,
    publishAt,
    onPublishAtChange,
    savedStatus,
    publishedAt,
    disabled,
    label = 'Visibility',
    note,
}: PublishControlProps) {
    const id = useId();

    const choose = (next: PostStatus) => {
        if (next === 'scheduled' && !publishAt) onPublishAtChange(defaultScheduleTime());
        onStatusChange(next);
    };

    return (
        <fieldset className="space-y-3" disabled={disabled}>
            <legend className="mb-2 text-sm font-medium">{label}</legend>
            <div className="grid grid-cols-2 gap-2">
                {ORDER.map((value) => {
                    const checked = status === value;
                    return (
                        <label
                            key={value}
                            className={`flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm ring-1 transition-colors focus-within:ring-2 focus-within:ring-ring ${
                                checked
                                    ? 'bg-background font-medium ring-primary'
                                    : 'text-muted-foreground ring-border hover:text-foreground'
                            }`}
                        >
                            <input
                                type="radio"
                                name={`${id}-status`}
                                value={value}
                                checked={checked}
                                onChange={() => choose(value)}
                                className="h-3.5 w-3.5 accent-primary"
                            />
                            {POST_STATUSES[value].label}
                        </label>
                    );
                })}
            </div>

            {status === 'scheduled' && (
                <Input
                    type="datetime-local"
                    aria-label="Goes live at"
                    value={publishAt}
                    onChange={(e) => onPublishAtChange(e.target.value)}
                />
            )}

            <p id={`${id}-result`} aria-live="polite" className="text-xs text-muted-foreground">
                {describePublish(status, { publishAt, savedStatus, publishedAt })}
                {note ? ` ${note}` : null}
            </p>
        </fieldset>
    );
}

const ICONS: Record<PostStatus, typeof Save> = {
    draft: Save,
    published: Send,
    scheduled: CalendarClock,
    archived: Archive,
};

export interface PublishActionsProps {
    status: PostStatus;
    savedStatus?: PostStatus;
    isSaving: boolean;
    saveDisabled?: boolean;
    publishDisabled?: boolean;
    onSave: () => void;
    /** Shortcut shown while the choice is Draft */
    onPublishNow: () => void;
}

/** Header buttons: a save named after the choice, plus "Publish now" while it's a draft */
export function PublishActions({
    status,
    savedStatus,
    isSaving,
    saveDisabled,
    publishDisabled,
    onSave,
    onPublishNow,
}: PublishActionsProps) {
    const isDraft = status === 'draft';
    const label = getSaveLabel(status, savedStatus);
    const Icon = status === savedStatus ? Save : ICONS[status];
    const spinner = <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />;
    return (
        <>
            <Button variant={isDraft ? 'outline' : 'default'} onClick={onSave} disabled={isSaving || saveDisabled}>
                {isSaving ? spinner : <Icon className="mr-2 h-4 w-4" aria-hidden="true" />}
                {isSaving ? 'Saving…' : label}
            </Button>
            {isDraft && (
                <Button onClick={onPublishNow} disabled={isSaving || publishDisabled}>
                    {isSaving ? spinner : <Send className="mr-2 h-4 w-4" aria-hidden="true" />}
                    Publish now
                </Button>
            )}
        </>
    );
}
