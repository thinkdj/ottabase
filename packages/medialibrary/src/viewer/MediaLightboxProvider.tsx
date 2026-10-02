import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { MediaLightboxNavigationDirection, MediaLightboxOptions, MediaViewerItem } from '../types';
import { createMediaLightboxState, getAdjacentMediaIndex } from './lightbox-state';
import { MediaImmersiveLightbox } from './MediaImmersiveLightbox';
import { MediaLightbox } from './MediaLightbox';
import { useMediaLightboxUrlSync } from './useMediaLightboxUrlSync';

interface RegisteredMediaViewerItem extends MediaViewerItem {
    registryKey: string;
}

interface MediaLightboxContextValue {
    isEnabled: boolean;
    registerItem: (registryKey: string, item: MediaViewerItem) => void;
    unregisterItem: (registryKey: string) => void;
    openByKey: (registryKey: string) => void;
}

const MediaLightboxContext = createContext<MediaLightboxContextValue | null>(null);

export interface MediaLightboxProviderProps extends MediaLightboxOptions {
    children: ReactNode;
    /**
     * Sync the active item with the URL query string so gallery items are deep-linkable.
     * Pass true to enable with default key `mgi`, or provide a custom param name.
     */
    syncWithUrl?: boolean | { paramName?: string };
    /** Fired when the lightbox opens. */
    onOpen?: (item: MediaViewerItem, index: number) => void;
    /** Fired when active item changes while open. */
    onNavigate?: (item: MediaViewerItem, index: number, direction: MediaLightboxNavigationDirection) => void;
    /** Fired when the lightbox closes. */
    onClose?: () => void;
}

export function MediaLightboxProvider({
    children,
    loop = true,
    showMetadata = true,
    variant = 'default',
    zIndex = 100,
    syncWithUrl = false,
    onOpen,
    onNavigate,
    onClose,
}: MediaLightboxProviderProps) {
    const [items, setItems] = useState<RegisteredMediaViewerItem[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);

    const itemsRef = useRef(items);
    itemsRef.current = items;

    const isOpenRef = useRef(isOpen);
    useEffect(() => {
        isOpenRef.current = isOpen;
    }, [isOpen]);

    const activeRegistryKeyRef = useRef<string | null>(null);
    const pendingOpenKeyRef = useRef<string | null>(null);

    const onOpenRef = useRef(onOpen);
    const onNavigateRef = useRef(onNavigate);
    const onCloseRef = useRef(onClose);
    useEffect(() => {
        onOpenRef.current = onOpen;
        onNavigateRef.current = onNavigate;
        onCloseRef.current = onClose;
    }, [onClose, onNavigate, onOpen]);

    const registerItem = useCallback((registryKey: string, item: MediaViewerItem) => {
        setItems((currentItems) => {
            const nextItem: RegisteredMediaViewerItem = { ...item, registryKey };
            const existingIndex = currentItems.findIndex((currentItem) => currentItem.registryKey === registryKey);

            if (existingIndex === -1) {
                return [...currentItems, nextItem];
            }

            const existing = currentItems[existingIndex];
            if (
                existing.url === nextItem.url &&
                existing.title === nextItem.title &&
                existing.altText === nextItem.altText &&
                existing.caption === nextItem.caption &&
                existing.thumbnailUrl === nextItem.thumbnailUrl
            ) {
                return currentItems;
            }

            const nextItems = [...currentItems];
            nextItems[existingIndex] = nextItem;
            return nextItems;
        });
    }, []);

    const unregisterItem = useCallback((registryKey: string) => {
        setItems((currentItems) => currentItems.filter((item) => item.registryKey !== registryKey));
    }, []);

    const openAtIndex = useCallback((index: number, direction: MediaLightboxNavigationDirection = 'jump') => {
        const item = itemsRef.current[index];
        if (!item) {
            return;
        }

        const wasOpen = isOpenRef.current;
        if (!wasOpen) {
            setIsOpen(true);
            onOpenRef.current?.(item, index);
        }

        setActiveIndex((currentIndex) => {
            if (wasOpen && currentIndex !== index) {
                onNavigateRef.current?.(item, index, direction);
            }
            return index;
        });

        activeRegistryKeyRef.current = item.registryKey;
    }, []);

    const openByKey = useCallback(
        (registryKey: string) => {
            const nextIndex = itemsRef.current.findIndex((item) => item.registryKey === registryKey);
            if (nextIndex >= 0) {
                pendingOpenKeyRef.current = null;
                openAtIndex(nextIndex, 'jump');
                return;
            }

            // Item may not be registered yet (e.g., deep-link arrived before list mounted)
            pendingOpenKeyRef.current = registryKey;
        },
        [openAtIndex],
    );

    const close = useCallback(() => {
        setIsOpen((wasOpen) => {
            if (wasOpen) {
                onCloseRef.current?.();
            }
            return false;
        });
    }, []);

    const goPrevious = useCallback(() => {
        setActiveIndex((currentIndex) => {
            const nextIndex = getAdjacentMediaIndex(currentIndex, itemsRef.current.length, 'previous', { loop });
            if (nextIndex !== currentIndex) {
                const item = itemsRef.current[nextIndex];
                if (item) {
                    onNavigateRef.current?.(item, nextIndex, 'previous');
                    activeRegistryKeyRef.current = item.registryKey;
                }
            }
            return nextIndex;
        });
    }, [loop]);

    const goNext = useCallback(() => {
        setActiveIndex((currentIndex) => {
            const nextIndex = getAdjacentMediaIndex(currentIndex, itemsRef.current.length, 'next', { loop });
            if (nextIndex !== currentIndex) {
                const item = itemsRef.current[nextIndex];
                if (item) {
                    onNavigateRef.current?.(item, nextIndex, 'next');
                    activeRegistryKeyRef.current = item.registryKey;
                }
            }
            return nextIndex;
        });
    }, [loop]);

    const selectIndex = useCallback(
        (index: number) => {
            openAtIndex(index, 'jump');
        },
        [openAtIndex],
    );

    // If a deep-linked item was requested before registration, flush once available.
    useEffect(() => {
        const pendingKey = pendingOpenKeyRef.current;
        if (!pendingKey) {
            return;
        }

        const nextIndex = items.findIndex((item) => item.registryKey === pendingKey);
        if (nextIndex >= 0) {
            pendingOpenKeyRef.current = null;
            openAtIndex(nextIndex, 'jump');
        }
    }, [items, openAtIndex]);

    // Keep active index aligned if item order changes while open.
    useEffect(() => {
        if (!isOpen || !activeRegistryKeyRef.current) {
            return;
        }

        const nextIndex = items.findIndex((item) => item.registryKey === activeRegistryKeyRef.current);
        if (nextIndex >= 0 && nextIndex !== activeIndex) {
            setActiveIndex(nextIndex);
        }
    }, [activeIndex, isOpen, items]);

    useEffect(() => {
        activeRegistryKeyRef.current = items[activeIndex]?.registryKey ?? null;
    }, [activeIndex, items]);

    const urlSyncEnabled = Boolean(syncWithUrl);
    const urlParamName =
        typeof syncWithUrl === 'object' && syncWithUrl && syncWithUrl.paramName ? syncWithUrl.paramName : 'mgi';
    const activeRegistryKeyForUrl = isOpen ? (items[activeIndex]?.registryKey ?? null) : null;

    const handleUrlKeyChange = useCallback(
        (registryKey: string | null) => {
            if (!registryKey) {
                close();
                return;
            }
            openByKey(registryKey);
        },
        [close, openByKey],
    );

    useMediaLightboxUrlSync({
        enabled: urlSyncEnabled,
        paramName: urlParamName,
        activeRegistryKey: activeRegistryKeyForUrl,
        onUrlKeyChange: handleUrlKeyChange,
    });

    const lightboxState = useMemo(
        () => createMediaLightboxState(items, activeIndex, { loop }),
        [activeIndex, items, loop],
    );

    const contextValue = useMemo<MediaLightboxContextValue>(
        () => ({
            isEnabled: true,
            registerItem,
            unregisterItem,
            openByKey,
        }),
        [openByKey, registerItem, unregisterItem],
    );

    const LightboxComponent = variant === 'immersive' ? MediaImmersiveLightbox : MediaLightbox;

    return (
        <MediaLightboxContext.Provider value={contextValue}>
            {children}
            <LightboxComponent
                items={items}
                activeIndex={lightboxState.activeIndex}
                isOpen={isOpen}
                loop={loop}
                showMetadata={showMetadata}
                canGoPrevious={lightboxState.canGoPrevious}
                canGoNext={lightboxState.canGoNext}
                zIndex={zIndex}
                onClose={close}
                onPrevious={goPrevious}
                onNext={goNext}
                onSelectIndex={selectIndex}
            />
        </MediaLightboxContext.Provider>
    );
}

export function useMediaLightboxRegistration(registryKey: string, item: MediaViewerItem | null) {
    const context = useContext(MediaLightboxContext);
    const itemKey = item ? JSON.stringify(item) : null;

    useEffect(() => {
        if (!context || !item?.url) {
            return undefined;
        }

        context.registerItem(registryKey, item);
        return () => {
            context.unregisterItem(registryKey);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- itemKey captures all item field changes
    }, [context, itemKey, registryKey]);

    const open = useCallback(() => {
        context?.openByKey(registryKey);
    }, [context, registryKey]);

    return {
        open,
        isEnabled: Boolean(context?.isEnabled),
    };
}

export function useOptionalMediaLightbox() {
    return useContext(MediaLightboxContext);
}
