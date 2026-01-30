import type { Meta, StoryObj } from '@storybook/react';
import HistoryGoBackButton from './HistoryGoBackButton';

const meta: Meta<typeof HistoryGoBackButton> = {
    title: 'HistoryGoBackButton',
    component: HistoryGoBackButton,
    parameters: {
        layout: 'centered',
    },
    decorators: [
        (Story) => (
            <div className="p-4">
                <Story />
            </div>
        ),
    ],
    tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof HistoryGoBackButton>;

export const Default: Story = {};
