"use client";

import { useState, useCallback } from "react";

export interface LayoutState {
  /** Whether the navbar is opened */
  navbarOpened: boolean;
  /** Whether the aside is opened */
  asideOpened: boolean;
  /** Whether the header is visible */
  headerVisible: boolean;
  /** Whether the footer is visible */
  footerVisible: boolean;
}

export interface UseOttaLayoutReturn extends LayoutState {
  /** Toggle navbar */
  toggleNavbar: () => void;
  /** Open navbar */
  openNavbar: () => void;
  /** Close navbar */
  closeNavbar: () => void;

  /** Toggle aside */
  toggleAside: () => void;
  /** Open aside */
  openAside: () => void;
  /** Close aside */
  closeAside: () => void;

  /** Toggle header */
  toggleHeader: () => void;
  /** Show header */
  showHeader: () => void;
  /** Hide header */
  hideHeader: () => void;

  /** Toggle footer */
  toggleFooter: () => void;
  /** Show footer */
  showFooter: () => void;
  /** Hide footer */
  hideFooter: () => void;

  /** Reset all sections to initial state */
  reset: () => void;
}

export interface UseOttaLayoutOptions {
  /** Initial navbar opened state */
  initialNavbarOpened?: boolean;
  /** Initial aside opened state */
  initialAsideOpened?: boolean;
  /** Initial header visible state */
  initialHeaderVisible?: boolean;
  /** Initial footer visible state */
  initialFooterVisible?: boolean;
}

/**
 * Hook for managing OttaLayout state
 * Provides toggle functions for all layout sections
 */
export function useOttaLayout(
  options: UseOttaLayoutOptions = {}
): UseOttaLayoutReturn {
  const {
    initialNavbarOpened = true,
    initialAsideOpened = false,
    initialHeaderVisible = true,
    initialFooterVisible = true,
  } = options;

  const [navbarOpened, setNavbarOpened] = useState(initialNavbarOpened);
  const [asideOpened, setAsideOpened] = useState(initialAsideOpened);
  const [headerVisible, setHeaderVisible] = useState(initialHeaderVisible);
  const [footerVisible, setFooterVisible] = useState(initialFooterVisible);

  // Navbar functions
  const toggleNavbar = useCallback(() => setNavbarOpened(prev => !prev), []);
  const openNavbar = useCallback(() => setNavbarOpened(true), []);
  const closeNavbar = useCallback(() => setNavbarOpened(false), []);

  // Aside functions
  const toggleAside = useCallback(() => setAsideOpened(prev => !prev), []);
  const openAside = useCallback(() => setAsideOpened(true), []);
  const closeAside = useCallback(() => setAsideOpened(false), []);

  // Header functions
  const toggleHeader = useCallback(() => setHeaderVisible(prev => !prev), []);
  const showHeader = useCallback(() => setHeaderVisible(true), []);
  const hideHeader = useCallback(() => setHeaderVisible(false), []);

  // Footer functions
  const toggleFooter = useCallback(() => setFooterVisible(prev => !prev), []);
  const showFooter = useCallback(() => setFooterVisible(true), []);
  const hideFooter = useCallback(() => setFooterVisible(false), []);

  // Reset function
  const reset = useCallback(() => {
    setNavbarOpened(initialNavbarOpened);
    setAsideOpened(initialAsideOpened);
    setHeaderVisible(initialHeaderVisible);
    setFooterVisible(initialFooterVisible);
  }, [initialNavbarOpened, initialAsideOpened, initialHeaderVisible, initialFooterVisible]);

  return {
    navbarOpened,
    toggleNavbar,
    openNavbar,
    closeNavbar,

    asideOpened,
    toggleAside,
    openAside,
    closeAside,

    headerVisible,
    toggleHeader,
    showHeader,
    hideHeader,

    footerVisible,
    toggleFooter,
    showFooter,
    hideFooter,

    reset,
  };
}
