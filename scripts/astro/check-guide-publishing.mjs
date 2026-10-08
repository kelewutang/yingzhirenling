import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { buildGuideSearchDocuments } from '../build-search-index.mjs';

const root = resolve(import.meta.dirname, '../..');
const workspace = await mkdtemp(resolve(tmpdir(), 'pbz-guide-fixture-'));
const fixtureDirectory = resolve(workspace, 'guides');
const output = resolve(workspace, 'dist');
const growthIds = ['growth-guide-f', 'growth-guide-e', 'growth-guide-d', 'growth-guide-c', 'growth-guide-b', 'growth-guide-a'];
try {
  await cp(resolve(root, 'tests/fixtures/guides'), fixtureDirectory, { recursive: true });
  const publishedFixture = await readFile(resolve(fixtureDirectory, 'published-guide.md'), 'utf8');
  for (const [index, id] of growthIds.entries()) {
    const date = index < 2 ? '2026-11-06' : `2026-11-0${6 - index}`;
    await writeFile(resolve(fixtureDirectory, `${id}.md`), publishedFixture
      .replace('title: 测试武器攻略', `title: Synthetic ${id}`)
      .replaceAll('2026-10-29', date));
  }
  const result = spawnSync(process.execPath, [resolve(root, 'node_modules/astro/bin/astro.mjs'), 'build', '--outDir', output], {
    cwd: root,
    env: { ...process.env, PBZ_GUIDE_CONTENT_DIR: fixtureDirectory },
    encoding: 'utf8'
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'Guide fixture Astro build failed');

  const [guide, majorGuide, landing, entity, sitemap, manifest] = await Promise.all([
    readFile(resolve(output, 'guide/published-guide.html'), 'utf8'),
    readFile(resolve(output, 'guide/story-guide-01.html'), 'utf8'),
    readFile(resolve(output, 'guide.html'), 'utf8'),
    readFile(resolve(output, 'weapons/tang-hengdao.html'), 'utf8'),
    readFile(resolve(output, 'sitemap.xml'), 'utf8'),
    readFile(resolve(output, 'generated/guide-search-manifest.json'), 'utf8').then(JSON.parse)
  ]);
  const positions = [
    landing.indexOf('class="page-header"'),
    landing.indexOf('guide-landing__notice'),
    landing.indexOf('class="page-jump-nav"'),
    landing.indexOf('class="guide-landing__published"'),
    landing.indexOf('id="beginner-section"'),
    landing.indexOf('id="guide-faq"'),
    landing.indexOf('<footer')
  ];
  assert(positions.every((position, index) => position >= 0 && (index === 0 || position > positions[index - 1])), `Landing order must be header, notice, navigation, all published Guides, body, FAQ, footer: ${positions.join(', ')}`);
  const publishedSection = landing.slice(positions[3], landing.indexOf('</section>', positions[3]));
  const guideLinks = [...publishedSection.matchAll(/class="guide-card__title"><a href="([^"]+)"/g)].map((match) => match[1]);
  const expectedSafeRoutes = ['growth-guide-e', 'growth-guide-f', 'growth-guide-d', 'growth-guide-c', 'growth-guide-b', 'growth-guide-a', 'published-guide'].map((id) => `/guide/${id}`);
  assert.deepEqual(guideLinks, [...expectedSafeRoutes, '/guide/story-guide-01'], 'All eight published links must remain, ordered by updatedAt descending then ID ascending within the existing spoiler groups');
  assert.equal(manifest.length, 8, 'Synthetic build must publish exactly eight Guides');
  assert.deepEqual(manifest.map((guide) => guide.route), [...expectedSafeRoutes.slice(0, 6), '/guide/story-guide-01', '/guide/published-guide'], 'Published projection must preserve date and ID sorting before spoiler grouping');
  for (const route of guideLinks) {
    assert.match(await readFile(resolve(output, `${route.slice(1)}.html`), 'utf8'), /<h1\b/, `Published route ${route} must exist`);
  }
  const disclosure = publishedSection.match(/<details\b[^>]*data-spoiler-level="major"[^>]*>[\s\S]*?<\/details>/)?.[0];
  assert(disclosure, 'Major Guide must remain inside a disclosure');
  assert.match(disclosure, /data-nosnippet/);
  assert.doesNotMatch(disclosure.split('>')[0], /\bopen(?:[=\s]|$)/, 'Major disclosure must start closed');
  assert.match(disclosure, /href="\/guide\/story-guide-01"/);
  assert.match(guide, /<link rel="canonical" href="https:\/\/www\.yingzhirenling\.cn\/guide\/published-guide"/);
  assert.equal((guide.match(/<h1\b/g) || []).length, 1, 'fixture Guide must render exactly one H1');
  assert.match(guide, /"@type":"Article"/);
  assert.match(guide, /"@type":"BreadcrumbList"/);
  assert.match(majorGuide, /<title>剧情相关攻略 - 影之刃零攻略站<\/title>/);
  assert.doesNotMatch(majorGuide.match(/<head>[\s\S]*?<\/head>/)?.[0] || '', /Late-game Boss/);
  assert.match(majorGuide, /data-spoiler-level="major"/);
  assert.match(majorGuide, /data-nosnippet/);
  assert.match(landing, /测试武器攻略/, 'published fixture Guide must appear on landing');
  assert.match(landing, /剧情相关攻略/, 'major fixture Guide must use its safe landing title');
  assert.doesNotMatch(landing.split('<details')[0], /Late-game Boss/, 'major fixture Guide must not leak its title before disclosure');
  assert.doesNotMatch(landing, /测试草稿/, 'draft fixture Guide must not appear on landing');
  assert.match(entity, /测试武器攻略/, 'published fixture Guide must appear on related Entity detail');
  assert.match(sitemap, /https:\/\/www\.yingzhirenling\.cn\/guide\/published-guide/);
  assert.match(sitemap, /https:\/\/www\.yingzhirenling\.cn\/guide\/story-guide-01/);
  assert.doesNotMatch(sitemap, /draft-guide/);
  const documents = buildGuideSearchDocuments(manifest, new Set(manifest.map((guide) => guide.id)));
  assert.deepEqual(documents.map((document) => document.route), [...expectedSafeRoutes].sort(), 'All seven safe Guides must remain searchable; major and draft Guides must be excluded');
  assert(documents.every((document) => document.recordState === 'published'));
  await assert.rejects(readFile(resolve(output, 'guide/draft-guide.html')), { code: 'ENOENT' });
  console.log('Guide publishing fixture verification passed: eight published Guides, landing DOM order, complete links, stable sorting, closed major disclosure, draft exclusion, routes, SEO, Search, and related Entity.');
} finally {
  await rm(workspace, { recursive: true, force: true });
}
