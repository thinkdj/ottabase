import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { AlertTriangle, Check, Rocket, X } from 'lucide-react';
import {
    Timeline,
    TimelineDescription,
    TimelineHeader,
    TimelineItem,
    TimelineTime,
    TimelineTitle,
} from '../components/ui/timeline';

const meta: Meta<typeof Timeline> = {
    title: 'Timeline',
    component: Timeline,
    parameters: { layout: 'centered' },
    decorators: [
        (Story) => (
            <div className="w-[420px] rounded-lg border bg-card p-5 shadow-xs">
                <Story />
            </div>
        ),
    ],
    tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof Timeline>;

/** The bus, newest first: routine events stay neutral, only what needs someone earns a tone. */
export const Events: Story = {
    render: () => (
        <Timeline aria-label="Recent events">
            <TimelineItem tone="red">
                <TimelineHeader>
                    <TimelineTitle className="font-mono text-[12.5px]">job.failed</TimelineTitle>
                    <TimelineTime dateTime="2026-10-24T09:41:00Z">09:41 UTC</TimelineTime>
                </TimelineHeader>
                <TimelineDescription>email.send failed 3 times and moved to the dead-letter queue</TimelineDescription>
            </TimelineItem>
            <TimelineItem tone="amber">
                <TimelineHeader>
                    <TimelineTitle className="font-mono text-[12.5px]">license.grace</TimelineTitle>
                    <TimelineTime dateTime="2026-10-24T06:00:00Z">06:00 UTC</TimelineTime>
                </TimelineHeader>
                <TimelineDescription>Tower pro is in its 14-day grace period</TimelineDescription>
            </TimelineItem>
            <TimelineItem>
                <TimelineHeader>
                    <TimelineTitle className="font-mono text-[12.5px]">backup.created</TimelineTitle>
                    <TimelineTime dateTime="2026-10-24T02:23:00Z">02:23 UTC</TimelineTime>
                </TimelineHeader>
                <TimelineDescription>31 tables, 9.1 MB to OBCF_R2</TimelineDescription>
            </TimelineItem>
            <TimelineItem>
                <TimelineHeader>
                    <TimelineTitle className="font-mono text-[12.5px]">cron.ran</TimelineTitle>
                    <TimelineTime dateTime="2026-10-24T02:00:00Z">02:00 UTC</TimelineTime>
                </TimelineHeader>
                <TimelineDescription>digest.weekly in 1.2s</TimelineDescription>
            </TimelineItem>
        </Timeline>
    ),
};

/** Icon discs and dots share one rail: the marker column takes the widest marker. */
export const WithIcons: Story = {
    render: () => (
        <Timeline aria-label="Release">
            <TimelineItem tone="green" icon={Rocket}>
                <TimelineHeader>
                    <TimelineTitle>Released 1.4.2</TimelineTitle>
                    <TimelineTime dateTime="2026-10-24">24 Oct</TimelineTime>
                </TimelineHeader>
                <TimelineDescription>otta-web, otta-worker and 12 packages</TimelineDescription>
            </TimelineItem>
            <TimelineItem icon={Check}>
                <TimelineHeader>
                    <TimelineTitle>Checks passed</TimelineTitle>
                    <TimelineTime dateTime="2026-10-23">23 Oct</TimelineTime>
                </TimelineHeader>
                <TimelineDescription>lint, type-check, test and build</TimelineDescription>
            </TimelineItem>
            <TimelineItem tone="red" icon={X}>
                <TimelineHeader>
                    <TimelineTitle>Preview deploy failed</TimelineTitle>
                    <TimelineTime dateTime="2026-10-22">22 Oct</TimelineTime>
                </TimelineHeader>
                <TimelineDescription>D1 migration 0042 timed out; retried and passed</TimelineDescription>
            </TimelineItem>
            <TimelineItem>
                <TimelineHeader>
                    <TimelineTitle>Branch opened</TimelineTitle>
                    <TimelineTime dateTime="2026-10-21">21 Oct</TimelineTime>
                </TimelineHeader>
            </TimelineItem>
            <TimelineItem tone="amber" icon={AlertTriangle}>
                <TimelineHeader>
                    <TimelineTitle>Scope changed</TimelineTitle>
                    <TimelineTime dateTime="2026-10-20">20 Oct</TimelineTime>
                </TimelineHeader>
                <TimelineDescription>
                    A long description wraps under the title and keeps the rail straight beside it, however many lines
                    it takes.
                </TimelineDescription>
            </TimelineItem>
        </Timeline>
    ),
};
