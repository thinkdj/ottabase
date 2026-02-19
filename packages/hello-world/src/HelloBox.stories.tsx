import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { HelloBox } from './HelloBox';

const meta: Meta<typeof HelloBox> = {
    title: 'HelloBox',
    component: HelloBox,
    parameters: {
        layout: 'centered',
    },
    args: {
        name: 'World',
    },
    tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof HelloBox>;

export const Default: Story = {};

export const CustomName: Story = {
    args: {
        name: 'Ottabase',
    },
};

export const WithCustomStyle: Story = {
    args: {
        name: 'Storybook',
        style: {
            backgroundColor: '#0d1117',
            color: '#f0f6fc',
            borderColor: '#58a6ff',
        },
    },
};
