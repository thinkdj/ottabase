import type { Preview } from "@storybook/react-webpack5";
import React from "react";
/* Import CSS from core/providers here */
import "../packages/ui-core/styles/index.css";
import "../packages/ui-tailwind/styles/tailwind.base.css";
import { StoryShell } from "./StoryShell";

export const parameters: Preview["parameters"] = {
  layout: "centered",
  controls: {
    matchers: {
      color: /(background|color)$/i,
      date: /Date$/,
    },
  },
  docs: {
    source: {
      state: "open",
    },
    // Keep the "Show code" section open by default
    canvas: {
      sourceState: "shown",
    },
  },
  options: {
    storySort: {
      method: "alphabetical",
      order: ["Packages", "Apps"],
    },
  },
  backgrounds: {
    options: {
      light: {
        name: "light",
        value: "#ffffff",
      },

      dark: {
        name: "dark",
        value: "#111827",
      }
    }
  },
};

const withOttabaseShell = (Story: any, context: any) => {
  // Enhanced dark mode detection from Storybook's background controls
  const backgroundValue = context.globals.backgrounds?.value;
  const isDark =
    backgroundValue === "#111827" ||
    backgroundValue === "dark" ||
    context.parameters.backgrounds?.default === "dark";
  const theme = isDark ? "dark" : "light";

  // Apply theme class to document and body for better dark mode support
  // Use React.useEffect to avoid triggering re-renders
  React.useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.classList.remove("light", "dark");
      document.documentElement.classList.add(theme);
      document.body.classList.remove("light", "dark");
      document.body.classList.add(theme);

      // Also set data attribute for additional CSS targeting
      document.documentElement.setAttribute("data-theme", theme);
      document.documentElement.setAttribute("data-mantine-color-scheme", theme);
    }
  }, [theme]);

  return (
    <StoryShell>
      <Story />
    </StoryShell>
  );
};

export const decorators = [withOttabaseShell];

export const initialGlobals = {
  backgrounds: {
    value: "light"
  }
};
