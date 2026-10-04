import type { PostStatus } from '@ottabase/ottablog';
import { toDateTimeLocalInput } from '@ottabase/utils/timezone';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { describePublish, getSaveLabel, PublishActions, PublishControl } from '../PublishControl';

const NOW = new Date(2026, 9, 4, 12, 0).getTime();
const HOUR = 3_600_000;

describe('describePublish', () => {
    it('says what saving will do for each choice', () => {
        expect(describePublish('draft')).toBe('Only editors can see it.');
        expect(describePublish('draft', { savedStatus: 'published' })).toMatch(/takes it offline/);
        expect(describePublish('published')).toBe('Goes live as soon as you save.');
        expect(describePublish('published', { savedStatus: 'published', publishedAt: NOW })).toMatch(/^Live since /);
        expect(describePublish('archived')).toMatch(/link still works/);
    });

    it('describes a schedule relative to now, and a past time honestly', () => {
        expect(describePublish('scheduled', { publishAt: '', now: NOW })).toBe('Pick when it goes live.');
        const future = toDateTimeLocalInput(NOW + 5 * HOUR);
        expect(describePublish('scheduled', { publishAt: future, now: NOW })).toMatch(/^Goes live .*\(in 5 hours\)\.$/);
        const past = toDateTimeLocalInput(NOW - HOUR);
        expect(describePublish('scheduled', { publishAt: past, now: NOW })).toMatch(/goes live within a minute/);
    });
});

describe('getSaveLabel', () => {
    it.each<[PostStatus, PostStatus | undefined, string]>([
        ['draft', undefined, 'Save draft'],
        ['draft', 'draft', 'Save draft'],
        ['draft', 'published', 'Unpublish'],
        ['published', 'draft', 'Publish'],
        ['published', 'published', 'Save changes'],
        ['scheduled', 'draft', 'Schedule'],
        ['archived', 'published', 'Archive'],
    ])('%s (saved as %s) → %s', (status, saved, label) => {
        expect(getSaveLabel(status, saved)).toBe(label);
    });
});

function Harness() {
    const [status, setStatus] = useState<PostStatus>('draft');
    const [publishAt, setPublishAt] = useState('');
    return (
        <PublishControl
            status={status}
            onStatusChange={setStatus}
            publishAt={publishAt}
            onPublishAtChange={setPublishAt}
        />
    );
}

describe('PublishControl', () => {
    it('offers a first guess of tomorrow 09:00 when Schedule is picked', () => {
        render(<Harness />);
        expect(screen.queryByLabelText('Goes live at')).toBeNull();

        fireEvent.click(screen.getByRole('radio', { name: 'Scheduled' }));

        const input = screen.getByLabelText('Goes live at') as HTMLInputElement;
        expect(input.value).toMatch(/T09:00$/);
        expect(screen.getByText(/^Goes live /)).toBeTruthy();
    });
});

describe('PublishActions', () => {
    it('offers Publish now only while the choice is Draft', () => {
        const onPublishNow = vi.fn();
        const { rerender } = render(
            <PublishActions status="draft" isSaving={false} onSave={() => {}} onPublishNow={onPublishNow} />,
        );
        fireEvent.click(screen.getByRole('button', { name: 'Publish now' }));
        expect(onPublishNow).toHaveBeenCalled();

        rerender(
            <PublishActions
                status="scheduled"
                savedStatus="draft"
                isSaving={false}
                onSave={() => {}}
                onPublishNow={onPublishNow}
            />,
        );
        expect(screen.queryByRole('button', { name: 'Publish now' })).toBeNull();
        expect(screen.getByRole('button', { name: 'Schedule' })).toBeTruthy();
    });
});
