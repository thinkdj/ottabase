# @ottabase/ui-icons

Unified icon package for Ottabase applications. Provides direct access to Lucide and Tabler icon libraries through a single dependency.

## Why This Package?

- **Single Dependency**: Install one package, get access to both Lucide (~1,400 icons) and Tabler (5,000+ icons)
- **Developer Freedom**: Import any icon directly from either library
- **Curated Common Set**: Quick access to frequently used icons via `Icon.*`
- **Tree Shakeable**: Only imports the icons you actually use
- **No Abstractions**: Direct re-exports mean you get the full native API of each library

## Installation

```bash
pnpm add @ottabase/ui-icons
```

This will automatically install `lucide-react` and `@tabler/icons-react` as dependencies.

## Usage

### Option 1: Curated Common Icons (Recommended for consistency)

Use the pre-selected `Icon` object for commonly used icons:

```tsx
import { Icon } from '@ottabase/ui-icons';

function MyComponent() {
  return (
    <div>
      <Icon.Home size={24} />
      <Icon.Search size={20} color="blue" />
      <Icon.Settings strokeWidth={1.5} />
    </div>
  );
}
```

### Option 2: Import Directly from Lucide

Get full access to all Lucide icons (~1,400 icons):

```tsx
import { Home, Search, Settings, Zap, Coffee } from '@ottabase/ui-icons/lucide';

function MyComponent() {
  return (
    <div>
      <Home size={24} color="currentColor" />
      <Zap size={20} strokeWidth={2} />
      <Coffee className="my-icon" />
    </div>
  );
}
```

**Lucide Props:**
- `size?: number | string` - Icon size (default: 24)
- `color?: string` - Icon color (default: "currentColor")
- `strokeWidth?: number` - Stroke width (default: 2)
- Plus all standard SVG props

**See all Lucide icons:** https://lucide.dev/icons/

### Option 3: Import Directly from Tabler

Get full access to all Tabler icons (5,000+ icons):

```tsx
import { IconHome, IconSearch, IconSettings, IconBolt } from '@ottabase/ui-icons/tabler';

function MyComponent() {
  return (
    <div>
      <IconHome size={24} stroke={1.5} />
      <IconBolt size={20} color="blue" />
      <IconSettings className="my-icon" />
    </div>
  );
}
```

**Tabler Props:**
- `size?: number` - Icon size (default: 24)
- `color?: string` - Icon color (default: "currentColor")
- `stroke?: number` - Stroke width (default: 2)
- Plus all standard SVG props

**See all Tabler icons:** https://tabler.io/icons

## Available Icons in Curated Set

The `Icon` object provides quick access to these commonly used icons:

**Navigation:** Menu, Close, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Home, Search, Settings, MoreVertical, MoreHorizontal

**Actions:** Plus, Minus, Edit, Trash, Save, Copy, Download, Upload, Share, ExternalLink, Refresh, Check, CheckCircle

**Files:** File, FileText, Folder, FolderOpen, Image

**Communication:** Mail, Send, MessageSquare, Bell, Phone

**Users:** User, Users, UserPlus, Lock, Unlock, LogIn, LogOut

**Status:** Info, AlertCircle, AlertTriangle, HelpCircle, XCircle, Loader, Loader2

**Data:** Database, Table, Grid, List, BarChart, PieChart, LineChart

**Development:** Code, Terminal, GitBranch, Package, Cpu, Server

**UI:** Eye, EyeOff, Star, Heart, Bookmark, Filter, Calendar, Clock, Sun, Moon

**Media:** Play, Pause, Volume, VolumeX, Camera

**Commerce:** ShoppingCart, CreditCard, DollarSign

## Examples

### Dark Mode Toggle

```tsx
import { Icon } from '@ottabase/ui-icons';

function DarkModeToggle({ isDark, toggle }: Props) {
  return (
    <button onClick={toggle}>
      {isDark ? <Icon.Sun size={20} /> : <Icon.Moon size={20} />}
    </button>
  );
}
```

### Loading Spinner

```tsx
import { Icon } from '@ottabase/ui-icons';

function LoadingSpinner() {
  return <Icon.Loader2 size={24} className="animate-spin" />;
}
```

### Navigation with Custom Icons

```tsx
import { Home, Settings } from '@ottabase/ui-icons/lucide';
import { IconDatabase, IconChartBar } from '@ottabase/ui-icons/tabler';

const menuItems = [
  { icon: Home, label: 'Home' },
  { icon: IconDatabase, label: 'Database' },
  { icon: IconChartBar, label: 'Analytics' },
  { icon: Settings, label: 'Settings' },
];

function NavMenu() {
  return (
    <nav>
      {menuItems.map(({ icon: IconComponent, label }) => (
        <a key={label} href={`/${label.toLowerCase()}`}>
          <IconComponent size={20} />
          <span>{label}</span>
        </a>
      ))}
    </nav>
  );
}
```

## Package Structure

```
@ottabase/ui-icons/
├── index.ts          # Curated Icon object
├── lucide.ts         # Re-exports all lucide-react
└── tabler.ts         # Re-exports all @tabler/icons-react
```

## TypeScript Support

Full TypeScript support is included. All icon components are properly typed with autocomplete support.

```tsx
import type { LucideProps } from '@ottabase/ui-icons/lucide';
import type { TablerIconsProps } from '@ottabase/ui-icons/tabler';
```

## Development

```bash
# Install dependencies
pnpm install

# Build the package
pnpm build

# Watch mode
pnpm dev

# Type checking
pnpm type-check

# Linting
pnpm lint
```

## Choosing Between Lucide and Tabler

**Use Lucide when:**
- You want simpler, cleaner icons
- You prefer consistent stroke widths
- You're building minimalist UIs
- The icon you need is available (~1,400 options)

**Use Tabler when:**
- You need more specialized icons
- You want more detailed designs
- Lucide doesn't have the icon you need
- You prefer their specific style (5,000+ options)

**Use the curated `Icon` set when:**
- You want consistency across your app
- You're using common UI icons
- You want the simplest imports

## License

MIT
