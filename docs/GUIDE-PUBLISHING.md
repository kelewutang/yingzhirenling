# Guide Publishing Foundation

> P3-CN-7G-B implementation candidate. This document describes work on its feature branch; it does not claim a merge, deployment, or completed publication stage.

## Content and identity

Guides use the single Astro `guides` Content Collection at `src/content/guides/`. A Markdown filename supplies the stable Guide ID and route identity: `some-guide.md` renders at `/guide/some-guide`. IDs must be unique ASCII kebab-case; frontmatter does not define a second slug.

Production currently contains no Guide Markdown files. The retained `.gitkeep` keeps the empty source directory explicit. Test-only fixtures exercise the public projection without entering production output.

The V1 frontmatter contract requires `title`, `description`, `status`, `guideType`, `publishedAt`, `updatedAt`, and `sourceIds`. `draft` permits null dates and an empty source list; `published` requires dates and at least one valid Source. The supported types are `walkthrough`, `boss`, `weapon`, `system`, and `performance`.

The page template supplies the only H1. Markdown bodies start at H2 and the validator rejects a Markdown H1.

## Publication projection

Only published Guides receive a static detail page, sitemap entry, Production Search document, landing card, or Entity related-guide link. `updatedAt` represents meaningful Guide content or metadata updates; builds, deployments, no-change evidence checks, and unrelated UI work do not change it.

Guide detail routes are `/guide/{id}` with no trailing slash canonical URLs. `/guide` remains the landing page. The Astro landing preserves the legacy page's editorial content, quick navigation, FAQ, Article/FAQPage/Breadcrumb structured data, lifecycle copy, metadata, and shared shell.

## Knowledge references

`sourceIds`, optional `gameVersionId`, optional `factIds`, optional `relatedEntityIds`, and optional platform or difficulty scope reuse existing Knowledge registries. A published Guide cannot reference a superseded Fact or an unpublished public Entity. Guide publication does not change a Fact status, and a Guide is never itself `release-verified`.

The absence of Guide-wide platform or difficulty scope means no Guide-wide claim. It does not mean all platforms or difficulties were tested. The difficulty registry remains empty until independently verified values exist.

## Derived output

The published Guide projection derives detail routes, canonical metadata, Article and BreadcrumbList JSON-LD, sitemap entries, Search documents, landing discovery, and Entity related-guide lists. The build inventory derives public count expectations from stable routes, published Entities, and published Guides. It does not use lower-bound count checks. Its temporary Astro handoff is copied into the private `generated/guide-publication.inventory.json` build artifact and removed from `dist/`, so it is not a deployed Guide endpoint.

Future spoiler and Guide-media fields require their own gates and contracts. They are not part of this foundation.
