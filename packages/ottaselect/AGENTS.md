# @ottabase/ottaselect — agent notes

React dropdown/select component: single/multi mode, search, chips, async fetch. Full docs: ./README.md

## Use when

- Building a React UI that needs a searchable select — single or multi, custom item renderers, chips, async/paginated data.
- NOT for non-React or server-side/edge code (requires react/react-dom peers and Tailwind classes in scope).

## Imports

```ts
import { OttaSelect } from '@ottabase/ottaselect';
import type { OttaSelectProps, OttaSelectItem, OttaSelectInputItem, OttaSelectSize, ItemRendererProps } from '@ottabase/ottaselect';
// Subpath alias (same component; ItemRendererProps not re-exported here):
import { OttaSelect } from '@ottabase/ottaselect/ottaselect';
```

## Canonical usage

```tsx
const [value, setValue] = useState<OttaSelectItem | null>(null);
<OttaSelect items={fruits} value={value} onChange={setValue} placeholder="Pick one" />;
```

```tsx
// Multi-select with chips (showChips default true)
const [selected, setSelected] = useState<OttaSelectItem[] | null>(null);
<OttaSelect mode="multiple" items={items} value={selected} onChange={setSelected} />;
```

```tsx
// Async fetch (API/CrudHub); selected items stay visible across pages
<OttaSelect
    mode="single"
    fetchCollection={async (searchQuery) => (await fetch(`/api/users?search=${searchQuery}`)).json()}
    value={selectedUser}
    onChange={setSelectedUser}
    searchDebounceMs={300}
/>;
```

## Gotchas

- Output items are normalized: `id` coerced to string, `name` from `name || label || title`; rest of the object is spread through.
- `onChange` payload depends on `mode`: single item (or null) vs array.
- Tailwind-based styling: consumer's tailwind `content` globs must include this package's src; sizes (`xs|sm|md|lg`) scale via `--spacing-element` and `--radius` CSS vars.
- With `fetchCollection`, selected items persist in the dropdown even if absent from results (`showSelectedFirst` default true).
