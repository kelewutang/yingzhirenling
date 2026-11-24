import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {
  approvedP3Cn8gSpoilerScope,
  approvedReleaseWorldSpoilerScope,
  collectionTriggerFromCounts,
  evaluateBrowserGate,
  evaluateCurrentness,
  extractCurrentnessReviewDate,
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

test('launch operations config keeps Collection Browser deferred and records the approved spoiler evidence', () => {
  assert.deepEqual(validateLaunchConfig(config), []);
  assert.deepEqual(Object.keys(config.browserGates).sort(), [collectionId, spoilerId].sort());
  assert.deepEqual(config.browserGates[collectionId], {
    contractVersion: 1,
    status: 'passed',
    approvedAt: '2026-11-16',
    evidenceRef: 'docs/RELEASE-FIVE-WEAPONS-BATCH2-2026-11-16.md'
  });
  assert.deepEqual(config.browserGates[spoilerId], {
    contractVersion: 1,
    status: 'passed',
    approvedAt: '2026-11-16',
    evidenceRef: 'docs/RELEASE-WORLD-CONTENT-2026-11-16.md',
    scopeId: 'release-world-2026-11-16'
  });
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

test('configured commercial pricing is warning-only while mandatory release evidence still blocks', () => {
  assert.deepEqual(config.freshnessPolicy, { 't-14': 14, 't-72': 3, 'release-candidate': 3 });
  assert.deepEqual(config.launchCriticalSubjects.map(({ id, mandatoryForReleaseCandidate }) => [id, mandatoryForReleaseCandidate]), [
    ['release-date-platform-store', true], ['commercial-pricing', false], ['physical-edition', false], ['pc-requirements', false]
  ]);
  const options = { mode: 'release-candidate', asOf: '2026-10-29', maxAgeDays: config.freshnessPolicy['release-candidate'] };
  const subjects = config.launchCriticalSubjects.map((subject) => ({
    ...subject, checkedAt: ['commercial-pricing', 'physical-edition'].includes(subject.id) ? '2026-08-26' : '2026-10-26'
  }));
  const results = evaluateCurrentness(subjects, options);
  assert.deepEqual(results.map(({ status }) => status), ['PASS', 'WARN', 'WARN', 'PASS']);
  assert.equal(status(results, 'BLOCK'), false);
  assert.equal(results[1].message, 'commercial-pricing: review is 64 days old (window 3)');
  const staleRelease = evaluateCurrentness(subjects.map((subject) => subject.id === 'release-date-platform-store' ? { ...subject, checkedAt: '2026-10-25' } : subject), options);
  assert.deepEqual(staleRelease.map(({ status }) => status), ['BLOCK', 'WARN', 'WARN', 'PASS']);
  for (const checkedAt of ['invalid', '2026-10-30']) {
    assert.equal(evaluateCurrentness([{ ...subjects[1], checkedAt }], options)[0].status, 'BLOCK');
  }
});

test('warning-only pricing retains unverified shop prices as dated historical evidence', async () => {
  const html = await readFile(path.join(root, 'pages/about.html'), 'utf8');
  const review = html.match(/<aside\b[^>]*aria-label="区域价格信息状态"[\s\S]*?<\/aside>/)?.[0];
  assert(review, 'Pricing provenance must remain present');
  assert.equal(review.match(/<time\s+datetime="([^"]+)"/)?.[1], '2026-08-26');
  for (const platform of ['Epic国区', 'WeGame']) {
    const row = html.match(new RegExp(`<tr><td>${platform}</td>[\\s\\S]*?</tr>`))?.[0];
    assert(row, `${platform}: historical price row must remain present`);
    assert(row.includes('datetime="2026-08-26"') && row.includes('历史快照') && row.includes('未核实'), `${platform}: unverified prices must not become current verified facts`);
  }
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

test('P3-CN-8G spoiler approval cannot cover another Entity, Fact, Guide, Media or major disclosure', () => {
  const entity = { id: 'weapon:chizhe-canjian', recordState: 'published', spoilerLevel: 'minor' };
  const fact = { id: 'fact:weapon:chizhe-canjian:acquisition', published: true, spoilerLevel: 'minor' };
  const state = { guides: [], entities: [entity], facts: [fact], media: [], renderedHtml: [] };
  assert.equal(approvedP3Cn8gSpoilerScope(state), true);
  assert.equal(approvedP3Cn8gSpoilerScope({ ...state, entities: [{ ...entity, spoilerLevel: 'major' }] }), false);
  assert.equal(approvedP3Cn8gSpoilerScope({ ...state, facts: [{ ...fact, spoilerLevel: 'major' }] }), false);
  assert.equal(approvedP3Cn8gSpoilerScope({ ...state, facts: [...state.facts, { id: 'fact:other', published: true, spoilerLevel: 'minor' }] }), false);
  assert.equal(approvedP3Cn8gSpoilerScope({ ...state, guides: [{ status: 'published', spoilerLevel: 'minor' }] }), false);
  assert.equal(approvedP3Cn8gSpoilerScope({ ...state, media: [{ recordState: 'published', spoilerLevel: 'major' }] }), false);
  assert.equal(approvedP3Cn8gSpoilerScope({ ...state, renderedHtml: ['<details data-spoiler-level="major">'] }), false);
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

test('current candidate includes one non-spoiler Guide and one minor-spoiler Weapon', async () => {
  const inventory = await loadProductionInventory(root);
  const itemCount = inventory.publishedAccessories.length + inventory.publishedFlasks.length;
  assert.deepEqual([inventory.publishedAccessories.length, inventory.publishedFlasks.length], [13, 11]);
  assert.deepEqual(inventory.counts, { sitemap: 51 + itemCount + 2, canonical: 51 + itemCount + 2, pageHtml: 52 + itemCount + 2, searchDocs: 42 + itemCount });
  assert.equal(inventory.guides.length, 1);
  const families = {
    weapons: inventory.publishedWeapons.filter((item) => item.spoilerLevel !== 'major').length,
    bosses: inventory.publishedBosses.filter((item) => item.spoilerLevel !== 'major').length,
    characters: inventory.publishedCharacters.filter((item) => item.spoilerLevel !== 'major').length,
    locations: inventory.publishedLocations.filter((item) => item.spoilerLevel !== 'major').length
  };
  assert.deepEqual(families, { weapons: 26, bosses: 5, characters: 6, locations: 4 });
  assert.equal(collectionTriggerFromCounts(families).triggered, true);
  const currentEntities = [...inventory.publishedWeapons, ...inventory.publishedBosses, ...inventory.publishedCharacters, ...inventory.publishedLocations];
  const guides = inventory.guides.map((guide) => ({ ...guide, status: 'published' }));
  const spoilerTrigger = spoilerTriggerFromState({ guides, entities: currentEntities, facts: currentEntities.flatMap((item) => item.facts), media: [], renderedHtml: [] });
  assert.equal(spoilerTrigger.triggered, true);
  assert.deepEqual(spoilerTrigger.reasons, ['published Entity']);
  assert.equal(siteLifecycle.state, 'released');
});

test('absence of exact unlock time remains informational while the approved Guide is explicit', async () => {
  const inventory = await loadProductionInventory(root);
  assert.deepEqual(inventory.guides.map((guide) => guide.id), ['difficulty-and-sixty-six-days']);
  assert.equal(JSON.stringify(config).includes('unlock'), false);
});

test('release-world approval is limited to the named minor Entities and two closed major Fact disclosures', () => {
  const entities = ['weapon:chizhe-canjian', 'boss:cangang', 'boss:peng-meng', 'boss:hua-qianxiao', 'boss:a-hua', 'boss:zhui-ming'].map((id) => ({ id, recordState: 'published', spoilerLevel: 'minor' }));
  const facts = [
    { id: 'fact:weapon:chizhe-canjian:acquisition', published: true, spoilerLevel: 'minor' },
    { id: 'fact:location:beiqi-xigu:release-hidden-outpost', published: true, spoilerLevel: 'major' },
    { id: 'fact:character:mu-xiaokui:release-encounter', published: true, spoilerLevel: 'major' }
  ];
  const renderedHtml = facts.filter((f) => f.spoilerLevel === 'major').map((f) => `<details data-spoiler-level="major" data-nosnippet><summary>显示重大剧情内容</summary><article data-fact-id="${f.id}">测试数据</article></details>`);
  const state = { entities, facts, guides: [], media: [], renderedHtml };
  assert.equal(approvedReleaseWorldSpoilerScope(state), true);
  assert.equal(approvedP3Cn8gSpoilerScope(state), false, 'Old approval cannot authorize the new content');
  for (const mutation of [
    { entities: [...entities, { id: 'boss:unapproved', recordState: 'published', spoilerLevel: 'minor' }] },
    { entities: entities.map((e, i) => i === 0 ? { ...e, spoilerLevel: 'major' } : e) },
    { facts: [...facts, { id: 'fact:unapproved', published: true, spoilerLevel: 'major' }] },
    { facts: facts.map((f, i) => i === 1 ? { ...f, spoilerLevel: 'minor' } : f) },
    { guides: [{ status: 'published', spoilerLevel: 'minor' }] },
    { media: [{ recordState: 'published', spoilerLevel: 'minor' }] },
    { renderedHtml: renderedHtml.map((html) => html.replace('<details ', '<details open ')) },
    { renderedHtml: renderedHtml.map((html) => html.replace(' data-nosnippet', '')) },
    { renderedHtml: [...renderedHtml, '<details data-spoiler-level="major"></details>'] },
    { renderedHtml: renderedHtml.map((html) => html.replace('release-hidden-outpost', 'unapproved')) }
  ]) assert.equal(approvedReleaseWorldSpoilerScope({ ...state, ...mutation }), false, JSON.stringify(mutation));
});

test('unknown spoiler scope identifiers are rejected', () => {
  const changed = structuredClone(config);
  changed.browserGates[spoilerId].scopeId = 'all-spoilers';
  assert(validateLaunchConfig(changed).some((error) => error.includes('scopeId')));
});

test('release currentness reads the explicitly marked review without reordering historical dates', async () => {
  const html = await readFile(path.join(root, 'pages/about.html'), 'utf8');
  const section = html.match(/<aside\b[^>]*aria-label="发售信息来源"[\s\S]*?<\/aside>/)[0];
  assert.equal(section.match(/<time\s+datetime="([^"]+)"/)[1], '2026-10-26');
  assert(section.includes('datetime="2026-10-29"'));
  assert.equal(extractCurrentnessReviewDate(section, 'release-date-platform-store'), '2026-11-16');
  const explicit = '<time data-review-subject="release-date-platform-store" datetime="2026-11-16">review</time>';
  const history = '<time datetime="2026-10-27">preload</time><time datetime="2026-10-29">launch</time>';
  assert.equal(extractCurrentnessReviewDate(explicit + history, 'release-date-platform-store'), '2026-11-16');
  assert.equal(extractCurrentnessReviewDate(history + explicit, 'release-date-platform-store'), '2026-11-16');
  for (const invalid of [history, explicit + explicit, explicit.replace(' datetime="2026-11-16"', '')]) {
    assert.equal(extractCurrentnessReviewDate(invalid, 'release-date-platform-store'), null);
  }
  for (const date of ['2026-11-12', '2026-11-17', 'invalid']) {
    const checkedAt = extractCurrentnessReviewDate(explicit.replaceAll('2026-11-16', date), 'release-date-platform-store');
    assert.equal(evaluateCurrentness([{ id: 'release-date-platform-store', mandatoryForReleaseCandidate: true, checkedAt }], { mode: 'release-candidate', asOf: '2026-11-16', maxAgeDays: 3 })[0].status, 'BLOCK');
  }
  for (const id of ['commercial-pricing', 'physical-edition', 'pc-requirements']) {
    assert.equal(extractCurrentnessReviewDate(history + explicit, id), '2026-10-27');
  }
});
