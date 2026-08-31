# P2 UI Design System Proposal

Status: approved direction; P2-UI-1 implements the token and shared-shell foundation, while Entity/media components remain phased work

Recommended direction: **Ink & Steel / 墨锋铁骨**

## 1. Purpose

This is a lightweight semantic system for a solo-maintainable Astro content site. It does not introduce a theme engine, runtime styling, a UI framework, or a page-specific color catalogue.

The system must protect the project's order of priorities:

1. Data trust
2. SEO
3. Performance
4. Maintainability
5. User experience

Core content remains semantic static HTML. Astro components own repeatable markup; CSS owns presentation; native JavaScript is reserved for real interaction.

## 2. Visual principles

### 2.1 Ink & Steel

- Near-black charcoal establishes atmosphere without becoming featureless black.
- Iron surfaces and graphite borders separate hierarchy before shadows do.
- Cinnabar marks action, selection, and focus; it is not a blanket decoration.
- Aged brass is a limited highlight, not a default “ancient China” effect.
- Texture is subtle, local, and optional. Text must remain readable with it removed.
- Entity identity comes from composition, typography, type, facts, and approved media or a deterministic fallback.

### 2.2 What the system must not become

- black/red esports skin
- gold-heavy historical fantasy theme
- mobile-game event page
- neon cyberpunk UI
- SaaS dashboard or admin panel
- Fandom clone or pure documentation theme

## 3. Semantic token proposal

Token names describe purpose rather than a page or Entity type. Values are the recommended starting point and require browser contrast and visual QA before production adoption.

```css
:root {
  color-scheme: dark;

  --color-bg: #0c0e0e;
  --color-surface: #141716;
  --color-surface-raised: #1b1f1e;
  --color-text: #f1ede4;
  --color-text-muted: #b0b2ac;
  --color-border: #343a37;
  --color-border-strong: #56605b;
  --color-accent: #de6658;
  --color-accent-strong: #b83a32;
  --color-accent-hover: #ef7774;
  --color-highlight: #c3a66a;
  --color-focus: #f0c36a;
  --color-danger: #ef7774;
  --color-observation: #75b9b1;

  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-12: 3rem;
  --space-16: 4rem;
  --space-24: 6rem;

  --width-site: 77.5rem;
  --width-wide: 70rem;
  --width-reading: 47.5rem;
  --gutter-mobile: 1rem;
  --gutter-tablet: 1.5rem;
  --gutter-desktop: 2rem;

  --radius-sm: 0.125rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.75rem;
  --border-thin: 1px;
  --shadow-raised: 0 0.75rem 2.5rem rgb(0 0 0 / 0.22);

  --duration-fast: 120ms;
  --duration-normal: 180ms;
  --duration-slow: 240ms;
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);

  --z-base: 0;
  --z-sticky: 20;
  --z-menu: 40;
  --z-dialog: 100;
  --z-skip-link: 120;
}
```

The proposed text/accent combinations were chosen to start above normal-text contrast requirements on the dark backgrounds. Production work must verify actual component combinations, hover states, disabled states, gradients, and imagery—not just token pairs.

Do not create Entity-specific red/blue/gold themes. Entity type may affect an icon or eyebrow label, but Fact status and source type must remain semantic and independent of Entity publication state.

### 3.1 Fact and trust states

Fact-level states require text labels; color is supporting information only.

| Meaning | Treatment |
| --- | --- |
| Official statement/material | neutral or brass label with explicit text |
| Direct observation from public footage | observation color plus “公开素材观察” text |
| Reputable third-party report | muted bordered label with source visible |
| Editorial/context note | quiet surface and explicit editorial label |
| Pending/unconfirmed | must not enter production Entity content under existing Knowledge rules |

`Source.authority`, `Fact.status`, and `recordState` must never collapse into one overall “verified Entity” badge.

## 4. Typography

No font files or external font service are proposed. Use resilient system stacks and test Chinese/English mixing on actual target devices.

```css
--font-body: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
  "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
--font-display: "Songti SC", "STSong", "SimSun", serif;
```

Recommended roles:

| Role | Size/line-height | Notes |
| --- | --- | --- |
| Body | `1rem / 1.75` | Chinese reading baseline; keep paragraphs within reading width |
| Small/supporting | `0.875rem / 1.6` | Source metadata, filters, dates; never the only important content |
| Caption | `0.8125rem / 1.5` | Media caption/credit; high-contrast muted text |
| H1 | `clamp(2rem, 5vw, 3.5rem) / 1.12` | Preserve natural wrapping; no truncation or forced uppercase |
| H2 | `clamp(1.5rem, 3vw, 2rem) / 1.25` | Major content sections |
| H3 | `1.125rem / 1.4` | Fact groups and subordinate sections |
| Alias/English name | `0.9375rem–1.125rem / 1.5` | Avoid wide letter-spacing on long names |
| Fact value | `1rem / 1.5` | Value first; status/source secondary |

Guidelines:

- Use the display serif selectively for the brand and major Chinese headings, not for dense body copy.
- Keep punctuation, Latin names, and numbers visually stable by allowing the body stack to handle mixed text.
- Do not reduce long English names to fit one line. Permit two or more lines without overlaying media or controls.
- Do not communicate hierarchy through letter-spacing alone.
- Source URLs should use readable labels, not unbroken raw URLs.

## 5. Layout system

| Context | Max width | Use |
| --- | --- | --- |
| Site | `1240px` | Header/footer and full page frame |
| Wide content | `1120px` | Entity Hero, Entity Grid, wide facts |
| Reading | `760px` | Summary, narrative sections, Sources |

Gutters:

- 0–599 px: 16 px
- 600–1023 px: 24 px
- 1024 px and above: 32 px

Section rhythm:

- Mobile major section gap: 48 px
- Desktop major section gap: 72 px
- Related items inside a section: 16–24 px
- Hero-to-first-section transition: 32 px mobile, 48 px desktop

Use CSS Grid for Entity Hero and collections, Flexbox for one-dimensional control rows, and normal document flow for reading content. Avoid arbitrary inline `max-width` and margin values.

## 6. Surfaces, borders, and images

- Base page: `--color-bg`.
- Reading sections normally remain on the base page; do not wrap every paragraph in a panel.
- `--color-surface` is for grouped facts, Search results, cards, and footer/navigation layers.
- `--color-surface-raised` is for dialog/menus and a small number of elevated areas.
- Default border: one-pixel graphite. Accent borders indicate active/focus/selected state, not decoration.
- Use the raised shadow only on overlays or a clearly floating panel.
- Default corners are 6 px. Large 12 px corners are for media or dialogs, not every tag.
- Media containers must reserve an aspect ratio and expose caption/credit outside the image overlay when possible.

## 7. Component inventory

Status definitions:

- `existing`: useful as-is for the first refresh step
- `refactor`: an existing behavior or component remains but markup/style boundaries change
- `new`: needed during an approved P2 phase
- `later`: useful only after data/content exists
- `not needed`: should not enter the planned system

| Component | Status | Responsibility |
| --- | --- | --- |
| `SiteHeader` | refactor | Brand, primary navigation, Search, mobile controls; one shared shell implementation |
| `DesktopNav` | refactor | Four primary Entity hubs plus limited secondary navigation and active state |
| `MobileNav` | refactor | Simple menu with focus/Escape/outside-close behavior and adequate targets |
| `SearchTrigger` | refactor | Visible label on desktop, local inline SVG, optional shortcut hint |
| `SearchDialog` | refactor | Preserve current engine/failure behavior and focus trap; improve semantics and hierarchy |
| `Breadcrumb` | refactor | Semantic ordered path with mobile wrapping; retain current component boundary |
| `PageHero` | refactor | Collection/editorial page title, release scope, summary, optional controls |
| `EntityHero` | refactor | Media/fallback plus identity, alias, type, summary, and updated context |
| `EntityCard` | refactor | One whole-card link with media/fallback, type, name, alias/category, short summary |
| `EntityGrid` | refactor | Responsive collection layout and empty result behavior |
| `StatusBadge` | refactor | Fact-level semantic state; never a whole-Entity trust shortcut |
| `FactGroup` | refactor | Named group of related facts; not a card around every section |
| `FactItem` | refactor | Label/value first, status/provenance secondary and accessible |
| `SourcePanel` | refactor | Compact list of full Source records at the end of the evidence chain |
| `MediaHero` | new | Approved media or deterministic fallback with dimensions, alt, caption, credit |
| `MediaGallery` | later | Only after multiple rights-cleared assets and governed records exist |
| `RelatedEntities` | new | Validated relationships and related navigation; absent when empty |
| `SectionHeading` | refactor | Consistent H2/H3, optional short intro/action |
| `EmptyState` | new | Honest no-results/no-media state with next action; no fake content |
| `SiteFooter` | refactor | Project scope, primary links, trust/release statement, one shared shell |
| Hydrated static card | not needed | Static Entity cards require no client framework or hydration |
| Runtime theme engine | not needed | One approved canonical dark system is sufficient |

The current theme selector is legacy behavior, not a reason to create a multi-theme token architecture. Whether to retain or retire it is a visible shell decision for P2-UI-1 approval and migration testing.

## 8. Core component patterns

### 8.1 Entity Card

Required content:

1. media or deterministic type fallback
2. Entity type/category eyebrow
3. name
4. alias or category when available
5. short summary
6. optional fact-level/status context only if it answers a real reader need

The card has one navigation target. Do not put a second “View details” link inside a whole-card anchor. Hover and focus may raise border contrast and translate by at most 1–2 px; the resting card must already look clickable.

### 8.2 Facts

Primary facts should be compact and scan-first:

```text
Label
Value
Fact status · source link or source count
```

Long evidence notes belong in the relevant content section or Source Panel. This preserves fact-level trust without making every fact visually equivalent to a full citation record.

### 8.3 Sources

Each Source row should expose:

- title
- publisher/authority label
- publication or access context if governed data provides it
- direct HTTP/HTTPS link
- concise relationship to the content when needed

Sources remain visible static HTML. Collapsing the whole Source list by default is not recommended for the pilot.

### 8.4 Icons

Use a tiny reviewed set of local inline SVG icons for Search, menu, close, external link, and disclosure. Icons must inherit color, have stable dimensions, and be hidden from accessibility APIs when adjacent text supplies the label. Do not install a multi-megabyte icon package.

## 9. Entity detail architecture

All four Entity types share this frame:

1. Breadcrumb
2. Entity Hero: approved media/fallback + identity/summary
3. release-state or scope note when needed
4. Primary Facts
5. type-specific evidence sections
6. Related Entities when governed relationships exist
7. Sources
8. Footer

The shared frame does not require identical fields.

### 9.0 P2-UI-2 Weapon pilot convention

`/weapons/tang-hengdao` is the sole P2-UI-2 opt-in detail pilot. Its Entity Hero combines the existing static identity/summary with `EntityMedia`, a presentation-only contract that accepts `src`, `alt`, `caption`, `credit`, `sourceUrl`/`sourceId`, `usage`, `width`, `height`, and `rightsStatus`. It does not add fields to Facts or the Knowledge Schema.

No cleared Tang Hengdao media is used in this pilot. The same reserved Hero slot instead renders a deterministic Weapon fallback: typographic identity, type marker, abstract blade mark, and restrained Ink & Steel texture. Quick Facts are limited to existing scan-friendly facts; detailed facts retain a value-first presentation with status and provenance kept secondary. Sources remain static and visible at the end of the evidence chain.

### 9.1 Weapon

- Identity: name, English/aliases, weapon category, summary, updated context
- Primary Facts: current governed classification/acquisition/observations only
- Main sections: public gameplay observations and other published evidence
- Future slots: acquisition detail, moves/skills, Build, video, and deeper combat sections exist in the template plan but are not rendered until data is publishable
- Use as the P2-UI-2 pilot

### 9.2 Character

- Hero portrait/media or Character fallback
- Identity and role only where sourced
- Relationships as a distinct validated section
- Published facts and appearance/observation material
- Sources

Do not fill missing role, biography, or relationships to balance the layout.

### 9.3 Boss

- Boss identity and media/fallback
- Primary facts and public encounter observations
- Related Location/Character only when governed relationships exist
- Future strategy area remains absent until post-release evidence supports it
- Sources

### 9.4 Location

- Location identity and media/fallback
- Observed traits and published context
- Related Entities where governed
- Future map/collectibles area remains absent; no interactive map is planned here
- Sources

## 10. Collections and homepage

### Collections

- Collection title, scope, count, and release-state note
- Search/filter controls only when they improve discovery
- visual Entity Grid with no-image parity
- supporting editorial/release material in a separate lower-priority section

Cards should not contain many Facts. A reader should recognize the Entity, understand why it is in the collection, and open the detail page.

### Homepage

The homepage should prioritize:

- brand and product statement
- prominent Search
- Weapon, Character, Boss, and World entry points
- selected publishable Entities or latest governed updates
- clear pre-release/release-state communication

It should not become a full-screen marketing campaign, autoplay media experience, or a dashboard of tiny statistics.

## 11. Accessibility contract

- Add a skip link and semantic `header`, `nav`, `main`, and `footer` landmarks.
- Preserve a logical heading outline with one H1.
- Every interactive control has a visible label or accessible name; button actions are buttons and navigation is links.
- Use a consistent `:focus-visible` ring with sufficient contrast and offset. Do not remove outlines without a replacement.
- Interactive targets should be at least 44×44 px as the project target, exceeding the WCAG 2.2 24×24 minimum where practical.
- Search dialog opens with focus inside, contains Tab/Shift+Tab, closes with Escape, restores trigger focus, and prevents background interaction.
- Mobile menu has explicit expanded state, Escape/outside-close behavior, and controlled focus.
- Images follow the alt/caption rules in `MEDIA-SOURCE-POLICY.md`.
- Essential information is never conveyed by color, image, hover, or animation alone.
- Respect `prefers-reduced-motion`; remove nonessential transforms/reveals and use immediate state changes where requested.

References: [WAI-ARIA modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/), [WCAG 2.2 Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible), [Target Size Minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), and [Animation from Interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html).

## 12. Motion and performance

Allowed motion is limited to short hover/focus transitions, disclosure/dialog state, and a small optional reveal. No scroll-jacking, parallax, background video, continuous motion, or large animation runtime.

Performance requirements:

- no client framework for static components
- no new large UI, icon, or animation dependency
- one interactive JavaScript path for shared Search/menu behavior where practical
- static H1, summary, facts, and Sources in build output
- responsive images with dimensions and limited eager loading
- a usable page with CSS, Search JS, or Entity Search failure

The current fixed full-page background texture should be re-evaluated in P2-UI-1 because it competes with surfaces and can increase mobile paint work.

## 13. Approval gate

This proposal does not authorize token implementation or page migration. P2-UI-1 begins only after approval of:

- Ink & Steel as the canonical visual direction
- semantic colors/type/layout scales
- component status and ownership
- single-theme recommendation
- accessibility and performance contracts
