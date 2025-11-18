import React, { useEffect, useState } from 'react';
import { AppShell, Container, Group, Text, Box, Burger } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Sidebar } from './Sidebar';
import { MarkdownContent } from './MarkdownContent';
import { TableOfContents } from './TableOfContents';
import { useDocsContext } from '../DocsContext';
import { extractHeadings } from '../utils/markdown';
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
   * Maximum width of the content area
   * @default 'lg'
   */
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

export function DocsLayout({
  header,
  showTableOfContents = true,
  maxWidth = 'lg',
}: DocsLayoutProps) {
  const { config, currentDoc, setCurrentSlug } = useDocsContext();
  const [mobileOpened, { toggle: toggleMobile }] = useDisclosure();
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeHeadingId, setActiveHeadingId] = useState<string>();

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
    toggleMobile();
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
        width: 280,
        breakpoint: 'sm',
        collapsed: { mobile: !mobileOpened },
      }}
      aside={
        showTableOfContents && headings.length > 0
          ? {
              width: 240,
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
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        {config.sidebarConfig && (
          <Sidebar
            config={config.sidebarConfig}
            currentSlug={currentDoc?.slug}
            onNavigate={handleNavigate}
          />
        )}
      </AppShell.Navbar>

      <AppShell.Main>
        <Container size={maxWidth} px="md">
          {currentDoc ? (
            <>
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
              <MarkdownContent content={currentDoc.content} />
            </>
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
        <AppShell.Aside p="md">
          <TableOfContents headings={headings} activeId={activeHeadingId} />
        </AppShell.Aside>
      )}
    </AppShell>
  );
}
