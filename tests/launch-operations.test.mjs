import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {
  collectionTriggerFromCounts,
  evaluateBrowserGate,
  evaluateCurrentness,
  evaluateInventory,
  evaluateReleaseState,
  findFixtureLeakage,
  main,
  runPostDeploySmoke,
  spoilerTriggerFromState,
  validateLaunchConfig
} from '../scripts/check-launch-readiness.mjs';
import { loadProductionInventory } from '../scripts/astro/production-inventory.mjs';
import { siteLifecycle } from '../src/lib/site-lifecycle.mjs';

const root = path.resolve(import.meta.dirname, '..');
const fixtures = JSON.parse(await readFile(new URL('./fixtures/launch-operations-cases.json', import.meta.url), 'utf8'));
const config = JSON.parse(await readFile(new URL('../config/launch-operations.json', import.meta.url), 'utf8'));
const collectionId = 'collection-browser-interaction';
const spoilerId = 'spoiler-disclosure-interaction';

function status(results, value) {
  return results.some((result) => result.status === value);
}

test('launch operations config contains exactly two deferred, internally consistent Browser gates', () => {
  assert.deepEqual(validateLaunchConfig(config), []);
  assert.deepEqual(Object.keys(config.browserGates).sort(), [collectionId, spoilerId].sort());
  for (const gate of Object.values(config.browserGates)) assert.deepEqual(gate, fixtures.approvals.deferred);
});

test('T-14 and T-72 currentness distinguish fresh reviews from warnings', () => {
  assert(status(evaluateCurrentness(fixtures.currentness.fresh, { mode: 't-14', asOf: '2026-10-29', maxAgeDays: 14 }), 'PASS'));
  assert(status(evaluateCurrentness(fixtures.currentness.stale, { mode: 't-14', asOf: '2026-10-29', maxAgeDays: 14 }), 'WARN'));
  assert(status(evaluateCurrentness([{ ...fixtures.currentness.fresh[0], checkedAt: '2026-10-26' }], { mode: 't-72', asOf: '2026-10-29', maxAgeDays: 3 }), 'PASS'));
  assert(status(evaluateCurrentness([{ ...fixtures.currentness.fresh[0], checkedAt: '2026-10-25' }], { mode: 't-72', asOf: '2026-10-29', maxAgeDays: 3 }), 'WARN'));
});

test('release candidate blocks stale or missing mandatory reviews but only warns for stale noncritical sources', () => {
  const stale = evaluateCurrentness(fixtures.currentness.stale, { mode: 'release-candidate', asOf: '2026-10-29', maxAgeDays: 3 });
  const missing = evaluateCurrentness([{ ...fixtures.currentness.fresh[0], checkedAt: null }], { mode: 'release-candidate', asOf: '2026-10-29', maxAgeDays: 3 });
  const noncritical = evaluateCurrentness(fixtures.currentness.noncriticalStale, { mode: 'release-candidate', asOf: '2026-10-29', maxAgeDays: 3 });
  assert(status(stale, 'BLOCK'));
  assert(status(missing, 'BLOCK'));
  assert(status(noncritical, 'WARN'));
  assert(status(evaluateCurrentness([{ ...fixtures.currentness.fresh[0], checkedAt: '2026-10-30' }], { mode: 't-14', asOf: '2026-10-29', maxAgeDays: 14 }), 'BLOCK'));
});

test('release evidence permits an empty foundation and blocks missing or malformed dependencies', () => {
  const empty = evaluateReleaseState({ releaseVersions: [], releaseDependencies: [], releaseVerifiedFacts: [] });
  assert.equal(status(empty, 'BLOCK'), false);
  assert(empty.some((item) => item.status === 'INFO' && item.message.includes('No release Version')));
  assert(empty.some((item) => item.status === 'INFO' && item.message.includes('No release-verified')));
  const missingVersion = evaluateReleaseState({ releaseVersions: [], releaseDependencies: [{ id: 'guide:fixture' }], releaseVerifiedFacts: [] });
  assert(status(missingVersion, 'BLOCK'));
  const malformedFact = evaluateReleaseState({ releaseVersions: [{ id: 'version:release' }], releaseDependencies: [], releaseVerifiedFacts: [{ releaseTrack: false, internalReleaseTestSource: false }] });
  assert(status(malformedFact, 'BLOCK'));
  const validFact = evaluateReleaseState({ releaseVersions: [{ id: 'version:release' }], releaseDependencies: [], releaseVerifiedFacts: [{ releaseTrack: true, internalReleaseTestSource: true }] });
  assert.equal(status(validFact, 'BLOCK'), false);
});

test('draft and published Guide fixture validation remains owned by the existing Guide suite', async () => {
  const guideFixtures = JSON.parse(await readFile(new URL('./fixtures/guide-publication-cases.json', import.meta.url), 'utf8'));
  assert(guideFixtures.cases.some((item) => item.name === 'valid draft Guide' && item.expected === 'pass'));
  assert(guideFixtures.cases.some((item) => item.name === 'valid published Guide' && item.expected === 'pass'));
});

test('Collection Browser trigger uses the shared safe-item threshold', () => {
  assert.equal(collectionTriggerFromCounts({ weapons: 19 }).triggered, false);
  assert.equal(collectionTriggerFromCounts({ weapons: 20 }).triggered, true);
  assert.equal(collectionTriggerFromCounts({ weapons: 19, hiddenMajor: 50 }).active.some(([name]) => name === 'weapons'), false);
});

test('deferred Collection Browser gate allows Preview/local and blocks candidate/production', () => {
  for (const enforcement of ['local', 'preview']) assert.equal(evaluateBrowserGate({ id: collectionId, triggered: true, approval: fixtures.approvals.deferred, enforcement }).status, 'WARN');
  for (const enforcement of ['release-candidate', 'production']) assert.equal(evaluateBrowserGate({ id: collectionId, triggered: true, approval: fixtures.approvals.deferred, enforcement }).status, 'BLOCK');
  assert.equal(evaluateBrowserGate({ id: collectionId, triggered: true, approval: fixtures.approvals.passed, enforcement: 'production' }).status, 'PASS');
  assert.equal(evaluateBrowserGate({ id: collectionId, triggered: false, approval: fixtures.approvals.deferred, enforcement: 'production' }).status, 'NOT APPLICABLE');
});

test('spoiler trigger covers Guide, Entity, first minor Fact, first minor Media and block-level disclosure', () => {
  const cases = [
    { guides: [{ status: 'published', spoilerLevel: 'minor' }] },
    { entities: [{ recordState: 'published', spoilerLevel: 'minor' }] },
    { facts: [{ published: true, spoilerLevel: 'minor' }] },
    { media: [{ recordState: 'published', spoilerLevel: 'minor' }] },
    { renderedHtml: ['<details data-spoiler-level="major">'] }
  ];
  for (const item of cases) assert.equal(spoilerTriggerFromState({ guides: [], entities: [], facts: [], media: [], renderedHtml: [], ...item }).triggered, true);
  assert.equal(spoilerTriggerFromState({ guides: [], entities: [], facts: [], media: [], renderedHtml: [] }).triggered, false);
});

test('unpublished or unreachable minor Fact and Media do not activate the production spoiler gate', () => {
  const base = { guides: [], entities: [], facts: [], media: [], renderedHtml: [] };
  assert.equal(spoilerTriggerFromState({ ...base, facts: [{ published: false, spoilerLevel: 'minor' }] }).triggered, false);
  assert.equal(spoilerTriggerFromState({ ...base, facts: [{ spoilerLevel: 'minor' }] }).triggered, false);
  assert.equal(spoilerTriggerFromState({ ...base, media: [{ recordState: 'draft', spoilerLevel: 'minor' }] }).triggered, false);
  assert.equal(spoilerTriggerFromState({ ...base, media: [{ recordState: 'retired', spoilerLevel: 'minor' }] }).triggered, false);
});

test('deferred spoiler gate allows Preview and blocks candidate/production; approval passes', () => {
  assert.equal(evaluateBrowserGate({ id: spoilerId, triggered: true, approval: fixtures.approvals.deferred, enforcement: 'preview' }).status, 'WARN');
  assert.equal(evaluateBrowserGate({ id: spoilerId, triggered: true, approval: fixtures.approvals.deferred, enforcement: 'release-candidate' }).status, 'BLOCK');
  assert.equal(evaluateBrowserGate({ id: spoilerId, triggered: true, approval: fixtures.approvals.deferred, enforcement: 'production' }).status, 'BLOCK');
  assert.equal(evaluateBrowserGate({ id: spoilerId, triggered: true, approval: fixtures.approvals.passed, enforcement: 'production' }).status, 'PASS');
});

test('passed approvals require both date and evidence; deferred records cannot carry approval data', () => {
  for (const invalid of [
    { ...fixtures.approvals.passed, approvedAt: null },
    { ...fixtures.approvals.passed, evidenceRef: null },
    { ...fixtures.approvals.deferred, approvedAt: '2026-10-28' }
  ]) {
    const candidate = structuredClone(config);
    candidate.browserGates[collectionId] = invalid;
    assert.notDeepEqual(validateLaunchConfig(candidate), []);
  }
});

test('fixture leakage blocks and dynamic inventory growth passes only when projections agree', () => {
  assert.deepEqual(findFixtureLeakage(['ordinary production output']), []);
  assert.deepEqual(findFixtureLeakage(['contains Hidden Entity']), ['Hidden Entity']);
  assert.equal(evaluateInventory(fixtures.inventory.grown, fixtures.inventory.grown).status, 'PASS');
  assert.equal(evaluateInventory(fixtures.inventory.grown, { ...fixtures.inventory.grown, searchDocs: 19 }).status, 'BLOCK');
  assert.equal(evaluateInventory(fixtures.inventory.grown, { ...fixtures.inventory.grown, sitemap: 28 }).status, 'BLOCK');
});

function mockFetch(routes) {
  const calls = [];
  const fetchImpl = async (url) => {
    const pathname = new URL(url).pathname;
    calls.push(pathname);
    const route = routes[pathname] || { status: 404, body: 'not found' };
    return new Response(route.body, { status: route.status });
  };
  return { calls, fetchImpl };
}

function healthyRoutes(inventory = fixtures.inventory.baseline) {
  const routes = {};
  for (const route of ['/', '/guide', '/weapons', '/bosses', '/characters', '/world', '/about']) {
    const lifecycle = route === '/' ? siteLifecycle.copy.homepage.eyebrow : '';
    routes[route] = { status: 200, body: `<link rel="canonical" href="${new URL(route, 'https://www.yingzhirenling.cn').href}">${lifecycle}` };
  }
  routes['/sitemap.xml'] = { status: 200, body: '<urlset>' + '<url></url>'.repeat(inventory.sitemap) + '</urlset>' };
  routes['/robots.txt'] = { status: 200, body: 'User-agent: *' };
  routes['/generated/search-index.production.json'] = { status: 200, body: JSON.stringify(Array.from({ length: inventory.searchDocs }, () => ({}))) };
  return routes;
}

test('post-deploy smoke passes healthy first-party routes and ignores unrelated third-party state', async () => {
  const { calls, fetchImpl } = mockFetch(healthyRoutes());
  const results = await runPostDeploySmoke({ baseUrl: 'https://example.test', expectedInventory: fixtures.inventory.baseline, fetchImpl });
  assert.equal(status(results, 'BLOCK'), false);
  assert(calls.includes('/'));
  assert.equal(calls.some((route) => route.includes('analytics')), false);
});

test('post-deploy smoke blocks first-party errors, lifecycle mismatch and projection mismatch', async () => {
  const failed = healthyRoutes();
  failed['/about'] = { status: 500, body: 'error' };
  assert(status(await runPostDeploySmoke({ baseUrl: 'https://example.test', expectedInventory: fixtures.inventory.baseline, fetchImpl: mockFetch(failed).fetchImpl }), 'BLOCK'));
  const lifecycleMismatch = healthyRoutes();
  lifecycleMismatch['/'].body = '<link rel="canonical" href="https://example.test/">wrong lifecycle';
  assert(status(await runPostDeploySmoke({ baseUrl: 'https://example.test', expectedInventory: fixtures.inventory.baseline, fetchImpl: mockFetch(lifecycleMismatch).fetchImpl }), 'BLOCK'));
  const inventoryMismatch = healthyRoutes();
  inventoryMismatch['/sitemap.xml'].body = '<urlset><url></url></urlset>';
  assert(status(await runPostDeploySmoke({ baseUrl: 'https://example.test', expectedInventory: fixtures.inventory.baseline, fetchImpl: mockFetch(inventoryMismatch).fetchImpl }), 'BLOCK'));
});

test('post-deploy requires an explicit base URL before any network access', async () => {
  let called = false;
  const original = globalThis.fetch;
  globalThis.fetch = async () => { called = true; throw new Error('unexpected'); };
  try {
    assert.equal(await main(['--mode=post-deploy', '--as-of=2026-10-29']), 1);
    assert.equal(called, false);
  } finally { globalThis.fetch = original; }
});

test('ordinary build guard source contains no network orchestration and post-deploy owns fetch calls', async () => {
  const source = await readFile(new URL('../scripts/check-launch-readiness.mjs', import.meta.url), 'utf8');
  const beforePostDeploy = source.slice(0, source.indexOf('export async function runPostDeploySmoke'));
  assert.equal(/\bfetch\s*\(/.test(beforePostDeploy), false);
  assert.match(source, /options\.mode === 'post-deploy'/);
});

test('current production keeps zero launch content, dormant triggers and dynamic baseline counts', async () => {
  const inventory = await loadProductionInventory(root);
  assert.deepEqual(inventory.counts, fixtures.inventory.baseline);
  assert.equal(inventory.guides.length, 0);
  const families = {
    weapons: inventory.publishedWeapons.filter((item) => item.spoilerLevel !== 'major').length,
    bosses: inventory.publishedBosses.filter((item) => item.spoilerLevel !== 'major').length,
    characters: inventory.publishedCharacters.filter((item) => item.spoilerLevel !== 'major').length,
    locations: inventory.publishedLocations.filter((item) => item.spoilerLevel !== 'major').length
  };
  assert.deepEqual(families, { weapons: 9, bosses: 3, characters: 3, locations: 1 });
  assert.equal(collectionTriggerFromCounts(families).triggered, false);
  const currentEntities = [...inventory.publishedWeapons, ...inventory.publishedBosses, ...inventory.publishedCharacters, ...inventory.publishedLocations];
  assert.equal(spoilerTriggerFromState({ guides: [], entities: currentEntities, facts: currentEntities.flatMap((item) => item.facts), media: [], renderedHtml: [] }).triggered, false);
  assert.equal(siteLifecycle.state, 'pre-release');
});

test('absence of exact unlock time and Guides remains informational and causes no inferred records', async () => {
  const inventory = await loadProductionInventory(root);
  assert.equal(inventory.guides.length, 0);
  assert.equal(JSON.stringify(config).includes('unlock'), false);
});
