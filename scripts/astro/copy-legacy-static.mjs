import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

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

for (const [sourcePath, destinationPath] of targets) {
  const source = resolve(root, sourcePath);
  const destination = resolve(dist, destinationPath);
  await mkdir(dirname(destination), { recursive: true });
  await rm(destination, { recursive: true, force: true });
  await cp(source, destination, { recursive: true });
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
