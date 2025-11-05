# Mantine Demo

This directory contains a complete demonstration of how to integrate **Mantine UI** into the Ottabase template app.

## Structure

The Mantine demo is organized as a nested route under `/demo/mantine` with its own layout that adds the Mantine providers:

```
app/
├── providers.tsx              # Main app providers (UI Base only, NO Mantine)
├── page.tsx                   # Home page (uses UI Base/shadcn only)
└── demo/
    ├── layout.tsx             # Demo section layout (NO Mantine)
    ├── page.tsx               # Demo gallery index
    └── mantine/               # 👈 Mantine-specific demo
        ├── layout.tsx         # Adds ProviderUIMantine + ThemeProvider
        ├── page.tsx           # Full Mantine components demo
        ├── components/
        │   └── ThemeSwitcher.tsx
        └── lib/
            └── themeContext.tsx
```

## Key Files

### [layout.tsx](layout.tsx)
This layout wraps all `/demo/mantine/*` routes and adds the Mantine providers:
- `ProviderUIMantine` - Mantine's theme provider with custom themes and colors
- `ThemeProvider` - Custom theme context for switching between Mantine theme presets

### [page.tsx](page.tsx)
The main demo page showcasing:
- Mantine components (Button, Card, Text, Title, etc.)
- Theme switching between different Mantine theme presets
- Global state management with Jotai
- OttaSelect component integration
- Dark mode toggle
- Font family demonstrations

### [components/ThemeSwitcher.tsx](components/ThemeSwitcher.tsx)
A custom component that allows switching between different Mantine theme presets:
- mantine-shadcn (minimal design)
- mantine-vercel (high-contrast)
- mantine-ant (enterprise design)
- mantine-stripe (fintech aesthetic)
- app-override (custom brand colors)

## How to Use Mantine in Your App

If you want to use Mantine throughout your entire app:

1. **Update main providers**: Edit [app/providers.tsx](../../providers.tsx) to include `ProviderUIMantine`:

```tsx
import { ProviderUIMantine } from "@ottabase/ui-mantine";
import { THEME_COLORS } from "@/ottabase/config/app.config";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ProviderState>
      <ProviderUIBase {...}>
        <ProviderFont {...}>
          <ProviderUIMantine
            storagePrefix={appConfig.storage.prefix}
            themeColors={THEME_COLORS}
            primaryColor={appConfig.theme.colorDefault}
          >
            <ProviderNextThemes {...}>
              {/* ... rest of your providers */}
            </ProviderNextThemes>
          </ProviderUIMantine>
        </ProviderFont>
      </ProviderUIBase>
    </ProviderState>
  );
}
```

2. **Use Mantine components**: Import and use Mantine components anywhere in your app:

```tsx
import { Button, Card, Text } from "@mantine/core";

export default function MyPage() {
  return (
    <Card>
      <Text>Hello from Mantine!</Text>
      <Button>Click me</Button>
    </Card>
  );
}
```

## Using Mantine Only in Specific Routes

If you only want Mantine in certain sections (like this demo):

1. **Keep main providers clean**: Don't add `ProviderUIMantine` to the main app providers
2. **Create a nested layout**: Add a `layout.tsx` in your route directory
3. **Add Mantine provider**: Wrap your nested layout content with `ProviderUIMantine`

This is exactly what this demo does - Mantine is only available under `/demo/mantine/*` routes.

## Benefits of This Approach

- **UI Base as foundation**: The main app uses UI Base which is lightweight and flexible
- **Optional Mantine**: Add Mantine only where needed to keep bundle size smaller
- **Easy to understand**: Clear separation shows exactly what's needed for Mantine
- **Mix and match**: Use shadcn/ui for some pages, Mantine for others

## Related Demos

- `/demo/shadcn` - shadcn/ui components demo (uses UI Base + Tailwind)
- `/demo/ottaeditor` - Rich text editor demo
