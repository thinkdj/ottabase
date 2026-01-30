import type { Meta, StoryObj } from '@storybook/react-webpack5';
import MessageBox from './MessageBox';

const meta: Meta<typeof MessageBox> = {
    title: 'MessageBox',
    component: MessageBox,
    args: {
        message: "Here's something you should know.",
        messageType: 'info',
    },
    argTypes: {
        messageType: {
            options: ['info', 'error', 'warning', 'success', 'help', 'loginRequired', 'disconnected', 'loading'],
            control: { type: 'select' },
        },
        loadingType: {
            options: ['spinner', 'skeleton'],
            control: { type: 'inline-radio' },
        },
        width: {
            control: { type: 'text' },
            description: 'Width for skeleton variant - numeric values use px, strings use as-is',
        },
    },
    parameters: {
        layout: 'centered',
    },
    decorators: [
        (Story) => (
            <div className="w-full max-w-4xl min-h-64 flex justify-center">
                <Story />
            </div>
        ),
    ],
    tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof MessageBox>;

export const Info: Story = {};

export const Success: Story = {
    args: {
        message: 'All operations completed successfully.',
        messageType: 'success',
    },
};

export const Warning: Story = {
    args: {
        message: 'Heads up! Some configuration might need attention.',
        messageType: 'warning',
    },
};

export const ErrorState: Story = {
    render: (args) => (
        <MessageBox
            {...args}
            message={new Error("We couldn't fetch the latest dashboard metrics.")}
            messageType="error"
        />
    ),
};

export const Help: Story = {
    args: {
        messageType: 'help',
        message: {
            title: 'Need a hand?',
            body: 'Reach out to support@ottabase.dev or check the documentation.',
        },
    },
};

export const LoadingSpinner: Story = {
    args: {
        isLoading: true,
        loadingType: 'spinner',
    },
};

export const LoadingSkeleton: Story = {
    args: {
        isLoading: true,
        loadingType: 'skeleton',
    },
};

export const LoginRequired: Story = {
    args: {
        messageType: 'loginRequired',
        message: 'Please sign in to continue.',
    },
};

export const LoadingSkeletonWithNumericWidth: Story = {
    args: {
        isLoading: true,
        loadingType: 'skeleton',
        width: 300,
    },
};

export const LoadingSkeletonWithTailwindWidth: Story = {
    args: {
        isLoading: true,
        loadingType: 'skeleton',
        width: 'w-1/2',
    },
};

export const LoadingSkeletonWithPercentageWidth: Story = {
    args: {
        isLoading: true,
        loadingType: 'skeleton',
        width: '75%',
    },
};

export const LoadingSkeletonWithCustomWidth: Story = {
    args: {
        isLoading: true,
        loadingType: 'skeleton',
        width: '400px',
    },
};

export const SkeletonWidthShowcase: Story = {
    render: () => (
        <div className="w-full space-y-8">
            <div className="space-y-4">
                <h3 className="text-lg font-semibold">Fluid Width (Default)</h3>
                <div className="border border-dashed border-gray-300 p-4 w-full">
                    <MessageBox isLoading={true} loadingType="skeleton" />
                </div>
            </div>

            <div className="space-y-4">
                <h3 className="text-lg font-semibold">Fixed Pixel Width</h3>
                <div className="border border-dashed border-gray-300 p-4 w-full">
                    <MessageBox isLoading={true} loadingType="skeleton" width="320px" />
                </div>
            </div>

            <div className="space-y-4">
                <h3 className="text-lg font-semibold">Percentage Width</h3>
                <div className="border border-dashed border-gray-300 p-4 w-full">
                    <MessageBox isLoading={true} loadingType="skeleton" width="60%" />
                </div>
            </div>

            <div className="space-y-4">
                <h3 className="text-lg font-semibold">Tailwind Class Width</h3>
                <div className="border border-dashed border-gray-300 p-4 w-full">
                    <MessageBox isLoading={true} loadingType="skeleton" width="w-2/3" />
                </div>
            </div>

            <div className="space-y-4">
                <h3 className="text-lg font-semibold">Numeric Width (converts to px)</h3>
                <div className="border border-dashed border-gray-300 p-4 w-full">
                    <MessageBox isLoading={true} loadingType="skeleton" width={280} />
                </div>
            </div>
        </div>
    ),
    parameters: {
        layout: 'padded',
    },
};
