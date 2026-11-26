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

test('only the 26-weapon collection activates the existing browser', async () => {
  const families = [
    ['weapons', 26],
    ['bosses', 5],
    ['characters', 6],
    ['locations', 4]
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
    assert.equal(model.active, directory === 'weapons', directory);
  }
});

test('build is accepted while every existing Guide type remains available', () => {
  for (const type of ['walkthrough', 'boss', 'weapon', 'system', 'performance', 'build']) {
    assert.equal(GUIDE_TYPES.includes(type), true, type);
  }
});


// Exercise the shipped inline enhancements without adding a DOM/test dependency.
const { runInNewContext } = await import('node:vm');
const { loadKnowledge } = await import('../src/lib/knowledge.mjs');
const { buildWeaponCollectionCard } = await import('../src/lib/collection-models.mjs');
const { searchableForgedNames } = await import('../src/lib/weapon-forms.mjs');
const { secondaryNavigation, approvedCollectionNavigation, footerGroups } = await import('../scripts/astro/site-shell.mjs');
const browserScript = (await readFile(new URL('../src/components/CollectionBrowser.astro', import.meta.url), 'utf8')).match(/<script is:inline>([\s\S]*?)<\/script>/)[1];
const formsScript = (await readFile(new URL('../src/components/WeaponForms.astro', import.meta.url), 'utf8')).match(/<script is:inline>([\s\S]*?)<\/script>/)[1];
const forgedPairs = [
  ['heishang', '黑魔伤', '黑魔'], ['heishang-shuangren', '绝影', '绝'],
  ['changxing-heishang', '炽刃', '炽'], ['luanying-jian', '天邈·乱莺', '天邈']
];

function browserRuntime(items) {
  const input = { value: '', addEventListener: (_, handler) => { input.update = handler; }, focus: () => { input.focused = true; } };
  const reset = { addEventListener: (_, handler) => { reset.click = handler; } };
  const count = {}, empty = {};
  const nodes = { '[data-collection-browser-input]': input, '[data-collection-browser-reset]': reset,
    '[data-collection-browser-count]': count, '[data-collection-browser-empty]': empty,
    label: { textContent: '搜索已发布武器' } };
  runInNewContext(browserScript, { document: { querySelector: () => ({ querySelector: (selector) => nodes[selector], querySelectorAll: () => items }) } });
  return { input, reset, count, empty, search(value) { input.value = value; input.update(); return items.filter((item) => !item.hidden); } };
}

test('weapon Browser matches four public forged names and partials, restores base links and resets', async () => {
  const knowledge = await loadKnowledge();
  const cards = knowledge.weapons.filter((entity) => entity.recordState === 'published' && entity.spoilerLevel !== 'major')
    .map((entity) => ({ card: buildWeaponCollectionCard(entity) }));
  const model = buildCollectionBrowserModel(cards);
  const items = model.items.map((item, index) => {
    const card = cards[index].card;
    const link = { href: card.href, dataset: { collectionForgedSearch: searchableForgedNames(card.entity, knowledge).join(' ').toLowerCase() },
      getAttribute: () => link.href, setAttribute: (_, value) => { link.href = value; } };
    return { id: item.id, dataset: { collectionSearch: item.searchText }, link, querySelector: () => link };
  });
  const runtime = browserRuntime(items);
  for (const [slug, name, partial] of forgedPairs) {
    for (const query of [name, partial, `  ${name}  `]) {
      const matches = runtime.search(query);
      assert.deepEqual(matches.map((item) => item.id), [`weapon:${slug}`], query);
      assert.equal(matches[0].link.href, `/weapons/${slug}?form=soulForged`);
      assert.equal(runtime.count.textContent, '共 1 个已发布武器');
    }
    const base = cards.find(({ card }) => card.entity.slug === slug).card;
    const matches = runtime.search(base.displayName);
    assert(matches.some((item) => item.id === base.entity.id));
    assert.equal(items.find((item) => item.id === base.entity.id).link.href, base.href);
  }
  assert.equal(runtime.search('不存在的武器').length, 0);
  assert.equal(runtime.empty.hidden, false);
  runtime.reset.click();
  assert.equal(runtime.input.value, '');
  assert.equal(runtime.input.focused, true);
  assert.equal(runtime.reset.disabled, true);
  assert.equal(runtime.empty.hidden, true);
  assert.equal(items.filter((item) => !item.hidden).length, 26);
  for (const item of items) assert.equal(item.link.href.includes('?'), false);
});

test('shape query selects only an explicit soulForged form and preserves keyboard tab/focus behavior', () => {
  for (const search of ['', '?form=base', '?form=unknown', '?form=soulForged']) {
    const keys = ['base', 'soulForged'];
    const buttons = keys.map((key) => ({ dataset: { formButton: key }, attributes: {}, handlers: {},
      setAttribute(name, value) { this.attributes[name] = value; }, addEventListener(name, handler) { this.handlers[name] = handler; },
      focus() { this.focused = true; } }));
    const panels = keys.map((key) => ({ dataset: { formPanel: key, formName: key }, setAttribute() {} }));
    const controls = { querySelectorAll: () => buttons, setAttribute() {}, hidden: true };
    const title = {};
    const root = { dataset: {}, querySelector: (selector) => selector === 'h1' ? title : controls, querySelectorAll: () => panels };
    runInNewContext(formsScript, { URLSearchParams, window: { location: { search, hash: '#base-weapon-details' } }, document: { querySelectorAll: () => [root] } });
    const selected = search === '?form=soulForged' ? 'soulForged' : 'base';
    assert.equal(root.dataset.activeForm, selected);
    assert.equal(title.textContent, selected);
    assert.equal(controls.hidden, false);
    assert.equal(buttons.find((button) => button.dataset.formButton === selected).attributes['aria-selected'], 'true');
    assert.equal(panels.filter((panel) => !panel.hidden).length, 1);
    let prevented = false;
    buttons[1].handlers.keydown({ key: 'Home', preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(root.dataset.activeForm, 'base');
    assert.equal(buttons[0].focused, true);
    buttons[0].handlers.keydown({ key: 'ArrowRight', preventDefault() {} });
    assert.equal(root.dataset.activeForm, 'soulForged');
    assert.equal(buttons[1].tabIndex, 0);
    buttons[0].handlers.click();
    assert.equal(root.dataset.activeForm, 'base');
  }
});

test('More navigation keeps approved primary order, stable URLs and matching footer semantics', () => {
  assert.deepEqual(secondaryNavigation.map(({ href, label }) => [href, label]), [
    ['/', '首页'], ['/guide', '攻略中心'], ['/accessories', '饰品图鉴'], ['/flasks', '药瓶图鉴'],
    ['/videos', '视频中心'], ['/about', '购买指南'], ['/about-site', '关于本站']
  ]);
  assert.deepEqual(approvedCollectionNavigation.map(({ href }) => href), ['/characters', '/bosses', '/weapons', '/world']);
  assert.deepEqual(footerGroups[1].links, secondaryNavigation.filter(({ section }) => section !== 'home'));
});
