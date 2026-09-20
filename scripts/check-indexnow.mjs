import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseSitemapCanonicalUrls, readIndexNowKey } from './indexnow.mjs';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');
const key = await readIndexNowKey(dist);
const [keyFile, sitemap, searchIndex, outputFiles] = await Promise.all([
  readFile(resolve(dist, `${key}.txt`), 'utf8'),
  readFile(resolve(dist, 'sitemap.xml'), 'utf8'),
  readFile(resolve(root, 'generated/search-index.production.json'), 'utf8'),
  readdir(dist, { recursive: true })
]);
const canonicalUrls = parseSitemapCanonicalUrls(sitemap);
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
assert.equal(canonicalUrls.length, 25, 'IndexNow must preserve the 25-URL sitemap contract');
assert.equal(canonicalTagCount, 27, 'IndexNow must preserve the 27 canonical-tag contract');
assert.equal(pageHtmlCount, 28, 'IndexNow must preserve the 28 page-HTML contract');
assert.equal(JSON.parse(searchIndex).length, 16, 'IndexNow must preserve the 16-document production Search contract');

console.log('IndexNow dist verification passed: root UTF-8 key file and frozen 25 sitemap / 27 canonical-tag / 28 page-HTML / 16 Search-document counts.');
