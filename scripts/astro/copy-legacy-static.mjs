import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const dist = resolve(root, 'dist');

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
