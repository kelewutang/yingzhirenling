import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const dist = resolve(root, 'dist');
const page = await readFile(resolve(dist, 'weapons/tang-hengdao.html'), 'utf8');
const weapon = JSON.parse(await readFile(resolve(root, 'data/weapons/tang-hengdao.json'), 'utf8'));

assert.equal((page.match(/<h1\b/g) || []).length, 1, 'Tang Hengdao pilot must render exactly one H1');
assert.match(page, /<h1[^>]*>唐横刀<\/h1>/, 'Tang Hengdao H1 missing');
assert(page.includes('<link rel="canonical" href="https://www.yingzhirenling.cn/weapons/tang-hengdao">'), 'Tang Hengdao canonical missing or changed');
assert(!page.includes('noindex'), 'Published Tang Hengdao page must remain indexable');
assert(page.includes('data-detail-pilot="weapon"'), 'Tang Hengdao pilot marker missing');
assert(page.includes('entity-hero'), 'Tang Hengdao entity hero missing');
assert(page.includes('entity-media__fallback'), 'Tang Hengdao no-media fallback missing');
assert(!page.includes('<img'), 'No cleared Media record must not emit an image for Tang Hengdao');
assert(page.includes(weapon.summary), 'Tang Hengdao summary missing');
assert(page.includes('id="quick-facts-title"'), 'Tang Hengdao Quick Facts missing');
assert(page.includes('id="sources-title"'), 'Tang Hengdao Sources missing');
assert(page.includes('class="footer site-footer"'), 'Tang Hengdao shared footer missing');

for (const factId of [
  'fact:weapon:tang-hengdao:kind',
  'fact:weapon:tang-hengdao:public-appearance',
  'fact:weapon:tang-hengdao:observed-trait'
]) assert(page.includes(`data-quick-fact-id="${factId}"`), `Tang Hengdao Quick Fact missing: ${factId}`);

for (const [file, canonical] of [
  ['weapons/ya-hengdao.html', 'https://www.yingzhirenling.cn/weapons/ya-hengdao'],
  ['weapons/bashpole.html', 'https://www.yingzhirenling.cn/weapons/bashpole'],
  ['characters/soul.html', 'https://www.yingzhirenling.cn/characters/soul'],
  ['bosses/commander-cleave.html', 'https://www.yingzhirenling.cn/bosses/commander-cleave'],
  ['world/pangzhen.html', 'https://www.yingzhirenling.cn/world/pangzhen'],
  ['about.html', 'https://www.yingzhirenling.cn/about']
]) {
  const html = await readFile(resolve(dist, file), 'utf8');
  assert(html.includes(`<link rel="canonical" href="${canonical}">`), `Regression route canonical missing: ${file}`);
}

console.log('Weapon detail pilot verification passed: Tang Hengdao hero, fallback, facts, sources, and static regression routes.');
