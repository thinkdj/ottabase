import type { DocItem, DocGroup, SidebarConfig } from '../types';
import { formatTitle, generateSlug } from './markdown';

/**
 * Generate sidebar config from file structure
 * Example file structure:
 * docs/
 *   getting-started/
 *     introduction.md
 *     installation.md
 *   guides/
 *     quick-start.md
 */
export interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileNode[];
}

/**
 * Convert file tree to sidebar config
 */
export function fileTreeToSidebarConfig(
  fileTree: FileNode[],
  basePath: string = ''
): SidebarConfig {
  const groups: DocGroup[] = [];
  const items: DocItem[] = [];

  for (const node of fileTree) {
    if (node.isDirectory && node.children) {
      // Create a group for each directory
      const groupItems: DocItem[] = [];

      for (const child of node.children) {
        if (!child.isDirectory && isMarkdownFile(child.name)) {
          groupItems.push({
            title: extractTitle(child.name) || formatTitle(child.name),
            slug: generateSlug(child.path),
            path: child.path,
            order: extractOrder(child.name),
          });
        }
      }

      // Sort by order if available
      groupItems.sort((a, b) => {
        if (a.order !== undefined && b.order !== undefined) {
          return a.order - b.order;
        }
        return a.title.localeCompare(b.title);
      });

      if (groupItems.length > 0) {
        groups.push({
          title: formatTitle(node.name),
          items: groupItems,
        });
      }
    } else if (!node.isDirectory && isMarkdownFile(node.name)) {
      // Root level markdown file
      items.push({
        title: extractTitle(node.name) || formatTitle(node.name),
        slug: generateSlug(node.path),
        path: node.path,
        order: extractOrder(node.name),
      });
    }
  }

  return groups.length > 0 ? { groups } : { items };
}

/**
 * Check if file is markdown
 */
function isMarkdownFile(filename: string): boolean {
  return /\.mdx?$/i.test(filename);
}

/**
 * Extract title from filename (looks for number prefix like "01-title.md")
 */
function extractTitle(filename: string): string | null {
  const match = filename.match(/^\d+-(.+)\.mdx?$/i);
  return match ? formatTitle(match[1]) : null;
}

/**
 * Extract order from filename (looks for number prefix like "01-title.md")
 */
function extractOrder(filename: string): number | undefined {
  const match = filename.match(/^(\d+)-/);
  return match ? parseInt(match[1], 10) : undefined;
}

/**
 * Sort docs by order field
 */
export function sortDocsByOrder(docs: DocItem[]): DocItem[] {
  return docs.sort((a, b) => {
    if (a.order !== undefined && b.order !== undefined) {
      return a.order - b.order;
    }
    if (a.order !== undefined) return -1;
    if (b.order !== undefined) return 1;
    return a.title.localeCompare(b.title);
  });
}

/**
 * Find next and previous docs in a flat list
 */
export function findAdjacentDocs(
  currentSlug: string,
  allDocs: DocItem[]
): { prev: DocItem | null; next: DocItem | null } {
  const sortedDocs = sortDocsByOrder(allDocs);
  const currentIndex = sortedDocs.findIndex((doc) => doc.slug === currentSlug);

  if (currentIndex === -1) {
    return { prev: null, next: null };
  }

  return {
    prev: currentIndex > 0 ? sortedDocs[currentIndex - 1] : null,
    next: currentIndex < sortedDocs.length - 1 ? sortedDocs[currentIndex + 1] : null,
  };
}

/**
 * Flatten sidebar config to get all docs
 */
export function flattenSidebarConfig(config: SidebarConfig): DocItem[] {
  const allDocs: DocItem[] = [];

  if (config.groups) {
    config.groups.forEach((group) => {
      allDocs.push(...group.items);
    });
  }

  if (config.items) {
    allDocs.push(...config.items);
  }

  return allDocs;
}

/**
 * Generate breadcrumbs from current path
 */
export function generateBreadcrumbs(
  currentPath: string,
  sidebarConfig: SidebarConfig
): Array<{ title: string; slug: string }> {
  const breadcrumbs: Array<{ title: string; slug: string }> = [];
  const segments = currentPath.split('/').filter(Boolean);

  // Find the doc in sidebar config
  const allDocs = flattenSidebarConfig(sidebarConfig);
  const currentDoc = allDocs.find((doc) => doc.slug === currentPath);

  if (!currentDoc) {
    return breadcrumbs;
  }

  // Find parent group if exists
  if (sidebarConfig.groups) {
    const parentGroup = sidebarConfig.groups.find((group) =>
      group.items.some((item) => item.slug === currentPath)
    );

    if (parentGroup) {
      breadcrumbs.push({
        title: parentGroup.title,
        slug: parentGroup.items[0]?.slug || '',
      });
    }
  }

  breadcrumbs.push({
    title: currentDoc.title,
    slug: currentDoc.slug,
  });

  return breadcrumbs;
}
