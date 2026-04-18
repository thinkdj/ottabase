import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { MediaLightboxOptions, MediaViewerItem } from '../types';
import { createMediaLightboxState, getAdjacentMediaIndex } from './lightbox-state';
import { MediaImmersiveLightbox } from './MediaImmersiveLightbox';
import { MediaLightbox } from './MediaLightbox';

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
}

export function MediaLightboxProvider({
    children,
    loop = true,
    showMetadata = true,
    variant = 'default',
}: MediaLightboxProviderProps) {
    const [items, setItems] = useState<RegisteredMediaViewerItem[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const activeRegistryKeyRef = useRef<string | null>(null);
    // Keep a ref to items so callbacks stay stable and don't trigger context identity changes
    const itemsRef = useRef(items);
    itemsRef.current = items;

    const registerItem = useCallback((registryKey: string, item: MediaViewerItem) => {
        setItems((currentItems) => {
            const nextItem: RegisteredMediaViewerItem = {
                ...item,
                registryKey,
            };
            const existingIndex = currentItems.findIndex((currentItem) => currentItem.registryKey === registryKey);

            if (existingIndex === -1) {
                return [...currentItems, nextItem];
            }

            // Skip update if nothing actually changed
            const existing = currentItems[existingIndex];
            if (
                existing.url === item.url &&
                existing.title === item.title &&
                existing.altText === item.altText &&
                existing.caption === item.caption &&
                existing.thumbnailUrl === item.thumbnailUrl
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

    const openByKey = useCallback((registryKey: string) => {
        activeRegistryKeyRef.current = registryKey;
        const nextIndex = itemsRef.current.findIndex((item) => item.registryKey === registryKey);
        if (nextIndex >= 0) {
            setActiveIndex(nextIndex);
            setIsOpen(true);
        }
    }, []);

    const openAt = useCallback((index: number) => {
        setActiveIndex(index);
        setIsOpen(true);
        activeRegistryKeyRef.current = itemsRef.current[index]?.registryKey ?? null;
    }, []);

    const close = useCallback(() => {
        setIsOpen(false);
    }, []);

    const goPrevious = useCallback(() => {
        setActiveIndex((currentIndex) =>
            getAdjacentMediaIndex(currentIndex, itemsRef.current.length, 'previous', { loop }),
        );
    }, [loop]);

    const goNext = useCallback(() => {
        setActiveIndex((currentIndex) =>
            getAdjacentMediaIndex(currentIndex, itemsRef.current.length, 'next', { loop }),
        );
    }, [loop]);

    // Sync activeIndex when items reorder (e.g. component mount order changes)
    useEffect(() => {
        if (!isOpen || !activeRegistryKeyRef.current) {
            return;
        }
        const nextIndex = items.findIndex((item) => item.registryKey === activeRegistryKeyRef.current);
        if (nextIndex >= 0 && nextIndex !== activeIndex) {
            setActiveIndex(nextIndex);
        }
        // Only re-run when items identity changes, not when activeIndex changes
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, items]);

    // Keep the registry key ref in sync with the active index
    useEffect(() => {
        activeRegistryKeyRef.current = items[activeIndex]?.registryKey ?? null;
    }, [activeIndex, items]);

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
                showMetadata={showMetadata}
                canGoPrevious={lightboxState.canGoPrevious}
                canGoNext={lightboxState.canGoNext}
                onClose={close}
                onPrevious={goPrevious}
                onNext={goNext}
                onSelectIndex={openAt}
            />
        </MediaLightboxContext.Provider>
    );
}

export function useMediaLightboxRegistration(registryKey: string, item: MediaViewerItem | null) {
    const context = useContext(MediaLightboxContext);
    // Serialize item to a stable string so the effect re-runs when any field changes,
    // without needing to enumerate every field in the dependency array.
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
