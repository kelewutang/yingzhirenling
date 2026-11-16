import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const dist = resolve(root, 'dist');
const pages = [
  ['weapons.html', 21],
  ['bosses.html', 5],
  ['characters.html', 6],
  ['world.html', 4]
];

for (const [file, expectedCards] of pages) {
  const html = await readFile(resolve(dist, file), 'utf8');
  const active = file === 'weapons.html';
  assert.equal(html.includes('data-collection-browser'), active, `${file}: Browser activation must follow the current collection size`);
  assert.equal((html.match(/data-entity-card="true"/g) || []).length, expectedCards, `${file}: safe card count changed`);
  assert.equal(html.includes('data-collection-browser-filter'), false, `${file}: filter UI must not exist`);
  assert.equal(html.includes('data-collection-browser-sort'), false, `${file}: sort UI must not exist`);
  if (active) {
    assert(html.includes('data-collection-browser-type="weapon"'), 'Weapon Browser must use its exact family');
    for (const attribute of ['input', 'count', 'reset', 'empty', 'grid']) assert(html.includes(`data-collection-browser-${attribute}`), `Weapon Browser ${attribute} missing`);
    assert.equal((html.match(/data-collection-browser-item /g) || []).length, 21, 'All 21 Weapon cards must remain server rendered');
    assert.equal((html.match(/entity-card--compact/g) || []).length, 21, 'Weapon Browser must use its existing compact card variant');
    assert(html.includes('data-collection-browser-reset disabled'), 'Reset must initially be disabled');
    assert(html.includes('data-collection-browser-empty hidden'), 'Empty state must initially be hidden');
  }
  for (const forbidden of ['Entity 01', 'Hidden Entity', 'Hidden Alias', 'collection-browser-cases']) {
    assert.equal(html.includes(forbidden), false, `${file}: fixture content leaked`);
  }
}

const guide = await readFile(resolve(dist, 'guide.html'), 'utf8');
assert.equal(guide.includes('Build 攻略'), false, 'No production Build Guide may be rendered');
assert.equal(guide.includes('data-collection-browser'), false, 'Guide landing must not receive Collection Browser');

console.log('Collection Browser dist verification passed: 21 server-rendered Weapon cards activate the existing Browser; other collections retain rich cards; no fixture leakage.');
