import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const pages = [
  'index.html',
  '404.html',
  'guide.html',
  'weapons.html',
  'characters.html',
  'bosses.html',
  'world.html',
  'videos.html',
  'about.html',
  'about-site.html',
  'pages/generated/weapons/tang-hengdao.html',
  'pages/generated/weapons/ya-hengdao.html',
  'weapons/tang-hengdao.html',
  'characters/soul.html',
  'bosses/commander-cleave.html',
  'world/pangzhen.html'
];

for (const page of pages) {
  const html = await readFile(resolve(root, 'dist', page), 'utf8');
  assert.match(html, /class="skip-link" href="#main-content"/, `${page} must provide a skip link`);
  assert.match(html, /class="site-header"/, `${page} must use the shared header shell`);
  assert.match(html, /id="main-content"/, `${page} must expose the main skip target`);
  assert.match(html, /class="footer site-footer"/, `${page} must use the shared footer shell`);
  assert.match(html, /aria-label="搜索知识库"/, `${page} must provide the shared Search trigger`);
  assert.doesNotMatch(html, /theme-switcher|theme-btn|🔍/, `${page} must not expose legacy theme or emoji Search controls`);
  assert.equal((html.match(/class="site-header"/g) || []).length, 1, `${page} must render one header shell`);
  assert.equal((html.match(/id="main-content"/g) || []).length, 1, `${page} must render one main skip target`);
  assert.equal((html.match(/class="footer site-footer"/g) || []).length, 1, `${page} must render one footer shell`);
}

console.log(`Shared shell verification passed: ${pages.length} static pages.`);
