import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadKnowledge } from '../../src/lib/knowledge.mjs';
import { publishedItems, itemCollections, itemFact } from '../../src/lib/items.mjs';

const root = resolve(import.meta.dirname, '../..');
const knowledge = await loadKnowledge();
const search = JSON.parse(await readFile(resolve(root, 'generated/search-index.production.json'), 'utf8'));
const sitemap = await readFile(resolve(root, 'dist/sitemap.xml'), 'utf8');
const config = await readFile(resolve(root, 'netlify.toml'), 'utf8');
const blocks = config.split('[[redirects]]').slice(1).map((text) => ({ from: text.match(/from = "([^"]+)"/)?.[1], to: text.match(/to = "([^"]+)"/)?.[1], status: Number(text.match(/status = (\d+)/)?.[1]) }));
const decode = (text) => text.replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&#39;', "'");
let count = 0;
for (const [type, spec] of Object.entries(itemCollections)) {
  const entities = publishedItems(knowledge, type);
  const collection = await readFile(resolve(root, `dist/${spec.directory}.html`), 'utf8');
  assert.equal((collection.match(/data-entity-card="true"/g) ?? []).length, entities.length);
  for (const group of spec.categories) assert(collection.includes(group), `Missing screenshot category: ${group}`);
  for (const entity of entities) {
    const route = `/${spec.directory}/${entity.slug}`;
    const html = await readFile(resolve(root, `dist${route}.html`), 'utf8');
    const visible = decode(html.replace(/<(script|style)\b[\s\S]*?<\/\1>/g, ''));
    for (const key of ['effect', 'description']) assert(visible.includes(itemFact(entity, key).value), `${entity.id}: full ${key} missing from No-JS HTML`);
    const level = itemFact(entity, 'level').value;
    assert(html.includes(`>${level}</dd>`), `${entity.id}: current level missing`);
    if (type === 'flask') assert(html.includes(`>${itemFact(entity, 'uses').value}</dd>`), `${entity.id}: uses missing`);
    assert(!html.includes('data-media-state="fallback"'), `${entity.id}: real image must render`);
    assert(!html.includes('id="sources-title"'), `${entity.id}: preserve current detail presentation`);
    assert(!visible.includes('Lv30'), `${entity.id}: item must not inherit weapon levels`);
    const document = search.find((document) => document.id === entity.id);
    assert.equal(document?.route, route);
    assert.equal(document?.summary, entity.summary);
    assert(sitemap.includes(`<loc>https://www.yingzhirenling.cn${route}</loc>`));
    for (const alias of [route + '/', route + '.html']) {
      const rule = blocks.find((block) => block.from === alias);
      assert.equal(rule?.status, 301); assert.equal(rule?.to, route);
    }
    const rule = blocks.find((block) => block.from === route);
    assert.equal(rule?.status, 200); assert.equal(rule?.to, route + '.html');
    count++;
  }
}
assert.equal(count, 24);
console.log('Item static verification passed: 13 accessories, 11 flasks; full effects, real media, independent levels/uses, Search/sitemap and canonical aliases.');
