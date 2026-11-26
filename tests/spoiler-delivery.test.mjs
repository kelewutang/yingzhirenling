import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { validateGuides } from '../src/lib/guide-publication.mjs';
import { entitySafeProjection, factIsConcealed, isMajorSpoiler, shouldConcealSpoiler, spoilerProtectionApplies, postReleaseGuideDecision } from '../src/lib/spoilers.mjs';
import { evaluateSpoilerPublicationGate } from '../scripts/check-launch-readiness.mjs';

const root = new URL('../', import.meta.url);

test('released open guides retain historical classification and expose admitted content', () => {
  const major = { spoilerLevel: 'major', displayName: 'Late-game Boss', summary: 'Story result', safeDisplayName: '重大剧透资料', safeSummary: '需主动展开。' };
  assert.deepEqual(entitySafeProjection(major), { displayName: 'Late-game Boss', summary: 'Story result', concealed: false });
  assert.equal(factIsConcealed({ spoilerLevel: 'major' }, { spoilerLevel: 'none' }), false);
  assert.equal(isMajorSpoiler(major), true);
  assert.equal(shouldConcealSpoiler(major), false);
  assert.equal(shouldConcealSpoiler(major, 'pre-release'), true);
  assert.equal(shouldConcealSpoiler(major, 'released', null), true);
  assert.equal(spoilerProtectionApplies('released', { ...postReleaseGuideDecision, approvedBy: '' }), true);
  assert.equal(isMajorSpoiler({ spoilerLevel: 'minor' }), false);
});

test('Guide validation retains classification and evidence while releasing safe-title requirements', () => {
  const knowledge = { sourceById: new Map([['source:test', {}]]), versionById: new Map(), factById: new Map(), entityById: new Map(), platformById: new Map(), difficultyById: new Map() };
  const base = { id: 'fixture-guide', body: '## Safe section', data: { title: 'Guide', description: 'Description', status: 'published', guideType: 'boss', publishedAt: '2026-10-30', updatedAt: '2026-10-30', sourceIds: ['source:test'] } };
  assert.throws(() => validateGuides([base], knowledge), /spoilerLevel/);
  assert.doesNotThrow(() => validateGuides([{ ...base, data: { ...base.data, spoilerLevel: 'major' } }], knowledge));
  assert.throws(() => validateGuides([{ ...base, data: { ...base.data, spoilerLevel: 'major', sourceIds: ['source:missing'] } }], knowledge), /Source/);
  assert.doesNotThrow(() => validateGuides([{ ...base, data: { ...base.data, spoilerLevel: 'major', safeTitle: '剧情相关攻略', safeDescription: '需主动展开。' } }], knowledge));
});

test('published Entities classify the Broken Blade acquisition as minor and retain all other classifications', async () => {
  const directories = ['weapons', 'characters', 'bosses', 'locations'];
  const records = (await Promise.all(directories.map(async (directory) => Promise.all((await readdir(new URL(`../data/${directory}/`, import.meta.url))).filter((file) => file.endsWith('.json')).map(async (file) => JSON.parse(await readFile(new URL(`../data/${directory}/${file}`, import.meta.url), 'utf8'))))))).flat();
  for (const record of records.filter((record) => record.recordState === 'published')) {
    if (record.facts.some((fact) => fact.gameVersionId === 'version:world-boss-catalog-2026-11-26')) {
      const minor = ['boss:jing-ye', 'boss:tie-kuang', 'boss:bai-chilian', 'boss:zhuo-bi', 'boss:bi-yuan', 'boss:bi-hai', 'location:zhengdao-daying', 'location:meigu-hu', 'location:jialong-shan'];
      assert.equal(record.spoilerLevel, minor.includes(record.id) ? 'minor' : 'major', record.id);
      if (record.spoilerLevel === 'major') assert(!entitySafeProjection(record).concealed && record.safeDisplayName && record.safeSummary, record.id);
      continue;
    }
    assert.equal(record.spoilerLevel, ['weapon:chizhe-canjian', 'boss:cangang', 'boss:peng-meng', 'boss:hua-qianxiao', 'boss:a-hua', 'boss:zhui-ming'].includes(record.id) ? 'minor' : 'none', record.id);
  }
});

test('Owner released decision supersedes old spoiler scope without skipping gates or concealing content', () => {
  const state = { entities: [{ id: 'boss:published', recordState: 'published', spoilerLevel: 'major' }], renderedHtml: [] };
  const approval = { contractVersion: 1, status: 'deferred', approvedAt: null, evidenceRef: null };
  for (const enforcement of ['production', 'release-candidate']) {
    assert.equal(evaluateSpoilerPublicationGate(state, { enforcement, approval }).status, 'PASS');
    assert.equal(evaluateSpoilerPublicationGate(state, { enforcement, approval, lifecycle: 'pre-release' }).status, 'BLOCK');
    assert.equal(evaluateSpoilerPublicationGate(state, { enforcement, approval, decision: null }).status, 'BLOCK');
    assert.equal(evaluateSpoilerPublicationGate({ ...state, renderedHtml: ['<details data-spoiler-level="major">hidden</details>'] }, { enforcement, approval }).status, 'BLOCK');
  }
});

test('published Entity classification is enforced by the data validator', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'pbz-spoiler-data-'));
  try {
    const dataDirectory = join(workspace, 'data');
    await cp(new URL('../data/', import.meta.url), dataDirectory, { recursive: true });
    const target = join(dataDirectory, 'characters', 'soul.json');
    const entity = JSON.parse(await readFile(target, 'utf8'));
    delete entity.spoilerLevel;
    await writeFile(target, `${JSON.stringify(entity, null, 2)}\n`);
    const result = spawnSync(process.execPath, ['scripts/validate-data.mjs', `--data-dir=${dataDirectory}`], { cwd: new URL('../', import.meta.url), encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /published Entity 必须显式提供 spoilerLevel/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});
