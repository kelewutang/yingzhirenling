import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const dist = resolve(root, 'dist');
const canonicalRoutes = [
  ['index.html', '/'], ['guide.html', '/guide'], ['weapons.html', '/weapons'],
  ['characters.html', '/characters'], ['bosses.html', '/bosses'], ['world.html', '/world'],
  ['videos.html', '/videos'], ['about.html', '/about'], ['about-site.html', '/about-site'],
  ['weapons/tang-hengdao.html', '/weapons/tang-hengdao'],
  ['weapons/ya-hengdao.html', '/weapons/ya-hengdao']
];

for (const [file] of canonicalRoutes) assert((await stat(resolve(dist, file))).isFile(), `Missing dist/${file}`);
assert((await stat(resolve(dist, '404.html'))).isFile(), 'Missing custom 404');
if (process.env.CONTEXT === 'deploy-preview') {
  assert.match(await readFile(resolve(dist, '_headers'), 'utf8'), /X-Robots-Tag: noindex, nofollow/);
} else {
  await assert.rejects(() => stat(resolve(dist, '_headers')), { code: 'ENOENT' });
}

for (const slug of ['tang-hengdao', 'ya-hengdao']) {
  const candidate = await readFile(resolve(dist, 'weapons', `${slug}.html`), 'utf8');
  const legacy = await readFile(resolve(root, 'pages/generated/weapons', `${slug}.html`), 'utf8');
  const canonical = `https://www.yingzhirenling.cn/weapons/${slug}`;
  for (const token of ['<title>', 'name="description"', `<link rel="canonical" href="${canonical}"`, '<h1', 'page-breadcrumb', 'data-fact-id=', '本页来源', '返回武器图鉴']) {
    assert(candidate.includes(token), `${slug}: missing static contract token ${token}`);
  }
  const candidateFacts = [...candidate.matchAll(/data-fact-id="([^"]+)"/g)].map((match) => match[1]).sort();
  const legacyFacts = [...legacy.matchAll(/data-fact-id="([^"]+)"/g)].map((match) => match[1]).sort();
  assert.deepEqual(candidateFacts, legacyFacts, `${slug}: Fact projection differs from production`);
  const contracts = [
    /<title>([^<]+)<\/title>/,
    /<meta name="description" content="([^"]+)"/,
    /<link rel="canonical" href="([^"]+)"/,
    /<h1[^>]*>([^<]+)<\/h1>/
  ];
  for (const contract of contracts) {
    assert.equal(candidate.match(contract)?.[1], legacy.match(contract)?.[1], `${slug}: SEO semantic parity failed: ${contract}`);
  }
  const candidateStatuses = [...candidate.matchAll(/class="info-status" data-status="([^"]+)"/g)].map((match) => match[1]).sort();
  const legacyStatuses = [...legacy.matchAll(/class="info-status" data-status="([^"]+)"/g)].map((match) => match[1]).sort();
  assert.deepEqual(candidateStatuses, legacyStatuses, `${slug}: status label projection differs from production`);
  const sourceUrls = [...legacy.matchAll(/href="(https?:\/\/[^"]+)"/g)].map((match) => match[1]);
  for (const url of sourceUrls) assert(candidate.includes(`href="${url}"`), `${slug}: Source link missing: ${url}`);
  for (const wording of ['待后续核查', '本站发售前编辑判断，不是官方评分或试玩客观数值。', '获取方式尚待后续官方资料或正式版验证。']) {
    assert.equal(candidate.includes(wording), legacy.includes(wording), `${slug}: wording parity failed: ${wording}`);
  }
}

for (const path of ['weapons/qinglong-lueyue-dao.html', 'characters/soul.html', 'characters/mo-yuan.html', 'characters/the-hunt.html']) {
  await assert.rejects(() => stat(resolve(dist, path)), { code: 'ENOENT' });
}

const search = JSON.parse(await readFile(resolve(dist, 'generated/search-index.production.json'), 'utf8'));
assert.deepEqual(search.map((item) => item.id), ['weapon:tang-hengdao', 'weapon:ya-hengdao']);
const sitemap = await readFile(resolve(dist, 'sitemap.xml'), 'utf8');
assert.equal((sitemap.match(/<url>/g) || []).length, 11, 'Sitemap must contain 11 URLs');
for (const forbidden of ['qinglong-lueyue-dao', '/characters/soul', '/characters/mo-yuan', '/characters/the-hunt']) assert(!sitemap.includes(forbidden));
assert.equal((await readdir(dist)).includes('_astro'), false, 'Unexpected Astro client assets');

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files;
}
for (const file of await walk(dist)) {
  const content = await readFile(file);
  const text = content.toString('utf8');
  for (const forbidden of ['/home/mok', '/mnt/c/', 'astro-island', 'client:load']) assert(!text.includes(forbidden), `${file}: forbidden build output`);
}
console.log(`Astro dist verification passed: ${canonicalRoutes.length} canonical routes, 2 Weapon pages, 0 draft detail routes.`);
