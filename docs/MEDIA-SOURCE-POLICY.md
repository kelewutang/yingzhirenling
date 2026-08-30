# Media Source Policy Proposal

Status: lightweight proposal; not a legal opinion and not a frozen Knowledge Schema

Scope: Entity hero, card, gallery, inline, and thumbnail media

## 1. Purpose

Media must improve Entity identity without weakening data trust, copyright discipline, page performance, or no-image usability. A public URL or an official factual source is not automatically permission to copy and republish an image.

Until a Media record and rights review are approved, an asset must not be promoted into the production Entity media system merely because it is visually suitable.

## 2. Source priority

Preferred order for investigation:

1. S-GAME official channels
2. Phantom Blade Zero official site and official channels
3. PlayStation official pages/channels
4. official trailers and press assets with reviewable usage terms
5. release-time screenshots captured by the project from a lawfully accessed game build

Priority identifies likely authority and relevance. It does not replace a rights decision.

### 2.1 Official material

For each official asset, retain the exact source page/video/press-kit URL, publisher, retrieval context, and the evidence used for the proposed reuse status. A platform trailer being official supports provenance; it does not by itself prove unrestricted redistribution rights.

### 2.2 Self-captured media

Self-captured media should record:

- project contributor/capture owner
- platform and game build/version
- capture date
- source sequence or in-game context
- crop/edit history
- spoiler classification when relevant
- confirmation that the capture does not expose private test material or prohibited content

Self-captured screenshots are still subject to the game publisher's applicable policies and should receive a rights review before production publication.

### 2.3 Third-party media

Default: **do not copy, download, hotlink, or republish** third-party article images, wiki images, creator thumbnails, social images, icons, or proprietary artwork.

An exception requires a later documented case-by-case review covering purpose, license/permission, attribution, transformation if relevant, and jurisdictional risk. A Source citation for a fact is not a media license.

### 2.4 Unknown-source media

Unknown-source media is prohibited in production. Reverse-image guesses, filenames, or model memory are not acceptable provenance.

### 2.5 Generated media

AI-generated images must never be presented as a game screenshot, official artwork, Entity portrait, location view, or factual representation. This project should prefer deterministic CSS/typographic fallbacks for missing Entity media. Any future decorative generated artwork would require separate approval, clear labeling, and a non-factual role.

## 3. Usage roles

Every production Media record should declare one or more approved usages:

| Usage | Purpose | Default treatment |
| --- | --- | --- |
| `hero` | Primary Entity identity | Wide responsive crop; above-fold priority only when actually displayed |
| `card` | Collection recognition | Stable aspect ratio and focal crop; lazy outside the first viewport |
| `gallery` | Additional evidence/context | Full caption, source/credit, lazy loading |
| `inline` | Supports a specific passage/fact | Near the relevant text with caption/source |
| `thumbnail` | Compact Search/related result | Small derived asset; inherits source and rights restrictions |

Do not hard-code a remote URL independently into several page templates. A derived thumbnail remains governed by the source asset's rights and credit requirements.

## 4. Proposed Media data model

This is a design proposal only. It does not modify or freeze Knowledge Schema 1.0.

```text
Media
  id
  entityIds[]
  mediaType             image | video-poster | illustration | screenshot
  localPath OR remoteSrc
  sourceId              optional link to a governed Source
  sourceUrl
  creditLine
  caption
  alt
  usage[]               hero | card | gallery | inline | thumbnail
  rightsStatus
  rightsEvidence
  width
  height
  recordState           draft | published | retired
```

Proposed `rightsStatus` vocabulary:

- `permission-recorded`
- `official-press-use-reviewed`
- `self-captured-reviewed`
- `review-required`
- `do-not-use`

The final vocabulary requires project review. It must remain independent from:

- `Fact.status`
- `Source.authority`
- Entity `recordState`

A published Entity does not make all media about it publishable. A high-authority Source does not automatically grant image reuse rights.

### 4.1 Proposed production gate

A Media record should reach production only when:

- its Entity target exists and is allowed in production
- source URL and source/credit context are recorded
- rights status is explicitly production-eligible
- local/remote path follows the approved hosting rule
- width and height are known
- usage and focal crop are defined
- alt and caption rules have been applied
- the asset passes file-type, decode, and performance checks

Draft or `review-required` media must stay out of production pages, Search thumbnails, social metadata, and sitemap-related output.

## 5. Hosting and file handling

- Prefer reviewed local assets so availability, dimensions, optimization, and cache behavior remain controlled.
- Do not hotlink third-party media.
- External media URLs, when explicitly approved, must be HTTP/HTTPS and allowed by the static image pipeline.
- Preserve an archival original only where rights permit; generate display variants from it.
- File extension, detected MIME type, and decode format must agree.
- Filenames should be deterministic and stable; do not include timestamps, random IDs, or local paths.

The current repository bitmap assets are not automatically grandfathered into the new Media system. The audit found no accompanying media-rights records, and some filename extensions do not match their encoded image formats. P2-UI-6 should inventory, identify, and either normalize, retain as reviewed legacy decoration, replace, or retire them. This proposal does not delete or change them.

## 6. Alt, caption, and credit

### Alt text

- Describe the content and its purpose in the current context, not the filename.
- Identify the Entity when that is what the image communicates.
- Include a meaningful observable detail only when it helps understand the page.
- Do not include uncertain lore, identity, location, or action.
- Use `alt=""` for truly decorative texture that is adjacent to complete textual identity.
- Do not prefix with “图片：” or repeat an adjacent caption verbatim.

Example:

```text
唐横刀在公开视频战斗画面中的侧面特写
```

This wording is acceptable only if the record/source supports that identification.

### Caption

A caption explains context: trailer/demo/build, observable scene, crop/edit note where relevant, and spoiler context. It must distinguish observation from official description.

### Credit

Credit follows the recorded rights/press requirement and links to the exact source where appropriate. “来自网络” and “官方图片” are not sufficient records.

## 7. Fallback system

Pages must remain visually complete when no lawful image exists.

The fallback should be deterministic and generated from local code/assets:

- fixed media aspect ratio identical to the real-media slot
- subtle charcoal/iron gradient or low-contrast CSS texture
- small Entity-type label or reviewed local inline SVG mark
- Entity name or restrained typographic monogram
- explicit no-image behavior without a fake screenshot frame

Fallbacks may differ by type through a non-factual abstract motif, but must share the same design grammar. Do not use random stock art, third-party icons, or generated approximations of game imagery.

The title, alias, category, summary, and primary facts remain normal HTML outside the image. Recognition must not depend on image loading.

## 8. Responsive image and performance approach

After approval, locally stored Media should use Astro's static image pipeline rather than runtime transformation. Astro's [`Image` and `Picture`](https://docs.astro.build/en/reference/modules/astro-assets/) support generated formats, dimensions, responsive sources, and priority behavior for local assets.

Proposed output strategy:

- Hero: 640, 960, 1280, and 1600 px candidates as justified by the source; AVIF/WebP plus a compatible fallback.
- Card: 320, 480, and 640 px candidates.
- Gallery: responsive candidates based on reading/wide container, loaded lazily.
- Thumbnail: a distinct small derivative, not the full Hero download.
- Always emit intrinsic `width` and `height` or an equivalent reserved aspect ratio to prevent layout shift.
- Use `srcset`/`sizes` that reflect the real layout, not `100vw` by habit.
- Eager/high-priority load at most the actual above-fold Hero. Do not mark every collection card as priority.
- Use `loading="lazy"` for below-fold card/gallery media and `decoding="async"` where appropriate.

Initial guardrails, to be tuned with real assets:

- primary Hero target: at or below roughly 250 KB for the common desktop candidate
- card target: at or below roughly 80 KB per common displayed candidate
- below-fold gallery target: at or below roughly 180 KB per common displayed candidate
- initial responsive media budget: roughly 400 KB on a typical mobile first view and 650 KB on desktop where a Hero is present

These are payload targets, not permission to destroy material visual detail. Crop choice, source resolution, and actual measurement decide the final output.

Browser behavior and responsive syntax should follow the platform's [`img` guidance](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/img), including intrinsic dimensions, `srcset`, `sizes`, and deliberate lazy loading.

## 9. Media UI rules

- Hero crops must have a recorded focal point or an art-directed variant when one crop cannot serve desktop and mobile.
- Text must not be baked into screenshots to provide critical labels.
- Captions and credits remain readable at mobile width and are not permanently hidden behind hover.
- Gallery controls require keyboard access, clear labels, and reduced-motion behavior.
- A lightbox is not required for the first media rollout; normal links to an approved larger asset may be sufficient.
- Do not use autoplay video, video backgrounds, or constant animated media.

## 10. Review checklist

Before a media batch is proposed:

- [ ] Exact origin and rights evidence are recorded.
- [ ] Entity identification is supported, not guessed.
- [ ] Usage roles and crop are approved.
- [ ] Alt, caption, and credit are accurate.
- [ ] Extension, MIME, dimensions, and decode are valid.
- [ ] Responsive candidates meet visual and payload targets.
- [ ] Page remains complete when the image fails or is omitted.
- [ ] Draft/unknown/third-party-unreviewed media is absent from production output.

## 11. Approval gate

This proposal does not authorize downloading, copying, converting, or publishing media. Before P2-UI-6, approve:

- Media as a separate governed data layer
- fields and rights-status vocabulary
- treatment of current legacy assets
- official/press/self-capture rights review procedure
- image payload targets and crop workflow
