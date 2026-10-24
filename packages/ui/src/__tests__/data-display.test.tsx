// Timeline, AvatarGroup and VisuallyHidden: markup, folding and the accessibility they carry.
import { render, screen } from '@testing-library/react';
import { Check } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { Avatar, AvatarFallback, AvatarGroup } from '../../components/ui/avatar';
import {
    Timeline,
    TimelineDescription,
    TimelineHeader,
    TimelineItem,
    TimelineTime,
    TimelineTitle,
} from '../../components/ui/timeline';
import { VisuallyHidden } from '../../components/ui/visually-hidden';

describe('<Timeline>', () => {
    it('is an ordered list of events with a machine-readable time', () => {
        render(
            <Timeline aria-label="Recent events">
                <TimelineItem tone="green" icon={Check}>
                    <TimelineHeader>
                        <TimelineTitle>deploy.succeeded</TimelineTitle>
                        <TimelineTime dateTime="2026-10-24T02:23:00Z">02:23 UTC</TimelineTime>
                    </TimelineHeader>
                    <TimelineDescription>otta-web 1.4.2 is live</TimelineDescription>
                </TimelineItem>
                <TimelineItem>
                    <TimelineTitle>backup.created</TimelineTitle>
                </TimelineItem>
            </Timeline>,
        );

        const list = screen.getByRole('list', { name: 'Recent events' });
        expect(list.tagName).toBe('OL');
        const [first, second] = screen.getAllByRole('listitem');
        expect(first).toHaveAttribute('data-tone', 'green');
        expect(second).not.toHaveAttribute('data-tone');
        expect(screen.getByText('02:23 UTC')).toHaveAttribute('dateTime', '2026-10-24T02:23:00Z');
        // The marker and rail are decoration: hidden from assistive tech
        expect(first.querySelector('[data-slot="timeline-marker"]')!.closest('[aria-hidden="true"]')).not.toBeNull();
        expect(first.querySelector('[data-slot="timeline-marker"] svg')).not.toBeNull();
        expect(second.querySelector('[data-slot="timeline-marker"] svg')).toBeNull();
    });
});

describe('<AvatarGroup>', () => {
    const people = ['AL', 'BO', 'CY', 'DE', 'EV'].map((initials) => (
        <Avatar key={initials}>
            <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
    ));

    it('shows every avatar when there is no max', () => {
        render(<AvatarGroup aria-label="Members">{people}</AvatarGroup>);
        expect(screen.getByRole('group', { name: 'Members' })).toBeInTheDocument();
        expect(screen.getAllByText(/^[A-Z]{2}$/)).toHaveLength(5);
        expect(screen.queryByText(/more$/)).toBeNull();
    });

    it('folds the rest into +N past max, and counts from total when given', () => {
        const { rerender } = render(<AvatarGroup max={3}>{people}</AvatarGroup>);
        expect(screen.getAllByText(/^[A-Z]{2}$/)).toHaveLength(3);
        expect(screen.getByText('+2')).toHaveAttribute('aria-hidden', 'true');
        expect(screen.getByText('2 more')).toHaveClass('sr-only');

        rerender(
            <AvatarGroup max={3} total={120}>
                {people}
            </AvatarGroup>,
        );
        expect(screen.getByText('99+')).toBeInTheDocument();
        expect(screen.getByText('117 more')).toBeInTheDocument();
    });
});

describe('<VisuallyHidden>', () => {
    it('keeps text for screen readers, as its own span or on a child', () => {
        render(
            <button type="button">
                <VisuallyHidden>Close dialog</VisuallyHidden>{' '}
                <VisuallyHidden asChild>
                    <strong>now</strong>
                </VisuallyHidden>
            </button>,
        );
        expect(screen.getByRole('button', { name: 'Close dialog now' })).toBeInTheDocument();
        expect(screen.getByText('Close dialog')).toHaveClass('sr-only');
        expect(screen.getByText('now').tagName).toBe('STRONG');
        expect(screen.getByText('now')).toHaveClass('sr-only');
    });
});
