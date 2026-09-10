# Video Contract

Status: P3-CN-4B3-A foundation. This is a separate Video system, not an extension of the Image Media contract in `data/media.json`.

`data/videos.json` is the Video source of truth. It is validated at build time by `scripts/validate-videos.mjs`; this foundation does not yet migrate or render the legacy `/videos` bridge page.

## V1 record

Each record has a stable `video:` ID; `recordState`; title and description; platform and platform video ID; direct source URL; owner and source type; rights status and evidence; retrieval and platform publication dates; and a controlled kind. `relatedEntityIds` is optional and, when present, must contain unique current Entity IDs.

Video record states use the established standalone-media lifecycle: `draft`, `published`, and `retired`. Only `published` records with a production-eligible rights status may enter a future production projection. A draft record is not production data.

## Rights and provenance

The allowed rights vocabulary is shared semantically with Image Media:

- Production-eligible: `permission-recorded`, `official-press-use-reviewed`, `self-captured-reviewed`, `official-promotional-risk-accepted`.
- Production-ineligible: `review-required`, `do-not-use`.

Unknown values fail validation. `official-promotional-risk-accepted` records traceable official developer or publisher promotional material for which explicit reuse permission has not been established. The known risk must be recorded and accepted for production editorial use. It does not claim ownership, a license, permission, or legal certainty.

## Platform and URL safety

V1 supports only `bilibili` and `youtube`. A Bilibili record uses a validated BV ID; a YouTube record uses a validated 11-character video ID. The direct source URL must be the matching HTTPS canonical navigation URL for that platform and ID.

Navigation and embed URLs are deterministic helper output derived from the validated platform and ID. Arbitrary iframe/embed HTML, arbitrary embed URLs, `javascript:` and `data:` URLs, and unsupported hosts are not trusted inputs and fail validation when supplied.

V1 kinds are limited to `gameplay`, `trailer`, and `showcase`; it deliberately has no playlist, channel, Shorts, API, thumbnail, duration, or remote metadata features.
