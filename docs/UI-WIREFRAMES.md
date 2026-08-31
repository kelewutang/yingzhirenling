# P2 UI Wireframes

Status: structural proposal, not production markup

Visual direction: **Ink & Steel / 墨锋铁骨**

These wireframes define hierarchy and responsive behavior. Bracketed `Future` areas are template plans, not visible empty sections and not permission to create facts.

## 1. Shared shell

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Skip to content                                                     │
│ Brand       Weapons  Characters  Bosses  World   More   [Search ⌘K] │
└──────────────────────────────────────────────────────────────────────┘
│ MAIN                                                                │
│ ...                                                                 │
┌──────────────────────────────────────────────────────────────────────┐
│ Project scope + release state │ Entity links │ Guides/About/Policy  │
└──────────────────────────────────────────────────────────────────────┘
```

Shell rules:

- Four Entity hubs are the primary navigation.
- Guides, videos, and project pages are grouped as secondary navigation rather than receiving equal weight.
- Search is visible by label on desktop and remains a labeled button on mobile.
- Active route uses text and border/marker, not color alone.
- Header remains useful without JavaScript; menu/Search interactions progressively enhance.

## 2. Homepage

### Desktop

```text
┌────────────────────────────── SiteHeader ─────────────────────────────┐
├───────────────────────────────────────────────────────────────────────┤
│ PRE-RELEASE KNOWLEDGE BASE                                            │
│                                                                       │
│ 影之刃零                                                              │
│ 可核验的武器、角色、Boss 与世界资料                                   │
│                                                                       │
│ ┌──────────────── Search knowledge ────────────────────────────────┐ │
│ │ 搜索武器、角色、Boss、地点…                              Search │ │
│ └──────────────────────────────────────────────────────────────────┘ │
│ Release-state note · Facts keep their own provenance/status           │
├───────────────────────────────────────────────────────────────────────┤
│ EXPLORE                                                               │
│ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐           │
│ │ Weapons  8 │ │Characters 3│ │ Bosses   3 │ │ World    1 │           │
│ │ short label│ │ short label│ │ short label│ │ short label│           │
│ └────────────┘ └────────────┘ └────────────┘ └────────────┘           │
├───────────────────────────────────────────────────────────────────────┤
│ FEATURED / RECENTLY PUBLISHED                                         │
│ ┌──── Entity card ────┐ ┌──── Entity card ────┐ ┌──── Entity card ─┐ │
│ │ media or fallback   │ │ media or fallback   │ │ media or fallback│ │
│ │ type · name · brief │ │ type · name · brief │ │ type · name ·... │ │
│ └─────────────────────┘ └─────────────────────┘ └───────────────────┘ │
├───────────────────────────────────────────────────────────────────────┤
│ HOW THIS SITE HANDLES PRE-RELEASE INFORMATION                         │
│ Short trust explanation                         [Read methodology]     │
└───────────────────────────────────────────────────────────────────────┘
┌────────────────────────────── SiteFooter ─────────────────────────────┐
```

The Hero is a compact brand and Search entry, not a full-viewport marketing panel. Featured content is optional and only renders from governed published content; it must not become manually invented “latest” data.

### Mobile

- Brand/Search value appears within the first viewport; the Hero does not force Entity hubs below a decorative full-screen image.
- Explore hubs form a 2×2 grid if labels fit, otherwise a one-column list.
- Featured Entity cards are one column with a stable media ratio.
- Release-state explanation is short and links to the full methodology.

## 3. Collection page

Applies to `/weapons`, `/characters`, `/bosses`, and `/world`.

### Desktop

```text
SiteHeader

Breadcrumb

COLLECTION TYPE
Weapons                                      8 published
Short scope/summary and pre-release boundary

┌──────────────────── Search this collection ────────────────┐
│ query                                            [Filters] │
└─────────────────────────────────────────────────────────────┘

Entity Grid
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ 4:3 media /     │ │ 4:3 media /     │ │ 4:3 media /     │
│ type fallback   │ │ type fallback   │ │ type fallback   │
├─────────────────┤ ├─────────────────┤ ├─────────────────┤
│ WEAPON · class  │ │ WEAPON · class  │ │ WEAPON · class  │
│ Entity Name     │ │ Entity Name     │ │ Entity Name     │
│ Alias           │ │ Alias           │ │ Alias           │
│ Two-line summary│ │ Two-line summary│ │ Two-line summary│
└─────────────────┘ └─────────────────┘ └─────────────────┘

[More rows]

──────────────── Supporting knowledge ───────────────────────
Clearly subordinate editorial/release material, if retained

SiteFooter
```

Rules:

- The whole card is one link; no nested “View details” link.
- Image and fallback use the same box, so a no-media Entity does not collapse or jump.
- The card displays identity, not a miniature list of facts.
- Filters appear only for categories supported by actual data and useful collection size.
- A zero-filter result uses an `EmptyState` with reset action; it does not imply no Entities exist.
- Legacy editorial content may remain below the inventory after a clear section boundary.

### Mobile

- Title/count may wrap into separate lines.
- Search is full width; filter controls are 44 px targets and wrap below it.
- Grid becomes one column. A compact horizontal card may be considered only after proving that long Chinese/English names and fallback media remain readable.
- Do not use a sideways-scrolling card carousel for the canonical collection.

## 4. Weapon detail pilot

Implementation note: P2-UI-2 applies this frame only to `/weapons/tang-hengdao`. It deliberately uses the no-media fallback shown below; no external or unreviewed asset is introduced.

### Desktop

```text
SiteHeader

Breadcrumb: Home / Weapons / 唐横刀

┌─────────────────────────────────────────────────────────────────────┐
│ ┌──────────────────────┐  WEAPON                                   │
│ │                      │  唐横刀                                    │
│ │ approved hero media  │  Tang Hengdao · aliases if present        │
│ │ or Weapon fallback   │  Category / compact fact labels           │
│ │                      │                                            │
│ │ caption + credit     │  Governed summary in readable measure     │
│ └──────────────────────┘  Updated context                           │
└─────────────────────────────────────────────────────────────────────┘

Pre-release scope note, only when required

QUICK FACTS
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ Label            │ │ Label            │ │ Label            │
│ Value            │ │ Value            │ │ Value            │
│ fact state/source│ │ fact state/source│ │ fact state/source│
└──────────────────┘ └──────────────────┘ └──────────────────┘

PUBLIC GAMEPLAY OBSERVATIONS                 optional local section nav
Readable narrative / grouped evidence

ACQUISITION / AVAILABILITY
Render only when a governed published fact exists

[Future template slots — not emitted while empty]
Moves & Skills · Build · Video · post-release verification

RELATED ENTITIES
Only validated relationships; absent if empty

SOURCES
┌─────────────────────────────────────────────────────────────────────┐
│ Source title · publisher/authority · date/context          [Open ↗] │
│ Source title · publisher/authority · date/context          [Open ↗] │
└─────────────────────────────────────────────────────────────────────┘

SiteFooter
```

The hero media and identity columns are peers, but the H1 and summary remain HTML outside the bitmap. Without approved media, the fallback occupies the same space and the page keeps its identity.

### Mobile-first detail at 390 px

```text
┌──────────────────── 390 px ────────────────────┐
│ Brand                         [Search] [Menu]   │  56 px shell
├────────────────────────────────────────────────┤
│ Home / Weapons / 唐横刀                         │  wraps; no clipping
│                                                │
│ ┌────────────────────────────────────────────┐ │
│ │ 358 × ~201 media or Weapon fallback       │ │  16:9, reserved
│ └────────────────────────────────────────────┘ │
│ caption / credit                              │
│                                                │
│ WEAPON · category                             │
│ 唐横刀                                        │  ~32/40; natural wrap
│ Tang Hengdao / aliases                        │  ~14–16; no truncation
│                                                │
│ Governed summary with comfortable line-height │
│ Updated context                               │
├────────────────────────────────────────────────┤
│ PRE-RELEASE SCOPE NOTE                        │
├────────────────────────────────────────────────┤
│ QUICK FACTS                                   │
│ ┌────────────────────────────────────────────┐ │
│ │ Label                                      │ │
│ │ Value                                      │ │
│ │ Fact state · readable source action        │ │
│ └────────────────────────────────────────────┘ │
│ [one fact per row; no cramped two-column grid]│
├────────────────────────────────────────────────┤
│ PUBLIC GAMEPLAY OBSERVATIONS                  │
│ Paragraphs and evidence groups                │
├────────────────────────────────────────────────┤
│ RELATED (only if data exists)                 │
├────────────────────────────────────────────────┤
│ SOURCES                                       │
│ Source title                                  │
│ publisher · date/context                      │
│ [Open source]                                 │
└────────────────────────────────────────────────┘
```

390 px behavior is not merely “stack desktop vertically”:

- Header presents only Brand, a 44×44 Search target, and a 44×44 Menu target. Primary links move into the controlled menu.
- Breadcrumb wraps or horizontally clips only as a last resort; the current Entity remains readable.
- Hero media is approximately 358×201 px inside 16 px gutters, with intrinsic dimensions/aspect ratio reserved before load.
- H1 uses roughly 32/40 px and may wrap naturally. Alias uses normal letter spacing and never overlays the image.
- Fact items become one column. Status and source actions remain text, not color-only dots.
- Section headings stay in document order; no sticky local table of contents at 390 px.
- Source records show a readable title, publisher/context, and labeled link rather than a long raw URL.
- Search opens as a near-full-width dialog below safe viewport margins, with 44 px controls and a scrollable result region capped by `100dvh`.
- Search preserves input focus, Tab/Shift+Tab containment, Escape close, trigger focus restoration, and static Page Search fallback.
- Reduced-motion users receive immediate layout states without sliding/reveal transitions.

## 5. Generic Entity detail

### Common frame

```text
SiteHeader
Breadcrumb

┌──────── approved media / fallback ────────┬──────── identity ───────┐
│ stable ratio, caption, credit             │ type · H1 · aliases     │
│                                           │ role/category if known  │
│                                           │ governed summary        │
└───────────────────────────────────────────┴─────────────────────────┘

Scope note if required
Primary Facts
Type-specific Sections
Related Entities if governed
Sources
SiteFooter
```

### Type-specific slots

| Entity | Identity/facts | Main governed content | Future slot, not rendered empty |
| --- | --- | --- | --- |
| Character | portrait/fallback, name, aliases, sourced role | relationships, facts, appearances/observations | deeper biography or progression data |
| Boss | media/fallback, name, classification if sourced | encounter observations, facts, related location | strategy/build/counter guidance |
| Location | landscape/fallback, name, classification if sourced | observed traits, facts, related entities | map, collectibles, route planner |

Templates must omit a group when its governed data is absent. They must not fill vertical symmetry with unsourced labels, `TBD` facts, fake stats, or empty cards.

## 6. Search dialog

```text
┌──────────────────────── Search ────────────────────────────┐
│ Search the knowledge base                          [Close] │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ query                                                  │ │
│ └────────────────────────────────────────────────────────┘ │
│ Page results remain available                              │
│ ────────────────────────────────────────────────────────── │
│ WEAPON                                                     │
│ 唐横刀 · Tang Hengdao                                      │
│ Short result context                                       │
│ ────────────────────────────────────────────────────────── │
│ BOSS                                                       │
│ Commander Cleave                                           │
│ Short result context                                       │
│                                             Esc to close    │
└─────────────────────────────────────────────────────────────┘
```

- Result type, title, alias, and short context have distinct hierarchy.
- Entity result enrichment may fail without removing static Page Search results.
- No image is required in the initial dialog. A future thumbnail must use the Media system and fallback parity.
- Dialog semantics and keyboard behavior follow the Design System accessibility contract.

## 7. Empty and no-media states

### No media

```text
┌──────────────────────────────┐
│ subtle deterministic texture │
│ WEAPON                        │
│ 唐横刀                        │
└──────────────────────────────┘
```

This is a normal identity state, not an error and not a prompt to use an unlicensed image.

### Empty filter result

```text
No published Entities match these filters.
[Reset filters]  [Search all knowledge]
```

Do not imply that no data exists globally, and do not surface draft Entities as a convenience.

## 8. Validation targets for implementation

When these wireframes move into P2-UI-1/P2-UI-2, validate:

- keyboard-only shell, mobile menu, Search, Entity cards, and Source links
- 390, 768, 1024, and wide desktop layouts
- long English name, long Chinese summary, missing alias, missing media, and one/many Sources
- CSS/JS failure and Entity Search index failure
- reduced motion and visible focus
- intrinsic media sizing and no avoidable layout shift
- unchanged canonical routes, static core content, production Search isolation, and sitemap behavior

## 9. Approval gate

These are preparation artifacts only. Do not implement the homepage, collections, Entity templates, or media rollout until the recommended visual direction, tokens, components, Media policy, and phase sequence are approved.
