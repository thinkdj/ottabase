import React, { useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSlug from 'rehype-slug';
import { Box, Text, Title, List, Table, Code, Divider, Anchor } from '@mantine/core';
import { CodeBlock } from './CodeBlock';
import { Callout, CalloutType } from './Callout';
import hljs from 'highlight.js/lib/core';

// Import common languages for highlighting
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';
import python from 'highlight.js/lib/languages/python';
import markdown from 'highlight.js/lib/languages/markdown';

// Register languages
if (!hljs.getLanguage('javascript')) {
  hljs.registerLanguage('javascript', javascript);
  hljs.registerLanguage('js', javascript);
  hljs.registerLanguage('typescript', typescript);
  hljs.registerLanguage('ts', typescript);
  hljs.registerLanguage('tsx', typescript);
  hljs.registerLanguage('jsx', typescript);
  hljs.registerLanguage('html', xml);
  hljs.registerLanguage('xml', xml);
  hljs.registerLanguage('css', css);
  hljs.registerLanguage('json', json);
  hljs.registerLanguage('bash', bash);
  hljs.registerLanguage('shell', bash);
  hljs.registerLanguage('python', python);
  hljs.registerLanguage('py', python);
  hljs.registerLanguage('markdown', markdown);
  hljs.registerLanguage('md', markdown);
}

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
            const codeString = String(children).replace(/\n$/, '');

            if (inline) {
              return (
                <Code {...props} style={{ padding: '2px 6px' }}>
                  {children}
                </Code>
              );
            }

            // Highlight the code
            let highlightedCode = codeString;
            let highlightClassName = '';

            if (language && hljs.getLanguage(language)) {
              try {
                const result = hljs.highlight(codeString, { language });
                highlightedCode = result.value;
                highlightClassName = 'hljs';
              } catch (err) {
                console.error('Highlight.js error:', err);
              }
            }

            return (
              <CodeBlock
                code={codeString}
                language={language}
                className={highlightClassName}
              />
            );
          },

          // Blockquotes (with callout support)
          blockquote: ({ children }: any) => {
            // Check if this is a callout by looking for [!TYPE] pattern
            const childArray = React.Children.toArray(children);
            const firstChild = childArray[0];

            if (firstChild && typeof firstChild === 'object' && 'props' in firstChild) {
              const text = firstChild.props?.children;
              if (typeof text === 'string') {
                const calloutMatch = text.match(/^\[!(NOTE|TIP|WARNING|DANGER|SUCCESS|INFO)\]\s*/i);
                if (calloutMatch) {
                  const type = calloutMatch[1].toLowerCase() as CalloutType;
                  // Remove the callout marker from content
                  const cleanedText = text.replace(/^\[!(NOTE|TIP|WARNING|DANGER|SUCCESS|INFO)\]\s*/i, '');
                  const newChildren = React.cloneElement(firstChild, {
                    ...firstChild.props,
                    children: cleanedText,
                  });

                  return (
                    <Callout type={type}>
                      {[newChildren, ...childArray.slice(1)]}
                    </Callout>
                  );
                }
              }
            }

            // Regular blockquote
            return (
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
            );
          },

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
