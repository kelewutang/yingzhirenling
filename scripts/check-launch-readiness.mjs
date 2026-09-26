import { spawnSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { COLLECTION_BROWSER_ACTIVATION_THRESHOLD } from '../src/lib/collection-browser.mjs';
import { loadKnowledge } from '../src/lib/knowledge.mjs';
import { siteLifecycle } from '../src/lib/site-lifecycle.mjs';
import { isSafeForDiscovery, spoilerLevel } from '../src/lib/spoilers.mjs';
import { loadProductionInventory } from './astro/production-inventory.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const CONFIG_FILE = path.join(ROOT, 'config', 'launch-operations.json');
const PUBLIC_MODES = new Set(['t-14', 't-72', 'release-candidate', 'post-deploy']);
const GATE_IDS = Object.freeze(['collection-browser-interaction', 'spoiler-disclosure-interaction']);
const ENTITY_DIRECTORIES = Object.freeze(['weapons', 'characters', 'bosses', 'locations']);
const FIXTURE_TOKENS = Object.freeze(['Entity 01', 'Hidden Entity', 'Hidden Alias', 'fixture-guide', 'story-guide-01', 'collection-browser-cases']);
const SAMPLE_ROUTES = Object.freeze(['/', '/guide', '/weapons', '/bosses', '/characters', '/world', '/about']);
const ABSENT_ROUTES = Object.freeze(['/generated/guide-search-manifest.json', '/guide/published-guide', '/guide/story-guide-01', '/guide/draft-guide']);
const STATUS_WEIGHT = Object.freeze({ BLOCK: 5, WARN: 4, PASS: 3, INFO: 2, 'NOT APPLICABLE': 1 });

export function finding(category, status, message) {
  return { category, status, message };
}

function parseDate(value, label) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) throw new Error(`${label} must be YYYY-MM-DD`);
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value) throw new Error(`${label} must be a valid date`);
  return date;
}

function daysBetween(from, to) {
  return Math.floor((to.valueOf() - from.valueOf()) / 86_400_000);
}

export function validateLaunchConfig(config) {
  const errors = [];
  if (config?.schemaVersion !== '1') errors.push('schemaVersion must be 1');
  for (const mode of ['t-14', 't-72', 'release-candidate']) {
    if (!Number.isInteger(config?.freshnessPolicy?.[mode]) || config.freshnessPolicy[mode] < 0) errors.push(`freshnessPolicy.${mode} must be a non-negative integer`);
  }
  if (!Array.isArray(config?.launchCriticalSubjects) || config.launchCriticalSubjects.length === 0) errors.push('launchCriticalSubjects must be a non-empty array');
  for (const subject of config?.launchCriticalSubjects || []) {
    for (const field of ['id', 'file', 'marker']) if (typeof subject?.[field] !== 'string' || !subject[field].trim()) errors.push(`launchCriticalSubjects.${field} must be non-empty`);
    if (typeof subject?.mandatoryForReleaseCandidate !== 'boolean') errors.push(`${subject?.id || 'subject'}.mandatoryForReleaseCandidate must be boolean`);
  }
  const actualGateIds = Object.keys(config?.browserGates || {}).sort();
  if (JSON.stringify(actualGateIds) !== JSON.stringify([...GATE_IDS].sort())) errors.push(`browserGates must contain exactly ${GATE_IDS.join(', ')}`);
  for (const id of GATE_IDS) {
    const gate = config?.browserGates?.[id];
    if (!gate) continue;
    if (!Number.isInteger(gate.contractVersion) || gate.contractVersion < 1) errors.push(`${id}.contractVersion must be a positive integer`);
    if (!['deferred', 'passed'].includes(gate.status)) errors.push(`${id}.status must be deferred or passed`);
    if (gate.status === 'passed' && (typeof gate.approvedAt !== 'string' || !gate.approvedAt.trim())) errors.push(`${id}.approvedAt is required when passed`);
    if (gate.status === 'passed' && (typeof gate.evidenceRef !== 'string' || !gate.evidenceRef.trim())) errors.push(`${id}.evidenceRef is required when passed`);
    if (gate.status === 'deferred' && (gate.approvedAt !== null || gate.evidenceRef !== null)) errors.push(`${id}.deferred approval fields must be null`);
    if (typeof gate.approvedAt === 'string') {
      try { parseDate(gate.approvedAt, `${id}.approvedAt`); } catch (error) { errors.push(error.message); }
    }
  }
  return errors;
}

export function evaluateCurrentness(subjects, { mode, asOf, maxAgeDays }) {
  const asOfDate = parseDate(asOf, '--as-of');
  return subjects.map((subject) => {
    if (!subject.checkedAt) {
      const blocking = mode === 'release-candidate' && subject.mandatoryForReleaseCandidate;
      return finding('Source currentness', blocking ? 'BLOCK' : 'WARN', `${subject.id}: review date is missing`);
    }
    let checkedAt;
    try { checkedAt = parseDate(subject.checkedAt, `${subject.id}.checkedAt`); } catch (error) {
      return finding('Source currentness', 'BLOCK', `${subject.id}: ${error.message}`);
    }
    const age = daysBetween(checkedAt, asOfDate);
    if (age < 0) return finding('Source currentness', 'BLOCK', `${subject.id}: review date is after --as-of`);
    if (age <= maxAgeDays) return finding('Source currentness', 'PASS', `${subject.id}: reviewed ${age} day(s) before checkpoint`);
    const blocking = mode === 'release-candidate' && subject.mandatoryForReleaseCandidate;
    return finding('Source currentness', blocking ? 'BLOCK' : 'WARN', `${subject.id}: review is ${age} days old (window ${maxAgeDays})`);
  });
}

export function evaluateReleaseState({ releaseVersions = [], releaseDependencies = [], releaseVerifiedFacts = [] }) {
  const results = [];
  if (releaseVersions.length === 0) results.push(finding('Release evidence', 'INFO', 'No release Version exists; none is required until release-scoped content depends on one'));
  else results.push(finding('Release evidence', 'PASS', `${releaseVersions.length} release Version record(s) passed the existing data validator`));
  const missing = releaseDependencies.filter((item) => !item.gameVersionId || !releaseVersions.some((version) => version.id === item.gameVersionId));
  results.push(missing.length ? finding('Release evidence', 'BLOCK', `${missing.length} release-scoped record(s) lack a valid release Version`) : finding('Release evidence', 'PASS', 'Release-scoped Version references are valid'));
  if (releaseVerifiedFacts.length === 0) results.push(finding('Release evidence', 'INFO', 'No release-verified Facts exist'));
  else {
    const malformed = releaseVerifiedFacts.filter((fact) => !fact.releaseTrack || !fact.internalReleaseTestSource);
    results.push(malformed.length ? finding('Release evidence', 'BLOCK', `${malformed.length} release-verified Fact(s) lack required release Version or internal test evidence`) : finding('Release evidence', 'PASS', `${releaseVerifiedFacts.length} release-verified Fact(s) passed evidence checks`));
  }
  return results;
}

export function collectionTriggerFromCounts(counts) {
  const entries = Object.entries(counts);
  const active = entries.filter(([, count]) => count >= COLLECTION_BROWSER_ACTIVATION_THRESHOLD);
  return { triggered: active.length > 0, active, threshold: COLLECTION_BROWSER_ACTIVATION_THRESHOLD };
}

export function spoilerTriggerFromState({ guides = [], entities = [], facts = [], media = [], renderedHtml = [] }) {
  const reasons = [];
  if (guides.some((guide) => guide.status === 'published' && spoilerLevel(guide) !== 'none')) reasons.push('published Guide');
  if (entities.some((entity) => entity.recordState === 'published' && spoilerLevel(entity) !== 'none')) reasons.push('published Entity');
  if (facts.some((fact) => fact.published === true && spoilerLevel(fact) !== 'none')) reasons.push('published spoiler Fact');
  if (media.some((item) => item.recordState === 'published' && spoilerLevel(item) !== 'none')) reasons.push('published spoiler Media');
  if (renderedHtml.some((html) => /data-spoiler-level=["']major["']/.test(html) || html.includes('含部分剧情信息'))) reasons.push('rendered spoiler disclosure');
  return { triggered: reasons.length > 0, reasons: [...new Set(reasons)] };
}

export function evaluateBrowserGate({ id, triggered, approval, enforcement }) {
  if (!triggered) return finding(id === GATE_IDS[0] ? 'Collection gate' : 'Spoiler gate', 'NOT APPLICABLE', `${id}: trigger is false`);
  const approvalErrors = validateLaunchConfig({
    schemaVersion: '1',
    freshnessPolicy: { 't-14': 14, 't-72': 3, 'release-candidate': 3 },
    launchCriticalSubjects: [{ id: 'placeholder', file: 'placeholder', marker: 'placeholder', mandatoryForReleaseCandidate: false }],
    browserGates: Object.fromEntries(GATE_IDS.map((gateId) => [gateId, gateId === id ? approval : { contractVersion: 1, status: 'deferred', approvedAt: null, evidenceRef: null }]))
  }).filter((error) => error.startsWith(id));
  const category = id === GATE_IDS[0] ? 'Collection gate' : 'Spoiler gate';
  if (approvalErrors.length) return finding(category, 'BLOCK', `${id}: invalid approval record (${approvalErrors.join('; ')})`);
  if (approval.status === 'passed') return finding(category, 'PASS', `${id}: trigger is true and Browser evidence is approved`);
  if (['release-candidate', 'production'].includes(enforcement)) return finding(category, 'BLOCK', `${id}: Browser Gate approval is required`);
  return finding(category, 'WARN', `${id}: Browser Gate required; local/Deploy Preview build may continue`);
}

export function evaluateInventory(expected, actual) {
  const keys = ['sitemap', 'canonical', 'pageHtml', 'searchDocs'];
  const mismatches = keys.filter((key) => expected[key] !== actual[key]);
  return mismatches.length
    ? finding('Search / sitemap', 'BLOCK', `inventory mismatch: ${mismatches.map((key) => `${key} expected ${expected[key]}, got ${actual[key]}`).join('; ')}`)
    : finding('Search / sitemap', 'PASS', `derived production inventory agrees (${keys.map((key) => `${key}=${actual[key]}`).join(', ')})`);
}

export function findFixtureLeakage(contents, tokens = FIXTURE_TOKENS) {
  return tokens.filter((token) => contents.some((content) => content.includes(token)));
}

function parseArguments(argv) {
  const options = {};
  for (const argument of argv) {
    if (!argument.startsWith('--') || !argument.includes('=')) throw new Error(`Unsupported argument: ${argument}`);
    const [key, ...parts] = argument.slice(2).split('=');
    options[key] = parts.join('=');
  }
  if (!options.mode) throw new Error('--mode is required');
  if (options.mode !== 'build-guards' && !PUBLIC_MODES.has(options.mode)) throw new Error(`Unsupported --mode: ${options.mode}`);
  if (options.mode !== 'build-guards') parseDate(options['as-of'], '--as-of');
  if (options.mode === 'post-deploy' && !options['base-url']) throw new Error('--base-url is required for post-deploy mode');
  if (options.mode !== 'post-deploy' && options['base-url']) throw new Error('--base-url is only valid in post-deploy mode');
  return options;
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function readEntities() {
  const families = {};
  for (const directory of ENTITY_DIRECTORIES) {
    const base = path.join(ROOT, 'data', directory);
    const names = (await readdir(base)).filter((name) => name.endsWith('.json')).sort();
    families[directory] = await Promise.all(names.map((name) => readJson(path.join(base, name))));
  }
  return families;
}

async function readRenderedHtml() {
  const output = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(file);
      else if (entry.isFile() && entry.name.endsWith('.html')) output.push(await readFile(file, 'utf8'));
    }
  }
  await walk(path.join(ROOT, 'dist'));
  return output;
}

async function readCurrentnessSubjects(config) {
  return Promise.all(config.launchCriticalSubjects.map(async (subject) => {
    const html = await readFile(path.join(ROOT, subject.file), 'utf8');
    const marker = `aria-label="${subject.marker}"`;
    const start = html.indexOf(marker);
    if (start < 0) return { ...subject, checkedAt: null };
    const end = html.indexOf('</aside>', start);
    const scope = html.slice(start, end < 0 ? undefined : end);
    return { ...subject, checkedAt: scope.match(/<time\s+datetime="(\d{4}-\d{2}-\d{2})"/)?.[1] || null };
  }));
}

async function productionState({ requireDist = false } = {}) {
  const [knowledge, inventory, families, media] = await Promise.all([
    loadKnowledge(), loadProductionInventory(ROOT), readEntities(), readJson(path.join(ROOT, 'data', 'media.json'))
  ]);
  const publishedByFamily = Object.fromEntries(Object.entries(families).map(([name, records]) => [name, records.filter((record) => record.recordState === 'published' && isSafeForDiscovery(record)).length]));
  const entities = Object.values(families).flat();
  const facts = entities.flatMap((entity) => entity.facts
    .filter((fact) => fact.supersededBy === null)
    .map((fact) => ({ ...fact, published: entity.recordState === 'published' })));
  const releaseVersions = [...knowledge.versionById.values()].filter((version) => version.track === 'release');
  const releaseVerifiedFacts = facts.filter((fact) => fact.status === 'release-verified').map((fact) => ({
    ...fact,
    releaseTrack: knowledge.versionById.get(fact.gameVersionId)?.track === 'release',
    internalReleaseTestSource: fact.sourceIds.some((id) => {
      const source = knowledge.sourceById.get(id);
      return source?.authority === 'internal' && source?.sourceType === 'site-release-test' && source?.locator?.type === 'internal-test-session';
    })
  }));
  const renderedHtml = requireDist ? await readRenderedHtml() : [];
  return {
    inventory, publishedByFamily, entities, facts, releaseVersions, releaseVerifiedFacts,
    media: media.records.filter((item) => entities.some((entity) => entity.id === item.entityId && entity.recordState === 'published')),
    renderedHtml,
    guides: inventory.guides.map((guide) => ({ ...guide, status: 'published' }))
  };
}

function run(command, args, label) {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: 'utf8', env: process.env });
  if (result.status === 0) return finding(label, 'PASS', `${command} ${args.join(' ')} passed`);
  const detail = `${result.stdout || ''}\n${result.stderr || ''}`.trim().split('\n').slice(-6).join(' | ');
  return finding(label, 'BLOCK', `${command} ${args.join(' ')} failed${detail ? `: ${detail}` : ''}`);
}

function outputFindings(results) {
  const categories = [...new Set(results.map((item) => item.category))];
  for (const category of categories) {
    const items = results.filter((item) => item.category === category);
    const status = items.reduce((strongest, item) => STATUS_WEIGHT[item.status] > STATUS_WEIGHT[strongest] ? item.status : strongest, 'NOT APPLICABLE');
    console.log(`[${status}] ${category}`);
    for (const item of items) console.log(`  - ${item.message}`);
  }
  const blocked = results.some((item) => item.status === 'BLOCK');
  console.log(`\nAUTOMATED CHECKS ${blocked ? 'BLOCKED' : 'PASS'}`);
  console.log('HUMAN APPROVAL STILL REQUIRED for editorial truth, lifecycle changes, Browser evidence, publication, deployment and rollback.');
  return blocked ? 1 : 0;
}

function localInventoryCounts(inventory) {
  return { ...inventory.counts };
}

async function fetchText(fetchImpl, baseUrl, pathname) {
  const response = await fetchImpl(new URL(pathname, baseUrl), { redirect: 'follow' });
  return { response, text: await response.text() };
}

export async function runPostDeploySmoke({ baseUrl, expectedInventory, lifecycle = siteLifecycle, fetchImpl = fetch }) {
  const results = [];
  let normalized;
  try {
    normalized = new URL(baseUrl);
    if (!['http:', 'https:'].includes(normalized.protocol)) throw new Error('unsupported protocol');
  } catch {
    return [finding('Post-deploy checks', 'BLOCK', '--base-url must be an explicit HTTP(S) URL')];
  }
  for (const route of SAMPLE_ROUTES) {
    try {
      const { response, text } = await fetchText(fetchImpl, normalized, route);
      if (!response.ok) { results.push(finding('Post-deploy checks', 'BLOCK', `${route}: HTTP ${response.status}`)); continue; }
      const canonical = text.match(/<link\s+rel="canonical"\s+href="([^"]+)"/)?.[1];
      const expectedCanonical = new URL(route, 'https://www.yingzhirenling.cn').href;
      if (canonical !== expectedCanonical) results.push(finding('Post-deploy checks', 'BLOCK', `${route}: canonical expected ${expectedCanonical}, got ${canonical || 'missing'}`));
      else results.push(finding('Post-deploy checks', 'PASS', `${route}: HTTP 200 with expected canonical`));
      if (route === '/' && !text.includes(lifecycle.copy.homepage.eyebrow)) results.push(finding('Post-deploy checks', 'BLOCK', `/: lifecycle copy does not match ${lifecycle.state}`));
    } catch (error) {
      results.push(finding('Post-deploy checks', 'BLOCK', `${route}: ${error.message}`));
    }
  }
  try {
    const { response, text } = await fetchText(fetchImpl, normalized, '/sitemap.xml');
    const count = (text.match(/<url>/g) || []).length;
    results.push(response.ok && count === expectedInventory.sitemap ? finding('Search / sitemap', 'PASS', `deployed sitemap has ${count} derived URLs`) : finding('Search / sitemap', 'BLOCK', `deployed sitemap expected ${expectedInventory.sitemap}, got HTTP ${response.status} and ${count}`));
  } catch (error) { results.push(finding('Search / sitemap', 'BLOCK', `sitemap: ${error.message}`)); }
  try {
    const { response } = await fetchText(fetchImpl, normalized, '/robots.txt');
    results.push(response.ok ? finding('Post-deploy checks', 'PASS', 'robots.txt is available') : finding('Post-deploy checks', 'BLOCK', `robots.txt: HTTP ${response.status}`));
  } catch (error) { results.push(finding('Post-deploy checks', 'BLOCK', `robots.txt: ${error.message}`)); }
  try {
    const { response, text } = await fetchText(fetchImpl, normalized, '/generated/search-index.production.json');
    const count = response.ok ? JSON.parse(text).length : -1;
    results.push(response.ok && count === expectedInventory.searchDocs ? finding('Search / sitemap', 'PASS', `deployed Search has ${count} derived documents`) : finding('Search / sitemap', 'BLOCK', `deployed Search expected ${expectedInventory.searchDocs}, got HTTP ${response.status} and ${count}`));
  } catch (error) { results.push(finding('Search / sitemap', 'BLOCK', `production Search: ${error.message}`)); }
  for (const route of ABSENT_ROUTES) {
    try {
      const response = await fetchImpl(new URL(route, normalized), { redirect: 'follow' });
      results.push(!response.ok ? finding('Post-deploy checks', 'PASS', `${route}: absent`) : finding('Post-deploy checks', 'BLOCK', `${route}: unexpectedly public`));
    } catch (error) { results.push(finding('Post-deploy checks', 'BLOCK', `${route}: ${error.message}`)); }
  }
  results.push(finding('Deployment readiness', 'WARN', 'Deployed SHA is not authoritative without an external deployment source'));
  return results;
}

async function evaluateRepositoryGates(config, enforcement, requireDist) {
  const state = await productionState({ requireDist });
  const collection = collectionTriggerFromCounts(state.publishedByFamily);
  const spoiler = spoilerTriggerFromState(state);
  const results = [
    evaluateBrowserGate({ id: GATE_IDS[0], triggered: collection.triggered, approval: config.browserGates[GATE_IDS[0]], enforcement }),
    evaluateBrowserGate({ id: GATE_IDS[1], triggered: spoiler.triggered, approval: config.browserGates[GATE_IDS[1]], enforcement })
  ];
  if (requireDist) {
    const leakage = findFixtureLeakage(state.renderedHtml);
    results.push(leakage.length ? finding('Content validity', 'BLOCK', `fixture leakage detected: ${leakage.join(', ')}`) : finding('Content validity', 'PASS', 'No known fixture markers occur in rendered HTML'));
  }
  return { state, results };
}

export async function main(argv = process.argv.slice(2)) {
  let options;
  try { options = parseArguments(argv); } catch (error) {
    console.error(`Launch readiness configuration error: ${error.message}`);
    return 1;
  }
  const config = await readJson(CONFIG_FILE);
  const configErrors = validateLaunchConfig(config);
  if (configErrors.length) return outputFindings(configErrors.map((message) => finding('Content validity', 'BLOCK', message)));

  if (options.mode === 'build-guards') {
    const context = process.env.CONTEXT === 'production' ? 'production' : process.env.CONTEXT === 'deploy-preview' ? 'preview' : 'local';
    const { results } = await evaluateRepositoryGates(config, context, true);
    return outputFindings([finding('Build', 'PASS', `network-free launch guards ran in ${context} context`), ...results]);
  }

  const results = [finding('Lifecycle', 'PASS', `repository lifecycle is explicitly ${siteLifecycle.state}`)];
  if (options.mode === 'post-deploy') {
    const inventory = await loadProductionInventory(ROOT);
    results.push(...await runPostDeploySmoke({ baseUrl: options['base-url'], expectedInventory: localInventoryCounts(inventory) }));
    return outputFindings(results);
  }

  const validation = run(process.execPath, ['scripts/validate-data.mjs'], 'Content validity');
  results.push(validation);
  if (validation.status === 'BLOCK') return outputFindings(results);
  if (options.mode === 'release-candidate') results.push(run('npm', ['run', 'build'], 'Build'));
  else results.push(finding('Build', 'NOT APPLICABLE', `${options.mode} performs repository checks without a full build`));
  if (results.some((item) => item.status === 'BLOCK')) return outputFindings(results);

  const subjects = await readCurrentnessSubjects(config);
  results.push(...evaluateCurrentness(subjects, { mode: options.mode, asOf: options['as-of'], maxAgeDays: config.freshnessPolicy[options.mode] }));
  const { state, results: gates } = await evaluateRepositoryGates(config, options.mode === 'release-candidate' ? 'release-candidate' : 'local', options.mode === 'release-candidate');
  results.push(...evaluateReleaseState({ releaseVersions: state.releaseVersions, releaseVerifiedFacts: state.releaseVerifiedFacts, releaseDependencies: [] }), ...gates);
  results.push(options.mode === 'release-candidate'
    ? finding('Search / sitemap', 'PASS', `full build verified derived inventory (${Object.entries(state.inventory.counts).map(([key, value]) => `${key}=${value}`).join(', ')})`)
    : finding('Search / sitemap', 'INFO', `derived expected inventory is ${Object.entries(state.inventory.counts).map(([key, value]) => `${key}=${value}`).join(', ')}; output comparison runs in build and post-deploy modes`));
  results.push(finding('Deployment readiness', 'INFO', options.mode === 'release-candidate' ? 'Repository candidate checks completed; merge and deployment remain human decisions' : 'Checkpoint report completed; deployment is not evaluated'));
  results.push(finding('Post-deploy checks', 'NOT APPLICABLE', 'HTTP smoke runs only in explicitly invoked post-deploy mode'));
  return outputFindings(results);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await main();
