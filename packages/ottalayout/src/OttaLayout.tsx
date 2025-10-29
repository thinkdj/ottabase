"use client";

import React, { ReactNode, CSSProperties } from "react";

export interface OttaLayoutSection {
  /** Content to render in the section */
  children?: ReactNode;
  /** Height of the section (for Header/Footer) */
  height?: number | string;
  /** Width of the section (for Navbar/Aside) */
  width?: number | string;
  /** Whether the section is collapsed */
  collapsed?: boolean;
  /** z-index of the section */
  zIndex?: number;
  /** Custom className */
  className?: string;
  /** Custom styles */
  style?: CSSProperties;
  /** Whether to offset main content area (affects padding) */
  offset?: boolean;
  /** Breakpoint for responsive behavior (px) */
  breakpoint?: number;
}

export interface OttaLayoutProps {
  /** Header section configuration */
  header?: OttaLayoutSection;

  /** Footer section configuration */
  footer?: OttaLayoutSection;

  /** Left navbar section configuration */
  navbar?: OttaLayoutSection;

  /** Right aside section configuration */
  aside?: OttaLayoutSection;

  /** Main content area */
  children: ReactNode;

  /** Layout configuration */
  layout?: "default" | "alt";

  /** Padding for the main content area */
  padding?: number | string;

  /** Whether to disable transitions */
  disableTransitions?: boolean;

  /** Transition duration in milliseconds */
  transitionDuration?: number;

  /** Transition timing function */
  transitionTimingFunction?: string;

  /** Custom className for the root container */
  className?: string;

  /** Custom styles for the root container */
  style?: CSSProperties;

  /** Custom className for the main content area */
  mainClassName?: string;

  /** Custom styles for the main content area */
  mainStyle?: CSSProperties;
}

const normalizeSize = (size: number | string | undefined, defaultValue: number | string): string => {
  if (size === undefined) return typeof defaultValue === 'number' ? `${defaultValue}px` : defaultValue;
  return typeof size === 'number' ? `${size}px` : size;
};

export const OttaLayout: React.FC<OttaLayoutProps> = ({
  header,
  footer,
  navbar,
  aside,
  children,
  layout = "default",
  padding = "md",
  disableTransitions = false,
  transitionDuration = 200,
  transitionTimingFunction = "ease",
  className = "",
  style = {},
  mainClassName = "",
  mainStyle = {},
}) => {
  // Normalize padding
  const paddingMap: Record<string, string> = {
    xs: '0.5rem',
    sm: '0.75rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
  };
  const normalizedPadding = typeof padding === 'string' && paddingMap[padding]
    ? paddingMap[padding]
    : normalizeSize(padding, '1rem');

  // Calculate dimensions
  const headerHeight = header && !header.collapsed ? normalizeSize(header.height, 60) : '0px';
  const footerHeight = footer && !footer.collapsed ? normalizeSize(footer.height, 60) : '0px';
  const navbarWidth = navbar && !navbar.collapsed ? normalizeSize(navbar.width, 300) : '0px';
  const asideWidth = aside && !aside.collapsed ? normalizeSize(aside.width, 300) : '0px';

  const transition = disableTransitions
    ? 'none'
    : `all ${transitionDuration}ms ${transitionTimingFunction}`;

  // Root container styles
  const containerStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: layout === 'alt'
      ? `${asideWidth} 1fr ${navbarWidth}`
      : `${navbarWidth} 1fr ${asideWidth}`,
    gridTemplateRows: `${headerHeight} 1fr ${footerHeight}`,
    gridTemplateAreas: layout === 'alt'
      ? `"header header header"
         "aside main navbar"
         "footer footer footer"`
      : `"header header header"
         "navbar main aside"
         "footer footer footer"`,
    height: '100vh',
    width: '100%',
    overflow: 'hidden',
    transition,
    ...style,
  };

  // Section styles
  const sectionBaseStyle: CSSProperties = {
    overflow: 'auto',
    transition,
  };

  const headerStyle: CSSProperties = {
    ...sectionBaseStyle,
    gridArea: 'header',
    height: headerHeight,
    zIndex: header?.zIndex ?? 100,
    opacity: header?.collapsed ? 0 : 1,
    transform: header?.collapsed ? 'translateY(-100%)' : 'translateY(0)',
    pointerEvents: header?.collapsed ? 'none' : 'auto',
    ...header?.style,
  };

  const footerStyle: CSSProperties = {
    ...sectionBaseStyle,
    gridArea: 'footer',
    height: footerHeight,
    zIndex: footer?.zIndex ?? 100,
    opacity: footer?.collapsed ? 0 : 1,
    transform: footer?.collapsed ? 'translateY(100%)' : 'translateY(0)',
    pointerEvents: footer?.collapsed ? 'none' : 'auto',
    ...footer?.style,
  };

  const navbarStyle: CSSProperties = {
    ...sectionBaseStyle,
    gridArea: 'navbar',
    width: navbarWidth,
    zIndex: navbar?.zIndex ?? 50,
    opacity: navbar?.collapsed ? 0 : 1,
    transform: navbar?.collapsed ? (layout === 'alt' ? 'translateX(100%)' : 'translateX(-100%)') : 'translateX(0)',
    pointerEvents: navbar?.collapsed ? 'none' : 'auto',
    ...navbar?.style,
  };

  const asideStyle: CSSProperties = {
    ...sectionBaseStyle,
    gridArea: 'aside',
    width: asideWidth,
    zIndex: aside?.zIndex ?? 50,
    opacity: aside?.collapsed ? 0 : 1,
    transform: aside?.collapsed ? (layout === 'alt' ? 'translateX(-100%)' : 'translateX(100%)') : 'translateX(0)',
    pointerEvents: aside?.collapsed ? 'none' : 'auto',
    ...aside?.style,
  };

  const mainContentStyle: CSSProperties = {
    ...sectionBaseStyle,
    gridArea: 'main',
    padding: normalizedPadding,
    zIndex: 1,
    ...mainStyle,
  };

  return (
    <div
      className={`otta-layout ${className}`}
      style={containerStyle}
      data-layout={layout}
      data-disable-transitions={disableTransitions}
    >
      {header && header.children && (
        <header
          className={`otta-layout-header ${header.className || ''}`}
          style={headerStyle}
          data-collapsed={header.collapsed}
        >
          {header.children}
        </header>
      )}

      {navbar && navbar.children && (
        <nav
          className={`otta-layout-navbar ${navbar.className || ''}`}
          style={navbarStyle}
          data-collapsed={navbar.collapsed}
        >
          {navbar.children}
        </nav>
      )}

      <main
        className={`otta-layout-main ${mainClassName}`}
        style={mainContentStyle}
      >
        {children}
      </main>

      {aside && aside.children && (
        <aside
          className={`otta-layout-aside ${aside.className || ''}`}
          style={asideStyle}
          data-collapsed={aside.collapsed}
        >
          {aside.children}
        </aside>
      )}

      {footer && footer.children && (
        <footer
          className={`otta-layout-footer ${footer.className || ''}`}
          style={footerStyle}
          data-collapsed={footer.collapsed}
        >
          {footer.children}
        </footer>
      )}
    </div>
  );
};

export default OttaLayout;
