# Ottabase Launch Plan — Maximum Impact Detailed Runbook

> This is the execution document.
> If you want the higher-level strategy, read [`LAUNCH_PLAN.md`](./LAUNCH_PLAN.md) first.
> If you want maximum impact, follow this file in order and do not improvise on launch day.

Assumption: Ottabase keeps its governance docs at the repo root (`LICENSE`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`).
If you reuse this runbook elsewhere, keep that structure or update the checklist first.

---

## 1. What success looks like

Your launch does **not** need to go viral to win.
It needs to create enough attention, trust, and momentum that Ottabase becomes a project people keep bumping into for the next 6-12 months.

### Primary launch goals

1. Establish Ottabase as **the serious “full-stack SaaS on Cloudflare Workers” project**
2. Turn the launch into **repeatable distribution**, not a one-day spike
3. Create enough social proof that future visitors feel they are early, not alone
4. Convert attention into:
    - GitHub stars
    - watchers
    - issues
    - contributors
    - newsletter mentions
    - direct conversations

### Minimum win conditions

If you hit these in the first 14 days, the launch worked:

- 100+ GitHub stars
- 10+ meaningful conversations with developers/founders
- 5+ people trying setup
- 3+ people sharing Ottabase without you asking twice
- 2+ newsletter / community mentions
- 1-3 follow-up posts that also get traction

### Real goal

The real goal is to make people say:

> “I keep seeing Ottabase everywhere.”

That feeling creates legitimacy.

---

## 2. The positioning to use everywhere

Do **not** describe Ottabase as a generic monorepo.
That is technically true but commercially weak.

Use this positioning:

> **Ottabase is an open-source TypeScript SaaS framework for Cloudflare Workers.**
> It gives solo founders and small teams the batteries they normally spend months wiring together: auth, multi-tenancy, RBAC, ORM, queues, CMS, realtime, analytics, and deployment.

### The three strongest angles

Use these repeatedly:

1. **Founder angle**
    - “This is for solo founders who want to ship SaaS without assembling 20 disconnected tools.”
2. **Cloudflare angle**
    - “This is a serious full-stack Cloudflare Workers stack, not just a demo.”
3. **DX angle**
    - “Fat models, batteries included, TypeScript-first, edge-native.”

### One-line versions

- **Default:** Open-source TypeScript SaaS framework for Cloudflare Workers
- **Founder angle:** Rails/Laravel-style SaaS builder for solo founders on Cloudflare
- **Technical angle:** Full-stack Cloudflare Workers framework with OttaORM, auth, RBAC, CMS, queues, and realtime

### What to avoid saying

- “Just another starter”
- “A collection of packages”
- “Monorepo template”
- “All-in-one boilerplate”

Those sound disposable.

---

## 3. The launch secrets that actually matter

These are the levers that repeatedly work for developer-tool launches.

### Secret 1: Launches are won before launch day

Big launch days usually come from warm attention, not cold posting.

What to do:

- Post 5-7 days before launch about one piece of Ottabase at a time
- Share screenshots, short clips, architecture snippets, and “building in public” notes
- Tell people something is coming without sounding hype-y

Why it works:

- Platforms reward accounts that have recent engagement
- People are more likely to amplify something they have seen before
- Familiarity increases click-through and trust

### Secret 2: The first hook matters more than the rest

Every post needs a first line that creates immediate curiosity.

Strong hooks:

- “I open-sourced the TypeScript SaaS framework I wish existed when I started building on Cloudflare Workers.”
- “I got tired of wiring auth, RBAC, multi-tenancy, queues, and CMS every time I started a SaaS.”
- “What if Rails-for-Cloudflare actually existed?”

Weak hooks:

- “Excited to announce…”
- “Please check out my project…”
- “I built something cool…”

### Secret 3: Narrow claim beats broad claim

Do not try to be for everyone.
Own a specific mental category:

> “The open-source SaaS framework for Cloudflare Workers”

This is stronger than:

> “A modern framework for building web apps”

### Secret 4: Makers get attention, not brands

On social, **you** are more persuasive than a project logo.

Do this:

- Post from your personal account first
- Use your founder story
- Say why you built it, what frustrated you, what you learned
- Then repost from project account if you create one

Why:

- People back people
- Personal posts outperform corporate voice for early-stage launches

### Secret 5: Comment velocity decides reach

A good post with dead comments loses momentum.
A decent post with active discussion keeps expanding.

What to do:

- Be available the full day
- Reply fast
- Ask simple follow-up questions
- Turn replies into mini-explanations, not “thanks”

### Secret 6: Native content beats outbound links

Do not make every post “click my GitHub.”

Instead:

- Put useful substance in the post itself
- Put the GitHub link at the end
- Share screenshots, code, diagrams, and short clips natively

### Secret 7: Launches need a week-two plan

Most projects die because the founder treats launch as one post.

You need:

- launch day
- 48-hour follow-up
- week 1 recap
- first tutorial
- first issue roundup
- first roadmap post

Momentum is manufactured by sequencing.

---

## 4. The assets you must prepare before launch

Do not launch until all of these exist.

### Must-have assets

- [ ] GitHub repo cleaned up
- [ ] README tightened with clear one-line value prop
- [ ] `LICENSE` present at repo root
- [ ] `CONTRIBUTING.md` present at repo root
- [ ] `CODE_OF_CONDUCT.md` present at repo root
- [ ] `SECURITY.md` present at repo root
- [ ] 5-10 good first issues created
- [ ] demo video recorded
- [ ] 6 screenshots or GIFs exported
- [ ] founder launch post drafted
- [ ] technical launch post drafted
- [ ] Hacker News post title drafted
- [ ] HN first comment drafted
- [ ] 3 Reddit post variants drafted
- [ ] 1 LinkedIn post drafted
- [ ] 1 newsletter pitch drafted
- [ ] 20-person outreach list prepared

### Screenshot / clip checklist

Capture these:

1. repo homepage with strong README top section
2. app running locally
3. admin UI / CMS / dashboard area
4. OttaORM or CRUD workflow
5. Cloudflare deployment proof
6. architecture / package overview visual

### Demo video structure

Keep it to 2-4 minutes.

Sequence:

1. what Ottabase is
2. what problem it removes
3. what comes out of the box
4. quick look at app
5. quick look at code
6. quick deploy / Cloudflare angle
7. CTA: GitHub + docs

Do **not** ramble.
Write a loose script first.

---

## 5. Your exact pre-launch schedule

## T-14 to T-10 days

### Objective

Build the narrative and collect feedback before public launch.

### Tasks

1. Finalize governance files and README
2. Prepare the landing page or at least a docs landing section
3. Ask 5-10 trusted developers to try setup
4. Fix any “I got stuck in 10 minutes” problems
5. Identify the most impressive 3 capabilities to demonstrate

### Outreach message to trusted testers

```text
I’m preparing to open-source Ottabase soon.
It’s a TypeScript SaaS framework for Cloudflare Workers with auth, RBAC, OttaORM, queues, CMS, and more built in.

Can you spend 15-20 minutes trying the repo and tell me where the onboarding is confusing?
I care most about:
1. what feels impressive
2. what feels unclear
3. what would stop you from trying it seriously
```

## T-9 to T-7 days

### Objective

Warm up your audience.

### Tasks

1. Post 2-3 times from your personal account
2. Share one concrete insight each time
3. Do **not** ask for stars yet

### Post ideas

- “I’ve been building a serious Cloudflare Workers SaaS framework and the surprising part is how much boilerplate founders keep rebuilding.”
- “The part I’m most proud of in Ottabase is OttaORM’s fat-model approach. It feels closer to Rails/Laravel than the usual JS stack.”
- “Cloudflare has quietly become a real full-stack platform if you wire D1, KV, R2, Queues, and Durable Objects together correctly.”

## T-6 to T-4 days

### Objective

Create social proof before the main event.

### Tasks

1. Ask close contacts to be around on launch day
2. Send them the exact link and time window
3. Ask them to engage honestly and early
4. Seed 5-10 GitHub stars if possible through genuine supporters

### Direct ask message

```text
I’m launching Ottabase on [day] at [time].
If you’re around in that window, I’d love an honest read, comment, share, or star if you think it deserves it.

I’m not asking for fake hype — just early eyes and real engagement so the launch has a chance.
```

## T-3 to T-1 days

### Objective

Remove all avoidable friction.

### Checklist

- [ ] Final README proofread
- [ ] GitHub topics added
- [ ] social bios updated
- [ ] all launch copy in one note or doc
- [ ] screenshots named and ready
- [ ] video uploaded and link tested
- [ ] HN post text ready
- [ ] Reddit posts adapted per subreddit
- [ ] Product Hunt assets prepared
- [ ] all links tested
- [ ] calendar blocked for launch day

---

## 6. Your launch-day schedule: exact execution

Pick **Tuesday, Wednesday, or Thursday**.
Best default: **Tuesday**.

Why Tuesday:

- enough weekday attention
- less fatigue than Thursday
- gives you the rest of the week for follow-up

## Launch-day rules

- All times below are in **UTC** so you can plan once and post consistently across regions
- Convert them into your local timezone the night before and put them in your calendar
- Example: `06:00 UTC` = `02:00 US Eastern` during daylight saving time, so check a timezone converter the night before launch to avoid DST mistakes
- Do not schedule a big personal obligation that day
- Do not post and disappear
- Do not improvise your core message
- Do not launch without sleep
- Do not spread attention across 12 channels at once in the first hour

## Launch-day order of operations

### 06:00-07:00 UTC — Hacker News first

Why first:

- HN has high leverage
- early posting can compound through the day
- if it works, you can reference momentum elsewhere later

#### Suggested titles

Choose one:

1. `Show HN: Ottabase – Open-source TypeScript SaaS framework for Cloudflare Workers`
2. `Show HN: Ottabase – Rails-style SaaS stack for Cloudflare Workers`
3. `Show HN: Ottabase – Full-stack Cloudflare Workers framework with auth, RBAC, ORM, queues, and CMS`

Use the cleanest version, not the cleverest.

#### HN first comment template

```text
Hi HN — I built Ottabase because every time I started a SaaS product I ended up rebuilding the same stack:
auth, organizations, roles, audit logs, queues, admin tooling, CMS, and deployment plumbing.

I wanted a serious open-source stack for Cloudflare Workers that felt batteries-included, but still TypeScript-first and flexible.

Ottabase includes:
- OttaORM (fat-model ORM)
- auth + RBAC
- multi-tenancy
- queue + cron
- CMS / blog tooling
- realtime / notifications
- Cloudflare-native deployment primitives

I’m especially interested in feedback on:
1. whether the positioning is clear
2. whether Cloudflare is a compelling foundation for this
3. what feels missing if you were adopting this for a real SaaS
```

### 07:00-08:00 UTC — Personal launch post on X

Post from **your personal account first**.

#### Best-performing structure

1. problem
2. who it is for
3. what is included
4. why Cloudflare
5. proof
6. call to action

#### Recommended launch post

```text
I just open-sourced Ottabase.

It’s the TypeScript SaaS framework I wish existed when I started building on Cloudflare Workers.

Built for solo founders and small teams who are tired of wiring the same stack from scratch:

• auth
• RBAC
• multi-tenancy
• ORM
• queues + cron
• CMS/blog
• realtime
• analytics

Ottabase gives you that in one open-source stack.

GitHub: https://github.com/[your-username]/ottabase
```

For Ottabase itself, replace `[your-username]` with `thinkdj`.
Do a final search for `github.com/` the day before launch so every post and doc uses the same canonical URL.

#### Follow-up thread

Reply to your own post with:

1. what makes OttaORM different
2. why Cloudflare is the right foundation
3. a short demo clip
4. what you want feedback on

### 08:00-10:00 UTC — Reddit and technical communities

Do **not** blast the exact same copy everywhere.

#### r/typescript angle

Focus on:

- TypeScript-first stack
- fat-model ORM
- batteries-included DX

#### r/cloudflare angle

Focus on:

- real use of D1, KV, R2, Queues, Durable Objects
- full-stack deployment on Workers
- what you learned building on the platform

#### r/SideProject / founder angle

Focus on:

- your personal problem
- why existing options were unsatisfying
- what you built

### 10:00-12:00 UTC — LinkedIn and direct outreach

LinkedIn is not for technical depth.
It is for:

- founder journey
- why this matters
- what you learned

### Direct outreach list

Message these people individually:

- friends who build products
- devs who know Cloudflare
- indie hackers
- previous collaborators
- anyone who has posted about SaaS tooling, founder tools, or Workers

Do not send mass identical DMs.

Personalize the message with one real reason they are a fit:

- a recent Cloudflare post
- their interest in SaaS tooling
- prior experience with TypeScript frameworks
- a conversation you already had about developer tooling

Use:

```text
Launched this today and thought you might actually care because of your work on [topic].

Ottabase is my open-source TypeScript SaaS framework for Cloudflare Workers.
Would love your honest reaction if you have a minute:
[link]
```

Filled example:

```text
Launched this today and thought you might actually care because of your recent Cloudflare Workers posts.

Ottabase is my open-source TypeScript SaaS framework for Cloudflare Workers.
Would love your honest reaction if you have a minute:
https://github.com/thinkdj/ottabase
```

### 12:00-18:00 UTC — Stay in the replies

This window matters more than posting more.

Your job:

- answer questions
- pull out great user reactions
- quote-post good commentary
- capture objections for follow-up content

Turn every strong question into future content.

Example:

- “Why not just use Supabase + Next?”
    - write comparison post later
- “Why Cloudflare?”
    - write architecture explanation
- “How production-ready is this?”
    - publish roadmap + case studies

---

## 7. Platform-by-platform playbooks

## Hacker News

### What works

- straightforward title
- honest first comment
- founder in the thread
- technical humility
- real answers to criticism

### What kills a Show HN

- marketing language
- vague claims
- obvious overhype
- arguing defensively
- disappearing after posting

### Tactical note

If HN starts moving:

- do **not** edit the title unless necessary
- keep replying
- share clarifications in-thread
- if someone gives thoughtful criticism, engage seriously

HN readers often become your best long-term users if respected.

## X / Twitter

### What works

- personal founder voice
- 1 strong claim
- clean bullets
- short clip or image
- follow-up replies with substance

### Recommended cadence

- main post
- 10-15 min later: reply with clip
- 20-30 min later: reply with differentiators
- 60+ min later: reply with who it is for / not for
- later in day: quote-post a good reaction or answer a common objection

### Important

Do not post 8 separate launch tweets.
One main post + strategic replies is better.

## Reddit

### What works

- useful framing
- transparent self-identification
- problem-first writing
- discussion, not CTA-heavy self-promotion

### What to do

- read each subreddit’s self-promo rules first
- tailor copy
- answer comments
- avoid link-dumping if text post is preferred

## LinkedIn

### Use this angle

“I’ve spent too much time rebuilding the same SaaS foundation, so I open-sourced the stack I wish I had.”

Less technical depth, more narrative + credibility.

## Product Hunt

Only do this if you have the bandwidth to show up there too.

If yes:

- prepare clean visuals
- have a tight tagline
- write clear first comment
- ask your network for honest support

If you cannot actively support Product Hunt for the day, deprioritize it behind HN, X, Reddit, GitHub, and direct outreach.

## Dev.to / Hashnode

Treat these as launch amplifiers and SEO seeds.

Best launch article title:

> I Open-Sourced a TypeScript SaaS Framework for Cloudflare Workers

Include:

- why you built it
- what it includes
- screenshots
- lessons learned
- link to repo

---

## 8. Exact messaging pillars to repeat all week

You should sound consistent across platforms.

Use these 5 messages repeatedly:

1. **Founders rebuild too much infrastructure**
2. **Cloudflare is ready for serious full-stack apps**
3. **Ottabase gives you a batteries-included SaaS foundation**
4. **OttaORM is a differentiator**
5. **This is open source and looking for early feedback**

If people hear the same core story from multiple angles, it sticks.

---

## 9. The first 72 hours after launch

Most people waste this period.
This is where a decent launch becomes a strong one.

## Hour 0-24

Focus:

- replies
- discussions
- collecting language from users
- identifying what resonated

Track:

- which post drove the most clicks
- which wording got repeated by others
- what objections came up

## Hour 24-48

Publish a follow-up post:

### Example

> Early reaction to Ottabase has been strongest around 3 things:
> 1. Cloudflare-native full-stack setup
> 2. OttaORM / fat-model DX
> 3. founder-focused batteries-included approach
>
> Based on feedback I’m now prioritizing:
> - docs improvements
> - starter walkthroughs
> - better comparison pages

Why it works:

- shows momentum
- shows you are listening
- creates a second wave of attention

## Hour 48-72

Publish your first tutorial.

Best options:

- “How to think about Ottabase in 10 minutes”
- “How OttaORM works”
- “What comes out of the box in Ottabase”

Do not wait weeks.
The audience is warm now.

---

## 10. The first 30 days after launch

## Week 1

Ship these posts:

1. launch announcement
2. launch recap
3. deep dive on OttaORM
4. why Cloudflare

## Week 2

Ship:

1. quickstart walkthrough
2. comparison post (`Ottabase vs X`)
3. roadmap post

## Week 3

Ship:

1. tutorial from a real workflow
2. “things I learned from early feedback”
3. call for contributors

## Week 4

Ship:

1. first release / changelog recap
2. case study or example app
3. contribution highlights

---

## 11. What to optimize on social for maximum reach

## Optimize for saves and shares, not just likes

Developer tools grow when people think:

- “I want this later”
- “My friend should see this”

Posts that perform well often contain:

- crisp architecture diagram
- specific list of built-in features
- honest comparison
- useful founder lessons

## Use proof early

Best proof types:

1. working demo
2. clean repo
3. screenshots
4. user comments
5. specific feature list
6. commits / roadmap / active iteration

## Make people feel early

Good phrasing:

- “just open-sourced”
- “looking for early feedback”
- “first public release”
- “would love opinions from Cloudflare / TS folks”

This gives people a reason to engage now.

## Turn reactions into second-order reach

If someone notable says something useful:

- quote it
- reply to it with extra value
- use it in a recap post

This is not fake leverage.
It is how attention compounds.

---

## 12. What not to do

Do **not**:

- buy followers
- buy engagement
- use engagement pods
- use fake comments
- DM strangers with “please star”
- post identical copy everywhere
- disappear after launch day
- argue defensively with criticism
- say “viral” things you cannot back up

Short-term vanity destroys trust.
Trust is the only asset that compounds for open-source projects.

---

## 13. Your emergency playbook if traction is weaker than expected

If launch day is quiet, do not spiral.
Do this instead.

### If HN does not move

- keep the post up
- do not obsessively repost it
- shift focus to X, direct outreach, Reddit, and follow-up content

### If X underperforms

- rewrite the hook and post a new angle 24-48 hours later
- use a clip or image
- post a specific sub-angle, not the generic launch

Examples:

- OttaORM angle
- founder angle
- Cloudflare angle
- “what’s included” angle

### If people are confused

That is a messaging problem, not a product death sentence.

Fix by publishing:

- “What Ottabase is”
- “Who it is for”
- “Who it is not for”
- “Why this exists”

### If interest exists but stars do not convert

Your CTA is weak or buried.

Fix:

- make the ask explicit
- put GitHub link earlier
- say what you want: star, feedback, issues, contributors

---

## 14. Exact deliverables to create this week

If you want a simple checklist, do these in order.

### Day 1

- [ ] tighten README top section
- [ ] define final one-line positioning
- [ ] create 10 good first issues
- [ ] make launch asset folder

### Day 2

- [ ] record 2-4 minute demo
- [ ] export 6 screenshots/GIFs
- [ ] draft HN post + first comment
- [ ] draft main X post + thread replies

### Day 3

- [ ] draft Reddit versions
- [ ] draft LinkedIn post
- [ ] draft launch blog post
- [ ] make 20-person outreach list

### Day 4

- [ ] ask 5-10 testers to review repo
- [ ] fix onboarding friction
- [ ] finalize all links/assets

### Day 5

- [ ] warm up personal audience with first teaser
- [ ] warm up with second teaser
- [ ] update GitHub topics and profile links

### Day 6

- [ ] send day-before reminder to close network
- [ ] block launch day calendar
- [ ] sleep early

### Day 7 — launch

- [ ] post on HN
- [ ] post on X
- [ ] post on Reddit
- [ ] publish article
- [ ] message direct contacts
- [ ] stay in replies all day

---

## 15. Suggested scorecard to review every night for 14 days

Track these daily:

| Metric | Goal | Meaning |
| --- | --- | --- |
| GitHub stars | rising daily | social proof and interest |
| GitHub traffic | rising | awareness |
| forks | some movement | deeper intent |
| issues / discussions | rising | user engagement |
| setup feedback | qualitative | onboarding reality |
| newsletter mentions | at least a few | external validation |
| founder DMs / conversations | growing | high-value signal |

### Questions to ask every night

1. What angle got the best response?
2. What confused people most?
3. What can I turn into tomorrow’s post?
4. Who reacted positively that I should follow up with?
5. What proof can I publish next?

---

## 16. Final recommendation: what I would do if I were launching Ottabase

If I had to maximize impact with limited time and zero fluff, I would do exactly this:

1. tighten the README headline so the value proposition is obvious in 5 seconds
2. record one strong 2-4 minute demo
3. prepare one excellent HN post
4. launch from the founder’s personal account, not only a brand account
5. use the phrase **“open-source TypeScript SaaS framework for Cloudflare Workers”** everywhere
6. keep the message centered on **solo founders rebuilding too much infrastructure**
7. stay in comments all day
8. publish a recap post 24 hours later
9. publish an OttaORM deep dive within 72 hours
10. spend the next 30 days turning questions into content

That is the play.

Not magic.
Not tricks.
Not hype.

Just sharp positioning, strong proof, concentrated attention, and relentless follow-through.

---

## 17. Short copy bank

### 5-second description

> Open-source TypeScript SaaS framework for Cloudflare Workers.

### 15-second description

> Ottabase gives solo founders and small teams a batteries-included SaaS stack on Cloudflare Workers: auth, RBAC, multi-tenancy, OttaORM, queues, CMS, realtime, and more.

### 30-second description

> I built Ottabase because every SaaS project starts with the same painful infrastructure setup. Ottabase packages the foundation into one open-source TypeScript stack for Cloudflare Workers, so you can start closer to product instead of rebuilding auth, roles, orgs, queues, content, and deployment every time.

### Call to action options

- Star the repo if this is the direction you want to see exist
- Try the repo and tell me where the onboarding breaks down
- If you build on Cloudflare, I want your blunt feedback
- If you’ve wanted a batteries-included Workers stack, this is for you

---

This document is intentionally opinionated.
If you follow it with discipline, Ottabase will have a materially better launch than “post once and hope.”
