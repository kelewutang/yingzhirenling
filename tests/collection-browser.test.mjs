import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  COLLECTION_BROWSER_ACTIVATION_THRESHOLD,
  buildCollectionBrowserModel,
  collectionBrowserResult,
  findCollectionBrowserItems,
  resetCollectionBrowserQuery
} from '../src/lib/collection-browser.mjs';
import { GUIDE_TYPES } from '../src/lib/guide-publication.mjs';

const fixtures = JSON.parse(await readFile(new URL('./fixtures/collection-browser-cases.json', import.meta.url), 'utf8'));

function card(index, overrides = {}) {
  const number = String(index).padStart(2, '0');
  const entity = {
    id: `entity:fixture:${number}`,
    displayName: `Entity ${number}`,
    aliases: [{ value: `Alias ${number}` }],
    summary: `Summary ${number}`,
    facts: [{ value: `Fact ${number}` }],
    media: { src: `entity-${number}.jpg` }
  };
  return {
    card: {
      entity,
      href: `/fixtures/entity-${number}`,
      displayName: entity.displayName,
      aliases: entity.aliases.map((alias) => alias.value),
      summary: entity.summary,
      concealed: false,
      ...overrides
    },
    media: entity.media
  };
}

function cards(count) {
  return Array.from({ length: count }, (_, index) => card(index + 1));
}

test('Collection Browser activates only at the centralized safe threshold', () => {
  assert.equal(COLLECTION_BROWSER_ACTIVATION_THRESHOLD, 20);
  for (const fixture of fixtures.cases) {
    const model = buildCollectionBrowserModel(cards(fixture.safeCount));
    assert.equal(model.active, fixture.active, fixture.name);
    assert.equal(model.compact, fixture.active, fixture.name);
    assert.equal(model.safeCount, fixture.safeCount, fixture.name);
  }
});

test('major cards never affect activation, compact mode, or browser data', () => {
  const hidden = card(99, {
    displayName: 'Hidden Entity',
    aliases: ['Hidden Alias'],
    summary: 'Hidden Summary',
    concealed: true
  });
  hidden.card.entity.facts = [{ value: 'Hidden Fact' }];
  hidden.media = { src: 'hidden-entity.jpg', alt: 'Hidden Media' };

  const belowThreshold = buildCollectionBrowserModel([...cards(19), hidden]);
  assert.equal(belowThreshold.safeCount, 19);
  assert.equal(belowThreshold.active, false);
  assert.equal(belowThreshold.compact, false);

  const model = buildCollectionBrowserModel([...cards(20), hidden]);
  assert.equal(model.safeCount, 20);
  assert.equal(model.active, true);
  const serialized = JSON.stringify(model.items);
  for (const forbidden of ['Hidden Entity', 'Hidden Alias', 'Hidden Summary', 'Hidden Fact', 'hidden-entity.jpg']) {
    assert.equal(serialized.includes(forbidden), false, `browser dataset leaked ${forbidden}`);
  }
  assert.equal(collectionBrowserResult(model.items, 'Hidden Entity').count, 0);
});

test('local search accepts only safe display names and aliases', () => {
  const model = buildCollectionBrowserModel(cards(20));
  assert.deepEqual(findCollectionBrowserItems(model.items, 'Entity 01').map((item) => item.id), ['entity:fixture:01']);
  assert.deepEqual(findCollectionBrowserItems(model.items, 'alias 02').map((item) => item.id), ['entity:fixture:02']);
  assert.equal(findCollectionBrowserItems(model.items, 'Summary 03').length, 0);
  assert.equal(findCollectionBrowserItems(model.items, 'Fact 04').length, 0);
});

test('result model covers reset, visible counts, and zero results', () => {
  const model = buildCollectionBrowserModel(cards(20));
  assert.equal(collectionBrowserResult(model.items, 'Entity 01').count, 1);
  assert.equal(collectionBrowserResult(model.items, 'missing').empty, true);
  assert.equal(collectionBrowserResult(model.items, resetCollectionBrowserQuery()).count, 20);
});

test('current production collections remain below the activation threshold', async () => {
  const families = [
    ['weapons', 9],
    ['bosses', 3],
    ['characters', 3],
    ['locations', 1]
  ];
  for (const [directory, expectedCount] of families) {
    const records = await Promise.all((await readdir(new URL(`../data/${directory}/`, import.meta.url)))
      .filter((name) => name.endsWith('.json'))
      .map(async (name) => JSON.parse(await readFile(new URL(`../data/${directory}/${name}`, import.meta.url), 'utf8'))));
    const published = records.filter((record) => record.recordState === 'published' && record.spoilerLevel !== 'major');
    assert.equal(published.length, expectedCount, directory);
    const model = buildCollectionBrowserModel(published.map((record, index) => card(index + 1, {
      entity: record,
      href: `/${directory}/${record.slug}`,
      displayName: record.displayName,
      aliases: record.aliases.map((alias) => alias.value),
      concealed: false
    })));
    assert.equal(model.active, false, directory);
  }
});

test('build is accepted while every existing Guide type remains available', () => {
  for (const type of ['walkthrough', 'boss', 'weapon', 'system', 'performance', 'build']) {
    assert.equal(GUIDE_TYPES.includes(type), true, type);
  }
});
