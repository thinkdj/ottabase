/**
 * @ottabase/ottablog - Post Content Plugin
 *
 * Example plugin that injects content at the beginning, end, or random position
 */

import React from 'react';
import type { Plugin } from './types';
import { HOOKS } from '../hooks';
import type { BlogPostData } from '../components/BlogRenderer';
import type { EditorJSData } from '../types';

export interface PostContentPluginOptions {
    /** Content to inject */
    content?: React.ReactNode | string;
    /** Position: 'beginning', 'end', or 'random' */
    position?: 'beginning' | 'end' | 'random';
    /** Only inject for specific content types */
    contentTypes?: string[];
    /** Only inject for specific post IDs */
    postIds?: string[];
    /** Priority for the hook */
    priority?: number;
    /** Enable/disable the plugin */
    enabled?: boolean;
}

/**
 * Post Content Plugin - Injects content into posts
 */
export function createPostContentPlugin(options: PostContentPluginOptions = {}): Plugin {
    const {
        content = null,
        position = 'end',
        contentTypes = [],
        postIds = [],
        priority = 10,
        enabled = true,
    } = options;

    const shouldInject = (post: BlogPostData): boolean => {
        if (!enabled) return false;

        // Check content type filter
        if (contentTypes.length > 0 && post.contentType) {
            if (!contentTypes.includes(post.contentType)) {
                return false;
            }
        }

        // Check post ID filter
        if (postIds.length > 0) {
            if (!postIds.includes(post.id)) {
                return false;
            }
        }

        return true;
    };

    const injectContent = (postContent: EditorJSData | null, post: BlogPostData): EditorJSData => {
        if (!content || !shouldInject(post)) {
            return postContent || { blocks: [] };
        }

        // Convert content to EditorJS block format
        const contentText = typeof content === 'string' ? content : String(content);

        // Create a paragraph block with HTML content (EditorJS supports HTML in paragraph text)
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
        } else if (position === 'random' && blocks.length > 0) {
            const randomIndex = Math.floor(Math.random() * blocks.length);
            return {
                ...baseContent,
                blocks: [...blocks.slice(0, randomIndex), contentBlock, ...blocks.slice(randomIndex)],
            };
        }

        return baseContent;
    };

    return {
        metadata: {
            id: 'post-content-plugin',
            name: 'Post Content Plugin',
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
            postIds,
            priority,
            enabled,
        },
    };
}

/**
 * Plugin configuration interface for admin UI
 */
export interface PostContentPluginConfig {
    content: string;
    position: 'beginning' | 'end' | 'random';
    contentTypes: string[];
    postIds: string[];
    priority: number;
    enabled: boolean;
}

/**
 * Update plugin configuration
 */
export function updatePostContentPluginConfig(plugin: Plugin, config: Partial<PostContentPluginConfig>): Plugin {
    const currentOptions = (plugin as any).options || {};
    const newOptions = { ...currentOptions, ...config };
    return createPostContentPlugin(newOptions);
}

/**
 * Pre-configured plugin instances
 */
export const postContentPlugin = {
    /**
     * Inject content at the beginning of posts
     */
    beginning: (content: React.ReactNode | string, options?: Omit<PostContentPluginOptions, 'position' | 'content'>) =>
        createPostContentPlugin({ ...options, content, position: 'beginning' }),

    /**
     * Inject content at the end of posts
     */
    end: (content: React.ReactNode | string, options?: Omit<PostContentPluginOptions, 'position' | 'content'>) =>
        createPostContentPlugin({ ...options, content, position: 'end' }),

    /**
     * Inject content at a random position in posts
     */
    random: (content: React.ReactNode | string, options?: Omit<PostContentPluginOptions, 'position' | 'content'>) =>
        createPostContentPlugin({ ...options, content, position: 'random' }),
};
