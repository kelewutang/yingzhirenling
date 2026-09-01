# Performance Baseline

Status: P2-UI-7 static baseline. This is a reproducible build observation, not a cross-network Lighthouse target.

## Context

- Baseline commit: `100434815b9234dc8b2bf9c19cd0a38eb6e40faa`
- Build: `npm run build` on 2026-09-01
- Output: Astro static `dist/`; no client framework hydration or Astro islands
- Production Media contract records: 0

## Measured output

| Item | Count | Bytes |
| --- | ---: | ---: |
| `dist/` total | 42 files | 2,598,387 |
| HTML | 27 | 313,763 |
| CSS | 1 | 66,155 |
| JavaScript | 1 | 16,403 |
| First-party image/media assets | 9 | 2,190,224 |
| Fonts | 0 | 0 |
| Production Media contract assets | 0 | 0 |

Representative HTML files: `/` 9,895 B; `/weapons` 15,184 B; `/characters` 8,095 B; `/weapons/tang-hengdao` 13,914 B; `/characters/soul` 11,938 B; `/404.html` 5,614 B. The production Entity Search index is 8,498 B for 15 documents. The sitemap contains 24 URLs.

Largest files: `assets/hero-logo.png` 746,887 B; `assets/bg-texture.jpg` 491,190 B; `assets/hero-bg.jpg` 413,900 B; `assets/map-pangzhen.jpg` 266,832 B; `css/style.css` 66,155 B; `js/main.js` 16,403 B. The images are pre-existing legacy `assets/` files, not admitted `assets/media/` records; their rights eligibility remains unresolved and they must not be treated as cleared Entity Media.

## Runtime observations

- Core content is static HTML; the only build output JavaScript is native `js/main.js`.
- Entity Search fetches one 8,498 B production index after DOM readiness. Page Search is bundled and remains usable if that enhancement fails.
- No external font or Entity-media request is emitted by the representative Entity and collection pages with Media=0.
- `js/main.js` dynamically inserts Baidu analytics (`hm.baidu.com`) and Baidu push (`zz.bdstatic.com`). They are third-party, non-blocking dynamic scripts; failures are known third-party behavior and do not provide core content.
- `/videos` contains four lazy Bilibili iframe embeds. They are outside the representative Media=0 routes and remain a separate third-party runtime cost.

## Reproduce

```bash
npm run build
find dist -type f -printf '%s %p\n' | sort -nr
find dist -type f -name '*.html' -exec wc -c {} +
find dist -type f -name '*.css' -o -name '*.js'
wc -c generated/search-index.production.json dist/sitemap.xml
```

The build-time Media validator is the regression guard for media admission: it requires a valid local `assets/media/` filename, signature/MIME/dimensions, rights evidence, declared usage, and a published Entity target before a published record can render. The static dist checks assert the current Media=0 fallback path and reject generated Entity `<img>` output until a separately reviewed media-admission update changes that expectation.

## Known limitations and follow-up

- Lighthouse is unavailable in this environment and was not installed for this baseline.
- Network timing varies by deploy location and is recorded only during the later Deploy Preview browser gate.
- Legacy CSS consolidation and legacy asset review are deferred to P2-UI-8. This baseline does not set brittle byte ceilings before a cleared responsive-media batch exists.
