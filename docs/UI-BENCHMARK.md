# P2-UI-0 UI Refresh Benchmark

Status: proposal, awaiting visual direction approval

Research date: 2026-08-31

Scope: audit and design preparation only; no production UI migration

## 1. Decision summary

The recommended direction is **Ink & Steel / 墨锋铁骨**: a dark martial-arts editorial system with restrained Chinese visual language, clear game-content hierarchy, and a strong no-image fallback.

Architecture recommendation:

- Keep Astro static output, native CSS, native JavaScript, committed Knowledge JSON, and build-time core content.
- Refactor the existing shared shell and components incrementally; do not replace the site with a UI framework.
- Use Starlight and mature game-content sites as pattern references, not as templates to copy.
- Consider small Astro-native components only after source, accessibility, license, and maintenance review.
- Do not add Tailwind, React, Vue, Svelte, a large icon library, or an animation library for P2-UI-1.

The primary problem is not that the current palette is insufficiently dramatic. Entity pages lack a strong identity layer, content patterns have blurred responsibilities, and media provenance is not modeled. Recoloring the existing cards would leave those problems intact.

## 2. Audit method and baseline

The audit covered the live HTTP output and the corresponding source, generated output path, CSS, and native JavaScript for:

- `/`
- `/weapons` and `/weapons/tang-hengdao`
- `/characters` and `/characters/soul`
- `/bosses` and `/bosses/commander-cleave`
- `/world` and `/world/pangzhen`
- desktop and mobile navigation, Search modal, footer, and a nonexistent route/404

The live routes returned the expected `200` statuses and the nonexistent route returned `404`. The repository baseline contains 8 published Weapons, 3 Characters, 3 Bosses, 1 Location, 15 production Search documents, and 24 sitemap URLs.

This was a structural and visual-code audit, supplemented by inspection of local bitmap assets. A graphical browser was not available in the execution environment, so breakpoint findings are implementation risks verified from HTML/CSS/JS rather than claims from pixel-level viewport QA. P2-UI-1 should include real-browser checks at 390 px, 768 px, 1024 px, and a wide desktop viewport.

## 3. Current UI audit

### 3.1 Highest-impact findings

| Priority | Finding | Problem type | Why it matters |
| --- | --- | --- | --- |
| P0 | Detail pages open with breadcrumb, title, metadata, and text but no composed Entity identity area or deterministic media fallback. | Media + visual hierarchy | A Weapon, Character, Boss, and Location feel like similarly styled articles rather than distinct game entities. A color change cannot solve this. |
| P0 | Every Fact and every Source uses a similarly heavy provenance card. | Information architecture + content density + trust presentation | Primary facts, supporting provenance, and full source records receive almost equal visual weight, making the page trustworthy but slow to scan. |
| P0 | Existing bitmap assets have no media-rights record; some extensions do not match their encoded formats. | Media + data trust | They cannot be promoted into a new Entity media system without an inventory and rights review. Format mismatches also make future processing less reliable. |
| P1 | The same generic `.card` language is reused for navigation, entities, editorial content, and warnings. | Component consistency | Cards do not communicate what is clickable, what is an Entity, and what is supporting content. |
| P1 | Legacy collection pages mix injected published Entity cards with long pre-existing editorial sections. | Information architecture | The canonical collection is not clearly collection-first; the inventory and the editorial guide compete for the same page hierarchy. |
| P1 | The header exposes many equal-weight links, an emoji-only Search control, and three small theme dots. | Navigation + accessibility + brand | Primary Entity routes, secondary content, Search, and theme controls lack priority. The shell feels functional rather than authored for this game. |
| P1 | Layout widths and spacing are set by several component rules and inline declarations. | Layout + spacing | Reading width, wide-content width, and section rhythm vary between legacy and Astro pages. |
| P1 | There is no global `:focus-visible` system; some controls suppress the default outline. | Accessibility + component consistency | Keyboard state is not predictable even though Search already contains valuable keyboard behavior. |
| P2 | A large fixed body texture is present across the site. | Visual + performance | It competes with content surfaces and can increase mobile paint cost. Texture should be a restrained layer, not the page identity. |
| P2 | Body and supporting copy are often 15 px or 13 px with mixed serif/system treatment. | Typography | Dense provenance copy and Chinese/English mixtures need a more explicit reading scale and line-height. |

### 3.2 Visual hierarchy and brand

The current site has recognizable dark, red, gold, and cyan cues, but those cues are distributed across many borders, badges, theme controls, and card surfaces. This produces “dark database” consistency without enough content identity.

Specific symptoms:

- The homepage background carries more visual identity than most Entity detail pages.
- Detail H1, alias, updated date, summary, Fact cards, and Source cards form a largely vertical sequence with limited contrast in importance.
- Collection cards have no media or type-specific fallback, so Entity categories are distinguished mainly by surrounding page context.
- Decorative red/gold treatment is not tied to a small semantic token set, which makes future refinement harder.
- The generic system lacks a clearly authored rhythm for eyebrow, H1, alias, summary, primary facts, body sections, and Sources.

### 3.3 Information architecture and content density

- Detail pages correctly keep facts and sources visible in static HTML, but each Fact is presented as a full provenance block. A compact Fact Item should show the value and fact-level status first, with provenance available without making every item a full Source card.
- Sources belong at the end of the evidence chain and should stay visible, but Source rows can be more compact than editorial content cards.
- Empty future areas such as Build, strategy, moves, map, or collectibles must not be rendered as invented content. Templates should define slots in code and documentation; pages should emit them only when governed data exists.
- Collection pages should lead with the published inventory and filters. Supplementary release-state/editorial material can follow as a distinct section.

### 3.4 Components and layout

- `EntityHeader`, `FactList`, `RelationList`, `SourceList`, and `Breadcrumb` are useful component boundaries and should be evolved rather than discarded.
- Header and footer exist in both the Astro layout and legacy static templates. This is a maintenance risk until shell ownership is consolidated.
- Outer site content reaches roughly 1280 px, detail reading content roughly 860 px, and several page-specific blocks use 760/900 px or inline spacing. P2 should replace these implicit choices with site, wide-content, and reading tokens.
- Card grids and section gaps change across page types. A small spacing scale can establish a repeatable vertical rhythm.

### 3.5 Navigation, Search, and mobile

Current strengths that must not regress:

- Search remains an enhancement: static pages and Page Search survive an Entity Search failure.
- Search uses only the production index.
- Search focuses the input, traps forward/reverse Tab, closes on Escape, and restores focus to the trigger.
- Mobile navigation maintains `aria-expanded` and closes after route selection.

Issues to address:

- Search has no visible desktop label or shortcut, and its emoji icon is not a durable icon strategy.
- The generated modal lacks a visible dialog heading; background inertness and page scroll locking are not explicit.
- Mobile navigation lacks explicit Escape, outside-click, and focus-management behavior.
- At the small breakpoint the navigation height changes while the menu top offset remains fixed, creating a likely visual gap.
- Theme dots are 22 px and therefore below the WCAG 2.2 24×24 CSS pixel minimum target exception baseline. P2-UI-1 should not preserve undersized controls merely for visual compactness.
- There is no skip link or site-wide focus-ring contract.

Search engine semantics are out of scope for this refresh. P2 should improve the trigger, dialog presentation, result hierarchy, and accessibility while preserving the existing query and failure behavior.

### 3.6 Footer and 404

- The footer is informative but large and repeated in multiple implementations. On mobile it should become a simple, predictable set of grouped links with the project trust statement prominent.
- The 404 correctly returns HTTP 404, uses `noindex,follow`, and offers Home/Search recovery.
- The 404 has a partial shell and inline styling. It should eventually share the production shell without changing its HTTP or robots behavior.

### 3.7 Entity and collection findings

| Page family | Current strength | Main gap | P2 implication |
| --- | --- | --- | --- |
| Weapon detail | Static facts and sources, clear release warning | No media/identity composition; facts have equal weight | Use as the pilot for Entity Hero, fallback media, compact facts, and Source Panel |
| Character detail | Shared evidence structure and relationships | Role, relationships, appearance, and portrait identity are not composed | Retain common frame; add only governed Character sections |
| Boss detail | Evidence-first content | No encounter identity; future strategy has no defined boundary | Add observed encounter area; keep strategy absent until publishable |
| Location detail | Published location facts and Sources | Location atmosphere, related entities, and future map boundary are not expressed | Use a Location-specific hero/fallback and observed-traits section; no interactive map |
| Collections | Published cards exist and remain static | Legacy editorial material competes with the Entity inventory | Make Entity grid primary, then clearly separate supporting content |
| Homepage | Brand/search/content entry points exist | Hierarchy leans toward decorative background and general cards | Build a compact brand + Search + Entity-hub structure, not a marketing landing page |

## 4. Benchmark A — Astro content systems

### withastro/starlight

Classification: **Reference only**

Repository: [withastro/starlight](https://github.com/withastro/starlight)

License: MIT

Maintenance observed: active repository and documentation at the research date

Starlight is not a suitable production replacement for this game-content site, but it demonstrates disciplined content-site boundaries:

- Header responsibilities are split into site identity, Search, navigation/actions, and mobile controls.
- Desktop Search uses a visible label and keyboard shortcut; its dialog is an explicit interaction surface rather than an icon with hidden meaning.
- Cards, Link Cards, Badges, Tabs, and Steps have distinct semantics instead of sharing one generic card treatment.
- Content width, type scale, color roles, and z-index values are tokenized without an enterprise-scale token engine.
- Skip link, navigation landmarks, focus behavior, and responsive overflow are part of the shell.
- Static content remains the primary artifact; client JavaScript is limited to interactions.

Patterns worth borrowing:

- Component boundaries, semantic variants, visible Search trigger, skip link, small token vocabulary, content-width discipline, and mobile header separation.
- Card/Grid for collection summaries, Badge for compact fact state, and Link Card only for a whole-card navigation target.
- Tabs only where multiple equivalent views genuinely exist. Core Facts and Sources must not be hidden in tabs.
- Steps only for future verified procedures, never for speculative pre-release strategy.

Patterns to avoid:

- Installing or theming Starlight as the site framework.
- Adopting its documentation information architecture, Pagefind engine, or documentation sidebar merely because its components are polished.
- Copying its CSS or component source wholesale.

Relevant references: [Cards](https://starlight.astro.build/components/cards/), [Badges](https://starlight.astro.build/components/badges/), [Link Cards](https://starlight.astro.build/components/link-cards/), [Tabs](https://starlight.astro.build/components/tabs/), [Steps](https://starlight.astro.build/components/steps/), and [customization](https://starlight.astro.build/guides/customization/).

## 5. Benchmark B — Astro UI candidates

Repository activity is a maintenance signal, not proof of accessibility or suitability. Any copied code would require a file-level license/attribution check and local review first.

| Candidate | Astro-native | React | Tailwind | Runtime JS | Accessibility signal | Useful patterns | Migration cost | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [Accessible Astro Components](https://github.com/incluud/accessible-astro-components) | Yes | No | No | Limited to interactive components | Explicit WCAG/accessibility focus; source still requires local verification | Modal, breadcrumb, skip link, card/media, tabs, focus management | Low per selected component; medium if adopted broadly | **Candidate for selective reuse**, after per-component audit; do not install in P2-UI-0 |
| [Bejamas UI](https://github.com/bejamas/ui) | Yes | No | Yes, Tailwind 4 | Zero by default; runtime for interaction | Semantic component focus | Component composition, data-slot conventions, breadth | High because it introduces Tailwind and a new styling contract | **Reference only** |
| [Starwind UI](https://github.com/starwind-ui/starwind-ui) | Primarily Astro with adapters | Optional adapters exist | Yes, Tailwind 4 | Framework-neutral runtime for interactive components | Broad accessible-component intent; verify each control | Dialog/navigation/component anatomy | High; large surface and styling/runtime contracts | **Reference only; reject adoption for current architecture** |
| [Adaptive Astro UI](https://github.com/david1gp/astro-ui) | Yes | No | Yes | Component-dependent | Insufficient evidence for a site-wide accessibility decision | Astro composition and responsive component ideas | Medium/high because of Tailwind and limited adoption evidence | **Reject adoption** |

The only plausible selective-reuse candidate is Accessible Astro Components because it is Astro-native and does not require a styling framework. Even then, the preferred path is first to compare its interaction behavior with the existing Search and shell, then reuse only where it reduces accessibility risk without creating a second design system.

## 6. Benchmark C — game wiki and guide UX

These sites were studied for general patterns only. Their art, icons, CSS, branding, and proprietary layout code must not be copied.

| Mode | Example | Strengths | Patterns worth borrowing | Patterns to avoid |
| --- | --- | --- | --- | --- |
| Wiki-heavy | [BG3 Wiki — Phalar Aluve](https://bg3.wiki/wiki/Phalar_Aluve) | H1/identity, lead media, compact properties, acquisition, actions, notes, gallery, dense cross-linking | Entity-first ordering, compact properties, clear “where found,” related links, gallery after facts | MediaWiki editing chrome, massive taxonomy, tool links, and visual density irrelevant to normal readers |
| Guide-heavy | [Icy Veins — Rend Barbarian](https://www.icy-veins.com/d4/guides/rend-barbarian-build/) | Author/update context, quick navigation, requirements, strengths/weaknesses, ordered long-form sections | Scan-first local navigation and explicit update/version discipline for future verified guides | Tier framing, speculative build advice, advertising cadence, and pre-release certainty |
| Database-heavy | [Kiranico — MHW weapons](https://mhworld.kiranico.com/en/weapons) | Strong Search, compact exact data, dense item/type browsing | Search/filter prominence, compact facts, and later cross-entity browsing when verified stats exist | All-taxonomy navigation, icon-only data, and dense numerical tables before release-verified data exists |
| Visual-heavy | [Prydwen — character collection](https://www.prydwen.gg/star-rail/characters/) and [character detail](https://www.prydwen.gg/star-rail/characters/acheron/) | Consistent image ratios, recognizable card identity, filters, composed detail hero | Stable media aspect ratios, filter hierarchy, strong image/fallback identity, quick metadata | Tier/review overload, tabs hiding core evidence, and making the page unusable when artwork is absent |

Cross-benchmark conclusions:

1. Lead with identity, then compact primary facts, then detailed observations, then Sources.
2. Use images to reinforce identity, not to carry the only route to recognition.
3. Treat collection cards as navigation summaries, not miniature detail pages.
4. Keep filters close to the collection and local navigation close to long content.
5. Preserve provenance, but reduce its visual weight relative to the fact it supports.
6. Do not inherit ad slots, tracking patterns, tier-list certainty, or image dependence.

## 7. Visual directions

### Direction A — Ink & Steel / 墨锋铁骨

**Recommended**

- Core mood: restrained dark martial-arts editorial; modern game knowledge base rather than event page.
- Background: near-black charcoal with quiet raised iron surfaces; texture is sparse and local.
- Accent: cinnabar for action/focus and aged brass only for selected highlights; no ubiquitous gold.
- Typography: highly readable system sans for body and metadata, restrained system serif for major Chinese display headings.
- Cards: flat surfaces, one-pixel borders, small radius, little or no shadow.
- Borders: graphite by default; accent borders only for focus, important state, or selected navigation.
- Images: neutral/dark treatment with intentional focal crops; no blanket red overlay.
- Advantages: survives missing media, keeps provenance legible, fits static content, and avoids both SaaS and cheap esports cues.
- Risks: can become too austere or documentation-like. Counter with a composed Entity Hero, deliberate media rhythm, type-specific fallback, and stronger collection imagery when cleared.

### Direction B — Cinematic Shadow / 暗幕电影感

- Core mood: trailer-like, atmospheric, large-scale game presentation.
- Background: deeper black with full-bleed image fields and gradient masks.
- Accent: saturated red and cold steel.
- Typography: larger display scale and shorter text blocks.
- Cards: image-forward overlays and translucent surfaces.
- Borders: minimal; depth relies on image and shadow.
- Images: wide crops and cinematic transitions.
- Advantages: immediate game identity and strong marketing impact.
- Risks: depends on a large cleared media library, raises performance cost, and makes no-image Entities visibly second class. It can drift into a marketing landing page.

### Direction C — Wuxia Archive / 武林档案

- Core mood: evidence-led martial archive with restrained editorial gravitas.
- Background: black ink with occasional warm paper-like panels.
- Accent: seal red, ink gray, and muted paper.
- Typography: serif-led headings and visibly structured annotations.
- Cards: document sheets, labels, and ruled facts.
- Borders: fine rules and editorial dividers.
- Images: framed as plates with caption and source.
- Advantages: strongest provenance storytelling and excellent long-form reading.
- Risks: can feel like a historical archive or pure documentation site rather than a current game-content product.

Direction A is recommended because it combines B's game identity with C's trust discipline while remaining strong before a complete legal media library exists.

## 8. UI tool decision matrix

Scores are qualitative: `High` compatibility/quality is favorable; `High` cost/lock-in is unfavorable.

| Choice | Visual potential | Astro compatibility | Runtime cost | Dependency cost | Maintenance | Accessibility | Migration cost | Lock-in | Decision |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Current Astro + native CSS/JS | High after refactor | High | Low | Low | High local control | Must be designed/tested locally | Low/medium incremental | Low | **Adopt** |
| Starlight pattern reference | High for content patterns | High conceptually | None when not installed | None | Mature reference | Strong reference baseline | Low | None | **Reference only** |
| Accessible Astro Components | Medium; styling remains local | High | Low/selective | Low | External package risk | Promising, verify source and behavior | Low/selective | Low | **Candidate for selective reuse** |
| Other Astro UI libraries | High in demos | Medium | Low/medium | Medium/high, often Tailwind | Varies | Varies | Medium/high | Medium | **Reference only** |
| Tailwind-based libraries | High | Medium | Low runtime, high build/style change | High for this repository | Introduces a second styling model | Library-dependent | High | Medium/high | **Reject current adoption** |
| React UI libraries | High | Low for current need | Higher hydration/runtime | High | Adds framework ownership | Library-dependent | Very high | High | **Reject** |

## 9. Recommended P2 implementation sequence

### P2-UI-1 — Design System + Shared Shell

- Approve Direction A and the semantic tokens.
- Implement token foundation, typography, widths, spacing, focus, skip link, header, desktop/mobile navigation, Search presentation, footer, and 404 shell.
- Preserve Search engine semantics, production-index behavior, focus trap, and static fallback.
- Do not add Entity media yet.

### P2-UI-2 — Weapon Detail Pilot

- Pilot the shared Entity Hero, deterministic media fallback, Quick Facts, observation sections, and compact Source Panel on Weapon detail pages.
- Test long Chinese/English names, missing aliases, missing images, and facts with different statuses.
- Keep future Build, moves, and video slots absent until governed content exists.

### P2-UI-3 — Entity Detail Rollout

- Apply the proven common frame to Character, Boss, and Location.
- Add only type-specific sections backed by current data.

### P2-UI-4 — Collection Pages

- Make visual Entity grids the primary collection experience.
- Add deterministic fallbacks and only useful filters; move supporting editorial material into a clearly subordinate section.

### P2-UI-5 — Homepage

- Implement the approved brand/Search/Entity-hub structure.
- Feature only publishable content and keep release-state communication visible.

### P2-UI-6 — Media Contract + Cleared Media Pilot

- Review and approve the proposed Media model separately from Knowledge Schema 1.0.
- Inventory current assets, resolve rights/format records, and pilot a very small cleared set.

### P2-UI-7 — Media Rollout + Performance QA

- Roll out approved responsive media by Entity priority.
- Measure mobile payload, CLS, and image crop quality; retain fallback parity.

### P2-UI-8 — Legacy Bridge and CSS Consolidation

- Retire duplicated shell/CSS paths only after production parity is demonstrated.
- Preserve URLs, canonicals, redirects, sitemap rules, and generated static behavior.

## 10. Approval gate

Before P2-UI-1 begins, approve or revise:

- Direction A as the visual direction
- semantic tokens and typography strategy
- shared component inventory
- Media Source Policy and Media-model proposal
- Astro/native CSS/native JS tool decision
- implementation sequence

No production UI refresh should be implemented or merged from this preparation phase.
