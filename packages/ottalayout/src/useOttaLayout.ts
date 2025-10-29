"use client";

import { useState, useCallback } from "react";
import { useDisclosure } from "@mantine/hooks";

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

  const [navbarOpened, { toggle: toggleNavbar, open: openNavbar, close: closeNavbar }] =
    useDisclosure(initialNavbarOpened);

  const [asideOpened, { toggle: toggleAside, open: openAside, close: closeAside }] =
    useDisclosure(initialAsideOpened);

  const [headerVisible, { toggle: toggleHeader, open: showHeader, close: hideHeader }] =
    useDisclosure(initialHeaderVisible);

  const [footerVisible, { toggle: toggleFooter, open: showFooter, close: hideFooter }] =
    useDisclosure(initialFooterVisible);

  const reset = useCallback(() => {
    if (navbarOpened !== initialNavbarOpened) toggleNavbar();
    if (asideOpened !== initialAsideOpened) toggleAside();
    if (headerVisible !== initialHeaderVisible) toggleHeader();
    if (footerVisible !== initialFooterVisible) toggleFooter();
  }, [
    navbarOpened,
    asideOpened,
    headerVisible,
    footerVisible,
    initialNavbarOpened,
    initialAsideOpened,
    initialHeaderVisible,
    initialFooterVisible,
    toggleNavbar,
    toggleAside,
    toggleHeader,
    toggleFooter,
  ]);

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
