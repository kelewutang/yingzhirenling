import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { renderLegacyFooter, renderLegacyHeader, resolveLegacyActiveSection } from './site-shell.mjs';

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
  ['pages/guide.html', 'guide.html'],
  ['pages/videos.html', 'videos.html'],
  ['pages/about.html', 'about.html'],
  ['pages/about-site.html', 'about-site.html']
];

const legacyShellPages = [
  ['guide.html', '/guide'],
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
