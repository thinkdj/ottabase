/**
 * @ottabase/ottablog - Content Injector Plugin
 *
 * Injects content at the beginning, end, or random position.
 *
 * Security: Content is rendered as HTML inside EditorJS paragraph blocks. Only allow input from
 * trusted admins, or sanitize HTML (e.g. DOMPurify) before saving in the admin UI to prevent XSS.
 */

import React from 'react';
import type { Plugin } from './types';
import { HOOKS } from '../hooks';
import type { BlogPostData } from '../components/BlogRenderer';
import type { EditorJSData } from '../types';

export interface ContentInjectorPluginOptions {
    /** Content to inject */
    content?: React.ReactNode | string;
    /** Position: 'beginning', 'end', or 'random' */
    position?: 'beginning' | 'end' | 'random';
    /** Only inject for specific content types */
    contentTypes?: string[];
    /** Priority for the hook */
    priority?: number;
    /** Enable/disable the plugin */
    enabled?: boolean;
}

/**
 * Content Injector Plugin - Injects content into posts
 */
export function createContentInjectorPlugin(options: ContentInjectorPluginOptions = {}): Plugin {
    const { content = null, position = 'end', contentTypes = [], priority = 10, enabled = true } = options;

    const shouldInject = (post: BlogPostData): boolean => {
        if (!enabled) return false;

        // Check content type filter
        if (contentTypes.length > 0 && post.contentType) {
            if (!contentTypes.includes(post.contentType)) {
                return false;
            }
        }

        return true;
    };

    /** Deterministic hash from post id so "random" position is stable per post across re-renders */
    const hashPostId = (id: string): number => {
        let h = 0;
        for (let i = 0; i < id.length; i++) {
            h = (h << 5) - h + id.charCodeAt(i);
            h |= 0;
        }
        return Math.abs(h);
    };

    const injectContent = (postContent: EditorJSData | null, post: BlogPostData): EditorJSData => {
        if (!content || !shouldInject(post)) {
            return postContent || { blocks: [] };
        }

        // Convert content to EditorJS block format (no sanitization here; caller must use trusted or sanitized input)
        const contentText = typeof content === 'string' ? content : String(content);

        // Create a paragraph block (EditorJS supports HTML in paragraph text)
        const contentBlock = {
            type: 'paragraph',
            data: { text: contentText },
        };

        const blocks = postContent?.blocks || [];
        const baseContent = postContent || { blocks: [], time: Date.now(), version: '2.28.0' };

        if (position === 'beginning') {
            return {
                ...baseContent,
                blocks: [contentBlock, ...blocks],
            };
        } else if (position === 'end') {
            return {
                ...baseContent,
                blocks: [...blocks, contentBlock],
            };
        } else if (position === 'random') {
            // Random among all EditorJS blocks: inject at one of (before first, between blocks, after last).
            // Use deterministic hash from post.id so position is stable per post (no jump on re-render).
            const numSlots = blocks.length + 1; // 0 = before first, 1..length-1 = between, length = after last
            const slot = blocks.length === 0 ? 0 : hashPostId(post.id) % numSlots;
            return {
                ...baseContent,
                blocks: [...blocks.slice(0, slot), contentBlock, ...blocks.slice(slot)],
            };
        }

        return baseContent;
    };

    return {
        metadata: {
            id: 'content-injector-plugin',
            name: 'Content Injector Plugin',
            description: 'Injects custom content into blog posts at specified positions',
            version: '1.0.0',
            author: 'Ottabase',
        },
        hooks: {
            [HOOKS['post.content.filter']]: [
                {
                    callback: async (value: EditorJSData | null, post: BlogPostData) => {
                        return injectContent(value, post);
                    },
                    priority,
                },
            ],
        },
        // Store options for configuration UI
        options: {
            content,
            position,
            contentTypes,
            priority,
            enabled,
        },
    };
}

/**
 * Plugin configuration interface for admin UI
 */
export interface ContentInjectorPluginConfig {
    content: string;
    position: 'beginning' | 'end' | 'random';
    contentTypes: string[];
    priority: number;
    enabled: boolean;
}

/**
 * Update plugin configuration
 */
export function updateContentInjectorPluginConfig(
    plugin: Plugin,
    config: Partial<ContentInjectorPluginConfig>,
): Plugin {
    const currentOptions = (plugin as any).options || {};
    const newOptions = { ...currentOptions, ...config };
    return createContentInjectorPlugin(newOptions);
}

/**
 * Pre-configured plugin instances
 */
export const contentInjectorPlugin = {
    /**
     * Inject content at the beginning of posts
     */
    beginning: (
        content: React.ReactNode | string,
        options?: Omit<ContentInjectorPluginOptions, 'position' | 'content'>,
    ) => createContentInjectorPlugin({ ...options, content, position: 'beginning' }),

    /**
     * Inject content at the end of posts
     */
    end: (content: React.ReactNode | string, options?: Omit<ContentInjectorPluginOptions, 'position' | 'content'>) =>
        createContentInjectorPlugin({ ...options, content, position: 'end' }),

    /**
     * Inject content at a random position in posts
     */
    random: (content: React.ReactNode | string, options?: Omit<ContentInjectorPluginOptions, 'position' | 'content'>) =>
        createContentInjectorPlugin({ ...options, content, position: 'random' }),
};
