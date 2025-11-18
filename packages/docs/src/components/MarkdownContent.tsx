import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSlug from 'rehype-slug';
import { Box, Text, Title, List, Table, Code, Divider, Anchor } from '@mantine/core';

interface MarkdownContentProps {
  content: string;
  className?: string;
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  return (
    <Box className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeSlug]}
        components={{
          // Headings
          h1: ({ children, id }) => (
            <Title order={1} id={id as string} mt="xl" mb="md">
              {children}
            </Title>
          ),
          h2: ({ children, id }) => (
            <Title order={2} id={id as string} mt="xl" mb="md">
              {children}
            </Title>
          ),
          h3: ({ children, id }) => (
            <Title order={3} id={id as string} mt="lg" mb="sm">
              {children}
            </Title>
          ),
          h4: ({ children, id }) => (
            <Title order={4} id={id as string} mt="lg" mb="sm">
              {children}
            </Title>
          ),
          h5: ({ children, id }) => (
            <Title order={5} id={id as string} mt="md" mb="xs">
              {children}
            </Title>
          ),
          h6: ({ children, id }) => (
            <Title order={6} id={id as string} mt="md" mb="xs">
              {children}
            </Title>
          ),

          // Paragraphs and text
          p: ({ children }) => (
            <Text component="p" my="md" size="md" lh={1.7}>
              {children}
            </Text>
          ),

          // Links
          a: ({ href, children }) => (
            <Anchor href={href} target={href?.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer">
              {children}
            </Anchor>
          ),

          // Lists
          ul: ({ children }) => (
            <List my="md" spacing="xs">
              {children}
            </List>
          ),
          ol: ({ children }) => (
            <List type="ordered" my="md" spacing="xs">
              {children}
            </List>
          ),
          li: ({ children }) => <List.Item>{children}</List.Item>,

          // Code blocks
          code: ({ inline, className, children, ...props }: any) => {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';

            if (inline) {
              return (
                <Code {...props} style={{ padding: '2px 6px' }}>
                  {children}
                </Code>
              );
            }

            return (
              <Box my="md" className="docs-code-block">
                <pre className={className} style={{
                  padding: '1rem',
                  borderRadius: '8px',
                  overflow: 'auto',
                  backgroundColor: 'var(--mantine-color-gray-0)',
                }}>
                  <code className={className} {...props}>
                    {children}
                  </code>
                </pre>
              </Box>
            );
          },

          // Blockquotes
          blockquote: ({ children }) => (
            <Box
              my="md"
              pl="md"
              style={{
                borderLeft: '4px solid var(--mantine-color-blue-6)',
                backgroundColor: 'var(--mantine-color-blue-0)',
                padding: '0.5rem 1rem',
                borderRadius: '4px',
              }}
            >
              {children}
            </Box>
          ),

          // Tables
          table: ({ children }) => (
            <Table my="md" striped highlightOnHover withTableBorder withColumnBorders>
              {children}
            </Table>
          ),

          // Horizontal rule
          hr: () => <Divider my="xl" />,

          // Images
          img: ({ src, alt }) => (
            <Box my="md" style={{ textAlign: 'center' }}>
              <img
                src={src}
                alt={alt}
                style={{
                  maxWidth: '100%',
                  height: 'auto',
                  borderRadius: '8px',
                }}
              />
            </Box>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </Box>
  );
}
