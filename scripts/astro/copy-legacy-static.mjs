import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { renderLegacyFooter, renderLegacyHeader, resolveLegacyActiveSection } from './site-shell.mjs';
import { createBreadcrumbList, createPageIdentity, productionUrl, serializeJsonLd } from '../../src/lib/structured-data.mjs';
import { applyLifecycleTokens } from '../../src/lib/site-lifecycle.mjs';

const root = resolve(import.meta.dirname, '../..');
const dist = resolve(root, 'dist');
const baiduVerificationFiles = (await readdir(root, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && /^baidu_verify_codeva-[a-z0-9-]+\.html$/i.test(entry.name))
  .map((entry) => entry.name)
  .sort();

if (baiduVerificationFiles.length !== 1) {
  throw new Error('Expected exactly one Baidu verification artifact at the repository root');
}

// Migration bridge only. Delete after every legacy page is owned by Astro.
const targets = [
  ['css', 'css'],
  ['js', 'js'],
  ['generated/search-index.production.json', 'generated/search-index.production.json'],
  ['favicon.ico', 'favicon.ico'],
  ['robots.txt', 'robots.txt'],
  ...baiduVerificationFiles.map((file) => [file, file]),
  ['404.html', '404.html'],
  ['pages/guide.html', 'guide.html'],
  ['pages/about.html', 'about.html'],
  ['pages/about-site.html', 'about-site.html']
];

const legacyShellPages = [
  ['guide.html', '/guide'],
  ['about.html', '/about'],
  ['about-site.html', '/about-site'],
  ['404.html', '']
];

function replaceLegacyShell(html, route) {
  const header = renderLegacyHeader(resolveLegacyActiveSection(route));
  const footer = renderLegacyFooter();
  const hasMain = /<main\b/i.test(html);
  const navPattern = /<nav class="navbar"[\s\S]*?<\/nav>/i;
  const footerPattern = /<footer class="footer"[\s\S]*?<\/footer>/i;

  if (!navPattern.test(html)) throw new Error(`Legacy navigation shell missing for ${route || '404'}`);
  if (!footerPattern.test(html)) throw new Error(`Legacy footer shell missing for ${route || '404'}`);

  let next = html.replace(navPattern, `${header}${hasMain ? '' : '<main class="legacy-main" id="main-content">'}`);
  if (hasMain) {
    next = next.replace(/<main\b([^>]*)>/i, (match, attributes) => /\bid\s*=/.test(attributes) ? match : `<main id="main-content"${attributes}>`);
  }
  return next.replace(footerPattern, `${hasMain ? '' : '</main>'}${footer}`);
}

function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function decodeHtml(value) {
  return String(value).replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');
}

function readLegacyMetadata(html, route) {
  if (!route) return null;

  const titleSource = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1];
  const descriptionSource = html.match(/<meta\s+name="description"\s+content="([^"]*)"\s*\/?\s*>/i)?.[1];
  const canonical = html.match(/<link\s+rel="canonical"\s+href="([^"]*)"\s*\/?\s*>/i)?.[1];
  if (!titleSource || !descriptionSource || !canonical) throw new Error(`Legacy metadata missing for ${route}`);
  if (canonical !== productionUrl(route)) throw new Error(`Legacy canonical mismatch for ${route}: ${canonical}`);
  return { title: decodeHtml(titleSource), description: decodeHtml(descriptionSource), canonical };
}

function legacyMetadata(html, metadata) {
  const ogType = /"@type": "Article"/.test(html) ? 'article' : 'website';
  const social = [
    `<meta property="og:title" content="${escapeHtml(metadata.title)}">`,
    `<meta property="og:description" content="${escapeHtml(metadata.description)}">`,
    `<meta property="og:url" content="${escapeHtml(metadata.canonical)}">`,
    `<meta property="og:type" content="${ogType}">`,
    '<meta name="twitter:card" content="summary">',
    `<meta name="twitter:title" content="${escapeHtml(metadata.title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(metadata.description)}">`
  ].join('\n  ');

  return html.replace(/(<link\s+rel="canonical"\s+href="[^"]*"\s*\/?\s*>)/i, `$1\n  ${social}`);
}

function legacyBreadcrumb(html, metadata, route) {
  const match = html.match(/<div class="page-breadcrumb">\s*<a href="\/">([^<]+)<\/a>\s*\/\s*([^<]+)\s*<\/div>/i);
  if (!match) throw new Error(`Legacy breadcrumb missing for ${route}`);
  return createBreadcrumbList([
    { name: decodeHtml(match[1]), item: productionUrl('/') },
    { name: decodeHtml(match[2]), item: metadata.canonical }
  ]);
}

function legacyStructuredData(html, route, metadata) {
  const data = [legacyBreadcrumb(html, metadata, route)];
  if (route !== '/guide') data.unshift(createPageIdentity({
    type: 'WebPage',
    name: metadata.title,
    description: metadata.description,
    url: metadata.canonical
  }));
  const scripts = data.map((item) => `  <script type="application/ld+json">${serializeJsonLd(item)}</script>`).join('\n');
  return html.replace(/<\/head>/i, `${scripts}\n</head>`);
}

for (const [sourcePath, destinationPath] of targets) {
  const source = resolve(root, sourcePath);
  const destination = resolve(dist, destinationPath);
  await mkdir(dirname(destination), { recursive: true });
  await rm(destination, { recursive: true, force: true });
  await cp(source, destination, { recursive: true });
}

for (const destinationPath of ['guide.html', 'about-site.html', 'js/main.js']) {
  const destination = resolve(dist, destinationPath);
  await writeFile(destination, applyLifecycleTokens(await readFile(destination, 'utf8')), 'utf8');
}

// Entity Media remains a separately governed path. The validator has already
// admitted these records, so only eligible local files may enter dist; draft,
// review-required, retired, and orphan files must never be copied.
const media = JSON.parse(await readFile(resolve(root, 'data', 'media.json'), 'utf8')).records;
const productionRightsStatuses = new Set([
  'permission-recorded',
  'official-press-use-reviewed',
  'self-captured-reviewed',
  'official-promotional-risk-accepted'
]);
const mediaDestination = resolve(dist, 'assets', 'media');
const productionMediaSources = [...new Set(media
  .filter((record) => record.recordState === 'published' && productionRightsStatuses.has(record.rightsStatus))
  .map((record) => record.src))];
await rm(mediaDestination, { recursive: true, force: true });
if (productionMediaSources.length > 0) {
  await mkdir(mediaDestination, { recursive: true });
  for (const source of productionMediaSources) {
    await cp(resolve(root, 'assets', 'media', source), resolve(mediaDestination, source));
  }
}

for (const [destinationPath, route] of legacyShellPages) {
  const destination = resolve(dist, destinationPath);
  const page = await readFile(destination, 'utf8');
  const withShell = replaceLegacyShell(page, route);
  const metadata = readLegacyMetadata(withShell, route);
  const withMetadata = metadata ? legacyMetadata(withShell, metadata) : withShell;
  await writeFile(destination, metadata ? legacyStructuredData(withMetadata, route, metadata) : withMetadata, 'utf8');
}

// Preserve the existing exact Netlify rewrites while making their targets
// Astro-generated. This compatibility copy disappears with the migration bridge.
for (const slug of ['tang-hengdao', 'ya-hengdao']) {
  const destination = resolve(dist, 'pages/generated/weapons', `${slug}.html`);
  await mkdir(dirname(destination), { recursive: true });
  await cp(resolve(dist, 'weapons', `${slug}.html`), destination);
}

// Netlify supplies CONTEXT. Never add noindex to a future production build.
if (process.env.CONTEXT === 'deploy-preview') {
  await writeFile(resolve(dist, '_headers'), '/*\n  X-Robots-Tag: noindex, nofollow\n', 'utf8');
}
