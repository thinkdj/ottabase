import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { Avatar, AvatarFallback, AvatarGroup } from '../components/ui/avatar';

const PEOPLE = ['DT', 'RK', 'AM', 'JS', 'LW', 'PN', 'OE'];

const people = (count = PEOPLE.length) =>
    PEOPLE.slice(0, count).map((initials) => (
        <Avatar key={initials}>
            <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
    ));

const meta: Meta<typeof AvatarGroup> = {
    title: 'AvatarGroup',
    component: AvatarGroup,
    args: { max: 4, size: 'default' },
    argTypes: { size: { options: ['sm', 'default', 'lg'], control: { type: 'inline-radio' } } },
    parameters: { layout: 'centered' },
    render: (args) => (
        <AvatarGroup aria-label="Members" {...args}>
            {people()}
        </AvatarGroup>
    ),
    tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof AvatarGroup>;

export const Default: Story = {};

/** Only the first few are loaded; `total` is the real headcount. */
export const WithTotal: Story = {
    render: () => (
        <AvatarGroup aria-label="Organization members" max={3} total={128}>
            {people(3)}
        </AvatarGroup>
    ),
};

export const Sizes: Story = {
    render: () => (
        <div className="flex flex-col items-start gap-4">
            {(['sm', 'default', 'lg'] as const).map((size) => (
                <AvatarGroup key={size} size={size} max={4} aria-label={`${size} members`}>
                    {people()}
                </AvatarGroup>
            ))}
        </div>
    ),
};

/** In a card row; the group's name comes from aria-label. */
export const InContext: Story = {
    render: () => (
        <div className="flex w-80 items-center justify-between rounded-lg border bg-card p-4 shadow-xs">
            <div>
                <div className="text-sm font-medium">Acme Inc.</div>
                <div className="text-xs text-muted-foreground">7 members · 2 pending</div>
            </div>
            <AvatarGroup aria-label="Acme Inc. members" size="sm" max={3}>
                {people()}
            </AvatarGroup>
        </div>
    ),
};
