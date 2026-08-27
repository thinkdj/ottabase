import { useEffect, useRef } from 'react';
import { doAction, HOOKS } from '../hooks';
import type { BlogPostData } from './blog-renderer-types';

interface LifecyclePayload {
    post: BlogPostData;
    props: unknown;
}

/**
 * Run one ordered plugin lifecycle for an asynchronously prepared render generation.
 *
 * React runs an old effect's cleanup before opening the replacement effect. Appending both sides
 * to one promise queue preserves that ordering even when an action itself is asynchronous:
 * render.before -> content.before -> content.after -> render.after, then the next generation.
 */
export function usePostRenderLifecycle(options: {
    enabled: boolean;
    revision: unknown;
    payload: LifecyclePayload;
    includeContent?: boolean;
}): void {
    const { enabled, revision, payload, includeContent = false } = options;
    const payloadRef = useRef(payload);
    const queueRef = useRef<Promise<void>>(Promise.resolve());
    payloadRef.current = payload;

    useEffect(() => {
        if (!enabled) return;

        const opened = payloadRef.current;
        queueRef.current = queueRef.current.then(async () => {
            await doAction(HOOKS['post.render.before'], opened.post, opened.props);
            if (includeContent) {
                await doAction(HOOKS['post.content.before'], opened.post, opened.props);
            }
        });

        return () => {
            queueRef.current = queueRef.current.then(async () => {
                if (includeContent) {
                    await doAction(HOOKS['post.content.after'], opened.post, opened.props);
                }
                await doAction(HOOKS['post.render.after'], opened.post, opened.props);
            });
        };
    }, [enabled, includeContent, revision]);
}
