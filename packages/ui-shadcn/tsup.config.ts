import { defineConfig } from "tsup";

// List of all component entry points
const componentEntries = [
    // Main exports
    "src/index.ts",
    "src/providers.ts",
    // Individual components for tree-shaking
    "components/ui/accordion.tsx",
    "components/ui/alert-dialog.tsx",
    "components/ui/alert.tsx",
    "components/ui/aspect-ratio.tsx",
    "components/ui/avatar.tsx",
    "components/ui/badge.tsx",
    "components/ui/breadcrumb.tsx",
    "components/ui/button-group.tsx",
    "components/ui/button.tsx",
    "components/ui/calendar.tsx",
    "components/ui/card.tsx",
    "components/ui/carousel.tsx",
    "components/ui/checkbox.tsx",
    "components/ui/collapsible.tsx",
    "components/ui/command.tsx",
    "components/ui/context-menu.tsx",
    "components/ui/dialog.tsx",
    "components/ui/drawer.tsx",
    "components/ui/dropdown-menu.tsx",
    "components/ui/empty.tsx",
    "components/ui/field.tsx",
    "components/ui/form.tsx",
    "components/ui/hover-card.tsx",
    "components/ui/input-group.tsx",
    "components/ui/input-otp.tsx",
    "components/ui/input.tsx",
    "components/ui/item.tsx",
    "components/ui/kbd.tsx",
    "components/ui/label.tsx",
    "components/ui/menubar.tsx",
    "components/ui/native-select.tsx",
    "components/ui/navigation-menu.tsx",
    "components/ui/pagination.tsx",
    "components/ui/popover.tsx",
    "components/ui/progress.tsx",
    "components/ui/radio-group.tsx",
    "components/ui/resizable.tsx",
    "components/ui/scroll-area.tsx",
    "components/ui/select.tsx",
    "components/ui/separator.tsx",
    "components/ui/sheet.tsx",
    "components/ui/sidebar.tsx",
    "components/ui/skeleton.tsx",
    "components/ui/slider.tsx",
    "components/ui/spinner.tsx",
    "components/ui/switch.tsx",
    "components/ui/table.tsx",
    "components/ui/tabs.tsx",
    "components/ui/textarea.tsx",
    "components/ui/toaster.tsx",
    "components/ui/toggle-group.tsx",
    "components/ui/toggle.tsx",
    "components/ui/tooltip.tsx",
];

// Use named entry points so the output file layout matches package.json exports
// (e.g. dist/index.*, dist/accordion.*, dist/providers.*)
const entry = Object.fromEntries(
    componentEntries.map((filePath) => {
        const fileName = filePath.split("/").pop() ?? filePath;
        const baseName = fileName.replace(/\.(tsx|ts)$/u, "");
        return [baseName, filePath];
    })
) as Record<string, string>;

export default defineConfig({
  entry,
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  // Disable bundling so "use client" stays at the top of each component file.
  bundle: false,
  splitting: false,
  external: ["react", "react-dom"],
});
