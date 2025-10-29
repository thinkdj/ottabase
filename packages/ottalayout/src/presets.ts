/**
 * Preset layout configurations based on common patterns
 * Inspired by Mantine AppShell examples
 */

export interface LayoutPreset {
  name: string;
  description: string;
  config: {
    header?: { height: number };
    footer?: { height: number };
    navbar?: { width: number };
    aside?: { width: number };
  };
}

export const layoutPresets: Record<string, LayoutPreset> = {
  default: {
    name: "Default",
    description: "Header with navbar sidebar",
    config: {
      header: { height: 60 },
      navbar: { width: 300 },
    },
  },

  headerOnly: {
    name: "Header Only",
    description: "Simple header layout",
    config: {
      header: { height: 60 },
    },
  },

  headerFooter: {
    name: "Header + Footer",
    description: "Header and footer layout",
    config: {
      header: { height: 60 },
      footer: { height: 60 },
    },
  },

  navbarOnly: {
    name: "Navbar Only",
    description: "Left sidebar navigation",
    config: {
      navbar: { width: 300 },
    },
  },

  fullLayout: {
    name: "Full Layout",
    description: "Header, footer, navbar, and aside",
    config: {
      header: { height: 60 },
      footer: { height: 60 },
      navbar: { width: 300 },
      aside: { width: 300 },
    },
  },

  asideOnly: {
    name: "Aside Only",
    description: "Right sidebar only",
    config: {
      aside: { width: 300 },
    },
  },

  doubleNavbar: {
    name: "Double Navbar",
    description: "Left navbar and right aside",
    config: {
      navbar: { width: 300 },
      aside: { width: 300 },
    },
  },

  headerNavbar: {
    name: "Header + Navbar",
    description: "Header with left sidebar",
    config: {
      header: { height: 60 },
      navbar: { width: 300 },
    },
  },

  headerAside: {
    name: "Header + Aside",
    description: "Header with right sidebar",
    config: {
      header: { height: 60 },
      aside: { width: 300 },
    },
  },

  headerNavbarFooter: {
    name: "Header + Navbar + Footer",
    description: "Header, footer with left sidebar",
    config: {
      header: { height: 60 },
      footer: { height: 60 },
      navbar: { width: 300 },
    },
  },

  headerAsideFooter: {
    name: "Header + Aside + Footer",
    description: "Header, footer with right sidebar",
    config: {
      header: { height: 60 },
      footer: { height: 60 },
      aside: { width: 300 },
    },
  },

  navbarFooter: {
    name: "Navbar + Footer",
    description: "Left sidebar with footer",
    config: {
      navbar: { width: 300 },
      footer: { height: 60 },
    },
  },

  asideFooter: {
    name: "Aside + Footer",
    description: "Right sidebar with footer",
    config: {
      aside: { width: 300 },
      footer: { height: 60 },
    },
  },
};

/**
 * Get a preset configuration by name
 */
export function getLayoutPreset(presetName: string): LayoutPreset | undefined {
  return layoutPresets[presetName];
}

/**
 * Get all available preset names
 */
export function getLayoutPresetNames(): string[] {
  return Object.keys(layoutPresets);
}
