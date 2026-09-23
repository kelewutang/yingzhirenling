import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { getPublishedGuides, guideRoute, validateGuides } from '../src/lib/guide-publication.mjs';

const fixture = JSON.parse(await readFile(new URL('./fixtures/guide-publication-cases.json', import.meta.url), 'utf8'));
const knowledge = {
  sourceById: new Map([['source:official', { id: 'source:official' }]]),
  versionById: new Map([['version:release-launch', { id: 'version:release-launch', track: 'release' }]]),
  factById: new Map([['fact:active', { id: 'fact:active', supersededBy: null }], ['fact:superseded', { id: 'fact:superseded', supersededBy: 'fact:active' }]]),
  entityById: new Map([
    ['entity:published-weapon', { id: 'entity:published-weapon', entityType: 'weapon', recordState: 'published' }],
    ['entity:draft-weapon', { id: 'entity:draft-weapon', entityType: 'weapon', recordState: 'draft' }]
  ]),
  platformById: new Map([['platform:pc', { id: 'platform:pc' }]]),
  difficultyById: new Map()
};

test('Guide publication fixtures preserve validation boundaries', () => {
  assert.match(fixture.fixtureNotice, /测试数据/);
  for (const fixtureCase of fixture.cases) {
    if (fixtureCase.expected === 'pass') {
      assert.doesNotThrow(() => validateGuides(fixtureCase.guides, knowledge), fixtureCase.name);
    } else {
      assert.throws(() => validateGuides(fixtureCase.guides, knowledge), new RegExp(fixtureCase.expectedErrorIncludes), fixtureCase.name);
    }
  }
});

test('Published Guide projection is deterministic and draft-safe', () => {
  const guides = [
    { id: 'draft-guide', data: { status: 'draft', updatedAt: null } },
    { id: 'later-guide', data: { status: 'published', updatedAt: '2026-10-30' } },
    { id: 'first-guide', data: { status: 'published', updatedAt: '2026-10-29' } }
  ];
  assert.deepEqual(getPublishedGuides(guides).map((guide) => guide.id), ['later-guide', 'first-guide']);
  assert.equal(guideRoute(guides[1]), '/guide/later-guide');
});
