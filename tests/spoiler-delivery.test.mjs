import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { validateGuides } from '../src/lib/guide-publication.mjs';
import { entitySafeProjection, factIsConcealed, isMajorSpoiler } from '../src/lib/spoilers.mjs';

const root = new URL('../', import.meta.url);

test('spoiler projections require safe fields and conceal major values', () => {
  const major = { spoilerLevel: 'major', displayName: 'Late-game Boss', summary: 'Story result', safeDisplayName: '重大剧透资料', safeSummary: '需主动展开。' };
  assert.deepEqual(entitySafeProjection(major), { displayName: '重大剧透资料', summary: '需主动展开。', concealed: true });
  assert.equal(factIsConcealed({ spoilerLevel: 'major' }, { spoilerLevel: 'none' }), true);
  assert.equal(isMajorSpoiler({ spoilerLevel: 'minor' }), false);
});

test('Guide validation rejects missing classification and unsafe major Guides', () => {
  const knowledge = { sourceById: new Map([['source:test', {}]]), versionById: new Map(), factById: new Map(), entityById: new Map(), platformById: new Map(), difficultyById: new Map() };
  const base = { id: 'fixture-guide', body: '## Safe section', data: { title: 'Guide', description: 'Description', status: 'published', guideType: 'boss', publishedAt: '2026-10-30', updatedAt: '2026-10-30', sourceIds: ['source:test'] } };
  assert.throws(() => validateGuides([base], knowledge), /spoilerLevel/);
  assert.throws(() => validateGuides([{ ...base, data: { ...base.data, spoilerLevel: 'major' } }], knowledge), /safeTitle/);
  assert.doesNotThrow(() => validateGuides([{ ...base, data: { ...base.data, spoilerLevel: 'major', safeTitle: '剧情相关攻略', safeDescription: '需主动展开。' } }], knowledge));
});

test('all current published Entities explicitly classify as none', async () => {
  const directories = ['weapons', 'characters', 'bosses', 'locations'];
  const records = (await Promise.all(directories.map(async (directory) => Promise.all((await readdir(new URL(`../data/${directory}/`, import.meta.url))).filter((file) => file.endsWith('.json')).map(async (file) => JSON.parse(await readFile(new URL(`../data/${directory}/${file}`, import.meta.url), 'utf8'))))))).flat();
  for (const record of records.filter((record) => record.recordState === 'published')) assert.equal(record.spoilerLevel, 'none', record.id);
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
