'use client';

import type { Meta, StoryObj } from '@storybook/react-webpack5';
import DarkModeToggle from './DarkModeToggle';

const meta: Meta<typeof DarkModeToggle> = {
    title: 'DarkModeToggle',
    component: DarkModeToggle,
    args: {
        type: 'toggle-switch',
    },
    parameters: {
        layout: 'centered',
    },
    tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof DarkModeToggle>;

export const ToggleSwitch: Story = {};

export const IconButton: Story = {
    args: {
        type: 'button',
    },
};

export const IconButtonWithTitle: Story = {
    args: {
        type: 'button',
        title: 'Switch between light and dark',
    },
};
