import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { DocsConfig, DocContent, DocItem } from './types';

interface DocsContextValue {
  config: DocsConfig;
  currentDoc: DocContent | null;
  setCurrentDoc: (doc: DocContent | null) => void;
  currentSlug: string | null;
  setCurrentSlug: (slug: string | null) => void;
}

const DocsContext = createContext<DocsContextValue | null>(null);

export interface DocsProviderProps {
  children: ReactNode;
  config: DocsConfig;
  initialDoc?: DocContent;
}

export function DocsProvider({ children, config, initialDoc }: DocsProviderProps) {
  const [currentDoc, setCurrentDoc] = useState<DocContent | null>(initialDoc || null);
  const [currentSlug, setCurrentSlug] = useState<string | null>(initialDoc?.slug || null);

  const value = {
    config,
    currentDoc,
    setCurrentDoc,
    currentSlug,
    setCurrentSlug,
  };

  return <DocsContext.Provider value={value}>{children}</DocsContext.Provider>;
}

export function useDocsContext() {
  const context = useContext(DocsContext);
  if (!context) {
    throw new Error('useDocsContext must be used within a DocsProvider');
  }
  return context;
}
