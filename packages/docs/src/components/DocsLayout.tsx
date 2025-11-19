import React, { useEffect, useState } from 'react';
import { AppShell, Container, Group, Text, Box, Burger, Stack } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Sidebar } from './Sidebar';
import { MarkdownContent } from './MarkdownContent';
import { TableOfContents } from './TableOfContents';
import { DocsSearch } from './DocsSearch';
import { Breadcrumbs } from './Breadcrumbs';
import { DocNavigation } from './DocNavigation';
import { useDocsContext } from '../DocsContext';
import { extractHeadings } from '../utils/markdown';
import { flattenSidebarConfig, findAdjacentDocs, generateBreadcrumbs } from '../utils/files';
import type { DocItem, Heading } from '../types';

export interface DocsLayoutProps {
  /**
   * Custom header content (logo, title, etc.)
   */
  header?: React.ReactNode;
  /**
   * Show/hide table of contents
   * @default true
   */
  showTableOfContents?: boolean;
  /**
   * Show/hide search
   * @default true
   */
  showSearch?: boolean;
  /**
   * Show/hide breadcrumbs
   * @default true
   */
  showBreadcrumbs?: boolean;
  /**
   * Show/hide prev/next navigation
   * @default true
   */
  showNavigation?: boolean;
  /**
   * Maximum width of the content area
   * @default 'lg'
   */
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

export function DocsLayout({
  header,
  showTableOfContents = true,
  showSearch = true,
  showBreadcrumbs = true,
  showNavigation = true,
  maxWidth = 'lg',
}: DocsLayoutProps) {
  const { config, currentDoc, setCurrentSlug } = useDocsContext();
  const [mobileOpened, { toggle: toggleMobile, close: closeMobile }] = useDisclosure();
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeHeadingId, setActiveHeadingId] = useState<string>();

  // Get all docs for search and navigation
  const allDocs = config.sidebarConfig ? flattenSidebarConfig(config.sidebarConfig) : [];

  // Get breadcrumbs
  const breadcrumbs = currentDoc && config.sidebarConfig
    ? generateBreadcrumbs(currentDoc.slug, config.sidebarConfig)
    : [];

  // Get adjacent docs for prev/next navigation
  const adjacentDocs = currentDoc
    ? findAdjacentDocs(currentDoc.slug, allDocs)
    : { prev: null, next: null };

  // Extract headings when content changes
  useEffect(() => {
    if (currentDoc?.content) {
      const extracted = extractHeadings(currentDoc.content);
      setHeadings(extracted);
    }
  }, [currentDoc?.content]);

  // Track active heading on scroll
  useEffect(() => {
    const handleScroll = () => {
      const headingElements = headings.map((h) => ({
        id: h.id,
        element: document.getElementById(h.id),
      }));

      for (let i = headingElements.length - 1; i >= 0; i--) {
        const { id, element } = headingElements[i];
        if (element) {
          const rect = element.getBoundingClientRect();
          if (rect.top <= 100) {
            setActiveHeadingId(id);
            return;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [headings]);

  const handleNavigate = (item: DocItem) => {
    setCurrentSlug(item.slug);
    closeMobile();
    // Scroll to top on navigation
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBreadcrumbNavigate = (slug: string) => {
    setCurrentSlug(slug);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const defaultHeader = (
    <Group h="100%" px="md">
      {config.logo}
      <Text size="lg" fw={700}>
        {config.title || 'Documentation'}
      </Text>
    </Group>
  );

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: parseInt(config.theme?.spacing.sidebarWidth || '280px') || 280,
        breakpoint: 'sm',
        collapsed: { mobile: !mobileOpened },
      }}
      aside={
        showTableOfContents && headings.length > 0
          ? {
              width: parseInt(config.theme?.spacing.tocWidth || '240px') || 240,
              breakpoint: 'md',
              collapsed: { mobile: true, desktop: false },
            }
          : undefined
      }
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={mobileOpened} onClick={toggleMobile} hiddenFrom="sm" size="sm" />
            {header || defaultHeader}
          </Group>
          {showSearch && allDocs.length > 0 && (
            <Box style={{ maxWidth: '300px', flex: 1 }} data-docs-header-actions>
              <DocsSearch docs={allDocs} onSelect={handleNavigate} />
            </Box>
          )}
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md" data-docs-sidebar>
        {config.sidebarConfig && (
          <Sidebar
            config={config.sidebarConfig}
            currentSlug={currentDoc?.slug}
            onNavigate={handleNavigate}
          />
        )}
      </AppShell.Navbar>

      <AppShell.Main data-docs-content>
        <Container size={maxWidth} px="md">
          {currentDoc ? (
            <Stack gap="md">
              {/* Breadcrumbs */}
              {showBreadcrumbs && breadcrumbs.length > 0 && (
                <Breadcrumbs items={breadcrumbs} onNavigate={handleBreadcrumbNavigate} />
              )}

              {/* Title and description */}
              {currentDoc.frontmatter.title && (
                <Box mb="xl">
                  <Text size="xl" fw={700} mb="xs">
                    {currentDoc.frontmatter.title}
                  </Text>
                  {currentDoc.frontmatter.description && (
                    <Text size="md" c="dimmed">
                      {currentDoc.frontmatter.description}
                    </Text>
                  )}
                </Box>
              )}

              {/* Content */}
              <MarkdownContent content={currentDoc.content} />

              {/* Prev/Next Navigation */}
              {showNavigation && (adjacentDocs.prev || adjacentDocs.next) && (
                <Box data-docs-navigation>
                  <DocNavigation
                    prev={adjacentDocs.prev}
                    next={adjacentDocs.next}
                    onNavigate={handleNavigate}
                  />
                </Box>
              )}
            </Stack>
          ) : (
            <Box ta="center" mt="xl">
              <Text size="xl" c="dimmed">
                Select a document from the sidebar
              </Text>
            </Box>
          )}
        </Container>
      </AppShell.Main>

      {showTableOfContents && headings.length > 0 && (
        <AppShell.Aside p="md" data-docs-toc>
          <TableOfContents headings={headings} activeId={activeHeadingId} />
        </AppShell.Aside>
      )}
    </AppShell>
  );
}
