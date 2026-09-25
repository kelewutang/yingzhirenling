import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const dist = resolve(root, 'dist');
const pages = [
  ['weapons.html', 9],
  ['bosses.html', 3],
  ['characters.html', 3],
  ['world.html', 1]
];

for (const [file, expectedCards] of pages) {
  const html = await readFile(resolve(dist, file), 'utf8');
  assert.equal(html.includes('data-collection-browser'), false, `${file}: Browser controls must remain absent below threshold`);
  assert.equal((html.match(/data-entity-card="true"/g) || []).length, expectedCards, `${file}: safe card count changed`);
  assert.equal(html.includes('data-collection-browser-filter'), false, `${file}: filter UI must not exist`);
  assert.equal(html.includes('data-collection-browser-sort'), false, `${file}: sort UI must not exist`);
  for (const forbidden of ['Entity 01', 'Hidden Entity', 'Hidden Alias', 'collection-browser-cases']) {
    assert.equal(html.includes(forbidden), false, `${file}: fixture content leaked`);
  }
}

const guide = await readFile(resolve(dist, 'guide.html'), 'utf8');
assert.equal(guide.includes('Build 攻略'), false, 'No production Build Guide may be rendered');
assert.equal(guide.includes('data-collection-browser'), false, 'Guide landing must not receive Collection Browser');

console.log('Collection Browser dist verification passed: current small collections retain server-rendered rich cards without Browser controls or fixture leakage.');
