import React, { useState } from 'react';
import { Box, ActionIcon, Tooltip, Text, Group } from '@mantine/core';
import { IconCopy, IconCheck } from '@tabler/icons-react';

interface CodeBlockProps {
  code: string;
  language?: string;
  className?: string;
  showLineNumbers?: boolean;
}

export function CodeBlock({ code, language, className, showLineNumbers = false }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  return (
    <Box
      pos="relative"
      my="md"
      className="docs-code-block"
      style={(theme) => ({
        borderRadius: theme.radius.md,
        overflow: 'hidden',
      })}
    >
      {/* Header with language and copy button */}
      {language && (
        <Group
          justify="space-between"
          px="md"
          py="xs"
          className="docs-code-block-header"
        >
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
            {language}
          </Text>
          <Tooltip label={copied ? 'Copied!' : 'Copy code'} position="left">
            <ActionIcon
              variant="subtle"
              color={copied ? 'teal' : 'gray'}
              onClick={handleCopy}
              size="sm"
            >
              {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
            </ActionIcon>
          </Tooltip>
        </Group>
      )}

      {/* Copy button for blocks without language header */}
      {!language && (
        <Box pos="absolute" top={8} right={8} style={{ zIndex: 1 }}>
          <Tooltip label={copied ? 'Copied!' : 'Copy code'} position="left">
            <ActionIcon
              variant="filled"
              color={copied ? 'teal' : 'gray'}
              onClick={handleCopy}
              size="sm"
            >
              {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
            </ActionIcon>
          </Tooltip>
        </Box>
      )}

      {/* Code content */}
      <Box
        component="pre"
        p="md"
        style={{
          margin: 0,
          overflow: 'auto',
          fontFamily: 'var(--mantine-font-family-monospace)',
          fontSize: '14px',
          lineHeight: 1.6,
        }}
      >
        <code className={className}>
          {code}
        </code>
      </Box>
    </Box>
  );
}
