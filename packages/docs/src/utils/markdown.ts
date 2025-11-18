import matter from 'gray-matter';
import type { DocContent, Heading } from '../types';

/**
 * Parse markdown file content with frontmatter
 */
export function parseMarkdown(markdown: string, slug: string): DocContent {
  const { data, content } = matter(markdown);

  return {
    frontmatter: data,
    content,
    slug,
  };
}

/**
 * Extract headings from markdown content for table of contents
 */
export function extractHeadings(markdown: string): Heading[] {
  const headings: Heading[] = [];
  const lines = markdown.split('\n');

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim();
      const id = text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-');

      headings.push({ id, text, level });
    }
  }

  return headings;
}

/**
 * Generate a slug from a file path
 */
export function generateSlug(filePath: string): string {
  return filePath
    .replace(/\.mdx?$/, '')
    .replace(/\\/g, '/')
    .toLowerCase();
}

/**
 * Format file name to title
 */
export function formatTitle(fileName: string): string {
  return fileName
    .replace(/\.mdx?$/, '')
    .replace(/[-_]/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
