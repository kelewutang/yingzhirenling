import { getPublishedBosses, getPublishedCharacters, getPublishedWeapons, loadKnowledge } from '../lib/knowledge.mjs';

export const prerender = true;
const site = 'https://www.yingzhirenling.cn';
const legacyPages = [
  ['/', '2026-08-12'], ['/guide', '2026-08-12'], ['/weapons', '2026-08-12'],
  ['/characters', '2026-08-12'], ['/bosses', '2026-08-12'], ['/world', '2026-08-12'],
  ['/videos', '2026-08-12'], ['/about', '2026-08-12'], ['/about-site', '2026-08-18']
];

export async function GET() {
  const knowledge = await loadKnowledge();
  const entries = [
    ...legacyPages,
    ...getPublishedWeapons(knowledge).map((weapon) => [`/weapons/${weapon.slug}`, weapon.updatedAt]),
    ...getPublishedCharacters(knowledge).map((character) => [`/characters/${character.slug}`, character.updatedAt]),
    ...getPublishedBosses(knowledge).map((boss) => [`/bosses/${boss.slug}`, boss.updatedAt])
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.map(([route, lastmod]) => `  <url><loc>${site}${route}</loc><lastmod>${lastmod}</lastmod></url>`).join('\n')}\n</urlset>\n`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
