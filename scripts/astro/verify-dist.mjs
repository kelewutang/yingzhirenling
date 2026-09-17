import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getVideoUrls, isProductionEligibleVideo } from '../../src/lib/video.mjs';

const root = resolve(import.meta.dirname, '../..');
const dist = resolve(root, 'dist');
const productionRightsStatuses = new Set([
  'permission-recorded',
  'official-press-use-reviewed',
  'self-captured-reviewed',
  'official-promotional-risk-accepted'
]);
function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}
function renderedExternalUrl(value) {
  return escapeHtml(new URL(value).href);
}
async function readEntities(relativeDirectory) {
  const directory = resolve(root, relativeDirectory);
  const names = (await readdir(directory)).filter((name) => name.endsWith('.json')).sort();
  return Promise.all(names.map(async (name) => JSON.parse(await readFile(resolve(directory, name), 'utf8'))));
}
const weapons = await readEntities('data/weapons');
const publishedWeapons = weapons.filter((weapon) => weapon.recordState === 'published');
const draftWeapons = weapons.filter((weapon) => weapon.recordState === 'draft');
const characters = await readEntities('data/characters');
const publishedCharacters = characters.filter((character) => character.recordState === 'published');
const bosses = await readEntities('data/bosses');
const publishedBosses = bosses.filter((boss) => boss.recordState === 'published');
const draftBosses = bosses.filter((boss) => boss.recordState === 'draft');
const locations = await readEntities('data/locations');
const publishedLocations = locations.filter((location) => location.recordState === 'published');
const draftLocations = locations.filter((location) => location.recordState === 'draft');
const mediaRecords = JSON.parse(await readFile(resolve(root, 'data/media.json'), 'utf8')).records;
const videoRecords = JSON.parse(await readFile(resolve(root, 'data/videos.json'), 'utf8')).records;
const isProductionMedia = (record) => record.recordState === 'published' && productionRightsStatuses.has(record.rightsStatus);
const getProductionMedia = (entityId, usage) => mediaRecords.find((record) => isProductionMedia(record) && record.entityId === entityId && record.usage.includes(usage)) || null;

function assertMediaImage(html, media, location) {
  assert(html.includes(`src="/assets/media/${media.src}"`), `${location}: admitted Media src missing`);
  assert(html.includes(`alt="${escapeHtml(media.alt)}"`), `${location}: admitted Media alt missing`);
  assert(html.includes(`width="${media.width}"`), `${location}: admitted Media intrinsic width missing`);
  assert(html.includes(`height="${media.height}"`), `${location}: admitted Media intrinsic height missing`);
}
const canonicalRoutes = [
  ['index.html', '/'], ['guide.html', '/guide'], ['weapons.html', '/weapons'],
  ['characters.html', '/characters'], ['bosses.html', '/bosses'], ['world.html', '/world'],
  ['videos.html', '/videos'], ['about.html', '/about'], ['about-site.html', '/about-site'],
  ...publishedWeapons.map((weapon) => [`weapons/${weapon.slug}.html`, `/weapons/${weapon.slug}`]),
  ['characters/soul.html', '/characters/soul'],
  ['characters/mo-yuan.html', '/characters/mo-yuan'],
  ['characters/the-hunt.html', '/characters/the-hunt'],
  ...publishedBosses.map((boss) => [`bosses/${boss.slug}.html`, `/bosses/${boss.slug}`]),
  ...publishedLocations.map((location) => [`world/${location.slug}.html`, `/world/${location.slug}`])
];

async function assertDetailVisualContract(file, entity) {
  const html = await readFile(resolve(dist, file), 'utf8');
  const entityHero = html.match(/<header class="entity-hero">[\s\S]*?<\/header>/)?.[0] || '';
  assert.equal((html.match(/<h1\b/g) || []).length, 1, `${file}: detail page must have one H1`);
  assert(html.includes('data-detail-system="rollout"'), `${file}: shared detail system missing`);
  assert(html.includes(`data-entity-type="${entity.entityType}"`), `${file}: entity type marker missing`);
  assert(html.includes('class="entity-hero"'), `${file}: Entity Hero missing`);
  const media = getProductionMedia(entity.id, 'hero');
  if (!media) {
    assert(html.includes('data-media-state="fallback"'), `${file}: fallback required without admitted hero Media`);
    assert(!entityHero.includes('<img'), `${file}: Entity Hero without admitted hero Media must not emit an image`);
  } else {
    assert(html.includes('data-media-state="ready"'), `${file}: admitted hero Media must render ready state`);
    assertMediaImage(html, media, file);
    assert(html.includes(`<a href="${renderedExternalUrl(media.sourceUrl)}" target="_blank" rel="noopener noreferrer">查看媒体来源</a>`), `${file}: hero Media source link missing`);
  }
}

for (const [file] of canonicalRoutes) assert((await stat(resolve(dist, file))).isFile(), `Missing dist/${file}`);
assert((await stat(resolve(dist, '404.html'))).isFile(), 'Missing custom 404');

function decodeHtml(value) {
  return value.replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');
}

function metaContent(html, attribute, key, file) {
  const tag = html.match(new RegExp(`<meta\\s+${attribute}="${key}"\\s+content="([^"]*)"\\s*\\/?\\s*>`, 'i'));
  assert(tag, `${file}: ${key} missing`);
  return decodeHtml(tag[1]);
}

const canonicalUrls = new Set();
const ogUrls = new Set();
for (const [file] of canonicalRoutes) {
  const html = await readFile(resolve(dist, file), 'utf8');
  const title = decodeHtml(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || '');
  const description = metaContent(html, 'name', 'description', file);
  const canonical = html.match(/<link\s+rel="canonical"\s+href="([^"]*)"\s*\/?\s*>/i)?.[1];
  assert(canonical, `${file}: canonical missing`);

  assert.equal(metaContent(html, 'property', 'og:title', file), title, `${file}: og:title must match title`);
  assert.equal(metaContent(html, 'property', 'og:description', file), description, `${file}: og:description must match description`);
  const ogUrl = metaContent(html, 'property', 'og:url', file);
  assert.equal(ogUrl, canonical, `${file}: og:url must match canonical`);
  assert.equal(metaContent(html, 'property', 'og:type', file), file === 'guide.html' ? 'article' : 'website', `${file}: og:type must match the page semantic`);
  assert.equal(metaContent(html, 'name', 'twitter:card', file), 'summary', `${file}: twitter:card must be summary`);
  assert.equal(metaContent(html, 'name', 'twitter:title', file), title, `${file}: twitter:title must match title`);
  assert.equal(metaContent(html, 'name', 'twitter:description', file), description, `${file}: twitter:description must match description`);
  assert(!/<meta\b[^>]*(?:property|name)="(?:og:image|twitter:image)"/i.test(html), `${file}: social image metadata is forbidden`);

  canonicalUrls.add(canonical);
  ogUrls.add(ogUrl);
}
assert.equal(canonicalUrls.size, 25, 'Expected 25 unique production canonical URLs');
assert.deepEqual(ogUrls, canonicalUrls, 'Production OG URLs must exactly match canonical URLs');
for (const file of ['pages/generated/weapons/tang-hengdao.html', 'pages/generated/weapons/ya-hengdao.html']) {
  const html = await readFile(resolve(dist, file), 'utf8');
  const canonical = html.match(/<link\s+rel="canonical"\s+href="([^"]*)"\s*\/?\s*>/i)?.[1];
  assert(canonical, `${file}: canonical missing`);
  assert.equal(metaContent(html, 'property', 'og:url', file), canonical, `${file}: legacy OG URL must match canonical`);
  assert(canonicalUrls.has(canonical), `${file}: legacy canonical must not create a new identity`);
}
const notFound = await readFile(resolve(dist, '404.html'), 'utf8');
assert(notFound.includes('<meta name="robots" content="noindex,follow">'), '404 must remain noindex,follow');
assert(!/<meta\b[^>]*(?:property|name)="(?:og|twitter):[^"]*"/i.test(notFound), '404 must not receive social metadata coverage');

const productionOrigin = 'https://www.yingzhirenling.cn';
const forbiddenStructuredDataTypes = new Set(['VideoObject', 'ImageObject', 'Product', 'Review', 'AggregateRating', 'Offer', 'Person']);

function jsonLdDocuments(html, file) {
  return [...html.matchAll(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/gi)].map((match, index) => {
    try {
      return JSON.parse(match[1]);
    } catch (error) {
      assert.fail(`${file}: JSON-LD ${index + 1} is invalid JSON: ${error.message}`);
    }
  });
}

function assertProductionSchemaUrl(value, file, field, { allowFragment = false } = {}) {
  assert.equal(typeof value, 'string', `${file}: ${field} must be a string URL`);
  let url;
  try {
    url = new URL(value);
  } catch {
    assert.fail(`${file}: ${field} must be an absolute URL`);
  }
  assert.equal(url.origin, productionOrigin, `${file}: ${field} must use the production origin`);
  assert.equal(url.search, '', `${file}: ${field} must not contain a query string`);
  if (!allowFragment) assert.equal(url.hash, '', `${file}: ${field} must not contain a fragment`);
  assert(url.pathname === '/' || !url.pathname.endsWith('/'), `${file}: ${field} must not use a trailing-slash variant`);
  return url;
}

function normalizeSchemaTypes(value, file) {
  const types = Array.isArray(value) ? value : [value];
  assert(types.length > 0, `${file}: JSON-LD @type array must not be empty`);
  for (const type of types) {
    assert.equal(typeof type, 'string', `${file}: JSON-LD @type values must be strings`);
    assert(type.trim(), `${file}: JSON-LD @type values must not be empty`);
    assert(!forbiddenStructuredDataTypes.has(type), `${file}: deferred schema type emitted: ${type}`);
  }
  return types;
}

function assertStructuredDataTypes(value, file, isRoot = false) {
  assert.notEqual(value, null, `${file}: JSON-LD must not contain null values`);
  if (Array.isArray(value)) {
    for (const item of value) assertStructuredDataTypes(item, file);
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (!isRoot) assert(!Object.hasOwn(value, '@context'), `${file}: JSON-LD must not nest @context`);
  if (Object.hasOwn(value, '@type')) normalizeSchemaTypes(value['@type'], file);
  for (const [key, item] of Object.entries(value)) {
    if (['url', 'item', '@id'].includes(key)) {
      const url = assertProductionSchemaUrl(item, file, key, { allowFragment: key === '@id' });
      const identity = `${url.origin}${url.pathname}`;
      assert(canonicalUrls.has(identity), `${file}: ${key} must reference a production canonical URL`);
    } else {
      assertStructuredDataTypes(item, file);
    }
  }
}

function expectedSchemaTypes(file) {
  if (file === 'index.html') return ['WebSite'];
  if (file === 'guide.html') return ['Article', 'FAQPage', 'BreadcrumbList'];
  if (['weapons.html', 'characters.html', 'bosses.html', 'world.html'].includes(file)) return ['CollectionPage'];
  if (file === 'videos.html') return ['WebPage'];
  if (['about.html', 'about-site.html'].includes(file) || /^(weapons|characters|bosses|world)\//.test(file)) return ['WebPage', 'BreadcrumbList'];
  assert.fail(`Unexpected canonical route for structured-data verification: ${file}`);
}

function visibleHtml(html) {
  return html.replace(/<(script|style|template)\b[\s\S]*?<\/\1>/gi, '');
}

function visibleText(value) {
  return decodeHtml(value.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function semanticFaqText(value, label) {
  return visibleText(value).replace(new RegExp(`^${label}\\s*[:：]\\s*`, 'i'), '').trim();
}

const voidHtmlElements = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

function htmlAttributes(token) {
  const attributes = new Map();
  const source = token.replace(/^<\s*\/?\s*[a-z][\w:-]*/i, '').replace(/\/?\s*>$/, '');
  for (const match of source.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
    attributes.set(match[1].toLowerCase(), match[2] ?? match[3] ?? match[4] ?? '');
  }
  return attributes;
}

function hiddenFaqSubtree(tag, attributes) {
  if (['script', 'style', 'template'].includes(tag) || attributes.has('hidden')) return true;
  if ((attributes.get('aria-hidden') || '').trim().toLowerCase() === 'true') return true;
  const style = attributes.get('style') || '';
  return /\bdisplay\s*:\s*none\b/i.test(style) || /\bvisibility\s*:\s*hidden\b/i.test(style);
}

function visibleFaqNodes(html) {
  const nodes = [];
  const stack = [{ tag: null, hidden: false, capture: null }];
  const tokens = html.match(/<!--[\s\S]*?-->|<\/?[a-z][^>]*>|[^<]+/gi) || [];

  for (const token of tokens) {
    if (token.startsWith('<!--')) continue;
    if (!token.startsWith('<')) {
      if (!stack.at(-1).hidden) {
        for (let index = stack.length - 1; index > 0; index -= 1) {
          if (stack[index].capture) {
            stack[index].capture.text += token;
            break;
          }
        }
      }
      continue;
    }

    const closing = /^<\s*\/\s*([a-z][\w:-]*)/i.exec(token);
    if (closing) {
      const tag = closing[1].toLowerCase();
      while (stack.length > 1) {
        const element = stack.pop();
        if (element.capture) nodes.push({ tag: element.tag, text: element.capture.text });
        if (element.tag === tag) break;
      }
      continue;
    }

    const opening = /^<\s*([a-z][\w:-]*)/i.exec(token);
    if (!opening) continue;
    const tag = opening[1].toLowerCase();
    const parent = stack.at(-1);
    const hidden = parent.hidden || hiddenFaqSubtree(tag, htmlAttributes(token));
    const element = { tag, hidden, capture: !hidden && ['h2', 'h3', 'p'].includes(tag) ? { text: '' } : null };
    if (!voidHtmlElements.has(tag) && !/\/\s*>$/.test(token)) stack.push(element);
  }
  return nodes;
}

function visibleFaqItems(html, file) {
  const nodes = visibleFaqNodes(html);
  const headingIndex = nodes.findIndex((node) => node.tag === 'h2' && visibleText(node.text) === '常见问题');
  if (headingIndex === -1) return [];
  const items = [];
  for (let index = headingIndex + 1; index < nodes.length && nodes[index].tag !== 'h2'; index += 1) {
    if (nodes[index].tag !== 'h3') continue;
    const answer = nodes[index + 1];
    assert(answer?.tag === 'p', `${file}: visible FAQ question must be followed by an answer`);
    items.push({ question: semanticFaqText(nodes[index].text, 'Q'), answer: semanticFaqText(answer.text, 'A') });
    index += 1;
  }
  assert(items.length > 0, `${file}: visible FAQ heading must contain FAQ items`);
  return items;
}

function resolveVisibleBreadcrumbHref(href, file) {
  let url;
  try {
    url = new URL(href, productionOrigin);
  } catch {
    assert.fail(`${file}: visible breadcrumb href must be a URL`);
  }
  assertProductionSchemaUrl(url.href, file, 'visible breadcrumb href');
  assert(canonicalUrls.has(url.href), `${file}: visible breadcrumb href must use a canonical URL`);
  return url.href;
}

function visibleBreadcrumbItems(html, file, canonical) {
  const breadcrumb = visibleHtml(html).match(/<div class="page-breadcrumb">([\s\S]*?)<\/div>/i)?.[1];
  assert(breadcrumb, `${file}: BreadcrumbList requires visible breadcrumb UI`);
  const items = [];
  let lastLinkEnd = 0;
  for (const match of breadcrumb.matchAll(/<a\b[^>]*\bhref="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    items.push({ name: visibleText(match[2]), item: resolveVisibleBreadcrumbHref(match[1], file) });
    lastLinkEnd = (match.index || 0) + match[0].length;
  }
  const current = visibleText(breadcrumb.slice(lastLinkEnd)).replace(/^(?:>|\/)\s*/, '').trim();
  assert(current, `${file}: visible breadcrumb current item missing`);
  items.push({ name: current, item: canonical });
  return items;
}

function assertBreadcrumbList(document, html, file, canonical) {
  assert(Array.isArray(document.itemListElement), `${file}: BreadcrumbList must contain itemListElement`);
  assert(document.itemListElement.length >= 2, `${file}: BreadcrumbList must contain at least two items`);
  const visibleItems = visibleBreadcrumbItems(html, file, canonical);
  assert.equal(document.itemListElement.length, visibleItems.length, `${file}: BreadcrumbList item count must match visible breadcrumb`);
  for (const [index, item] of document.itemListElement.entries()) {
    assert.equal(item['@type'], 'ListItem', `${file}: BreadcrumbList item must be a ListItem`);
    assert.equal(item.position, index + 1, `${file}: BreadcrumbList positions must be continuous`);
    assert.equal(typeof item.name, 'string', `${file}: BreadcrumbList item name missing`);
    assert.equal(item.name, visibleItems[index].name, `${file}: BreadcrumbList name must match visible breadcrumb order`);
    assertProductionSchemaUrl(item.item, file, 'BreadcrumbList item');
    assert.equal(item.item, visibleItems[index].item, `${file}: BreadcrumbList item URL must match visible breadcrumb href`);
  }
  assert.equal(document.itemListElement.at(-1).item, canonical, `${file}: BreadcrumbList final item must match page canonical`);
}

function assertFaqPage(document, html, file) {
  assert(Array.isArray(document.mainEntity), `${file}: FAQPage must contain mainEntity`);
  const visibleItems = visibleFaqItems(html, file);
  assert.equal(document.mainEntity.length, visibleItems.length, `${file}: FAQPage item count must match visible FAQ`);
  for (const [index, question] of document.mainEntity.entries()) {
    assert.equal(question['@type'], 'Question', `${file}: FAQPage entries must be Questions`);
    assert.equal(typeof question.name, 'string', `${file}: FAQ question missing`);
    assert.equal(question.name, visibleItems[index].question, `${file}: FAQ question must match visible FAQ order`);
    assert.equal(question.acceptedAnswer?.['@type'], 'Answer', `${file}: FAQ acceptedAnswer missing`);
    assert.equal(typeof question.acceptedAnswer?.text, 'string', `${file}: FAQ answer missing`);
    assert.equal(question.acceptedAnswer.text, visibleItems[index].answer, `${file}: FAQ answer must match visible FAQ order`);
  }
}

function assertStructuredData(html, file, canonical, expectedTypes) {
  const documents = jsonLdDocuments(html, file);
  assert.deepEqual(documents.map((document) => document['@type']), expectedTypes, `${file}: JSON-LD type inventory changed`);
  for (const document of documents) {
    assert.equal(document['@context'], 'https://schema.org', `${file}: JSON-LD context must be schema.org`);
    normalizeSchemaTypes(document['@type'], file);
    assertStructuredDataTypes(document, file, true);
    const serialized = JSON.stringify(document);
    for (const forbidden of ['localhost', 'netlify.app', 'qinglong-lueyue-dao', '青龙掠月刀', 'fixture']) {
      assert(!serialized.includes(forbidden), `${file}: forbidden structured-data value: ${forbidden}`);
    }
  }

  const pageIdentity = documents.find((document) => ['WebSite', 'WebPage', 'CollectionPage'].includes(document['@type']));
  if (pageIdentity) {
    assert.equal(pageIdentity.url, canonical, `${file}: page identity URL must match canonical`);
    if (pageIdentity['@type'] !== 'WebSite') {
      assert.equal(pageIdentity.name, decodeHtml(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || ''), `${file}: page identity name must match title`);
      assert.equal(pageIdentity.description, metaContent(html, 'name', 'description', file), `${file}: page identity description must match meta description`);
    }
  }
  const article = documents.find((document) => document['@type'] === 'Article');
  if (article) assert.equal(article.mainEntityOfPage?.['@id'], canonical, `${file}: Article mainEntityOfPage must match canonical`);
  for (const document of documents.filter((document) => document['@type'] === 'BreadcrumbList')) assertBreadcrumbList(document, html, file, canonical);
  const faq = documents.find((document) => document['@type'] === 'FAQPage');
  if (faq) assertFaqPage(faq, html, file);
}

for (const [file] of canonicalRoutes) {
  const html = await readFile(resolve(dist, file), 'utf8');
  const canonical = html.match(/<link\s+rel="canonical"\s+href="([^"]*)"\s*\/?\s*>/i)?.[1];
  assert(canonical, `${file}: canonical missing for structured-data verification`);
  assertStructuredData(html, file, canonical, expectedSchemaTypes(file));
}
for (const file of ['pages/generated/weapons/tang-hengdao.html', 'pages/generated/weapons/ya-hengdao.html']) {
  const html = await readFile(resolve(dist, file), 'utf8');
  const canonical = html.match(/<link\s+rel="canonical"\s+href="([^"]*)"\s*\/?\s*>/i)?.[1];
  assert(canonical, `${file}: legacy canonical missing for structured-data verification`);
  assertStructuredData(html, file, canonical, ['WebPage', 'BreadcrumbList']);
}
assert.equal(jsonLdDocuments(notFound, '404.html').length, 0, '404 must not receive production structured data');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function expectStructuredDataFailure(label, callback) {
  assert.throws(callback, undefined, `${label}: verifier mutation must fail`);
}

const guideHtml = await readFile(resolve(dist, 'guide.html'), 'utf8');
const guideCanonical = 'https://www.yingzhirenling.cn/guide';
const guideDocuments = jsonLdDocuments(guideHtml, 'guide.html');
const guideFaq = guideDocuments.find((document) => document['@type'] === 'FAQPage');
const guideBreadcrumb = guideDocuments.find((document) => document['@type'] === 'BreadcrumbList');
assert(guideFaq && guideBreadcrumb, 'Guide structured-data regression fixtures require FAQPage and BreadcrumbList');
const guideWithoutVisibleFaq = guideHtml.replace(/<h3\b[^>]*>\s*Q[:：][\s\S]*?<\/h3>\s*<p\b[^>]*>\s*A[:：][\s\S]*?<\/p>/gi, '');
assert.notEqual(guideWithoutVisibleFaq, guideHtml, 'Guide FAQ removal fixture must remove visible FAQ markup');
expectStructuredDataFailure('Guide visible FAQ removal', () => assertFaqPage(guideFaq, guideWithoutVisibleFaq, 'guide.html'));
function wrapVisibleFaqItems(wrapper) {
  let count = 0;
  const wrapped = guideHtml.replace(/<h3\b[^>]*>\s*Q[:：][\s\S]*?<\/h3>\s*<p\b[^>]*>\s*A[:：][\s\S]*?<\/p>/gi, (item) => {
    count += 1;
    return wrapper(item);
  });
  assert.equal(count, guideFaq.mainEntity.length, 'Guide hidden FAQ fixture must wrap every visible FAQ item');
  return wrapped;
}
expectStructuredDataFailure('Guide FAQ comment-hidden', () => assertFaqPage(guideFaq, wrapVisibleFaqItems((item) => `<!--${item}-->`), 'guide.html'));
expectStructuredDataFailure('Guide FAQ hidden-attribute', () => assertFaqPage(guideFaq, wrapVisibleFaqItems((item) => `<div hidden>${item}</div>`), 'guide.html'));
expectStructuredDataFailure('Guide FAQ display-none', () => assertFaqPage(guideFaq, wrapVisibleFaqItems((item) => `<div style="display:none">${item}</div>`), 'guide.html'));
expectStructuredDataFailure('Guide FAQ visibility-hidden', () => assertFaqPage(guideFaq, wrapVisibleFaqItems((item) => `<div style="visibility: hidden">${item}</div>`), 'guide.html'));
expectStructuredDataFailure('Guide FAQ aria-hidden', () => assertFaqPage(guideFaq, wrapVisibleFaqItems((item) => `<div aria-hidden="true">${item}</div>`), 'guide.html'));
const guideQuestionDrift = clone(guideFaq);
guideQuestionDrift.mainEntity[0].name = '不存在的问题？';
expectStructuredDataFailure('Guide FAQ question drift', () => assertFaqPage(guideQuestionDrift, guideHtml, 'guide.html'));
const guideAnswerDrift = clone(guideFaq);
guideAnswerDrift.mainEntity[0].acceptedAnswer.text = '不存在的答案。';
expectStructuredDataFailure('Guide FAQ answer drift', () => assertFaqPage(guideAnswerDrift, guideHtml, 'guide.html'));
const guideFinalBreadcrumbDrift = clone(guideBreadcrumb);
guideFinalBreadcrumbDrift.itemListElement.at(-1).item = 'https://www.yingzhirenling.cn/weapons';
expectStructuredDataFailure('Guide breadcrumb final URL drift', () => assertBreadcrumbList(guideFinalBreadcrumbDrift, guideHtml, 'guide.html', guideCanonical));
const guideBreadcrumbUrlDrift = clone(guideBreadcrumb);
guideBreadcrumbUrlDrift.itemListElement[0].item = 'https://www.yingzhirenling.cn/weapons';
expectStructuredDataFailure('Guide breadcrumb matching-name URL drift', () => assertBreadcrumbList(guideBreadcrumbUrlDrift, guideHtml, 'guide.html', guideCanonical));
const guideBreadcrumbOrderDrift = clone(guideBreadcrumb);
[guideBreadcrumbOrderDrift.itemListElement[0], guideBreadcrumbOrderDrift.itemListElement[1]] = [guideBreadcrumbOrderDrift.itemListElement[1], guideBreadcrumbOrderDrift.itemListElement[0]];
guideBreadcrumbOrderDrift.itemListElement.forEach((item, index) => { item.position = index + 1; });
expectStructuredDataFailure('Guide breadcrumb order drift', () => assertBreadcrumbList(guideBreadcrumbOrderDrift, guideHtml, 'guide.html', guideCanonical));
const guideTypeArrayBypass = clone(guideFaq);
guideTypeArrayBypass.mainEntity[0]['@type'] = ['Organization', 'Product'];
expectStructuredDataFailure('@type array bypass', () => assertStructuredDataTypes(guideTypeArrayBypass, 'guide.html', true));
console.log('Structured-data negative regression fixtures passed: FAQ removal/comment/hidden/style/aria visibility, question/answer drift, breadcrumb URL/name/order drift, and @type array bypass.');
const baiduVerificationFiles = (await readdir(root, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && /^baidu_verify_codeva-[a-z0-9-]+\.html$/i.test(entry.name))
  .map((entry) => entry.name)
  .sort();
const distBaiduVerificationFiles = (await readdir(dist, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && /^baidu_verify_codeva-[a-z0-9-]+\.html$/i.test(entry.name))
  .map((entry) => entry.name)
  .sort();
assert.equal(baiduVerificationFiles.length, 1, 'Expected exactly one Baidu verification artifact at the repository root');
assert.equal(distBaiduVerificationFiles.length, 1, 'Expected exactly one Baidu verification artifact in dist');
assert.equal(distBaiduVerificationFiles[0], baiduVerificationFiles[0], 'Baidu verification artifact filename must match between source and dist');
const baiduVerificationFile = baiduVerificationFiles[0];
const sourceBaiduVerification = await readFile(resolve(root, baiduVerificationFile));
const distBaiduVerification = await readFile(resolve(dist, baiduVerificationFile));
assert(sourceBaiduVerification.byteLength > 0, `${baiduVerificationFile}: source Baidu verification artifact must not be empty`);
assert(distBaiduVerification.byteLength > 0, `${baiduVerificationFile}: dist Baidu verification artifact must not be empty`);
assert.deepEqual(distBaiduVerification, sourceBaiduVerification, `${baiduVerificationFile}: dist verification artifact must exactly match the tracked source`);
const productionMediaSources = [...new Set(mediaRecords.filter(isProductionMedia).map((record) => record.src))];
const mediaDistDirectory = resolve(dist, 'assets', 'media');
if (productionMediaSources.length === 0) {
  await assert.rejects(() => stat(mediaDistDirectory), { code: 'ENOENT' });
} else {
  assert((await stat(mediaDistDirectory)).isDirectory(), 'Admitted local Media requires dist/assets/media');
  for (const source of productionMediaSources) {
    const sourcePath = resolve(root, 'assets', 'media', source);
    const distPath = resolve(mediaDistDirectory, source);
    assert((await stat(distPath)).isFile(), `Admitted Media asset missing from dist: ${source}`);
    assert.deepEqual(await readFile(distPath), await readFile(sourcePath), `Admitted Media asset differs from source: ${source}`);
  }
}
for (const record of mediaRecords.filter((record) => !isProductionMedia(record) && !productionMediaSources.includes(record.src))) {
  if (typeof record.src !== 'string') continue;
  await assert.rejects(() => stat(resolve(mediaDistDirectory, record.src)), { code: 'ENOENT' });
}
if (process.env.CONTEXT === 'deploy-preview') {
  assert.match(await readFile(resolve(dist, '_headers'), 'utf8'), /X-Robots-Tag: noindex, nofollow/);
} else {
  await assert.rejects(() => stat(resolve(dist, '_headers')), { code: 'ENOENT' });
}

const homepage = await readFile(resolve(dist, 'index.html'), 'utf8');
assert.equal((homepage.match(/<h1\b/g) || []).length, 1, 'Homepage must have one H1');
assert(homepage.includes('<link rel="canonical" href="https://www.yingzhirenling.cn/"'), 'Homepage canonical missing');
assert(homepage.includes('data-home-search-trigger'), 'Homepage primary Search trigger missing');
assert(!homepage.includes('noindex'), 'Homepage must be indexable');
assert(homepage.includes('class="footer site-footer"'), 'Homepage shared footer missing');
assert(!homepage.includes('qinglong-lueyue-dao') && !homepage.includes('青龙掠月刀'), 'Homepage must exclude draft Qinglong');
assert(!homepage.includes('JSON.stringify'), 'Homepage must not emit a literal JSON.stringify expression');
const homepageJsonLd = [...homepage.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
assert.equal(homepageJsonLd.length, 1, 'Homepage must render one WebSite JSON-LD script');
const homepageStructuredData = JSON.parse(homepageJsonLd[0][1]);
assert.equal(homepageStructuredData['@context'], 'https://schema.org', 'Homepage JSON-LD context must be schema.org');
assert.equal(homepageStructuredData['@type'], 'WebSite', 'Homepage JSON-LD type must be WebSite');
const homepageCategoryAssertions = [
  ['/weapons', '武器', publishedWeapons.length],
  ['/characters', '角色', publishedCharacters.length],
  ['/bosses', 'Boss', publishedBosses.length],
  ['/world', '世界', publishedLocations.length]
];
for (const [route, label, count] of homepageCategoryAssertions) {
  assert(homepage.includes(`href="${route}"`), `Homepage category link missing: ${route}`);
  assert(homepage.includes(`<strong>${count}</strong> 个已发布条目`), `Homepage published count missing: ${label}`);
}

const guide = await readFile(resolve(dist, 'guide.html'), 'utf8');
const videos = await readFile(resolve(dist, 'videos.html'), 'utf8');
const purchase = await readFile(resolve(dist, 'about.html'), 'utf8');
const steamProductUrl = 'https://store.steampowered.com/app/4115450/Phantom_Blade_Zero/';
const productionVideos = videoRecords.filter(isProductionEligibleVideo);
assert.equal((videos.match(/data-video-card/g) || []).length, productionVideos.length, 'Videos must render exactly the production-eligible Video records');
assert.equal((videos.match(/<iframe\b/gi) || []).length, 0, 'Videos static HTML must not instantiate third-party iframes before explicit user action');
assert(videos.includes('data-videos-system="click-to-load"'), 'Videos must expose the click-to-load system marker');
assert.match(videos, /document\.createElement\('iframe'\)/, 'Videos must create an iframe only after explicit user action');
assert(!videos.includes('autoplay'), 'Videos must not opt into autoplay');
assert(!videos.includes('BV1VVM166Evb'), 'Videos must exclude unverified legacy Bilibili content');
assert(!videos.includes('csuFGspAe6s') && !videos.includes('mOncuUWLipQ'), 'Videos must exclude legacy YouTube links without Video records');
for (const video of productionVideos) {
  const urls = getVideoUrls(video.platform, video.platformVideoId);
  const escapedEmbedUrl = urls.embedUrl.replaceAll('&', '&amp;');
  assert(videos.includes(`data-video-id="${video.id}"`), `Videos must render ${video.id}`);
  assert(videos.includes(video.title), `Videos must render ${video.id} title`);
  assert(videos.includes(`href="${urls.sourceUrl}"`), `Videos must provide ${video.id} canonical source link`);
  assert(videos.includes(`data-video-embed-url="${escapedEmbedUrl}"`), `Videos must derive ${video.id} embed URL`);
}
assert.equal((videos.match(/<button class="video-card__load" type="button" data-video-load/g) || []).length, productionVideos.length, 'Videos must provide one accessible load control per record');
assert.match(videos, /<button class="video-card__load" type="button"[^>]*aria-controls=/, 'Videos load controls must be buttons with aria-controls');
assert.match(videos, /<a class="video-card__source" href="https:\/\/www\.bilibili\.com\/video\//, 'Videos source fallback must be a canonical anchor');
assert(!videos.includes('embedHtml') && !videos.includes('embedUrl"'), 'Videos must not project arbitrary embed fields');
await assert.rejects(() => stat(resolve(dist, 'pages', 'videos.html')), { code: 'ENOENT' });
assert(purchase.includes('<a href="/characters/soul">魂</a>1/12可动人偶及配件'), 'Purchase must link the explicit Soul collector-edition mention');
const guideLaunchDateCitation = `游戏计划于2026年10月29日发售（见 <a href="${steamProductUrl}" target="_blank" rel="noopener noreferrer">Steam 官方商品页</a>）。以下内容来自官方发布材料与公开试玩`;
assert(guide.includes(guideLaunchDateCitation), 'Guide launch-date alert must place the official Steam link adjacent to the release-date statement');
assert(guide.includes(`预购特典"聚宝盆"可提升意识尘埃掉落率+10%；<a href="${steamProductUrl}"`), 'Guide preorder accessory claim must cite the official Steam product page');
assert(guide.includes(`<strong>隐藏路径与机关</strong>：<a href="${steamProductUrl}"`), 'Guide hidden-path claim must cite the official Steam product page');
for (const page of [guide, videos, purchase]) assert(!page.includes('href="/weapons/qinglong-lueyue-dao"'), 'Legacy content must not link draft Qinglong');

for (const slug of ['tang-hengdao', 'ya-hengdao']) {
  const candidate = await readFile(resolve(dist, 'weapons', `${slug}.html`), 'utf8');
  const legacy = await readFile(resolve(root, 'pages/generated/weapons', `${slug}.html`), 'utf8');
  const canonical = `https://www.yingzhirenling.cn/weapons/${slug}`;
  for (const token of ['<title>', 'name="description"', `<link rel="canonical" href="${canonical}"`, '<h1', 'page-breadcrumb', 'data-fact-id=', '本页来源', '返回武器图鉴']) {
    assert(candidate.includes(token), `${slug}: missing static contract token ${token}`);
  }
  const candidateFacts = [...candidate.matchAll(/data-fact-id="([^"]+)"/g)].map((match) => match[1]);
  assert(candidateFacts.length > 0, `${slug}: concise Weapon overview must retain rendered fact anchors`);
  const contracts = [
    /<title>([^<]+)<\/title>/,
    /<meta name="description" content="([^"]+)"/,
    /<link rel="canonical" href="([^"]+)"/,
    /<h1[^>]*>([^<]+)<\/h1>/
  ];
  for (const contract of contracts) {
    assert.equal(candidate.match(contract)?.[1], legacy.match(contract)?.[1], `${slug}: SEO semantic parity failed: ${contract}`);
  }
  const sourceUrls = [...legacy.matchAll(/href="(https?:\/\/[^"]+)"/g)].map((match) => match[1]);
  for (const url of sourceUrls) assert(candidate.includes(`href="${url}"`), `${slug}: Source link missing: ${url}`);
}

for (const path of [
  'weapons/not-real.html',
  'characters/not-real.html',
  'bosses/not-real.html',
  'world/not-real.html',
  ...draftWeapons.map((weapon) => `weapons/${weapon.slug}.html`),
  ...draftBosses.map((boss) => `bosses/${boss.slug}.html`),
  ...draftLocations.map((location) => `world/${location.slug}.html`)
]) {
  await assert.rejects(() => stat(resolve(dist, path)), { code: 'ENOENT' });
}

for (const weapon of publishedWeapons) {
  const html = await readFile(resolve(dist, 'weapons', `${weapon.slug}.html`), 'utf8');
  await assertDetailVisualContract(`weapons/${weapon.slug}.html`, weapon);
  const canonical = `https://www.yingzhirenling.cn/weapons/${weapon.slug}`;
  for (const token of ['<title>', 'name="description"', `<link rel="canonical" href="${canonical}"`, '<h1', 'page-breadcrumb', 'data-fact-id=', '本页来源', '返回武器图鉴']) {
    assert(html.includes(token), `${weapon.slug}: missing static Weapon contract token ${token}`);
  }
  assert(html.includes(escapeHtml(weapon.summary)), `${weapon.slug}: summary missing from static Weapon page`);
  assert(!html.includes('noindex'), `${weapon.slug}: published Weapon must be indexable`);
}
const weaponCollection = await readFile(resolve(dist, 'weapons.html'), 'utf8');
for (const weapon of publishedWeapons) assert(weaponCollection.includes(`href="/weapons/${weapon.slug}"`), `Weapon collection missing ${weapon.slug}`);
for (const weapon of draftWeapons) assert(!weaponCollection.includes(`href="/weapons/${weapon.slug}"`), `Weapon collection must exclude draft ${weapon.slug}`);

for (const slug of ['soul', 'mo-yuan', 'the-hunt']) {
  const html = await readFile(resolve(dist, 'characters', `${slug}.html`), 'utf8');
  await assertDetailVisualContract(`characters/${slug}.html`, characters.find((character) => character.slug === slug));
  const canonical = `https://www.yingzhirenling.cn/characters/${slug}`;
  for (const token of ['<title>', 'name="description"', `<link rel="canonical" href="${canonical}"`, '<h1', 'page-breadcrumb', 'data-fact-id=', '本页来源', '返回角色图鉴']) {
    assert(html.includes(token), `${slug}: missing static Character contract token ${token}`);
  }
  assert(!html.includes('noindex'), `${slug}: published Character must be indexable`);
}
const soul = await readFile(resolve(dist, 'characters/soul.html'), 'utf8');
assert.equal((soul.match(/data-relation-id=/g) || []).length, 2, 'Soul must render two unique Relations');
for (const wording of ['魔渊', '父亲', 'The Hunt', '曾经的同伴']) assert(soul.includes(wording), `Soul Relation presentation missing: ${wording}`);
const hunt = await readFile(resolve(dist, 'characters/the-hunt.html'), 'utf8');
assert(!hunt.includes('猎杀'), 'The Hunt must not gain an invented Chinese name');

const collection = await readFile(resolve(dist, 'characters.html'), 'utf8');
for (const slug of ['soul', 'mo-yuan', 'the-hunt']) assert(collection.includes(`href="/characters/${slug}"`), `Character collection missing ${slug}`);

for (const boss of publishedBosses) {
  const html = await readFile(resolve(dist, 'bosses', `${boss.slug}.html`), 'utf8');
  await assertDetailVisualContract(`bosses/${boss.slug}.html`, boss);
  const canonical = `https://www.yingzhirenling.cn/bosses/${boss.slug}`;
  for (const token of ['<title>', 'name="description"', `<link rel="canonical" href="${canonical}"`, '<h1', 'page-breadcrumb', 'data-fact-id=', '本页来源', '返回 Boss 图鉴']) {
    assert(html.includes(token), `${boss.slug}: missing static Boss contract token ${token}`);
  }
  assert(html.includes(boss.summary), `${boss.slug}: summary missing from static Boss page`);
  assert(!html.includes('noindex'), `${boss.slug}: published Boss must be indexable`);
}
const bossCollection = await readFile(resolve(dist, 'bosses.html'), 'utf8');
for (const boss of publishedBosses) assert(bossCollection.includes(`href="/bosses/${boss.slug}"`), `Boss collection missing ${boss.slug}`);
for (const boss of draftBosses) assert(!bossCollection.includes(`/bosses/${boss.slug}`), `Boss collection must exclude draft ${boss.slug}`);
assert(bossCollection.includes('名称与 Boss 身份均保持为引用第三方来源的信息'), 'Boss collection must preserve third-party evidence framing');

for (const location of publishedLocations) {
  const html = await readFile(resolve(dist, 'world', `${location.slug}.html`), 'utf8');
  await assertDetailVisualContract(`world/${location.slug}.html`, location);
  const canonical = `https://www.yingzhirenling.cn/world/${location.slug}`;
  for (const token of ['<title>', 'name="description"', `<link rel="canonical" href="${canonical}"`, '<h1', 'page-breadcrumb', 'data-fact-id=', '本页来源', '返回世界与地点']) {
    assert(html.includes(token), `${location.slug}: missing static Location contract token ${token}`);
  }
  assert(html.includes(escapeHtml(location.summary)), `${location.slug}: summary missing from static Location page`);
  assert(!html.includes('noindex'), `${location.slug}: published Location must be indexable`);
}
const locationCollection = await readFile(resolve(dist, 'world.html'), 'utf8');
for (const location of publishedLocations) assert(locationCollection.includes(`href="/world/${location.slug}"`), `Location collection missing ${location.slug}`);
for (const location of draftLocations) assert(!locationCollection.includes(`href="/world/${location.slug}"`), `Location collection must exclude draft ${location.slug}`);
assert(locationCollection.includes('现有官方资料明确提供地点名称'), 'World collection must explain Pangzhen inclusion from official naming evidence');

const search = JSON.parse(await readFile(resolve(dist, 'generated/search-index.production.json'), 'utf8'));
assert.deepEqual(search.map((item) => item.id), [
  ...publishedBosses.map((boss) => boss.id),
  ...publishedWeapons.map((weapon) => weapon.id),
  ...publishedLocations.map((location) => location.id),
  'character:mo-yuan', 'character:soul', 'character:the-hunt'
].sort());
for (const document of search.filter((item) => item.entityType === 'character')) assert.equal(document.route, `/characters/${document.slug}`);
const weaponDocuments = search.filter((item) => item.entityType === 'weapon');
assert.equal(weaponDocuments.length, publishedWeapons.length, 'Production Search Weapon count must match published Weapon data');
for (const weapon of publishedWeapons) {
  const document = weaponDocuments.find((item) => item.id === weapon.id);
  assert(document, `Production Search missing ${weapon.id}`);
  assert.equal(document.route, `/weapons/${weapon.slug}`, `${weapon.id}: Search route must be canonical`);
}
for (const weapon of draftWeapons) assert(!search.some((item) => item.id === weapon.id), `Production Search must exclude draft ${weapon.id}`);
const bossDocuments = search.filter((item) => item.entityType === 'boss');
assert.equal(bossDocuments.length, publishedBosses.length, 'Production Search Boss count must match published Boss data');
for (const boss of publishedBosses) {
  const document = bossDocuments.find((item) => item.id === boss.id);
  assert(document, `Production Search missing ${boss.id}`);
  assert.equal(document.route, `/bosses/${boss.slug}`, `${boss.id}: Search route must be canonical`);
}
for (const boss of draftBosses) assert(!search.some((item) => item.id === boss.id), `Production Search must exclude draft ${boss.id}`);
const locationDocuments = search.filter((item) => item.entityType === 'location');
assert.equal(locationDocuments.length, publishedLocations.length, 'Production Search Location count must match published Location data');
for (const location of publishedLocations) {
  const document = locationDocuments.find((item) => item.id === location.id);
  assert(document, `Production Search missing ${location.id}`);
  assert.equal(document.route, `/world/${location.slug}`, `${location.id}: Search route must be canonical`);
}
for (const location of draftLocations) assert(!search.some((item) => item.id === location.id), `Production Search must exclude draft ${location.id}`);
const sitemap = await readFile(resolve(dist, 'sitemap.xml'), 'utf8');
assert.equal(
  (sitemap.match(/<url>/g) || []).length,
  9 + publishedWeapons.length + 3 + publishedBosses.length + publishedLocations.length,
  'Sitemap URL count must match published Entity data'
);
const sitemapUrls = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]));
assert.equal(sitemapUrls.size, 25, 'Expected 25 unique sitemap URLs');
assert.deepEqual(sitemapUrls, canonicalUrls, 'Sitemap URLs must exactly match production canonical URLs');
for (const weapon of publishedWeapons) assert(sitemap.includes(`/weapons/${weapon.slug}`), `Sitemap missing Weapon ${weapon.slug}`);
for (const weapon of draftWeapons) assert(!sitemap.includes(`/weapons/${weapon.slug}`), `Sitemap must exclude draft Weapon ${weapon.slug}`);
for (const route of ['/characters/soul', '/characters/mo-yuan', '/characters/the-hunt']) assert(sitemap.includes(route), `Sitemap missing ${route}`);
for (const boss of publishedBosses) assert(sitemap.includes(`/bosses/${boss.slug}`), `Sitemap missing Boss ${boss.slug}`);
for (const boss of draftBosses) assert(!sitemap.includes(`/bosses/${boss.slug}`), `Sitemap must exclude draft Boss ${boss.slug}`);
for (const location of publishedLocations) assert(sitemap.includes(`/world/${location.slug}`), `Sitemap missing Location ${location.slug}`);
for (const location of draftLocations) assert(!sitemap.includes(`/world/${location.slug}`), `Sitemap must exclude draft Location ${location.slug}`);
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
const retiredLegacyAssets = [
  'bg-texture.jpg',
  'hero-bg.jpg',
  'hero-logo.png',
  'map-lake.jpg',
  'map-pangzhen.jpg',
  'map-snow.jpg',
  'map-street.jpg',
  'map-tower.jpg',
  'map-valley.jpg'
];
const distFiles = await walk(dist);
const distHtmlFiles = distFiles.filter((file) => file.endsWith('.html'));
assert.equal(distHtmlFiles.length, 29, 'Expected 29 total dist HTML files including the Baidu verification artifact');
assert.equal(distHtmlFiles.filter((file) => !file.endsWith(baiduVerificationFile)).length, 28, 'Expected 28 page HTML files excluding the Baidu verification artifact');
const canonicalTagCount = (await Promise.all(distHtmlFiles.map((file) => readFile(file, 'utf8'))))
  .reduce((count, html) => count + (html.match(/<link\s+rel="canonical"/gi) || []).length, 0);
assert.equal(canonicalTagCount, 27, 'Expected 27 canonical tags across 28 page HTML files');
for (const file of distFiles) {
  const content = await readFile(file);
  const text = content.toString('utf8');
  for (const forbidden of ['/home/mok', '/mnt/c/', 'astro-island', 'client:load']) assert(!text.includes(forbidden), `${file}: forbidden build output`);
  for (const asset of retiredLegacyAssets) assert(!text.includes(asset), `${file}: retired legacy asset reference remains: ${asset}`);
}
console.log(`Astro dist verification passed: ${canonicalRoutes.length} canonical routes, ${publishedWeapons.length} Weapon pages, 3 Character pages, ${publishedBosses.length} Boss pages, ${publishedLocations.length} Location pages, ${draftWeapons.length} draft Weapon, ${draftBosses.length} draft Boss, and ${draftLocations.length} draft Location detail routes.`);
