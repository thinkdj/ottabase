# Homepage Data Integration Plan

> Comprehensive plan to migrate hardcoded homepage content (title, description, features, CTAs) to database-backed sources using Ottabase OttaORM.

---

## Overview

Currently, all homepage data is hardcoded in `app/page.tsx` as constants (HERO_DATA, FEATURES_DATA, CTA_DATA). This plan integrates Cloudflare D1 + OttaORM to:
- Store homepage sections and content in the database
- Support dynamic editing via admin APIs
- Maintain type safety and single source of truth
- Enable multi-tenant homepage configurations
- Allow admin users to edit content without code changes

---

## Phase 1: Schema & ORM Models

### 1.1 Create HomepageSection Model

The `HomepageSection` model represents a top-level slot (hero, features, cta).

**Schema Definition** (`ottabase/models/HomepageSection.ts`):

```typescript
import { sqliteTable, text, integer, boolean as sqliteBoolean } from 'drizzle-orm/sqlite-core';
import { BaseModel } from '@ottabase/ottaorm';

// Table schema
export const homepageSectionsTable = sqliteTable('homepage_sections', {
    id: text('id').primaryKey(),
    slot: text('slot', { enum: ['hero', 'features', 'cta'] }).notNull().unique(), // One section per slot
    title: text('title'),
    subtitle: text('subtitle'),
    description: text('description'),
    contentJson: text('contentJson'), // Flex field: stores complex data as JSON
    isActive: sqliteBoolean('is_active').default(true),
    sortOrder: integer('sort_order').default(0),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// ORM Model
export class HomepageSection extends BaseModel {
    static entity = 'homepage_sections';
    static table = homepageSectionsTable;
    static primaryKey = 'id';

    static casts = {
        isActive: 'boolean',
        contentJson: 'json', // Auto-parse JSON field
    };

    /**
     * Get all active sections, ordered for display
     */
    static async getAllActive() {
        return this.query()
            .where('isActive', '=', true)
            .orderBy('sortOrder', 'asc')
            .get();
    }

    /**
     * Get section by slot name
     */
    static async bySlot(slot: 'hero' | 'features' | 'cta') {
        return this.query()
            .where('slot', '=', slot)
            .first();
    }
}
```

### 1.2 Create HomepageFeature Model

Represents individual feature items (title, description, icon).

**Schema Definition** (`ottabase/models/HomepageFeature.ts`):

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { BaseModel } from '@ottabase/ottaorm';

export const homepageFeaturesTable = sqliteTable('homepage_features', {
    id: text('id').primaryKey(),
    sectionId: text('section_id').references(() => homepageSectionsTable.id),
    title: text('title').notNull(),
    description: text('description').notNull(),
    icon: text('icon'), // icon name/slug (e.g., 'rocket', 'palette')
    sortOrder: integer('sort_order').default(0),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export class HomepageFeature extends BaseModel {
    static entity = 'homepage_features';
    static table = homepageFeaturesTable;
    static primaryKey = 'id';

    /**
     * Belongs to HomepageSection
     */
    async section() {
        const { HomepageSection } = await import('./HomepageSection');
        return this.belongsTo(HomepageSection, 'sectionId');
    }

    /**
     * Get features for a section, ordered
     */
    static async forSection(sectionId: string) {
        return this.query()
            .where('sectionId', '=', sectionId)
            .orderBy('sortOrder', 'asc')
            .get();
    }
}
```

### 1.3 Create HomepageAction Model

Represents CTA buttons (label, href, variant, icon).

**Schema Definition** (`ottabase/models/HomepageAction.ts`):

```typescript
import { sqliteTable, text, integer, boolean as sqliteBoolean } from 'drizzle-orm/sqlite-core';
import { BaseModel } from '@ottabase/ottaorm';

export const homepageActionsTable = sqliteTable('homepage_actions', {
    id: text('id').primaryKey(),
    sectionId: text('section_id').references(() => homepageSectionsTable.id),
    label: text('label').notNull(),
    href: text('href').notNull(),
    variant: text('variant', { enum: ['default', 'secondary', 'outline', 'ghost'] }).default('default'),
    icon: text('icon'), // icon name/slug
    isExternal: sqliteBoolean('is_external').default(false),
    sortOrder: integer('sort_order').default(0),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export class HomepageAction extends BaseModel {
    static entity = 'homepage_actions';
    static table = homepageActionsTable;
    static primaryKey = 'id';

    async section() {
        const { HomepageSection } = await import('./HomepageSection');
        return this.belongsTo(HomepageSection, 'sectionId');
    }

    /**
     * Get actions for a section, ordered
     */
    static async forSection(sectionId: string) {
        return this.query()
            .where('sectionId', '=', sectionId)
            .orderBy('sortOrder', 'asc')
            .get();
    }
}
```

---

## Phase 2: Database Configuration

### 2.1 Update D1 Binding

Add or ensure D1 is configured in `wrangler.jsonc`:

```jsonc
{
    "d1": {
        "bindings": [
            {
                "binding": "OBCF_D1",
                "database_name": "ottabase-homepage",
                "database_id": "YOUR_DATABASE_ID",
            }
        ]
    },
    "env": {
        "staging": {
            "d1": {
                "bindings": [
                    {
                        "binding": "OBCF_D1",
                        "database_name": "ottabase-homepage-staging",
                        "preview": true,
                    }
                ]
            }
        }
    }
}
```

### 2.2 Export Tables in Schema

Update `ottabase/db/schema.ts`:

```typescript
// Export D1 / Drizzle schemas for auto-migration and codegen
export { homepageSectionsTable } from '../models/HomepageSection';
export { homepageFeaturesTable } from '../models/HomepageFeature';
export { homepageActionsTable } from '../models/HomepageAction';
```

### 2.3 Register Models in DB Utils

Create or update `ottabase/lib/db-utils.ts` to register models for CRUD API:

```typescript
import { HomepageSection, HomepageFeature, HomepageAction } from '../models';

export function initDbConnection(env: CloudflareEnv) {
    const driver = createD1Driver(env.OBCF_D1);
    setDriver(driver);

    // Register models for auto-CRUD API
    registerModels([
        HomepageSection,
        HomepageFeature,
        HomepageAction,
        // ... other models
    ]);
}
```

---

## Phase 3: API Routes

### 3.1 Auto-CRUD Endpoints

Once models are registered, these endpoints auto-generate:

- `GET /api/ottaorm/homepage_sections` — List all sections
- `GET /api/ottaorm/homepage_sections/:id` — Get one section
- `POST /api/ottaorm/homepage_sections` — Create section
- `PATCH /api/ottaorm/homepage_sections/:id` — Update section
- `DELETE /api/ottaorm/homepage_sections/:id` — Delete section
- (Same for features and actions)

### 3.2 Custom Endpoint: Fetch Full Homepage Data

Create `worker/routes/homepage.ts`:

```typescript
import { HomepageSection, HomepageFeature, HomepageAction } from '../ottabase/models';

/**
 * GET /api/homepage/data
 * Fetch complete homepage structure with all nested content
 * Response: { sections: [{ slot, title, ..., features: [...], actions: [...] }] }
 */
export async function getHomepageData() {
    const sections = await HomepageSection.getAllActive();

    const enriched = await Promise.all(
        sections.map(async (section) => {
            const features = await HomepageFeature.forSection(section.id);
            const actions = await HomepageAction.forSection(section.id);

            return {
                ...section.toJSON(),
                features: features.map((f) => f.toJSON()),
                actions: actions.map((a) => a.toJSON()),
            };
        })
    );

    return enriched;
}
```

### 3.3 Custom Endpoint: Seed Initial Data

Create `worker/routes/homepage-seed.ts`:

```typescript
import { HomepageSection, HomepageFeature, HomepageAction } from '../ottabase/models';

/**
 * POST /api/homepage/seed
 * Populate DB with initial homepage content (matches current hardcoded data)
 * Only runs if tables are empty; idempotent.
 * Requires admin/bootstrap authentication.
 */
export async function seedHomepageData() {
    const existingHero = await HomepageSection.bySlot('hero');
    if (existingHero) {
        return { message: 'Homepage already seeded' };
    }

    // Create Hero Section
    const heroSection = await HomepageSection.create({
        id: 'section-hero',
        slot: 'hero',
        title: 'Ottabase Homepage on Next.js',
        subtitle: 'Ship a themed, edge-deployed homepage on Cloudflare Workers in minutes.',
    });

    // Create Hero Actions (buttons)
    await HomepageAction.create({
        id: 'action-hero-1',
        sectionId: heroSection.id,
        label: 'About',
        href: '/about',
        variant: 'default',
        sortOrder: 0,
    });

    await HomepageAction.create({
        id: 'action-hero-2',
        sectionId: heroSection.id,
        label: 'Theme Demo',
        href: '/theme-demo',
        variant: 'secondary',
        icon: 'palette',
        sortOrder: 1,
    });

    // Create Features Section
    const featuresSection = await HomepageSection.create({
        id: 'section-features',
        slot: 'features',
        title: 'Features & Capabilities',
    });

    // Create Feature Items
    const featureData = [
        { title: 'Cloudflare Workers', description: 'Edge-deployed via OpenNext. No origin server needed.' },
        { title: 'Brand Engine', description: '8 theme presets with live switching and dark mode.' },
        { title: 'Next.js 16', description: 'App Router, RSC, and streaming out of the box.' },
        { title: 'TypeScript', description: 'End-to-end type safety across client and server.' },
    ];

    for (const [idx, feature] of featureData.entries()) {
        await HomepageFeature.create({
            id: `feature-${idx}`,
            sectionId: featuresSection.id,
            title: feature.title,
            description: feature.description,
            sortOrder: idx,
        });
    }

    // Create CTA Section
    const ctaSection = await HomepageSection.create({
        id: 'section-cta',
        slot: 'cta',
        title: 'Ready to Ship?',
        description: 'Clone the template, customize the brand, and deploy to Cloudflare Workers in minutes.',
    });

    await HomepageAction.create({
        id: 'action-cta-1',
        sectionId: ctaSection.id,
        label: 'Get Started',
        href: 'https://github.com/thinkdj/ottabase',
        variant: 'default',
        icon: 'rocket',
        isExternal: true,
        sortOrder: 0,
    });

    await HomepageAction.create({
        id: 'action-cta-2',
        sectionId: ctaSection.id,
        label: 'Explore Themes',
        href: '/theme-demo',
        variant: 'outline',
        sortOrder: 1,
    });

    return { message: 'Homepage data seeded successfully' };
}
```

---

## Phase 4: Frontend Integration

### 4.1 Create Server Hook to Fetch Data

Create `lib/get-homepage-data.ts`:

```typescript
import { cache } from 'react';

/**
 * Server-side cached fetch for homepage data.
 * Called from page.tsx; results cached for the request lifecycle.
 * In SSR, data is fetched once and embedded in HTML.
 * In ISR/static, can use revalidate: 3600 (1 hour).
 */
export const getHomepageData = cache(async () => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3004';

    try {
        const response = await fetch(`${baseUrl}/api/homepage/data`, {
            headers: { 'Content-Type': 'application/json' },
            next: { revalidate: 3600 }, // ISR: revalidate every 1 hour
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch homepage data: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching homepage data:', error);

        // Return empty structure on error (graceful fallback)
        return {
            sections: [],
        };
    }
});
```

### 4.2 Update page.tsx to Use Database Data

Refactor `app/page.tsx`:

```typescript
import { SlotRenderer } from '../components/SlotRenderer';
import { getHomepageData } from '../lib/get-homepage-data';

/**
 * Homepage — server component.
 * Fetches all sections from database via API.
 * Passes structured data to SlotRenderer.
 */
export default async function HomePage() {
    const sections = await getHomepageData();

    // Find sections by slot for rendering
    const heroSection = sections.find((s) => s.slot === 'hero');
    const featuresSection = sections.find((s) => s.slot === 'features');
    const ctaSection = sections.find((s) => s.slot === 'cta');

    return (
        <div className="flex flex-col items-center">
            {heroSection && (
                <SlotRenderer
                    slot="hero"
                    data={{
                        title: heroSection.title,
                        subtitle: heroSection.subtitle,
                        actions: heroSection.actions,
                    }}
                />
            )}

            {featuresSection && (
                <SlotRenderer
                    slot="features"
                    data={{
                        features: featuresSection.features.map((f) => ({
                            title: f.title,
                            description: f.description,
                            icon: f.icon,
                        })),
                    }}
                />
            )}

            {ctaSection && (
                <SlotRenderer
                    slot="cta"
                    data={{
                        title: ctaSection.title,
                        description: ctaSection.description,
                        actions: ctaSection.actions,
                    }}
                />
            )}
        </div>
    );
}
```

### 4.3 Add NEXT_PUBLIC_API_URL to .env.local

```bash
# For local development with Wrangler running on port 3004
NEXT_PUBLIC_API_URL=http://localhost:3004

# For production
# NEXT_PUBLIC_API_URL=https://api.ottabase.dev
```

---

## Phase 5: Admin API & Authentication

### 5.1 Add Authentication Guard

Create `worker/middleware/admin-guard.ts`:

```typescript
import { errorResponse } from '@ottabase/utils/http-errors';

/**
 * Middleware to check admin permissions.
 * Should be applied to any update/delete endpoints for homepage content.
 */
export async function requireAdmin(request: Request, context: any) {
    // Extract user from auth context (assumes Auth.js or similar is set up)
    const user = context.user;

    if (!user || !user.role || user.role !== 'admin') {
        return errorResponse('Unauthorized: Admin role required', { status: 403 });
    }

    return null; // Allowed
}
```

### 5.2 Create Admin Update Endpoint

Create `worker/routes/homepage-admin.ts`:

```typescript
import { HomepageSection, HomepageFeature, HomepageAction } from '../ottabase/models';
import { requireAdmin } from '../middleware/admin-guard';

/**
 * PATCH /api/homepage/sections/:id
 * Update a homepage section (admin only)
 */
export async function updateSection(request: Request, params: { id: string }, context: any) {
    // Check permissions
    const authError = await requireAdmin(request, context);
    if (authError) return authError;

    const data = await request.json();
    const section = await HomepageSection.find(params.id);

    if (!section) {
        return errorResponse('Section not found', { status: 404 });
    }

    // Update fields
    section.set('title', data.title);
    section.set('subtitle', data.subtitle);
    section.set('description', data.description);

    await section.save();

    return new Response(JSON.stringify(section.toJSON()), {
        headers: { 'Content-Type': 'application/json' },
    });
}

/**
 * DELETE /api/homepage/features/:id
 * Delete a feature item (admin only)
 */
export async function deleteFeature(request: Request, params: { id: string }, context: any) {
    const authError = await requireAdmin(request, context);
    if (authError) return authError;

    const feature = await HomepageFeature.find(params.id);
    if (!feature) {
        return errorResponse('Feature not found', { status: 404 });
    }

    await feature.delete();

    return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
    });
}
```

---

## Phase 6: Client-Side Admin Panel (Optional)

### 6.1 Create Admin Edit Component

Create `components/HomepageAdmin.tsx` (CSR):

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@ottabase/ui-shadcn';

type Section = {
    id: string;
    slot: string;
    title?: string;
    subtitle?: string;
    description?: string;
    features?: Array<{ id: string; title: string; description: string }>;
    actions?: Array<{ id: string; label: string; href: string }>;
};

export function HomepageAdmin() {
    const [sections, setSections] = useState<Section[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingSection, setEditingSection] = useState<Section | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            const res = await fetch('/api/homepage/data');
            const data = await res.json();
            setSections(data);
            setLoading(false);
        };

        fetchData();
    }, []);

    const handleUpdate = async () => {
        if (!editingSection) return;

        const res = await fetch(`/api/homepage/sections/${editingSection.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(editingSection),
        });

        if (res.ok) {
            setSections((prev) => prev.map((s) => (s.id === editingSection.id ? editingSection : s)));
            setEditingSection(null);
        }
    };

    if (loading) return <div>Loading...</div>;

    if (!editingSection) {
        return (
            <div className="space-y-4">
                <h2 className="text-2xl font-bold">Edit Homepage</h2>
                {sections.map((section) => (
                    <div key={section.id} className="border p-4 rounded">
                        <h3 className="font-bold">{section.slot}</h3>
                        <p className="text-sm text-muted-foreground">{section.title}</p>
                        <Button onClick={() => setEditingSection(section)} className="mt-2">
                            Edit
                        </Button>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <h3>Editing: {editingSection.slot}</h3>
            <input
                type="text"
                value={editingSection.title || ''}
                onChange={(e) =>
                    setEditingSection({
                        ...editingSection,
                        title: e.target.value,
                    })
                }
                placeholder="Title"
                className="w-full border p-2 rounded"
            />
            <textarea
                value={editingSection.subtitle || ''}
                onChange={(e) =>
                    setEditingSection({
                        ...editingSection,
                        subtitle: e.target.value,
                    })
                }
                placeholder="Subtitle"
                className="w-full border p-2 rounded"
            />
            <div className="flex gap-2">
                <Button onClick={handleUpdate}>Save</Button>
                <Button onClick={() => setEditingSection(null)} variant="outline">
                    Cancel
                </Button>
            </div>
        </div>
    );
}
```

---

## Phase 7: Migrations & Deployment

### 7.1 Create Database Migration

Run auto-migration:

```bash
# Ensure environment has CLOUDFLARE_API_TOKEN set
curl -X POST http://localhost:3004/api/ottaorm/init
```

Or manually create a migration file `ottabase/migrations/001_homepage_schema.sql`:

```sql
-- Homepage Sections Table
CREATE TABLE IF NOT EXISTS homepage_sections (
    id TEXT PRIMARY KEY,
    slot TEXT NOT NULL UNIQUE CHECK(slot IN ('hero', 'features', 'cta')),
    title TEXT,
    subtitle TEXT,
    description TEXT,
    content_json TEXT,
    is_active BOOLEAN DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Homepage Features Table
CREATE TABLE IF NOT EXISTS homepage_features (
    id TEXT PRIMARY KEY,
    section_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (section_id) REFERENCES homepage_sections(id)
);

-- Homepage Actions Table
CREATE TABLE IF NOT EXISTS homepage_actions (
    id TEXT PRIMARY KEY,
    section_id TEXT NOT NULL,
    label TEXT NOT NULL,
    href TEXT NOT NULL,
    variant TEXT DEFAULT 'default' CHECK(variant IN ('default', 'secondary', 'outline', 'ghost')),
    icon TEXT,
    is_external BOOLEAN DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (section_id) REFERENCES homepage_sections(id)
);
```

### 7.2 Seed Initial Data

```bash
# Bootstrap endpoint (requires BOOTSTRAP_SECRET from environment)
BOOTSTRAP_SECRET=$(grep BOOTSTRAP_OWNER_SECRET .env.local | cut -d= -f2)
curl -X POST http://localhost:3004/__bootstrap__/api/init \
  -H "X-Bootstrap-Secret: $BOOTSTRAP_SECRET"

# Seed homepage data
curl -X POST http://localhost:3004/api/homepage/seed \
  -H "Content-Type: application/json"
```

---

## Rollout Strategy

### Phase 1: Foundation (Week 1-2)
1. ✅ Create models (HomepageSection, HomepageFeature, HomepageAction)
2. ✅ Add D1 binding to wrangler
3. ✅ Register models in db-utils
4. ✅ Create auto-CRUD endpoints

### Phase 2: Frontend Integration (Week 2-3)
5. ✅ Create server hook to fetch data
6. ✅ Update page.tsx to use database
7. ✅ Test with seeded data
8. ✅ Add caching/ISR strategy

### Phase 3: Admin (Week 3-4, Optional)
9. Add authentication guard middleware
10. Create admin update endpoints
11. Build admin panel UI (optional)
12. Add role-based access control (RBAC)

### Phase 4: Polish & Deploy (Week 4)
13. Performance tuning (caching, CDN headers)
14. Error handling & fallbacks
15. Documentation & deploy scripts
16. Live deployment to Cloudflare

---

## Files to Create/Modify

| File | Purpose |
|------|---------|
| `ottabase/models/HomepageSection.ts` | Main schema + model |
| `ottabase/models/HomepageFeature.ts` | Feature items model |
| `ottabase/models/HomepageAction.ts` | CTA button model |
| `ottabase/db/schema.ts` | Export all tabs for migrations |
| `ottabase/lib/db-utils.ts` | Register models |
| `lib/get-homepage-data.ts` | Server-side data fetching hook |
| `app/page.tsx` | Refactored to use DB data |
| `worker/routes/homepage.ts` | Custom fetch endpoint |
| `worker/routes/homepage-seed.ts` | Seed initial data |
| `worker/routes/homepage-admin.ts` | Admin CRUD endpoints |
| `worker/middleware/admin-guard.ts` | Auth middleware |
| `.env.local` | Add NEXT_PUBLIC_API_URL |
| `wrangler.jsonc` | Ensure D1 binding exists |
| `ottabase/migrations/001_homepage_schema.sql` | Schema migration |

---

## Type Definitions

```typescript
// types/homepage.ts
export type HomepageSection = {
    id: string;
    slot: 'hero' | 'features' | 'cta';
    title?: string;
    subtitle?: string;
    description?: string;
    isActive: boolean;
    sortOrder: number;
    features?: HomepageFeature[];
    actions?: HomepageAction[];
    createdAt: Date;
    updatedAt: Date;
};

export type HomepageFeature = {
    id: string;
    sectionId: string;
    title: string;
    description: string;
    icon?: string;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
};

export type HomepageAction = {
    id: string;
    sectionId: string;
    label: string;
    href: string;
    variant: 'default' | 'secondary' | 'outline' | 'ghost';
    icon?: string;
    isExternal: boolean;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
};
```

---

## Benefits

✅ **Single Source of Truth** — All content lives in DB, renders consistently  
✅ **Admin-Friendly** — Edit content without code changes  
✅ **Maintainable** — OttaORM encapsulates all data logic  
✅ **Type-Safe** — Full TypeScript support end-to-end  
✅ **Scalable** — Easy to add more sections or fields  
✅ **Multi-Tenant Ready** — Can add org/tenant filtering  
✅ **Performance** — ISR caching + edge deployment  
✅ **Fallback Support** — Graceful errors if API unavailable  

---

## Future Enhancements

- Rich text editor (WYSIWYG) for sections
- Media library integration for images/icons
- Schedule content publish dates
- A/B testing different section variants
- Analytics tracking per section
- Versioning & rollback capability
- Multi-language support (translations)
- Template/preset homepage layouts
