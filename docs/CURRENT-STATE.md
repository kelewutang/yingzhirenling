# Current Project State

## 1. Snapshot

- **Project:** 影之刃零攻略站
- **Production:** https://www.yingzhirenling.cn/
- **Repository:** `git@github.com:kelewutang/yingzhirenling.git`
- **Formal local repo:** `/home/mok/projects/yingzhirenling-site`
- **Branch:** `main`
- **Baseline commit:** `ee09a49aa76965078c81264242afacb1303ec96e`
- **Hosting:** Netlify static hosting
- **Architecture:** Astro static output, native CSS, native JavaScript, and build-time Knowledge data

## 2. Current Product Position

The site is a pre-release knowledge base and guide-search entry for *Phantom Blade Zero / 影之刃零*.

It is a player knowledge base, a discovery path for guides and structured Entities, and a future foundation for Build tools when reliable release data exists. It is not a complete post-release guide, UGC platform, AI Q&A product, CMS, or account-backed service.

## 3. Production Inventory

The current static build and its verification derive the following production inventory:

| Item | Count |
| --- | ---: |
| Published Weapons | 8 |
| Published Characters | 3 |
| Published Bosses | 3 |
| Published Locations | 1 |
| Weapon collection cards | 8 |
| Character collection cards | 3 |
| Boss collection cards | 3 |
| Location collection cards | 1 |
| Weapon detail pages | 8 |
| Character detail pages | 3 |
| Boss detail pages | 3 |
| Location detail pages | 1 |
| Production Search documents | 15 |
| URLs in the generated sitemap | 24 |
| Production-eligible Media records | 0 |

Counts must be re-derived from `data/` and the static build when precision matters; they are not homepage copy constants.

## 4. Production Entity Notes

**Qinglong Lueyue Dao / 青龙掠月刀** remains `draft` only. It has no production detail page, Collection card, Production Search document, or sitemap entry. Its production detail route is intentionally absent and returns the custom 404 behavior.

## 5. Data and Trust Model

Knowledge data is composed of Entities, Facts (claims), Sources, Relations, GameVersions and scopes, plus Registries for controlled vocabulary.

- A Fact is the minimum trust unit. An Entity or page is not a trust boundary.
- Fact statuses are `official`, `observation`, `third-party`, `editorial`, `pending-review`, and `release-verified`.
- `release-verified` is post-release only and is prohibited in current pre-release production data.
- Source authority is separately classified as `official`, `third-party`, `community`, or `internal`.
- An official Source does not make every derived claim official. Directly observed public footage normally remains `observation`.
- Editorial claims may cite `basisFactIds`; old HTML is not evidence for an editorial claim.
- Relations are independent, directed, sourced, status-bearing, versioned records rather than implied Facts.
- `recordState=published` grants production eligibility only; it does not mean official or verified.

Read [Knowledge Schema 1.0](knowledge-schema-1.0.md) before changing any data or validation rule.

## 6. Architecture Decisions

- Production is Astro static output; core SEO content is present in build-time HTML.
- `data/` is the Knowledge source of truth. `generated/`, `pages/generated/`, and `dist/` are derived artifacts.
- Native CSS and native JavaScript remain the defaults. JavaScript is progressive enhancement only.
- Core H1, summaries, Facts, Sources, canonical URLs, and metadata must not depend on runtime Knowledge JSON rendering.
- Production runtime loads only `generated/search-index.production.json`; Page Search remains usable if the Entity enhancement fails.
- Do not introduce Next.js, React, Tailwind, a database, CMS, Server API, or account system without an explicit approved need.
- Netlify publishes `dist/`; its build command runs the repository validation and generation chain.

## 7. UI System

The visual direction is **Ink & Steel / 墨锋铁骨**: deep charcoal, cool iron-gray surfaces, limited cinnabar accents, fine borders, restrained shadows, and high readability.

Avoid black-red esports styling, neon/glow-heavy effects, large gold treatment, SaaS-dashboard framing, and publisher-style marketing landing pages.

Shared production systems are:

- Shared Header, desktop/mobile navigation, and Footer
- Global Search dialog
- Entity Detail system with deterministic no-media fallback
- Collection system and Entity cards
- Homepage knowledge entry

## 8. Completed UI Refresh Stages

| Stage | State |
| --- | --- |
| P2-UI-0 Preparation | PASS |
| P2-UI-1 Design System + Shell | PASS |
| P2-UI-2 Weapon Detail Pilot | PASS |
| P2-UI-3 Media Pipeline Foundation | PASS |
| P2-UI-4 Entity Detail Rollout | PASS |
| P2-UI-5 Collection Pages | PASS |
| P2-UI-6 Homepage | PASS |
| P2-UI-7 Media Readiness + Performance QA | PASS |

Known merge baselines:

- P2-UI-5: `093a6f614d0d08e80d1804c46126f288f1ecd015`
- P2-UI-6, including the Homepage structured-data hotfix: `b0ecacfc7e84439deb0b27b3f9494598dc13989f`
- P2-UI-7 merge: `ee09a49aa76965078c81264242afacb1303ec96e`

## 9. Current User Journey

```text
Homepage
  → Global Search or an Entity category
  → Collection
  → Entity Detail
  → Facts / Relations / Sources
```

Production Search has 15 Entity documents in addition to the existing Page Search documents. The homepage presents brand and pre-release state, a primary Search trigger, Weapons/Characters/Bosses/World entrances, current coverage, trust context, and subordinate guide/video/about links.

## 10. Media State

The Media contract exists in `data/media.json` and is validated at build time. Production-eligible Media records are currently **0**.

Production UI therefore uses deterministic abstract CSS/SVG fallbacks. Do not scrape, hotlink, download, or casually reuse screenshots. A Media asset may enter production only after its source, rights evidence, eligibility, local path, dimensions, and usage meet the Media policy.

Published Media may only target a published Entity; draft or archived Entity targets are rejected by the Media validator.

**Cleared Media Asset Admission: DEFERRED.**

## 10.1 Performance Baseline

P2-UI-7 records a reproducible static baseline in [Performance Baseline](PERFORMANCE-BASELINE.md): `dist/` 2,598,387 B; CSS 66,155 B; JavaScript 16,403 B; Production Search index 8,498 B / 15 Entity documents; legacy images 9 files / 2,190,224 B; Production Media 0.

## 11. SEO and Routing State

Core canonical routes are:

```text
/
/guide
/weapons
/characters
/bosses
/world
/videos
/about
/about-site
```

Published Entity details use their type and stable slug below the relevant collection route. Legacy `/pages/*.html` aliases redirect to canonical routes. A custom 404 exists, and draft production route isolation is verified.

The generated sitemap has 24 canonical URLs. Homepage canonical is `https://www.yingzhirenling.cn/`.

## 12. Homepage State

P2-UI-6 replaced the old promotional homepage with a knowledge-base entry:

- old promotional Hero, countdown/KPI presentation, news feed, and video embed were removed or reframed;
- a primary trigger reuses the existing Global Search dialog;
- four Entity category entrances use build-time published counts;
- coverage and a concise trust explanation are present;
- guide, video, and site-information links are visually subordinate;
- WebSite JSON-LD is valid build-time JSON.

No homepage-specific runtime Search implementation was added.

## 13. Validation Baseline

At baseline `ee09a49`, the main build passed:

- `git diff --check`
- Knowledge validator
- Media validator
- Astro/static build and dist verification
- Homepage verification, including WebSite JSON-LD parsing
- Shared shell verification
- Search route and modal-focus regression checks
- Collection verification
- Entity-detail verification

This records a completed baseline, not a claim that future browsers or deploys need no re-testing.

## 14. Development Workflow

Current operating workflow:

```text
Main ChatGPT
  → planning, prompts, Gate decisions, merge authorization
Codex CLI in WSL
  → code, Git, builds, validators
GitHub
  → feature branch and PR
Netlify
  → Deploy Preview
Independent browser QA
  → currently Doubao is preferred
Main ChatGPT
  → final PASS / FAIL judgment
Codex
  → merge only after explicit authorization
```

All code and Git work happens in `/home/mok/projects/yingzhirenling-site`. Never develop from `/mnt/c/` copies. Before every code or Git task, verify `pwd`, repository root, remote, branch/HEAD, `origin/main`, and worktree status.

## 15. Browser QA Reality

OpenAI Work and Windows local-project/browser reliability has been unstable. Do not rely on Work for local repository or Git operations.

The preferred independent browser QA agent is currently Doubao. It has been used for Deploy Preview access, DOM/meta inspection, JavaScript execution, Search/menu interaction, console inspection, and responsive checks when viewport tooling is available. If exact viewport emulation is unavailable, the QA report must state that limitation explicitly.

## 16. Merge Discipline

```text
feature branch
  → implementation validation
  → push
  → PR
  → Deploy Preview Gate
  → explicit merge authorization
  → merge
  → post-merge validation
```

Do not merge directly because `gh` is unavailable. Do not force-push, rewrite history, or merge changes committed after Browser Gate without a new Gate.

## 17. Current Technical Debt and Deferred Work

- Production media rollout is deferred until cleared assets exist.
- Legacy CSS and legacy asset review remain for P2-UI-8.
- The legacy static-copy bridge remains while older hand-authored pages are still served through it.
- Post-release content expansion, search scaling, and Build tools are future scope.
- Accounts, UGC, and backend services are future scope.

## 18. Next Planned Stage

The next main stage is **P2-UI-8 Legacy Bridge + CSS Consolidation**.

Cleared Media Asset Admission remains deferred. Visual Atmosphere / Background Layer is planned after legacy cleanup and is not part of P2-UI-8 unless separately authorized. Do not begin P2-UI-8 without a separate approved prompt.

## 19. Future Reusable Starter

Do not blindly clone the current content repository for future game-guide sites. After the architecture is mature and legacy consolidation is complete, extract a clean reusable starter/template from the proven architecture. Future projects should start natively in WSL.

## 20. Source-of-Truth Rule

This file is a current operational snapshot, not the ultimate source of truth.

When conflicts occur, resolve in this order:

1. Git and current production/static build output
2. Authoritative project docs and schemas
3. `CURRENT-STATE.md`
4. Chat history

Do not guess stale commit IDs, counts, or phase status. Re-verify them from Git, data, and build output when precision matters.
