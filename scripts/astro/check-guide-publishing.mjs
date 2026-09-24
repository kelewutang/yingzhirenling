import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { buildGuideSearchDocuments } from '../build-search-index.mjs';

const root = resolve(import.meta.dirname, '../..');
const fixtureDirectory = resolve(root, 'tests/fixtures/guides');
const output = await mkdtemp(resolve(tmpdir(), 'pbz-guide-fixture-'));
try {
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
  const documents = buildGuideSearchDocuments(manifest, new Set(['published-guide']));
  assert.deepEqual(documents.map((document) => document.route), ['/guide/published-guide']);
  assert.equal(documents[0].recordState, 'published');
  console.log('Guide publishing fixture verification passed: published route, canonical, Article, BreadcrumbList, sitemap, Search, landing, related Entity, and draft exclusion.');
} finally {
  await rm(output, { recursive: true, force: true });
}
