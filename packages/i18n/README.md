# @ottabase/i18n

Internationalization (i18n) package for the Ottabase monorepo, built with i18next and react-i18next.

## Features

- 🌍 Multi-language support (English, Spanish, French, German)
- 🔥 Type-safe translations with TypeScript
- ⚛️ React integration with hooks
- 🚀 Automatic language detection
- 💾 LocalStorage persistence
- 🎯 Namespace-based organization
- 📦 Tree-shakeable
- 🔄 Hot module replacement support

## Installation

This package is part of the Ottabase monorepo and uses pnpm workspaces.

```bash
pnpm add @ottabase/i18n
```

## Usage

### React Applications

```tsx
import { I18nProvider, useTranslation } from '@ottabase/i18n/react';

// Wrap your app with I18nProvider
function App() {
    return (
        <I18nProvider defaultLanguage="en">
            <YourApp />
        </I18nProvider>
    );
}

// Use the useTranslation hook in your components
function MyComponent() {
    const { t, i18n } = useTranslation('common');

    return (
        <div>
            <h1>{t('welcome')}</h1>
            <button onClick={() => i18n.changeLanguage('es')}>{t('language')}</button>
        </div>
    );
}
```

### Non-React Usage

```ts
import { initI18n, i18n } from '@ottabase/i18n';

// Initialize i18n
initI18n({ defaultLanguage: 'en' });

// Use translations
const message = i18n.t('common:welcome');
console.log(message); // "Welcome to Ottabase"

// Change language
i18n.changeLanguage('es');
console.log(i18n.t('common:welcome')); // "Bienvenido a Ottabase"
```

## Supported Languages

| Code | Language | Native Name |
| ---- | -------- | ----------- |
| `en` | English  | English     |
| `es` | Spanish  | Español     |
| `fr` | French   | Français    |
| `de` | German   | Deutsch     |

## Translation Structure

Translations are organized by namespace:

```
src/locales/
├── en/
│   └── common.json
├── es/
│   └── common.json
├── fr/
│   └── common.json
└── de/
    └── common.json
```

### Adding New Translations

1. Add the key to all language files in the same namespace
2. TypeScript will automatically provide autocomplete and type checking

Example:

```json
// src/locales/en/common.json
{
    "myNewKey": "My New Translation"
}
```

```tsx
// Your component
const { t } = useTranslation('common');
t('myNewKey'); // Type-safe and autocompleted!
```

## API Reference

### React API

#### `I18nProvider`

Wraps your application to provide i18n context.

**Props:**

- `children`: ReactNode - Your app components
- `defaultLanguage?`: SupportedLanguage - Fallback when no language is detected or persisted (does not override
  localStorage/navigator)
- `supportedLngs?`: readonly string[] - Languages the app allows (constrains package list; e.g. app `enabledLanguages`)
- `fallbackLng?`: string - Fallback when a translation is missing (defaults to defaultLanguage or 'en')
- `debug?`: boolean - Enable debug mode (default: false)
- `fallback?`: ReactNode - Loading fallback component

#### `useTranslation(namespace)`

Hook for using translations in components.

**Returns:**

- `t`: Translation function
- `i18n`: i18next instance
- `ready`: boolean - Whether translations are loaded

### Core API

#### `initI18n(options?)`

Initialize i18next instance.

**Options:**

- `defaultLanguage?`: SupportedLanguage - Used only when no language is detected (localStorage/navigator) or detected
  language is not in supportedLngs
- `supportedLngs?`: readonly string[] - Allowed languages (passed to i18next)
- `fallbackLng?`: string - Fallback for missing translations
- `debug?`: boolean

#### `supportedLanguages`

Array of supported language codes.

#### `languageNames`

Object mapping language codes to display names.

## Type Safety

The package provides full TypeScript support with autocomplete for translation keys:

```tsx
const { t } = useTranslation('common');

// ✅ TypeScript knows this key exists
t('welcome');

// ❌ TypeScript error - key doesn't exist
t('nonExistentKey');
```

## Development

```bash
# Build the package
pnpm build

# Watch mode for development
pnpm dev

# Type check
pnpm type-check

# Lint
pnpm lint
```

## License

MIT
