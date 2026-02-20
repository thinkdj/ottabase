# Referral System — Feature Roadmap

This document lists candidate features for the referral system, split into two tiers.
Everything already shipped is marked ✅. Everything below is a candidate — decide which ones
to build next.

---

## What's already live (summary)

| Feature | Notes |
|---|---|
| ✅ First-touch attribution | localStorage, 90-day expiry |
| ✅ Click tracking | IP, user-agent, UTM, referer → D1 |
| ✅ WAE analytics | Click counts by country / code / day |
| ✅ Conversion tracking | pending → completed on signup |
| ✅ User-managed referral username | Set once, change limited by `REFERRAL_SYSTEM_USERNAME_CHANGE` |
| ✅ Referral dashboard | Stats, activity feed, copy link |
| ✅ Admin tracking page | All-user conversion list |
| ✅ RESTful API | `/api/referrals/*` |

---

## Tier 1 — Simple, Good-to-Have (10 ideas)

These are self-contained, low-risk additions that fit naturally into the existing
architecture. Each one can be built in a single PR.

---

### 1. Auto-generate referral username on signup

**What:** When a new user registers and no referral username is set, automatically derive a
username from their display name or email prefix (`john.doe@` → `johndoe`) and save it.

**Why:** Users get a share-ready link immediately; zero friction.

**Where:** `processReferralAttribution` / Auth.js sign-in callback.
New helper `generateReferralUsername(user)` in `@ottabase/referrals/validation`.
Add a uniqueness-suffix loop (`johndoe2`, `johndoe3` …) if taken.

---

### 2. Conversion rate display in the dashboard

**What:** Add a "Conversion rate" stat card next to Total / Conversions / Pending:

```
Conversion rate = completed / (completed + pending) × 100
```

**Why:** The most useful KPI for any referral programme — it's one arithmetic expression on
data that's already returned by `/api/referrals/user`.

**Where:** Pure UI change in `ReferralDashboard.tsx`. No schema or API change needed.

---

### 3. One-click social sharing buttons

**What:** Pre-formatted share URLs for Twitter/X, LinkedIn, and WhatsApp directly in the
dashboard, next to the "Copy" button.

```
Twitter: https://twitter.com/intent/tweet?text=Join+via+my+link:+{link}
LinkedIn: https://www.linkedin.com/shareArticle?url={link}
WhatsApp: https://wa.me/?text={link}
```

**Why:** Dramatically lowers the effort to share. No backend work; pure UI.

**Where:** `ReferralDashboard.tsx` — Referral Link card.

---

### 4. Referral source label in the activity feed

**What:** Parse the stored `referer` header into a human-readable label ("Twitter", "Facebook",
"Reddit", "Direct", "Other") and show it in the tracking table.

**Why:** Users want to know _where_ their clicks came from without decoding raw URLs.

**Where:** Pure display utility in `ReferralDashboard.tsx` / `ReferralTracking.getBrowserInfo()`
style helper. No schema change.

---

### 5. QR code for the referral link

**What:** A "Show QR Code" button in the Referral Link card that renders a QR code using the
browser-native `window.QRCode` API or a tiny canvas-based lib (e.g. `qrcode` npm, ~7 KB).

**Why:** Great for offline use, printed materials, and conference name-badges.

**Where:** `ReferralDashboard.tsx` — Referral Link card. Optional dep added only to the app,
not shared packages.

---

### 6. Referred-by display on the user's own profile/settings

**What:** If `referredById` is set on the user, show a small "Referred by: @username" note
on the user's settings or profile page.

**Why:** Nice social acknowledgement; confirms the attribution is working.

**Where:** Add `GET /api/referrals/referrer` (returns `{ referralUsername }` of the referrer),
then display in the profile UI.

---

### 7. Referral milestone badges / in-app notifications

**What:** When a user crosses a referral count milestone (1st, 5th, 10th, 25th, 50th
conversion), show a toast/banner in the dashboard celebrating it.

**Why:** Gamification keeps top referrers engaged. Pure client-side calculation on data
already loaded.

**Where:** `ReferralDashboard.tsx` — compute `milestoneMessage` from `stats.completed` on
mount, pop a `toast.success()`.

---

### 8. Duplicate-click deduplication (basic fraud prevention)

**What:** In `handleReferralTrack`, skip creating a new WAE event if the same IP has already
fired for the same `referralCode` within the last N minutes (tracked in KV with a TTL).

**Why:** Prevents a single user from inflating click counts by refreshing the page.

**Where:** `worker/routes/referrals.ts` — `handleReferralTrack`. Use `OBCF_KV` (already
bound) with key `ref_dedup:{ip}:{code}` and 15-min TTL. Config flag
`REFERRAL_DEDUP_WINDOW_MINUTES` (default `15`, `0` = disabled).

---

### 9. Export referral data as CSV

**What:** A "Download CSV" button in the activity feed that calls
`GET /api/referrals/export?format=csv` and downloads the user's tracking records as a
comma-separated file.

**Why:** Power users want their data. Requested feature in many SaaS products.

**Where:** New route handler `handleReferralExport` in `worker/routes/referrals.ts`.
Generates CSV in memory from `ReferralTracking.forUser(userId)`.

---

### 10. Referral link preview / custom `/r/{username}` vanity URL

**What:** Add a route `/r/:username` that redirects to `/?ref=:username` with a proper
`302` and injects OG meta tags (`og:title`, `og:description`, `og:image`) so link previews
on social media show a personalised card rather than the generic homepage preview.

**Why:** `?ref=` params look spammy; `/r/johndoe` is clean and memorable.

**Where:** New catch-all worker route `/r/:username` → read user record → redirect with
meta-injected HTML (reuse the existing `brand-html-inject` pattern).

---

## Tier 2 — High-Level / Larger Features (5 ideas)

These require more planning (schema changes, multi-step flows, or new packages) but would
significantly elevate the referral programme.

---

### A. Rewards & Incentives Engine

**Vision:** Define configurable rewards that are automatically granted when a referral
converts — account credits, coupon codes, feature unlocks, or custom callback webhooks.
Both the referrer _and_ the new user can receive rewards (double-sided referral).

**Key pieces:**
- `rewards` config table: `{ trigger: 'conversion', grantType: 'credit', amount: 10 }`
- `referral_rewards` table: `{ userId, trackingId, grantType, amount, status, grantedAt }`
- Queue job `referral.reward.grant` dispatched on conversion
- Dashboard: "You earned $10 credit" banner

---

### B. Multi-Tier / Chain Referrals

**Vision:** Support referral chains where A referred B who referred C, so A gets a partial
reward for C's conversion (configurable depth and split percentages).

**Key pieces:**
- `referralChain` JSON column on `referral_tracking`: `['userId-A', 'userId-B']`
- Attribution walker that climbs the chain up to `REFERRAL_MAX_DEPTH` levels
- Per-tier reward config: `[{ depth: 1, pct: 100 }, { depth: 2, pct: 20 }]`

---

### C. Campaign Management

**Vision:** Admins create named referral campaigns (e.g. "Black Friday 2025") with custom
expiry dates, unique campaign-scoped tracking URLs, per-campaign conversion goals, and
campaign-specific reward overrides.

**Key pieces:**
- New `referral_campaigns` table: `{ id, name, startsAt, endsAt, goal, rewardConfig }`
- Campaign-scoped referral links: `/?ref=johndoe&campaign=blackfriday`
- Admin campaign CRUD page
- Dashboard: campaign selector + per-campaign stats

---

### D. Fraud Detection & Risk Scoring

**Vision:** Automatically flag suspicious referral activity with a risk score per tracking
record — VPN/datacenter IP detection, velocity checks (too many conversions from the same /24
subnet in 24 h), disposable email detection on the referred user.

**Key pieces:**
- `riskScore` integer column on `referral_tracking` (0–100)
- `status: 'suspicious'` in addition to existing `pending/completed/invalid`
- Background queue job `referral.risk.score` runs after each conversion
- Admin UI: filter by status=suspicious, one-click approve/invalidate

---

### E. White-Label Public Invite Page (`/invite/{username}`)

**Vision:** A fully branded, publicly accessible landing page at `/invite/{username}` that
shows the inviter's name, avatar, a personalised headline ("John Doe invites you to join!"),
and a sign-up CTA — all themed with the app's brand engine. Ideal for email campaigns and
direct links.

**Key pieces:**
- Worker SSR route `/invite/:username` → fetches user record → renders branded HTML
- Extend `brand-html-inject` to accept per-page OG meta overrides
- Optional: `referralBio` text field on the User model for a custom tagline
- Optional: integration with `@ottabase/ui-shadcn` for the client-side component after hydration

---

## Decision Matrix

| # | Feature | Effort | Impact | Dependencies |
|---|---|---|---|---|
| 1 | Auto-generate username | Low | High | None |
| 2 | Conversion rate display | Very Low | Medium | None |
| 3 | Social sharing buttons | Very Low | High | None |
| 4 | Source label | Very Low | Medium | None |
| 5 | QR code | Low | Medium | Small npm dep |
| 6 | Referred-by on profile | Low | Low | New API endpoint |
| 7 | Milestone badges | Very Low | Medium | None |
| 8 | Dedup / fraud prevention | Low | High | KV (already bound) |
| 9 | CSV export | Low | Medium | None |
| 10 | `/r/{username}` vanity URL | Medium | High | Worker route |
| A | Rewards engine | High | Very High | Schema + Queue |
| B | Multi-tier referrals | High | High | Schema changes |
| C | Campaign management | High | High | New tables + Admin UI |
| D | Fraud detection | Medium | High | Queue + scoring logic |
| E | White-label invite page | Medium | High | Worker SSR |
