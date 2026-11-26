import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const dist = resolve(root, 'dist');
const pages = [
  ['weapons.html', 26],
  ['bosses.html', 54],
  ['characters.html', 6],
  ['world.html', 9]
];

for (const [file, expectedCards] of pages) {
  const html = await readFile(resolve(dist, file), 'utf8');
  const active = ['weapons.html', 'bosses.html'].includes(file);
  assert.equal(html.includes('data-collection-browser'), active, `${file}: Browser activation must follow the current collection size`);
  assert.equal((html.match(/data-entity-card="true"/g) || []).length, expectedCards, `${file}: safe card count changed`);
  assert.equal(html.includes('data-collection-browser-filter'), false, `${file}: filter UI must not exist`);
  assert.equal(html.includes('data-collection-browser-sort'), false, `${file}: sort UI must not exist`);
  if (active) {
    assert(html.includes(`data-collection-browser-type="${file === 'weapons.html' ? 'weapon' : 'boss'}"`), `${file}: Browser must use its exact family`);
    for (const attribute of ['input', 'count', 'reset', 'empty', 'grid']) assert(html.includes(`data-collection-browser-${attribute}`), `Weapon Browser ${attribute} missing`);
    assert.equal((html.match(/data-collection-browser-item /g) || []).length, expectedCards, `${file}: all admitted cards must remain server rendered`);
    assert.equal((html.match(/entity-card--compact/g) || []).length, expectedCards, `${file}: Browser must use its existing compact card variant`);
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

console.log('Collection Browser dist verification passed: 26 Weapon and 54 Boss cards activate the existing Browser; other collections retain rich cards; no fixture leakage.');


const weapons = await readFile(resolve(dist, 'weapons.html'), 'utf8');
const forgedPairs = [['heishang', '黑魔伤'], ['heishang-shuangren', '绝影'], ['changxing-heishang', '炽刃'], ['luanying-jian', '天邈·乱莺']];
assert.equal((weapons.match(/data-collection-forged-search=/g) || []).length, 4);
for (const [slug, name] of forgedPairs) {
  const card = weapons.match(new RegExp(`<a[^>]*href="/weapons/${slug}"[^>]*>[\\s\\S]*?</a>`))?.[0];
  assert(card?.includes(`data-collection-forged-search="${name}"`), `${slug}: safe forged search metadata missing`);
  assert(card.includes(`铸魂后：${name}`), `${slug}: forged label missing from the static card`);
  const detail = await readFile(resolve(dist, `weapons/${slug}.html`), 'utf8');
  assert.match(detail, /data-form-controls hidden/, `${slug}: controls must progressively enhance`);
  assert.equal((detail.match(/<section[^>]*data-form-panel=/g) || []).length, 2);
  assert.equal((detail.match(/<section[^>]*data-form-panel=[^>]* hidden/g) || []).length, 0, `${slug}: both forms must remain readable without JS`);
}
console.log('Forged-name static verification passed: four labeled cards, original detail paths and both no-JS forms.');
