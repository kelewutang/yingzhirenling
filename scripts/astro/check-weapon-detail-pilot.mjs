import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const dist = resolve(root, 'dist');
const page = await readFile(resolve(dist, 'weapons/soft-snake-sword.html'), 'utf8');
const weapon = JSON.parse(await readFile(resolve(root, 'data/weapons/soft-snake-sword.json'), 'utf8'));
const mediaRecords = JSON.parse(await readFile(resolve(root, 'data/media.json'), 'utf8')).records;
const productionRightsStatuses = new Set(['permission-recorded', 'official-press-use-reviewed', 'self-captured-reviewed', 'official-promotional-risk-accepted']);
const heroMedia = mediaRecords.find((media) => media.entityId === weapon.id && media.recordState === 'published' && productionRightsStatuses.has(media.rightsStatus) && media.usage.includes('hero'));
const escapeHtml = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const entityHero = page.match(/<header class="entity-hero">[\s\S]*?<\/header>/)?.[0] || '';

assert.equal((page.match(/<h1\b/g) || []).length, 1, 'Soft Snake Sword pilot must render exactly one H1');
assert.match(page, /<h1[^>]*>灵蛇软剑<\/h1>/, 'Soft Snake Sword H1 missing');
assert(page.includes('<link rel="canonical" href="https://www.yingzhirenling.cn/weapons/soft-snake-sword">'), 'Soft Snake Sword canonical missing or changed');
assert(!page.includes('noindex'), 'Published Soft Snake Sword page must remain indexable');
assert(page.includes('data-detail-pilot="weapon"'), 'Soft Snake Sword pilot marker missing');
assert(page.includes('entity-hero'), 'Soft Snake Sword entity hero missing');
if (heroMedia) {
  assert(page.includes('data-media-state="ready"'), 'Admitted Soft Snake Sword hero Media must render ready state');
  assert(page.includes(`src="/assets/media/${heroMedia.src}"`), 'Admitted Soft Snake Sword hero Media src missing');
  assert(page.includes(`alt="${escapeHtml(heroMedia.alt)}"`), 'Admitted Soft Snake Sword hero Media alt missing');
  assert(!entityHero.includes('<figcaption'), 'Soft Snake Sword hero Media must not render a caption');
} else {
  assert(page.includes('entity-media__fallback'), 'Soft Snake Sword fallback missing without admitted hero Media');
  assert(!entityHero.includes('<img'), 'Soft Snake Sword Entity Hero must not emit an image without admitted hero Media');
}
assert(page.includes(weapon.summary), 'Soft Snake Sword SEO summary missing');
assert(!entityHero.includes('entity-hero__summary'), 'Soft Snake Sword Hero must not render its summary');
assert(page.includes('id="weapon-overview-title"'), 'Soft Snake Sword Weapon overview missing');
assert(page.includes('id="sources-title"'), 'Soft Snake Sword Sources missing');
assert(page.includes('class="footer site-footer"'), 'Soft Snake Sword shared footer missing');

assert(page.includes('data-weapon-overview-field="taxonomy" data-system-category-fact-id="fact:weapon:soft-snake-sword:system-category"'), 'Soft Snake Sword normalized taxonomy missing');
assert(!page.includes('data-weapon-section="mechanics"'), 'Sparse Soft Snake Sword must not emit an empty mechanics section');
assert(!page.includes('data-weapon-section="progression"'), 'Sparse Soft Snake Sword must not emit an empty progression section');

for (const [file, canonical] of [
  ['weapons/soft-snake-sword.html', 'https://www.yingzhirenling.cn/weapons/soft-snake-sword'],
  ['characters/soul.html', 'https://www.yingzhirenling.cn/characters/soul'],
  ['bosses/cangang.html', 'https://www.yingzhirenling.cn/bosses/cangang'],
  ['world/pangzhen.html', 'https://www.yingzhirenling.cn/world/pangzhen'],
  ['about.html', 'https://www.yingzhirenling.cn/about']
]) {
  const html = await readFile(resolve(dist, file), 'utf8');
  assert(html.includes(`<link rel="canonical" href="${canonical}">`), `Regression route canonical missing: ${file}`);
}

console.log('Weapon detail verification passed: Soft Snake Sword hero, sparse overview, sources, and static regression routes.');
