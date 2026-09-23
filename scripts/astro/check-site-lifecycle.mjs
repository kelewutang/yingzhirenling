import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { siteLifecycle } from '../../src/lib/site-lifecycle.mjs';

const root = resolve(import.meta.dirname, '../..');
const dist = resolve(root, 'dist');
const [homepage, guide, aboutSite, footerPage, searchScript] = await Promise.all([
  readFile(resolve(dist, 'index.html'), 'utf8'),
  readFile(resolve(dist, 'guide.html'), 'utf8'),
  readFile(resolve(dist, 'about-site.html'), 'utf8'),
  readFile(resolve(dist, 'weapons.html'), 'utf8'),
  readFile(resolve(dist, 'js/main.js'), 'utf8')
]);
const { copy, state } = siteLifecycle;

assert(['pre-release', 'released'].includes(state), 'Site lifecycle state must be explicit and supported');
for (const output of [homepage, guide, aboutSite, footerPage, searchScript]) {
  assert(!output.includes('__SITE_LIFECYCLE_'), 'Lifecycle tokens must not reach production output');
}

assert(homepage.includes(copy.homepage.eyebrow), 'Homepage lifecycle eyebrow must match the configured state');
assert(homepage.includes(copy.homepage.status), 'Homepage lifecycle status must match the configured state');
assert(guide.includes(copy.guide.metaDescription), 'Guide lifecycle metadata must match the configured state');
assert(guide.includes(copy.guide.jsonLdHeadline), 'Guide lifecycle JSON-LD headline must match the configured state');
assert(guide.includes(copy.guide.jsonLdDescription), 'Guide lifecycle JSON-LD description must match the configured state');
assert(guide.includes(copy.guide.status), 'Guide lifecycle status must match the configured state');
assert(guide.includes(copy.guide.notice), 'Guide lifecycle notice must match the configured state');
assert(aboutSite.includes(copy.aboutSite.introduction), 'About-site lifecycle introduction must match the configured state');
assert(aboutSite.includes(copy.aboutSite.evidenceNotice), 'About-site evidence notice must match the configured state');
assert(footerPage.includes(copy.footer), 'Shared footer lifecycle copy must match the configured state');
for (const description of Object.values(copy.pageSearch)) assert(searchScript.includes(description), 'Page Search lifecycle copy must match the configured state');

if (state === 'pre-release') {
  for (const releasedCopy of [
    '>RELEASE KNOWLEDGE BASE<',
    '本站已进入正式版攻略与实测更新阶段；内容按版本、平台和核验状态持续更新。',
    '《影之刃零》已进入正式版持续维护阶段。'
  ]) assert(!homepage.includes(releasedCopy) && !guide.includes(releasedCopy) && !aboutSite.includes(releasedCopy), `Pre-release output must not contain released lifecycle copy: ${releasedCopy}`);
} else {
  assert(!homepage.includes('PRE-RELEASE KNOWLEDGE BASE'), 'Released homepage must not retain the pre-release lifecycle eyebrow');
  assert(!homepage.includes('游戏尚未正式发售；当前内容以官方公开资料、公开素材观察与明确标注的第三方资料为基础。'), 'Released homepage must not retain the pre-release lifecycle status');
  assert(!guide.includes('官方系统信息 · 试玩观察 · 发售前准备'), 'Released guide must not retain the pre-release lifecycle status');
  assert(!aboutSite.includes('《影之刃零》仍处于正式发售前阶段。'), 'Released about-site must not retain the pre-release lifecycle introduction');
  assert(!footerPage.includes('发售前信息不替代正式版验证。'), 'Released footer must not retain the pre-release lifecycle copy');
}

console.log(`Site lifecycle verification passed for ${state}.`);
