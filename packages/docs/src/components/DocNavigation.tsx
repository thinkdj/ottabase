import React from 'react';
import { Group, Button, Box, Text } from '@mantine/core';
import { IconArrowLeft, IconArrowRight } from '@tabler/icons-react';
import type { DocItem } from '../types';

interface DocNavigationProps {
  prev?: DocItem | null;
  next?: DocItem | null;
  onNavigate?: (doc: DocItem) => void;
}

export function DocNavigation({ prev, next, onNavigate }: DocNavigationProps) {
  if (!prev && !next) return null;

  return (
    <Group justify="space-between" mt="xl" pt="xl" style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>
      {/* Previous */}
      <Box style={{ flex: 1 }}>
        {prev && (
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => onNavigate?.(prev)}
            styles={{
              root: {
                height: 'auto',
                padding: '12px',
              },
              inner: {
                justifyContent: 'flex-start',
              },
              section: {
                marginRight: '8px',
              },
            }}
          >
            <Box>
              <Text size="xs" c="dimmed" mb={4}>
                Previous
              </Text>
              <Text size="sm" fw={500}>
                {prev.title}
              </Text>
            </Box>
          </Button>
        )}
      </Box>

      {/* Next */}
      <Box style={{ flex: 1, textAlign: 'right' }}>
        {next && (
          <Button
            variant="subtle"
            rightSection={<IconArrowRight size={16} />}
            onClick={() => onNavigate?.(next)}
            styles={{
              root: {
                height: 'auto',
                padding: '12px',
              },
              inner: {
                justifyContent: 'flex-end',
              },
              section: {
                marginLeft: '8px',
              },
            }}
          >
            <Box>
              <Text size="xs" c="dimmed" mb={4}>
                Next
              </Text>
              <Text size="sm" fw={500}>
                {next.title}
              </Text>
            </Box>
          </Button>
        )}
      </Box>
    </Group>
  );
}
