# P1-10 Astro Production Migration Candidate

## Scope

This branch is a production-equivalent static candidate for Netlify Deploy Preview. It is not a Production Switch. The production `main` context continues to publish the committed root static site; only `context.deploy-preview` runs `npm ci && npm run build` and publishes `dist`.

Character Publication Ready does not mean Character is published during P1-10. Framework migration and new content publication remain separate variables. Soul, 魔渊, and The Hunt stay draft with `publishedAt: null`; their relations therefore have zero production visibility. Character Publication requires a later independent gate after production migration is verified.

## Architecture

The root Astro layer is presentation and static build only:

```text
Knowledge Schema 1.0 data/
  -> existing strict validator
  -> Astro static published-Weapon projection
  -> production Search generator guarded against dist Weapon routes
  -> explicit legacy copy bridge
  -> deterministic dist verification
```

Astro uses static output, file format, and no adapter, hydration, Content Collections, runtime Knowledge fetch, or client framework. It directly reads `data/`; the existing validator and Search generator remain authoritative.

The legacy copy bridge is a migration bridge, not the long-term architecture. It copies the nine existing pages and unchanged CSS, JavaScript, assets, favicon, robots, custom 404, and production Search artifact into `dist`. It does not parse or rewrite legacy page content. Existing Netlify Weapon rewrites are preserved by copying the Astro-generated Weapon HTML to their historical physical targets; the canonical Astro file remains the Search guard target. Delete the bridge after all legacy routes migrate to Astro and the redirect contract is independently switched.

## Node and dependency boundary

`.nvmrc` and `package.json#engines.node` both select Node `24.19.0`. Astro `7.2.8` requires Node `>=22.12.0`. The only direct dependency is Astro. Preview builds obtain the same Node from the repository version declaration and run the locked `npm ci` install.

## Search, sitemap, and SEO

Production Search is regenerated from Knowledge data after Astro emits the pages. The existing generator accepts an explicit Candidate detail directory and fails if either published Weapon HTML or its production canonical is absent. A fixture covers missing page, mismatched canonical, and valid Astro output. The resulting Search index remains exactly two Weapon documents.

The static sitemap endpoint combines an explicit nine-page legacy transition list with the same published Weapon projection. It emits exactly 11 production-domain canonical URLs and uses data `updatedAt` for Weapon `lastmod`; it never uses build time. Draft Weapon, Character, and Relation data are excluded.

When Netlify supplies `CONTEXT=deploy-preview`, output includes a `_headers` file with `X-Robots-Tag: noindex, nofollow`. Ordinary and future production builds do not emit that file; production source pages and `robots.txt` are unchanged. Page canonical values continue to use `https://www.yingzhirenling.cn`.

## Rollback

No legacy generator or committed production artifact is deleted. Before Production Switch, rollback is simply abandoning or reverting this isolated Candidate branch/configuration; `main` and the current static production deploy remain unchanged.
