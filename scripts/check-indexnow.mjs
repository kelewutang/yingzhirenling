import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseSitemapCanonicalUrls, readIndexNowKey } from './indexnow.mjs';
import { loadProductionInventory } from './astro/production-inventory.mjs';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');
const manifestPath = resolve(root, 'plugins/netlify-plugin-indexnow/manifest.yml');
const manifestMetadata = await stat(manifestPath);
assert(manifestMetadata.isFile(), 'IndexNow Netlify plugin manifest must be a file');

const manifest = await readFile(manifestPath, 'utf8');
const manifestFields = manifest
  .split(/\r?\n/)
  .filter((line) => line.trim() && !line.trimStart().startsWith('#'))
  .map((line) => {
    const match = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
    assert(match, `IndexNow Netlify plugin manifest must contain only top-level fields: ${line}`);
    return { name: match[1], value: match[2] };
  });

assert.deepEqual(
  manifestFields.map((field) => field.name),
  ['name'],
  'IndexNow Netlify plugin manifest must contain only the allowed name field'
);
assert.equal(manifestFields[0].value, 'netlify-plugin-indexnow', 'IndexNow Netlify plugin name must match its directory contract');

const key = await readIndexNowKey(dist);
const [keyFile, sitemap, searchIndex, outputFiles] = await Promise.all([
  readFile(resolve(dist, `${key}.txt`), 'utf8'),
  readFile(resolve(dist, 'sitemap.xml'), 'utf8'),
  readFile(resolve(root, 'generated/search-index.production.json'), 'utf8'),
  readdir(dist, { recursive: true })
]);
const canonicalUrls = parseSitemapCanonicalUrls(sitemap);
const inventory = await loadProductionInventory(root);
const canonicalTagCount = (await Promise.all(
  outputFiles
    .filter((file) => file.endsWith('.html'))
    .map((file) => readFile(resolve(dist, file), 'utf8'))
)).reduce((count, html) => count + (html.match(/<link\s+rel="canonical"\s+href="/gi) || []).length, 0);
const pageHtmlCount = outputFiles
  .filter((file) => file.endsWith('.html'))
  // This is the existing non-page Baidu ownership artifact, not a canonical page.
  .filter((file) => !file.startsWith('baidu_verify_')).length;

assert.equal(keyFile, key, 'IndexNow key file content must exactly equal the filename key');
assert(keyFile.length > 0, 'IndexNow key file must not be empty');
assert(!keyFile.includes('<'), 'IndexNow key file must not contain an HTML wrapper');
assert(!sitemap.includes(`${key}.txt`), 'IndexNow key file must not enter the sitemap');
assert.equal(canonicalUrls.length, inventory.counts.sitemap, 'IndexNow sitemap inventory drifted');
assert.equal(canonicalTagCount, inventory.counts.canonical, 'IndexNow canonical-tag inventory drifted');
assert.equal(pageHtmlCount, inventory.counts.pageHtml, 'IndexNow page-HTML inventory drifted');
assert.equal(JSON.parse(searchIndex).length, inventory.counts.searchDocs, 'IndexNow production Search inventory drifted');

console.log(`IndexNow dist verification passed: root UTF-8 key file and production inventory ${inventory.counts.sitemap} sitemap / ${inventory.counts.canonical} canonical-tag / ${inventory.counts.pageHtml} page-HTML / ${inventory.counts.searchDocs} Search-document counts.`);
