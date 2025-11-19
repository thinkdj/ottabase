import React, { useState, useEffect, useMemo } from 'react';
import { TextInput, Paper, Stack, Text, Box, Highlight, Kbd, Group } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { useHotkeys } from '@mantine/hooks';
import FlexSearch from 'flexsearch';
import type { DocItem } from '../types';

interface SearchResult extends DocItem {
  excerpt?: string;
}

interface DocsSearchProps {
  docs: DocItem[];
  onSelect: (doc: DocItem) => void;
  placeholder?: string;
}

export function DocsSearch({ docs, onSelect, placeholder = 'Search docs...' }: DocsSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isFocused, setIsFocused] = useState(false);

  // Create search index
  const searchIndex = useMemo(() => {
    const index = new FlexSearch.Index({
      tokenize: 'forward',
      cache: true,
    });

    docs.forEach((doc, i) => {
      // Index title and path
      index.add(i, `${doc.title} ${doc.path} ${doc.slug}`);
    });

    return index;
  }, [docs]);

  // Search handler
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const searchResults = searchIndex.search(query, { limit: 10 });
    const matchedDocs = searchResults.map((index) => docs[index as number]);

    setResults(matchedDocs);
  }, [query, searchIndex, docs]);

  // Keyboard shortcut: Cmd+K or Ctrl+K
  useHotkeys([
    [
      'mod+K',
      (e) => {
        e.preventDefault();
        const input = document.querySelector<HTMLInputElement>('[data-docs-search]');
        input?.focus();
      },
    ],
  ]);

  const handleSelect = (doc: DocItem) => {
    onSelect(doc);
    setQuery('');
    setResults([]);
    setIsFocused(false);
  };

  return (
    <Box pos="relative">
      <TextInput
        data-docs-search
        placeholder={placeholder}
        leftSection={<IconSearch size={16} />}
        rightSection={
          <Group gap={4}>
            <Kbd size="xs">⌘</Kbd>
            <Kbd size="xs">K</Kbd>
          </Group>
        }
        value={query}
        onChange={(e) => setQuery(e.currentTarget.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setTimeout(() => setIsFocused(false), 200)}
        styles={{
          input: {
            borderRadius: '8px',
          },
        }}
      />

      {/* Search Results Dropdown */}
      {isFocused && results.length > 0 && (
        <Paper
          shadow="md"
          p="xs"
          pos="absolute"
          top="100%"
          left={0}
          right={0}
          mt="xs"
          style={{ zIndex: 1000, maxHeight: '400px', overflow: 'auto' }}
        >
          <Stack gap="xs">
            {results.map((result) => (
              <Box
                key={result.slug}
                p="sm"
                onClick={() => handleSelect(result)}
                style={{ cursor: 'pointer' }}
                className="docs-search-result"
              >
                <Highlight highlight={query} size="sm" fw={600}>
                  {result.title}
                </Highlight>
                <Text size="xs" c="dimmed" mt={4}>
                  {result.path}
                </Text>
              </Box>
            ))}
          </Stack>
        </Paper>
      )}

      {/* No Results */}
      {isFocused && query && results.length === 0 && (
        <Paper
          shadow="md"
          p="md"
          pos="absolute"
          top="100%"
          left={0}
          right={0}
          mt="xs"
          style={{ zIndex: 1000 }}
        >
          <Text size="sm" c="dimmed" ta="center">
            No results found for "{query}"
          </Text>
        </Paper>
      )}
    </Box>
  );
}
