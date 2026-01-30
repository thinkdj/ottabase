import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { createAppConfig } from '@ottabase/config';
import Logo from './Logo';

const meta: Meta<typeof Logo> = {
    title: 'Logo',
    component: Logo,
    args: {
        darkModeSwitcher: true,
        size: 48,
        linkUrl: '',
    },
    parameters: {
        layout: 'centered',
    },
    tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof Logo>;

export const Default: Story = {
    args: {
        appName: 'Ottabase Storybook',
        logoUrl: '/logo.png',
    },
};

export const WithNavigation: Story = {
    args: {
        appName: 'Ottabase Storybook',
        logoUrl: '/logo.png',
        linkUrl: '/',
    },
};

export const LogoOnly: Story = {
    args: {
        appName: ' ',
        logoUrl: '/logo.png',
    },
};

export const FromAppConfig: Story = {
    args: {
        darkModeSwitcher: false,
        appConfig: createAppConfig({
            appName: 'Config Driven App',
            defaults: {
                meta: {
                    appName: 'Config Driven App',
                    logoUrl: '/logo.png',
                },
            },
        }),
    },
};
