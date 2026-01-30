import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { fn } from 'storybook/test';
import BlogPagination from './BlogPagination';

const meta: Meta<typeof BlogPagination> = {
    title: 'BlogPagination',
    component: BlogPagination,
    args: {
        page: 3,
        lastPage: 12,
        perPage: 10,
        showNextPrev: true,
        showPageNumbers: true,
        onPageChange: fn(),
    },
    parameters: {
        layout: 'centered',
        viewport: {
            defaultViewport: 'responsive',
        },
    },
    decorators: [
        (Story) => (
            <div style={{ width: '600px', margin: '0 auto' }}>
                <Story />
            </div>
        ),
    ],
    tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof BlogPagination>;

export const Default: Story = {};

export const FirstPage: Story = {
    args: {
        page: 1,
    },
};

export const LastPage: Story = {
    args: {
        page: 12,
    },
};

export const WithoutNumberedButtons: Story = {
    args: {
        showPageNumbers: false,
    },
};

export const Loading: Story = {
    args: {
        isLoading: true,
    },
};
