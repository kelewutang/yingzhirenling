import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const pocRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const repositoryRoot = resolve(pocRoot, '../..');
const distRoot = resolve(pocRoot, 'dist');

const copyTargets = [
  ['css', 'css'],
  ['js', 'js'],
  ['assets', 'assets'],
  ['generated/search-index.production.json', 'generated/search-index.production.json'],
  ['favicon.ico', 'favicon.ico'],
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

for (const [sourceRelativePath, destinationRelativePath] of copyTargets) {
  const source = resolve(repositoryRoot, sourceRelativePath);
  const destination = resolve(distRoot, destinationRelativePath);
  await mkdir(dirname(destination), { recursive: true });
  await rm(destination, { recursive: true, force: true });
  await cp(source, destination, { recursive: true });
}
