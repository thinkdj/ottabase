import React from 'react';
import type { Preview } from '@storybook/react-webpack5';
import '@ottabase/ui-tailwind/styles/tailwind.base.css';
import '../app/globals.css';

import { ProviderUIBase } from '@ottabase/ui-base';
import { ProviderUIMantine } from '@ottabase/ui-mantine';
import { ProviderState } from '@ottabase/state';
import { ProviderCodeHighlight } from '@ottabase/ui-code-highlight';
import {
    ProviderFont,
    ProviderNextThemes,
    primaryFontFamily,
    headingFontFamily,
    monospaceFontFamily,
} from '../ottabase/providers';
import { appConfig, THEME_COLORS } from '../ottabase/config/app.config';

const preview: Preview = {
    parameters: {
        layout: 'centered',
        backgrounds: {
            options: {
                light: { name: 'light', value: '#ffffff' },
                dark: { name: 'dark', value: '#111827' },
            },
        },
    },

    decorators: [
        (Story: any) => (
            <ProviderState>
                <ProviderUIBase
                    fontFamilies={{
                        primary: primaryFontFamily.style.fontFamily,
                        heading: headingFontFamily.style.fontFamily,
                        monospace: monospaceFontFamily.style.fontFamily,
                    }}
                >
                    <ProviderFont enforceGoogleFonts={appConfig.ui.enforceGoogleFonts}>
                        <ProviderUIMantine
                            storagePrefix={appConfig.storage.prefix}
                            themeColors={THEME_COLORS}
                            primaryColor={appConfig.theme.colorDefault}
                        >
                            <ProviderNextThemes storagePrefix={appConfig.storage.prefix}>
                                <ProviderCodeHighlight>
                                    <Story />
                                </ProviderCodeHighlight>
                            </ProviderNextThemes>
                        </ProviderUIMantine>
                    </ProviderFont>
                </ProviderUIBase>
            </ProviderState>
        ),
    ],

    initialGlobals: {
        backgrounds: {
            value: 'light',
        },
    },
};

export default preview;
