# @ottabase/i18n — agent notes

i18next/react-i18next wrapper with bundled locales (en/es/fr/de), browser detection, and localStorage persistence. Full docs: ./README.md

## Use when

- Any user-facing text needing translation, language switching, or locale detection (otta-web or plain Node/TS code).
- NOT for number/date/currency formatting — use `Intl` directly; this package handles translation strings only.

## Imports

```ts
import { initI18n, i18n, resources, supportedLanguages, languageNames, defaultNS, DEFAULT_LANGUAGE_STORAGE_KEY, type InitI18nOptions, type SupportedLanguage } from '@ottabase/i18n';
import { I18nProvider, initReactI18n, useTranslation, Trans, i18n, supportedLanguages, languageNames } from '@ottabase/i18n/react';
```

`react-i18next` and `react` are peer deps (catalog:) — the consuming app must provide them.

## Canonical usage

```tsx
// React app root
import { I18nProvider } from '@ottabase/i18n/react';

<I18nProvider defaultLanguage='en'>
    <YourApp />
</I18nProvider>;
```

```tsx
// Component
import { useTranslation } from '@ottabase/i18n/react';
const { t } = useTranslation('common');
return <h1>{t('welcome')}</h1>;
```

```ts
// Non-React (Node/tests)
import { initI18n, i18n } from '@ottabase/i18n';
await initI18n({ defaultLanguage: 'en' });
const s = i18n.t('common:welcome');
```

## Gotchas

- `defaultLanguage` is a fallback, not an override: detection order is localStorage → navigator → defaultLanguage.
- `initI18n` is a no-op once initialized — custom `resources`/options apply only on the first call.
- React apps must go through `I18nProvider`/`initReactI18n`, never `initI18n` directly: the React plugin must register before init.
- `I18nProvider` does not re-init on `resources` prop changes (deliberately excluded from its effect deps); memoize or set on mount.
- Language persists in localStorage under `ottabase.language` (`DEFAULT_LANGUAGE_STORAGE_KEY`); override via `lookupLocalStorage`.
- `load: 'languageOnly'` — region codes normalize to base (en-US → en).
