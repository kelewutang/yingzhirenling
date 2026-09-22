import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { sourceTypeLabel, statusLabel } from '../src/lib/knowledge.mjs';

const root = path.resolve(import.meta.dirname, '..');
const data = path.join(root, 'data');
const validator = path.join(root, 'scripts', 'validate-data.mjs');

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function writeJson(file, value) {
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function withReleaseFixture(mutate, expectedMessage = null) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'yingzhirenling-release-foundation-'));
  try {
    await cp(data, directory, { recursive: true });
    const sourceFile = path.join(directory, 'sources', 'site-release-test.json');
    const launchFile = path.join(directory, 'versions', 'release-launch.json');
    const patchFile = path.join(directory, 'versions', 'release-patch.json');
    const difficultyFile = path.join(directory, 'registries', 'difficulties.json');
    const weaponFile = path.join(directory, 'weapons', 'qinglong-lueyue-dao.json');
    const internalSource = {
      schemaVersion: '1.0-implementation',
      id: 'source:fixture-site-release-test',
      sourceType: 'site-release-test',
      authority: 'internal',
      publisher: '影之刃零攻略站',
      title: '正式版内部测试记录',
      language: 'zh-CN',
      url: null,
      locator: { type: 'internal-test-session', recordId: 'fixture-release-session' },
      publishedAt: null,
      checkedAt: '2026-10-29',
      archivedUrl: null,
      notes: '仅用于 schema 回归测试。'
    };
    const launch = {
      schemaVersion: '1.0-implementation',
      id: 'version:fixture-release-launch',
      track: 'release',
      stage: 'release-launch',
      displayName: '正式版',
      versionLabel: null,
      sequence: 100,
      platformIds: ['platform:pc', 'platform:playstation-5'],
      releasedAt: '2026-10-29',
      checkedAt: '2026-10-29',
      sourceIds: ['source:fixture-site-release-test'],
      supersedesVersionId: null,
      supersededBy: 'version:fixture-release-patch'
    };
    const patch = {
      ...launch,
      id: 'version:fixture-release-patch',
      stage: 'release-patch',
      displayName: '正式版更新（测试）',
      versionLabel: null,
      sequence: 101,
      releasedAt: '2026-11-05',
      checkedAt: '2026-11-05',
      supersedesVersionId: 'version:fixture-release-launch',
      supersededBy: null
    };
    const weapon = await readJson(weaponFile);
    const fact = weapon.facts[0];
    Object.assign(fact, {
      status: 'release-verified',
      sourceIds: ['source:fixture-site-release-test'],
      gameVersionId: 'version:fixture-release-patch',
      checkedAt: '2026-11-05',
      scope: {
        platforms: { mode: 'include', ids: ['platform:pc', 'platform:playstation-5'] },
        difficulties: { mode: 'include', ids: ['difficulty:fixture-standard'] }
      }
    });

    await writeJson(sourceFile, internalSource);
    await writeJson(launchFile, launch);
    await writeJson(patchFile, patch);
    await writeJson(difficultyFile, {
      schemaVersion: '1.0-implementation',
      difficulties: [{ id: 'difficulty:fixture-standard', displayName: 'Fixture Standard' }]
    });
    await writeJson(weaponFile, weapon);
    await mutate({ directory, sourceFile, launchFile, patchFile, difficultyFile, weaponFile });

    const result = spawnSync(process.execPath, [validator, `--data-dir=${directory}`], {
      cwd: root,
      encoding: 'utf8'
    });
    if (expectedMessage) {
      assert.notEqual(result.status, 0, result.stdout);
      assert.match(`${result.stdout}\n${result.stderr}`, expectedMessage);
    } else {
      assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('release launch and patch support null public version labels with verified platform and difficulty scope', async () => {
  await withReleaseFixture(async () => {});
});

test('release version stage and supersession ordering are enforced', async () => {
  await withReleaseFixture(async ({ patchFile }) => {
    const patch = await readJson(patchFile);
    patch.stage = 'prelaunch-demo';
    await writeJson(patchFile, patch);
  }, /release track 不支持该 stage/);

  await withReleaseFixture(async ({ patchFile }) => {
    const patch = await readJson(patchFile);
    patch.sequence = 99;
    await writeJson(patchFile, patch);
  }, /sequence 更早/);
});

test('release-verified requires a valid internal release test Source', async () => {
  await withReleaseFixture(async ({ weaponFile }) => {
    const weapon = await readJson(weaponFile);
    weapon.facts[0].sourceIds = [];
    await writeJson(weaponFile, weapon);
  }, /release-verified Fact 至少需要一个/);

  await withReleaseFixture(async ({ sourceFile }) => {
    const source = await readJson(sourceFile);
    source.authority = 'official';
    await writeJson(sourceFile, source);
  }, /site-release-test Source 必须使用 authority=internal/);

  await withReleaseFixture(async ({ sourceFile }) => {
    const source = await readJson(sourceFile);
    source.sourceType = 'official-article';
    await writeJson(sourceFile, source);
  }, /release-verified Fact 至少需要一个/);

  await withReleaseFixture(async ({ sourceFile }) => {
    const source = await readJson(sourceFile);
    source.locator = { type: 'url' };
    source.url = 'https://example.com/fixture';
    await writeJson(sourceFile, source);
  }, /site-release-test Source 必须使用 authority=internal/);

  await withReleaseFixture(async ({ weaponFile }) => {
    const weapon = await readJson(weaponFile);
    weapon.facts[0].gameVersionId = 'version:prelaunch-materials-2026-09';
    await writeJson(weaponFile, weapon);
  }, /必须引用 track=release/);
});

test('scope registry validation accepts known fixture IDs and rejects unknown IDs', async () => {
  await withReleaseFixture(async () => {});

  await withReleaseFixture(async ({ weaponFile }) => {
    const weapon = await readJson(weaponFile);
    weapon.facts[0].scope.platforms.ids = ['platform:unknown'];
    await writeJson(weaponFile, weapon);
  }, /平台不存在/);

  await withReleaseFixture(async ({ weaponFile }) => {
    const weapon = await readJson(weaponFile);
    weapon.facts[0].scope.difficulties.ids = ['difficulty:unknown'];
    await writeJson(weaponFile, weapon);
  }, /难度不存在/);
});

test('Fact supersession rejects self-reference and cycles', async () => {
  await withReleaseFixture(async ({ weaponFile }) => {
    const weapon = await readJson(weaponFile);
    weapon.facts[0].supersededBy = weapon.facts[0].id;
    await writeJson(weaponFile, weapon);
  }, /不能指向自身/);

  await withReleaseFixture(async ({ weaponFile }) => {
    const weapon = await readJson(weaponFile);
    const previous = weapon.facts[0];
    const successor = { ...previous, id: 'fact:weapon:qinglong-lueyue-dao:exists-patch', supersededBy: previous.id };
    previous.supersededBy = successor.id;
    weapon.facts.push(successor);
    await writeJson(weaponFile, weapon);
  }, /Fact supersession 不得形成循环/);
});

test('release evidence labels remain part of the existing status and source taxonomy', () => {
  assert.equal(statusLabel('release-verified'), '本站正式版实测');
  assert.equal(sourceTypeLabel('site-release-test'), '本站正式版实测记录');
});
