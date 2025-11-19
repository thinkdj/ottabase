export interface DocItem {
  title: string;
  slug: string;
  path: string;
  order?: number;
}

export interface DocGroup {
  title: string;
  items: DocItem[];
  collapsed?: boolean;
}

export interface DocFrontmatter {
  title?: string;
  description?: string;
  order?: number;
  [key: string]: any;
}

export interface DocContent {
  frontmatter: DocFrontmatter;
  content: string;
  slug: string;
}

export interface SidebarConfig {
  groups?: DocGroup[];
  items?: DocItem[];
}

export interface DocsConfig {
  docsDir: string;
  sidebarConfig?: SidebarConfig;
  title?: string;
  logo?: React.ReactNode;
  defaultTheme?: 'light' | 'dark';
  showTableOfContents?: boolean;
  theme?: any; // Will be DocsTheme from theme/types
}

export interface Heading {
  id: string;
  text: string;
  level: number;
}
