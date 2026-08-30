import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { renderLegacyFooter, renderLegacyHeader, resolveLegacyActiveSection } from './site-shell.mjs';

const root = resolve(import.meta.dirname, '../..');
const dist = resolve(root, 'dist');

function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

async function renderPublishedWeaponCards() {
  const directory = resolve(root, 'data/weapons');
  const names = (await readdir(directory)).filter((name) => name.endsWith('.json')).sort();
  const weapons = (await Promise.all(names.map(async (name) => JSON.parse(await readFile(resolve(directory, name), 'utf8')))))
    .filter((weapon) => weapon.recordState === 'published')
    .sort((a, b) => a.id.localeCompare(b.id));
  return `<section aria-labelledby="published-weapons-title">
        <h2 id="published-weapons-title">已发布武器资料</h2>
        <p>以下条目来自可核查的公开资料；详情页只展示当前有 Fact 与 Source 支持的信息。</p>
        <div class="card-grid" style="margin:20px 0;">
${weapons.map((weapon) => `          <a class="card" href="/weapons/${escapeHtml(weapon.slug)}"><h3 class="card-title">${escapeHtml(weapon.displayName)}</h3><p class="card-text">${escapeHtml(weapon.summary)}</p><span class="btn btn-outline">查看武器资料</span></a>`).join('\n')}
        </div>
      </section>`;
}

async function renderPublishedCharacterCards() {
  const directory = resolve(root, 'data/characters');
  const names = (await readdir(directory)).filter((name) => name.endsWith('.json')).sort();
  const characters = (await Promise.all(names.map(async (name) => JSON.parse(await readFile(resolve(directory, name), 'utf8')))))
    .filter((character) => character.recordState === 'published')
    .sort((a, b) => a.id.localeCompare(b.id));
  return `<section aria-labelledby="published-characters-title">
        <h2 id="published-characters-title">已发布角色资料</h2>
        <div class="card-grid" style="margin:20px 0;">
${characters.map((character) => `          <a class="card" href="/characters/${escapeHtml(character.slug)}"><h3 class="card-title">${escapeHtml(character.displayName)}</h3><p class="card-text">${escapeHtml(character.summary)}</p><span class="btn btn-outline">查看角色资料</span></a>`).join('\n')}
        </div>
      </section>`;
}

async function renderPublishedBossCards() {
  const directory = resolve(root, 'data/bosses');
  const names = (await readdir(directory)).filter((name) => name.endsWith('.json')).sort();
  const bosses = (await Promise.all(names.map(async (name) => JSON.parse(await readFile(resolve(directory, name), 'utf8')))))
    .filter((boss) => boss.recordState === 'published')
    .sort((a, b) => a.id.localeCompare(b.id));
  return `<section aria-labelledby="published-bosses-title">
        <h2 id="published-bosses-title">已发布 Boss 资料</h2>
        <p>以下条目来自可核查的公开资料；详情页仅展示目前有来源支持的信息。</p>
        <div class="card-grid" style="margin:20px 0;">
${bosses.map((boss) => `          <a class="card" href="/bosses/${escapeHtml(boss.slug)}"><h3 class="card-title">${escapeHtml(boss.displayName)}</h3><p class="card-text">${escapeHtml(boss.summary)}</p><span class="btn btn-outline">查看 Boss 资料</span></a>`).join('\n')}
        </div>
      </section>`;
}

async function renderPublishedLocationCards() {
  const directory = resolve(root, 'data/locations');
  const names = (await readdir(directory)).filter((name) => name.endsWith('.json')).sort();
  const locations = (await Promise.all(names.map(async (name) => JSON.parse(await readFile(resolve(directory, name), 'utf8')))))
    .filter((location) => location.recordState === 'published')
    .sort((a, b) => a.id.localeCompare(b.id));
  return `<section aria-labelledby="published-locations-title">
        <h2 id="published-locations-title">已发布地点资料</h2>
        <p>以下条目只收录名称与地点 identity 有可靠公开依据的场所；描述性场景不会自动成为正式地点名。</p>
        <div class="card-grid" style="margin:20px 0;">
${locations.map((location) => `          <a class="card" href="/world/${escapeHtml(location.slug)}"><h3 class="card-title">${escapeHtml(location.displayName)}</h3><p class="card-text">${escapeHtml(location.summary)}</p><span class="btn btn-outline">查看地点资料</span></a>`).join('\n')}
        </div>
      </section>`;
}

// Migration bridge only. Delete after every legacy page is owned by Astro.
const targets = [
  ['css', 'css'],
  ['js', 'js'],
  ['assets', 'assets'],
  ['generated/search-index.production.json', 'generated/search-index.production.json'],
  ['favicon.ico', 'favicon.ico'],
  ['robots.txt', 'robots.txt'],
  ['404.html', '404.html'],
  ['index.html', 'index.html'],
  ['pages/guide.html', 'guide.html'],
  ['pages/weapons.html', 'weapons.html'],
  ['pages/characters.html', 'characters.html'],
  ['pages/bosses.html', 'bosses.html'],
  ['pages/world.html', 'world.html'],
  ['pages/videos.html', 'videos.html'],
  ['pages/about.html', 'about.html'],
  ['pages/about-site.html', 'about-site.html']
];

const legacyShellPages = [
  ['index.html', '/'],
  ['guide.html', '/guide'],
  ['weapons.html', '/weapons'],
  ['characters.html', '/characters'],
  ['bosses.html', '/bosses'],
  ['world.html', '/world'],
  ['videos.html', '/videos'],
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

for (const [sourcePath, destinationPath] of targets) {
  const source = resolve(root, sourcePath);
  const destination = resolve(dist, destinationPath);
  await mkdir(dirname(destination), { recursive: true });
  await rm(destination, { recursive: true, force: true });
  await cp(source, destination, { recursive: true });
}

for (const [destinationPath, route] of legacyShellPages) {
  const destination = resolve(dist, destinationPath);
  const page = await readFile(destination, 'utf8');
  await writeFile(destination, replaceLegacyShell(page, route), 'utf8');
}

const weaponCollectionFile = resolve(dist, 'weapons.html');
const weaponCollection = await readFile(weaponCollectionFile, 'utf8');
const weaponCards = await renderPublishedWeaponCards();
if (!weaponCollection.includes('<!-- published-weapon-cards -->')) throw new Error('Weapon collection projection marker missing');
await writeFile(weaponCollectionFile, weaponCollection.replace('<!-- published-weapon-cards -->', weaponCards), 'utf8');

const characterCollectionFile = resolve(dist, 'characters.html');
const characterCollection = await readFile(characterCollectionFile, 'utf8');
const characterCards = await renderPublishedCharacterCards();
if (!characterCollection.includes('<!-- published-character-cards -->')) throw new Error('Character collection projection marker missing');
await writeFile(characterCollectionFile, characterCollection.replace('<!-- published-character-cards -->', characterCards), 'utf8');

const bossCollectionFile = resolve(dist, 'bosses.html');
const bossCollection = await readFile(bossCollectionFile, 'utf8');
const bossCards = await renderPublishedBossCards();
if (!bossCollection.includes('<!-- published-boss-cards -->')) throw new Error('Boss collection projection marker missing');
await writeFile(bossCollectionFile, bossCollection.replace('<!-- published-boss-cards -->', bossCards), 'utf8');

const locationCollectionFile = resolve(dist, 'world.html');
const locationCollection = await readFile(locationCollectionFile, 'utf8');
const locationCards = await renderPublishedLocationCards();
if (!locationCollection.includes('<!-- published-location-cards -->')) throw new Error('Location collection projection marker missing');
await writeFile(locationCollectionFile, locationCollection.replace('<!-- published-location-cards -->', locationCards), 'utf8');

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
