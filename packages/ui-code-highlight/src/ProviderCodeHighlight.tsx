'use client';

import '@mantine/code-highlight/styles.css';
/* IMPORTANT: Load both the light and dark themes here, switching is done via CSS overrides below */
import 'highlight.js/styles/atom-one-dark.min.css';
import 'highlight.js/styles/atom-one-light.min.css';

import React, { ReactNode, useEffect } from 'react';
import { CodeHighlightAdapterProvider, createHighlightJsAdapter } from '@mantine/code-highlight';
import hljs from 'highlight.js/lib/core';
import { useMantineColorScheme } from '@mantine/core';

// Import common languages
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml'; // for HTML
import css from 'highlight.js/lib/languages/css';
import scss from 'highlight.js/lib/languages/scss';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';
import sql from 'highlight.js/lib/languages/sql';
import python from 'highlight.js/lib/languages/python';
import markdown from 'highlight.js/lib/languages/markdown';
import plaintext from 'highlight.js/lib/languages/plaintext';

// Register languages
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('ts', typescript);
hljs.registerLanguage('tsx', typescript);
hljs.registerLanguage('jsx', typescript);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('css', css);
hljs.registerLanguage('scss', scss);
hljs.registerLanguage('json', json);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('shell', bash);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('python', python);
hljs.registerLanguage('py', python);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('md', markdown);
hljs.registerLanguage('plaintext', plaintext);
hljs.registerLanguage('text', plaintext);

// Create the adapter with the original function
const highlightJsAdapter = createHighlightJsAdapter(hljs);

interface ProviderCodeHighlightProps {
    children: ReactNode;
}

const ProviderCodeHighlight = ({ children }: ProviderCodeHighlightProps) => {
    // Safely get color scheme, fallback to 'light' if Mantine context is not available
    let colorScheme = 'light';
    try {
        const mantineColorScheme = useMantineColorScheme();
        colorScheme = mantineColorScheme.colorScheme;
    } catch (error) {
        // Fallback to detecting from document class or default to light
        if (typeof document !== 'undefined') {
            colorScheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
        }
    }

    useEffect(() => {
        // Add CSS to control which theme is active
        const styleId = 'hljs-theme-controller';
        let style = document.getElementById(styleId) as HTMLStyleElement;

        if (!style) {
            style = document.createElement('style');
            style.id = styleId;
            document.head.appendChild(style);
        }

        // CSS to control theme visibility based on color scheme
        const controllerCSS = `
			/* Base styles - hide both themes by default */
			.hljs {
				background: transparent !important;
			}
			.hljs.plaintext {
				font-family: 'JetBrains Mono', monospace !important;
			}
			h1 .hljs.plaintext,
			h2 .hljs.plaintext,
			h3 .hljs.plaintext,
			h4 .hljs.plaintext,
			h5 .hljs.plaintext,
			h6 .hljs.plaintext {
				font-size: inherit !important;
				font-weight: inherit !important;
			}
			/* Light theme styles */
			[data-mantine-color-scheme="light"] .hljs {
				background: #ffffff !important;
				color: #24292e !important;
			}
			[data-mantine-color-scheme="light"] .hljs-comment,
			[data-mantine-color-scheme="light"] .hljs-quote {
				color: #6a737d !important;
			}
			[data-mantine-color-scheme="light"] .hljs-keyword,
			[data-mantine-color-scheme="light"] .hljs-selector-tag,
			[data-mantine-color-scheme="light"] .hljs-literal,
			[data-mantine-color-scheme="light"] .hljs-type {
				color: #d73a49 !important;
			}
			[data-mantine-color-scheme="light"] .hljs-string,
			[data-mantine-color-scheme="light"] .hljs-number {
				color: #032f62 !important;
			}
			/* Dark theme styles */
			[data-mantine-color-scheme="dark"] .hljs {
				background: #0d1117 !important;
				color: #e6edf3 !important;
			}
			[data-mantine-color-scheme="dark"] .hljs-comment,
			[data-mantine-color-scheme="dark"] .hljs-quote {
				color: #8b949e !important;
			}
			[data-mantine-color-scheme="dark"] .hljs-keyword,
			[data-mantine-color-scheme="dark"] .hljs-selector-tag,
			[data-mantine-color-scheme="dark"] .hljs-literal,
			[data-mantine-color-scheme="dark"] .hljs-type {
				color: #ff7b72 !important;
			}
			[data-mantine-color-scheme="dark"] .hljs-string,
			[data-mantine-color-scheme="dark"] .hljs-number {
				color: #a5d6ff !important;
			}
		`;

        style.textContent = controllerCSS;
        console.log(`Applied highlight.js theme: ${colorScheme === 'dark' ? 'github-dark' : 'github'}`);
    }, [colorScheme]);

    return <CodeHighlightAdapterProvider adapter={highlightJsAdapter}>{children}</CodeHighlightAdapterProvider>;
};

export default ProviderCodeHighlight;
