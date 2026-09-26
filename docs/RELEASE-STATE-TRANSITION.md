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

Run the repository launch checks with an explicit review date:

```sh
npm run check:launch -- --mode=t-14 --as-of=YYYY-MM-DD
npm run check:launch -- --mode=t-72 --as-of=YYYY-MM-DD
npm run check:launch -- --mode=release-candidate --as-of=YYYY-MM-DD
```

These commands report deterministic repository checks. They do not confirm editorial truth, change the lifecycle, create release evidence, publish content or approve a deployment.

Collection Browser and spoiler disclosure have separate Browser approvals. The first real trigger is allowed to build in a local build or Deploy Preview so that the interaction can be reviewed. A triggered gate without a valid approval blocks `release-candidate` and Netlify production builds.

## Lifecycle switch

1. Change only `siteLifecycle.state` from `pre-release` to `released` in `src/lib/site-lifecycle.mjs`.
2. Independently update confirmed commercial facts and Entity evidence. Do not infer either from the lifecycle setting.
3. Run `npm run test:site-lifecycle` and `npm run build`.
4. Review the Deploy Preview and perform the lifecycle Browser Gate.
5. Merge only after the Preview, build, lifecycle check and commercial review pass.
6. After production deployment, check the homepage, `/guide`, `/about-site`, shared Footer, sitemap, Search and production smoke results.

Run the first-party HTTP smoke only with an explicit deployment URL:

```sh
npm run check:launch -- --mode=post-deploy --as-of=YYYY-MM-DD --base-url=https://www.yingzhirenling.cn
```

This smoke does not submit IndexNow or call third-party analytics. Repository checks cannot prove the deployed SHA without an authoritative external deployment source, so that remains an operator check.

The following decisions always remain human: official source rechecks; release date, platform, store and commercial confirmation; actual regional playability; the lifecycle switch; release Version identity and creation; first-party test execution and internal evidence; creation of release-verified Facts; Guide publication and spoiler classification; Browser Gate approval; production merge and deployment; and rollback authorization.

## Rollback

1. Stop further publication and identify the last known-good `main` SHA and deploy.
2. If the incident is urgent, use an authorized Netlify rollback or known-good deploy.
3. Create a normal repository revert so source control matches the intended production state. Never rewrite shared `main` history.
4. Rebuild, review the Deploy Preview and merge through the normal workflow.
5. Rerun the production post-deploy smoke and complete the human content and commercial checks.

## Scope boundary

The state controls only site-lifecycle copy: homepage status, selected legacy-page status slots, shared Footer, collection framing, detail scope framing and Page Search descriptions.

It does not create a release Version, Source, Fact, guide, screenshot, patch record, price, preorder status, platform availability or formal verification. Historical references to pre-release materials remain when they describe the evidence for a specific claim.
