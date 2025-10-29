"use client";

import React, { ReactNode } from "react";
import { AppShell, AppShellProps } from "@mantine/core";

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
  style?: React.CSSProperties;
  /** Whether to offset main content area */
  offset?: boolean;
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

  /** Additional AppShell props */
  appShellProps?: Partial<AppShellProps>;

  /** Custom className for the main content area */
  mainClassName?: string;

  /** Custom styles for the main content area */
  mainStyle?: React.CSSProperties;
}

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
  appShellProps = {},
  mainClassName,
  mainStyle,
}) => {
  const transitionProps = disableTransitions
    ? false
    : {
        duration: transitionDuration,
        timingFunction: transitionTimingFunction,
      };

  return (
    <AppShell
      layout={layout}
      padding={padding}
      transitionDuration={transitionDuration}
      transitionTimingFunction={transitionTimingFunction}
      header={
        header
          ? {
              height: header.height || 60,
              collapsed: header.collapsed,
              offset: header.offset !== undefined ? header.offset : true,
            }
          : undefined
      }
      footer={
        footer
          ? {
              height: footer.height || 60,
              collapsed: footer.collapsed,
              offset: footer.offset !== undefined ? footer.offset : true,
            }
          : undefined
      }
      navbar={
        navbar
          ? {
              width: navbar.width || 300,
              breakpoint: "sm",
              collapsed: { mobile: navbar.collapsed || false },
            }
          : undefined
      }
      aside={
        aside
          ? {
              width: aside.width || 300,
              breakpoint: "md",
              collapsed: { desktop: aside.collapsed || false, mobile: true },
            }
          : undefined
      }
      {...appShellProps}
    >
      {header && header.children && (
        <AppShell.Header
          className={header.className}
          style={header.style}
          zIndex={header.zIndex}
        >
          {header.children}
        </AppShell.Header>
      )}

      {navbar && navbar.children && (
        <AppShell.Navbar
          className={navbar.className}
          style={navbar.style}
          zIndex={navbar.zIndex}
        >
          {navbar.children}
        </AppShell.Navbar>
      )}

      {aside && aside.children && (
        <AppShell.Aside
          className={aside.className}
          style={aside.style}
          zIndex={aside.zIndex}
        >
          {aside.children}
        </AppShell.Aside>
      )}

      <AppShell.Main className={mainClassName} style={mainStyle}>
        {children}
      </AppShell.Main>

      {footer && footer.children && (
        <AppShell.Footer
          className={footer.className}
          style={footer.style}
          zIndex={footer.zIndex}
        >
          {footer.children}
        </AppShell.Footer>
      )}
    </AppShell>
  );
};

export default OttaLayout;
