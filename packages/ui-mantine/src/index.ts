// Main exports for the Mantine UI package
export { default as ProviderUIMantine } from "../provider/ProviderUI";

// Re-export types
export type { ThemeColors } from "../provider/ProviderUI";

// Export themes
export { default as mantineShadcn } from "../themes/mantine-shadcn";
export { default as mantineVercel } from "../themes/mantine-vercel";
export { default as mantineAnt } from "../themes/mantine-ant";
export { default as mantineStripe } from "../themes/mantine-stripe";

// Export theme configuration utilities
export type { MantineThemeConfig } from "./themeConfig";
export { createMantineTheme, validateMantineThemeConfig } from "./themeConfig";

// Re-export commonly used Mantine components
export {
  Badge,
  Button,
  Card,
  Code,
  Container,
  Group,
  Slider,
  Stack,
  Switch,
  Text,
  Title,
  // Add more as needed
} from "@mantine/core";

// Re-export Mantine hooks
export {
  useDisclosure,
  useToggle,
  useHover,
  useClickOutside,
  // Add more as needed
} from "@mantine/hooks";

// Re-export types from Mantine
export type {
  MantineTheme,
  MantineColorScheme,
  MantineColor,
  MantineSize,
  MantineSpacing,
  MantineRadius,
  MantineShadow,
} from "@mantine/core";
