# OttaLayout Demo

This demo showcases the `@ottabase/ottalayout` package - a standalone layout system built with CSS Grid and React.

## Features Demonstrated

### 🎨 Layout Presets
- 13 different preset configurations
- Switch between presets using the top-right switcher
- Smooth transitions between layouts

### 📐 Layout Sections
- **Header** - Top section with app branding
- **Footer** - Bottom section with links
- **Navbar** - Left sidebar navigation
- **Aside** - Right sidebar for activity feed
- **Main** - Central content area

### ⚡ Technical Features
- CSS Grid-based layout system
- 300ms smooth transitions
- Zero external UI library dependencies
- Responsive design
- TypeScript support

## Stub Components

The demo uses stub components to demonstrate the layout system:

- `HeaderStub.tsx` - Purple gradient header with branding
- `FooterStub.tsx` - Dark footer with links
- `NavbarStub.tsx` - Navigation menu with icons
- `AsideStub.tsx` - Activity feed sidebar
- `LayoutSwitcher.tsx` - Preset selector (absolutely positioned)

## Available Presets

1. **default** - Header with navbar sidebar
2. **headerOnly** - Simple header layout
3. **headerFooter** - Header and footer layout
4. **navbarOnly** - Left sidebar navigation
5. **fullLayout** - Header, footer, navbar, and aside
6. **asideOnly** - Right sidebar only
7. **doubleNavbar** - Left navbar and right aside
8. **headerNavbar** - Header with left sidebar
9. **headerAside** - Header with right sidebar
10. **headerNavbarFooter** - Header, footer with left sidebar
11. **headerAsideFooter** - Header, footer with right sidebar
12. **navbarFooter** - Left sidebar with footer
13. **asideFooter** - Right sidebar with footer

## Usage

```tsx
import { OttaLayout, getLayoutPreset } from "@ottabase/ottalayout";
import "@ottabase/ottalayout/styles";

const preset = getLayoutPreset("fullLayout");

<OttaLayout
  header={{ height: 60, children: <Header /> }}
  navbar={{ width: 300, children: <Nav /> }}
  aside={{ width: 300, children: <Aside /> }}
  footer={{ height: 60, children: <Footer /> }}
>
  <MainContent />
</OttaLayout>
```

## Try It

Navigate to `/demo/ottalayout` to see the live demo and explore all layout presets!
