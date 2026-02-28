/**
 * Blog Studio Context
 *
 * Tracks when blog themes/plugins (studio state) have been loaded and applied
 * so that BlogRenderer can re-mount and use the correct theme/plugins.
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { initBlogSystem } from './init';

interface BlogStudioContextValue {
    isReady: boolean;
    refresh: () => Promise<void>;
}

const BlogStudioContext = createContext<BlogStudioContextValue>({
    isReady: false,
    refresh: async () => {},
});

export function BlogStudioProvider({ children }: { children: React.ReactNode }) {
    const [isReady, setIsReady] = useState(false);

    const refresh = useCallback(async () => {
        setIsReady(false);
        await initBlogSystem();
        setIsReady(true);
    }, []);

    useEffect(() => {
        let cancelled = false;
        initBlogSystem().then(() => {
            if (!cancelled) setIsReady(true);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    return <BlogStudioContext.Provider value={{ isReady, refresh }}>{children}</BlogStudioContext.Provider>;
}

export function useBlogStudio() {
    return useContext(BlogStudioContext);
}
