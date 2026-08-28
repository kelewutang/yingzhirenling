import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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
const publishedSlugs = ['tang-hengdao', 'ya-hengdao'];

assert(!indexByFrom.has('/weapons/:slug.html'), 'Parameterized .html redirect would change unknown/draft 404 behavior');
for (const slug of publishedSlugs) {
  const htmlRoute = `/weapons/${slug}.html`;
  const canonicalRoute = `/weapons/${slug}`;
  const htmlRule = blocks[indexByFrom.get(htmlRoute)];
  const canonicalRule = blocks[indexByFrom.get(canonicalRoute)];
  assert.deepEqual(htmlRule, { from: htmlRoute, to: canonicalRoute, status: 301, force: true });
  assert.equal(canonicalRule.status, 200, `${canonicalRoute} must remain an extensionless 200 rewrite`);
  assert(indexByFrom.get(htmlRoute) < indexByFrom.get(canonicalRoute), `${htmlRoute} redirect must precede its 200 rewrite`);

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

assert.equal(blocks.at(-1).from, '/*');
assert.equal(blocks.at(-1).status, 404);
console.log('Netlify Weapon redirect regression checks passed.');
