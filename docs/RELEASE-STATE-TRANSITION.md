# Release State Transition

## Current production state

`src/lib/site-lifecycle.mjs` currently sets `siteLifecycle.state` to `pre-release`.

This is an explicit editorial setting. It must never change from the calendar, a deployment timestamp, a browser setting, or a remote configuration request.

## Launch Day prerequisites

Before changing the lifecycle state, confirm all of the following:

1. The game is actually playable in the relevant production region.
2. Store availability, price, edition, preorder and reward status have been reviewed as separate commercial facts.
3. A real release GameVersion is ready if any formal-version Fact will be published.
4. An internal `site-release-test` Source and test session exist before any `release-verified` Fact is published.

## Lifecycle switch

1. Change only `siteLifecycle.state` from `pre-release` to `released` in `src/lib/site-lifecycle.mjs`.
2. Independently update confirmed commercial facts and Entity evidence. Do not infer either from the lifecycle setting.
3. Run `npm run test:site-lifecycle` and `npm run build`.
4. Review the Deploy Preview and perform the lifecycle Browser Gate.
5. Merge only after the Preview, build, lifecycle check and commercial review pass.
6. After production deployment, check the homepage, `/guide`, `/about-site`, shared Footer, sitemap, Search and production smoke results.

## Scope boundary

The state controls only site-lifecycle copy: homepage status, selected legacy-page status slots, shared Footer, collection framing, detail scope framing and Page Search descriptions.

It does not create a release Version, Source, Fact, guide, screenshot, patch record, price, preorder status, platform availability or formal verification. Historical references to pre-release materials remain when they describe the evidence for a specific claim.
