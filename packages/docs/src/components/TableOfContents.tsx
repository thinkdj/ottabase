import React from 'react';
import { Box, Text, Anchor, Stack } from '@mantine/core';
import type { Heading } from '../types';

interface TableOfContentsProps {
  headings: Heading[];
  activeId?: string;
}

export function TableOfContents({ headings, activeId }: TableOfContentsProps) {
  if (headings.length === 0) {
    return null;
  }

  return (
    <Box
      style={{
        position: 'sticky',
        top: '2rem',
        maxHeight: 'calc(100vh - 4rem)',
        overflowY: 'auto',
      }}
    >
      <Text size="sm" fw={600} mb="sm" c="dimmed">
        ON THIS PAGE
      </Text>
      <Stack gap="xs">
        {headings.map((heading) => (
          <Anchor
            key={heading.id}
            href={`#${heading.id}`}
            size="sm"
            c={activeId === heading.id ? 'blue' : 'dimmed'}
            fw={activeId === heading.id ? 600 : 400}
            style={{
              paddingLeft: `${(heading.level - 1) * 0.75}rem`,
              textDecoration: 'none',
              transition: 'color 0.2s ease',
            }}
            onClick={(e) => {
              e.preventDefault();
              const element = document.getElementById(heading.id);
              if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                window.history.pushState(null, '', `#${heading.id}`);
              }
            }}
          >
            {heading.text}
          </Anchor>
        ))}
      </Stack>
    </Box>
  );
}
