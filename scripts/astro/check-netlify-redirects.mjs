import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const config = await readFile(resolve(root, 'netlify.toml'), 'utf8');
const blocks = config.split('[[redirects]]').slice(1).map((text) => {
  const from = text.match(/^\s*from = "([^"]+)"/m)?.[1];
  const to = text.match(/^\s*to = "([^"]+)"/m)?.[1];
  const status = Number(text.match(/^\s*status = (\d+)/m)?.[1]);
  const force = text.match(/^\s*force = (true|false)/m)?.[1] === 'true';
  return { from, to, status, force };
});

const indexByFrom = new Map(blocks.map((block, index) => [block.from, index]));
const weaponDirectory = resolve(root, 'data/weapons');
const weapons = await Promise.all(
  (await readdir(weaponDirectory)).filter((name) => name.endsWith('.json')).sort()
    .map(async (name) => JSON.parse(await readFile(resolve(weaponDirectory, name), 'utf8')))
);
const publishedWeapons = weapons.filter((weapon) => weapon.recordState === 'published');
const draftWeapons = weapons.filter((weapon) => weapon.recordState === 'draft');
const bossDirectory = resolve(root, 'data/bosses');
const publishedBosses = (await Promise.all(
  (await readdir(bossDirectory)).filter((name) => name.endsWith('.json')).sort()
    .map(async (name) => JSON.parse(await readFile(resolve(bossDirectory, name), 'utf8')))
)).filter((boss) => boss.recordState === 'published');
const locationDirectory = resolve(root, 'data/locations');
const locations = await Promise.all(
  (await readdir(locationDirectory)).filter((name) => name.endsWith('.json')).sort()
    .map(async (name) => JSON.parse(await readFile(resolve(locationDirectory, name), 'utf8')))
);
const publishedLocations = locations.filter((location) => location.recordState === 'published');
const draftLocations = locations.filter((location) => location.recordState === 'draft');
const historicalWeaponSlugs = new Set(['tang-hengdao', 'ya-hengdao']);

assert(!indexByFrom.has('/weapons/:slug.html'), 'Parameterized .html redirect would change unknown/draft 404 behavior');
for (const weapon of publishedWeapons) {
  const slug = weapon.slug;
  const htmlRoute = `/weapons/${slug}.html`;
  const canonicalRoute = `/weapons/${slug}`;
  const htmlRule = blocks[indexByFrom.get(htmlRoute)];
  const canonicalRule = blocks[indexByFrom.get(canonicalRoute)];
  assert.deepEqual(htmlRule, { from: htmlRoute, to: canonicalRoute, status: 301, force: true });
  assert.equal(canonicalRule.status, 200, `${canonicalRoute} must remain an extensionless 200 rewrite`);
  assert(indexByFrom.get(htmlRoute) < indexByFrom.get(canonicalRoute), `${htmlRoute} redirect must precede its 200 rewrite`);

  if (historicalWeaponSlugs.has(slug)) {
    const historicalRoutes = [
      `/pages/generated/weapons/${slug}.html`,
      `/pages/generated/weapons/${slug}`
    ];
    for (const route of historicalRoutes) {
      const rule = blocks[indexByFrom.get(route)];
      assert.deepEqual(rule, { from: route, to: canonicalRoute, status: 301, force: true });
      assert(indexByFrom.get(route) < indexByFrom.get(canonicalRoute), `${route} must stay a single-hop canonical redirect`);
    }
  }
}
for (const weapon of draftWeapons) {
  assert(!indexByFrom.has(`/weapons/${weapon.slug}`), `Draft Weapon canonical route must remain 404: ${weapon.slug}`);
  assert(!indexByFrom.has(`/weapons/${weapon.slug}.html`), `Draft Weapon .html route must remain 404: ${weapon.slug}`);
}

assert(!indexByFrom.has('/characters/:slug.html'), 'Parameterized Character .html redirect would change unknown/draft 404 behavior');
for (const slug of ['soul', 'mo-yuan', 'the-hunt']) {
  const htmlRoute = `/characters/${slug}.html`;
  const canonicalRoute = `/characters/${slug}`;
  assert.deepEqual(blocks[indexByFrom.get(htmlRoute)], { from: htmlRoute, to: canonicalRoute, status: 301, force: true });
  assert.equal(blocks[indexByFrom.get(canonicalRoute)].status, 200, `${canonicalRoute} must remain an extensionless 200 rewrite`);
  assert(indexByFrom.get(htmlRoute) < indexByFrom.get(canonicalRoute), `${htmlRoute} redirect must precede its 200 rewrite`);
}

assert(!indexByFrom.has('/bosses/:slug.html'), 'Parameterized Boss .html redirect would change unknown/draft 404 behavior');
for (const boss of publishedBosses) {
  const htmlRoute = `/bosses/${boss.slug}.html`;
  const canonicalRoute = `/bosses/${boss.slug}`;
  assert.deepEqual(blocks[indexByFrom.get(htmlRoute)], { from: htmlRoute, to: canonicalRoute, status: 301, force: true });
  assert.equal(blocks[indexByFrom.get(canonicalRoute)].status, 200, `${canonicalRoute} must remain an extensionless 200 rewrite`);
  assert(indexByFrom.get(htmlRoute) < indexByFrom.get(canonicalRoute), `${htmlRoute} redirect must precede its 200 rewrite`);
}

assert(!indexByFrom.has('/world/:slug.html'), 'Parameterized Location .html redirect would change unknown/draft 404 behavior');
for (const location of publishedLocations) {
  const htmlRoute = `/world/${location.slug}.html`;
  const canonicalRoute = `/world/${location.slug}`;
  assert.deepEqual(blocks[indexByFrom.get(htmlRoute)], { from: htmlRoute, to: canonicalRoute, status: 301, force: true });
  assert.equal(blocks[indexByFrom.get(canonicalRoute)].status, 200, `${canonicalRoute} must remain an extensionless 200 rewrite`);
  assert(indexByFrom.get(htmlRoute) < indexByFrom.get(canonicalRoute), `${htmlRoute} redirect must precede its 200 rewrite`);
}
for (const location of draftLocations) {
  assert(!indexByFrom.has(`/world/${location.slug}`), `Draft Location canonical route must remain 404: ${location.slug}`);
  assert(!indexByFrom.has(`/world/${location.slug}.html`), `Draft Location .html route must remain 404: ${location.slug}`);
}

assert.equal(blocks.at(-1).from, '/*');
assert.equal(blocks.at(-1).status, 404);
console.log(`Netlify redirect regression checks passed: ${publishedWeapons.length} published Weapon, ${publishedBosses.length} published Boss, and ${publishedLocations.length} published Location routes.`);
