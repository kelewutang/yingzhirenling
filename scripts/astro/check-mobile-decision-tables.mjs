import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const root = resolve(import.meta.dirname, '../..');
const FROZEN_COUNTS = Object.freeze({ sitemap: 25, canonical: 27, pageHtml: 28, searchDocs: 16 });

const targets = [
  { page: 'about', variant: 'facts', heading: '发售信息', rows: 6, columns: 2, minWidthPx: 448, hash: 'acf141f69ee561cae483909be0f2689c848c30a99ea387a941cd49f02138a253' },
  { page: 'about', variant: 'prices', heading: '各平台售价', rows: 7, columns: 4, minWidthPx: 544, hash: '40f1fadd83dbe4765af6150bec4ba4aaf06f03dad745f8cb4d11d1fda7e67b88', thead: true },
  { page: 'about', variant: 'editions', heading: '版本内容对比', rows: 8, columns: 3, minWidthPx: 512, hash: '8a9e7a3cfa6b4602ea5e0c5c3e1740d5e971c98c0b84d417b9b90b97d0a334c1', thead: true },
  { page: 'about', variant: 'hardware', heading: '最低配置（1080p / 30FPS）', rows: 6, columns: 2, minWidthPx: 512, hash: 'c5941cfd5e6c0c0123581b1abf8e5840deff851652dd89218370d6a5dcecc3b7' },
  { page: 'about', variant: 'hardware', heading: '推荐配置（1440p / 60FPS）', rows: 6, columns: 2, minWidthPx: 512, hash: 'fa3d702dc5156736bbe7b89fc94542443264de77a2865f74ce0195a83ca7982d' },
  { page: 'about-site', variant: 'policy', heading: '内容更新原则', rows: 4, columns: 3, minWidthPx: 480, hash: '9a46e76110ac23a81ec1c76839c9db1dadb35688dcb0e0f143cd0ed7b4666aa0', thead: true }
];

const giftTable = {
  page: 'about', heading: '实体收藏版礼盒', rows: 6, columns: 2,
  hash: 'e9444902944a7455781028e6f3a27e4eaa4557fe1076d06d268c2669394af368'
};

const hash = (value) => createHash('sha256').update(value).digest('hex');
const classes = (node) => new Set((node.attrs.class || '').split(/\s+/u).filter(Boolean));
const hasClass = (node, value) => classes(node).has(value);
const descendants = (node, predicate) => node.children.flatMap((child) => [child, ...descendants(child, predicate)]).filter(predicate);
const elementText = (node) => (node.raw || '').replace(/<[^>]+>/gu, '').replace(/\s+/gu, ' ').trim();

function parseHtml(html) {
  const rootNode = { tag: '#document', attrs: {}, parent: null, children: [], raw: html };
  const stack = [rootNode];
  const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
  const tags = /<!--[\s\S]*?-->|<![^>]*>|<\/?([A-Za-z][\w:-]*)\b([^>]*)>/gu;
  let match;
  while ((match = tags.exec(html))) {
    if (!match[1]) continue;
    const whole = match[0];
    const tag = match[1].toLowerCase();
    if (whole.startsWith('</')) {
      for (let index = stack.length - 1; index > 0; index -= 1) {
        if (stack[index].tag === tag) {
          stack[index].raw = html.slice(stack[index].contentStart, match.index);
          stack.length = index;
          break;
        }
      }
      continue;
    }
    const attrs = {};
    for (const attribute of (match[2] || '').matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/gu)) {
      attrs[attribute[1].toLowerCase()] = attribute[2] ?? attribute[3] ?? attribute[4] ?? '';
    }
    const node = { tag, attrs, parent: stack.at(-1), children: [], raw: '', contentStart: tags.lastIndex };
    stack.at(-1).children.push(node);
    if (!voidTags.has(tag) && !whole.endsWith('/>')) stack.push(node);
  }
  return rootNode;
}

function documentOrder(rootNode) {
  const output = [];
  const visit = (node) => {
    for (const child of node.children) {
      output.push(child);
      visit(child);
    }
  };
  visit(rootNode);
  return output;
}

function tableText(table) {
  return descendants(table, (node) => node.tag === 'th' || node.tag === 'td').map(elementText).join('\u001f');
}

function directTable(wrapper) {
  const tables = wrapper.children.filter((node) => node.tag === 'table');
  assert.equal(tables.length, 1, 'responsive wrapper must directly own exactly one native table');
  return tables[0];
}

function previousHeading(order, node) {
  const index = order.indexOf(node);
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) if (/^h[1-6]$/u.test(order[cursor].tag)) return elementText(order[cursor]);
  return '';
}

function assertNativeTable(table, expected, label) {
  assert.equal(table.tag, 'table', `${label}: native <table> missing`);
  assert(hasClass(table, 'data-table'), `${label}: data-table class missing`);
  const rows = descendants(table, (node) => node.tag === 'tr');
  assert.equal(rows.length, expected.rows, `${label}: expected ${expected.rows} rows, actual ${rows.length}`);
  assert(rows.length > 0, `${label}: table has no rows`);
  const cells = rows[0].children.filter((node) => node.tag === 'th' || node.tag === 'td');
  assert.equal(cells.length, expected.columns, `${label}: expected ${expected.columns} columns, actual ${cells.length}`);
  assert(descendants(table, (node) => node.tag === 'tbody').length > 0, `${label}: tbody missing`);
  assert(descendants(table, (node) => node.tag === 'th').length > 0, `${label}: th missing`);
  assert(descendants(table, (node) => node.tag === 'td').length > 0, `${label}: td missing`);
  assert.equal(hash(tableText(table)), expected.hash, `${label}: table cell content changed`);
  if (expected.thead) assert(descendants(table, (node) => node.tag === 'thead').length > 0, `${label}: thead missing`);
}

function splitTopLevel(value, delimiter = ',') {
  const parts = [];
  let current = '';
  let depth = 0;
  let quote = '';
  for (const character of value) {
    if (quote) {
      current += character;
      if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    else if (character === '(' || character === '[') depth += 1;
    else if (character === ')' || character === ']') depth -= 1;
    if (character === delimiter && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else current += character;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function declarations(value) {
  return splitTopLevel(value, ';').flatMap((part) => {
    const separator = part.indexOf(':');
    if (separator < 0) return [];
    const property = part.slice(0, separator).trim().toLowerCase();
    const declaration = part.slice(separator + 1).trim();
    return property ? [{ property, value: declaration }] : [];
  });
}

function readCssRules(css, media = [], state = { order: 0 }) {
  const rules = [];
  const source = css.replace(/\/\*[\s\S]*?\*\//gu, '');
  let start = 0;
  while (start < source.length) {
    while (/\s/u.test(source[start] || '')) start += 1;
    if (start >= source.length) break;
    let cursor = start;
    let quote = '';
    let parentheses = 0;
    for (; cursor < source.length; cursor += 1) {
      const character = source[cursor];
      if (quote) {
        if (character === quote && source[cursor - 1] !== '\\') quote = '';
      } else if (character === '"' || character === "'") quote = character;
      else if (character === '(') parentheses += 1;
      else if (character === ')') parentheses -= 1;
      else if (parentheses === 0 && (character === '{' || character === ';')) break;
    }
    const prelude = source.slice(start, cursor).trim();
    if (source[cursor] !== '{') {
      start = cursor + 1;
      continue;
    }
    let end = cursor + 1;
    let depth = 1;
    quote = '';
    for (; end < source.length && depth > 0; end += 1) {
      const character = source[end];
      if (quote) {
        if (character === quote && source[end - 1] !== '\\') quote = '';
      } else if (character === '"' || character === "'") quote = character;
      else if (character === '{') depth += 1;
      else if (character === '}') depth -= 1;
    }
    const body = source.slice(cursor + 1, end - 1);
    if (prelude.startsWith('@media')) rules.push(...readCssRules(body, [...media, prelude.slice(6).trim()], state));
    else if (!prelude.startsWith('@')) rules.push({ selectors: splitTopLevel(prelude), declarations: declarations(body), media, order: state.order++ });
    start = end;
  }
  return rules;
}

function mediaApplies(media, viewport) {
  return media.every((condition) => {
    if (/\bprint\b/iu.test(condition)) return false;
    for (const match of condition.matchAll(/\((min|max)-width\s*:\s*([\d.]+)px\)/giu)) {
      const value = Number(match[2]);
      if (match[1].toLowerCase() === 'max' && viewport > value) return false;
      if (match[1].toLowerCase() === 'min' && viewport < value) return false;
    }
    return true;
  });
}

function selectorTokens(selector) {
  const tokens = [];
  let buffer = '';
  let bracketDepth = 0;
  let sawSpace = false;
  const flush = () => {
    if (!buffer) return;
    if (sawSpace && tokens.length && tokens.at(-1) !== '>') tokens.push(' ');
    tokens.push(buffer);
    buffer = '';
    sawSpace = false;
  };
  for (const character of selector.trim()) {
    if (character === '[' || character === '(') bracketDepth += 1;
    if (character === ']' || character === ')') bracketDepth -= 1;
    if (bracketDepth === 0 && /\s/u.test(character)) {
      flush();
      sawSpace = true;
    } else if (bracketDepth === 0 && character === '>') {
      flush();
      if (tokens.at(-1) === ' ') tokens.pop();
      tokens.push('>');
      sawSpace = false;
    } else buffer += character;
  }
  flush();
  return tokens;
}

function matchesCompound(node, compound) {
  const rootPseudo = /:root\b/iu.test(compound);
  if (rootPseudo && node.tag !== 'html') return false;
  const clean = compound.replace(/::?[\w-]+(?:\([^)]*\))?/gu, '');
  const tag = clean.match(/^[A-Za-z][\w-]*/u)?.[0]?.toLowerCase();
  if (tag && tag !== node.tag) return false;
  const id = clean.match(/#([\w-]+)/u)?.[1];
  if (id && node.attrs.id !== id) return false;
  for (const match of clean.matchAll(/\.([\w-]+)/gu)) if (!hasClass(node, match[1])) return false;
  for (const match of clean.matchAll(/\[([\w:-]+)(?:\s*=\s*["']?([^\]"']+)["']?)?\]/gu)) {
    const attribute = match[1].toLowerCase();
    if (!(attribute in node.attrs)) return false;
    if (match[2] && node.attrs[attribute] !== match[2].trim()) return false;
  }
  return rootPseudo || clean === '*' || tag || id || /\./u.test(clean) || /\[/u.test(clean);
}

function matchesSelector(node, selector) {
  const tokens = selectorTokens(selector);
  if (!tokens.length || tokens.at(-1) === '>') return false;
  const matchFrom = (candidate, index) => {
    if (!candidate || !matchesCompound(candidate, tokens[index])) return false;
    if (index === 0) return true;
    const combinator = tokens[index - 1] === '>' ? '>' : ' ';
    const previous = index - 2;
    if (previous < 0) return false;
    if (combinator === '>') return matchFrom(candidate.parent, previous);
    for (let ancestor = candidate.parent; ancestor && ancestor.tag !== '#document'; ancestor = ancestor.parent) if (matchFrom(ancestor, previous)) return true;
    return false;
  };
  return matchFrom(node, tokens.length - 1);
}

function specificity(selector) {
  const clean = selector.replace(/::?[\w-]+(?:\([^)]*\))?/gu, '');
  const pseudoClasses = (selector.match(/(?<!:):(?!:)[\w-]+(?:\([^)]*\))?/gu) || []).length;
  return (clean.match(/#[\w-]+/gu) || []).length * 100
    + ((clean.match(/\.[\w-]+|\[[^\]]+\]/gu) || []).length + pseudoClasses) * 10
    + (clean.match(/(?:^|[\s>])([A-Za-z][\w-]*)/gu) || []).length;
}

function overflowX(value) {
  return value.trim().split(/\s+/u)[0].toLowerCase();
}

function computedStyle(node, rules, viewport) {
  const result = new Map();
  const apply = (declaration, rank, order) => {
    const important = /\s*!important\s*$/iu.test(declaration.value);
    const value = declaration.value.replace(/\s*!important\s*$/iu, '').trim();
    const candidates = declaration.property === 'overflow' ? [{ property: 'overflow-x', value: overflowX(value) }] : [{ property: declaration.property, value }];
    for (const candidate of candidates) {
      const prior = result.get(candidate.property);
      const priority = rank + (important ? 2_000_000_000 : 0);
      if (!prior || priority >= prior.priority) result.set(candidate.property, { value: candidate.value, priority, order });
    }
  };
  for (const rule of rules) {
    if (!mediaApplies(rule.media, viewport)) continue;
    const matchingSelectors = rule.selectors.filter((selector) => matchesSelector(node, selector));
    if (!matchingSelectors.length) continue;
    const weight = Math.max(...matchingSelectors.map(specificity));
    for (const declaration of rule.declarations) apply(declaration, weight * 1_000_000 + rule.order, rule.order);
  }
  for (const declaration of declarations(node.attrs.style || '')) apply(declaration, 1_000_000_000, Number.MAX_SAFE_INTEGER);
  return Object.fromEntries([...result.entries()].map(([property, value]) => [property, value.value]));
}

function rootFontSizePixels(html, rules, viewport) {
  const style = computedStyle(html, rules, viewport);
  const variable = style['font-size']?.trim().match(/^var\((--[\w-]+)\)$/u)?.[1];
  const value = variable ? style[variable] : style['font-size'];
  if (!value) return 16;
  const match = value.trim().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(px|rem|%)$/u);
  assert(match, `root font-size must resolve to px, rem, or %, actual ${value}`);
  return Number(match[1]) * ({ px: 1, rem: 16, '%': 0.16 })[match[2]];
}

function minimumWidthPixels(value, rootFontSize) {
  if (value?.trim() === '0') return 0;
  const match = value?.trim().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(px|rem)$/u);
  if (!match) return null;
  return Number(match[1]) * ({ px: 1, rem: rootFontSize })[match[2]];
}

function safeContainerMinimumWidth(value) {
  if (!value) return true;
  const normalized = value.trim().toLowerCase();
  if (/^(auto|none|initial|inherit|unset|revert|revert-layer|0|0(?:\.0+)?(?:px|rem|em|%)?)$/u.test(normalized)) return true;
  const percentage = normalized.match(/^(\d+(?:\.\d+)?)%$/u);
  return Boolean(percentage && Number(percentage[1]) <= 100);
}

function assertLocalOverflowContract(wrapper, table, rules, html, target) {
  const label = `${target.page} ${target.heading}`;
  for (const viewport of [320, 390]) {
    const rootFontSize = rootFontSizePixels(html, rules, viewport);
    const wrapperStyle = computedStyle(wrapper, rules, viewport);
    assert(['auto', 'scroll'].includes(wrapperStyle['overflow-x']), `${label} at ${viewport}px: wrapper overflow-x must be auto or scroll, actual ${wrapperStyle['overflow-x'] || 'unset'}`);
    assert(safeContainerMinimumWidth(wrapperStyle['min-width']), `${label} at ${viewport}px: responsive wrapper must not force page width, actual min-width ${wrapperStyle['min-width'] || 'auto'}`);
    const tableStyle = computedStyle(table, rules, viewport);
    assert.equal(tableStyle.display, 'table', `${label} at ${viewport}px: target table display must remain table, actual ${tableStyle.display || 'unset'}`);
    const actualMinWidth = minimumWidthPixels(tableStyle['min-width'], rootFontSize);
    assert(actualMinWidth !== null && actualMinWidth >= target.minWidthPx, `${label} at ${viewport}px: effective min-width must be at least ${target.minWidthPx}px, actual ${tableStyle['min-width'] || 'unset'}`);
    for (let ancestor = wrapper.parent; ancestor && ancestor.tag !== '#document'; ancestor = ancestor.parent) {
      const style = computedStyle(ancestor, rules, viewport);
      assert(!['auto', 'scroll'].includes(style['overflow-x']), `${label} at ${viewport}px: ancestor <${ancestor.tag}> must not become the horizontal scroll container`);
      assert(!['hidden', 'clip'].includes(style['overflow-x']), `${label} at ${viewport}px: ancestor <${ancestor.tag}> must not clip the target table horizontally`);
      assert(safeContainerMinimumWidth(style['min-width']), `${label} at ${viewport}px: ancestor <${ancestor.tag}> must not force page width, actual min-width ${style['min-width'] || 'auto'}`);
    }
  }
  const desktopStyle = computedStyle(table, rules, 1280);
  assert.equal(minimumWidthPixels(desktopStyle['min-width'], rootFontSizePixels(html, rules, 1280)), 0, `${label} at 1280px: mobile min-width contract must not force desktop scrolling`);
}

async function listFiles(directory) {
  const entries = await readdir(directory, { recursive: true, withFileTypes: true });
  return entries.filter((entry) => entry.isFile()).map((entry) => join(entry.parentPath, entry.name));
}

function assertCount(name, expected, actual) {
  assert.equal(actual, expected, `${name} frozen count mismatch: expected ${expected}, actual ${actual}`);
}

async function verifyFrozenCounts(dist) {
  const [sitemap, searchIndex, files] = await Promise.all([
    readFile(resolve(dist, 'sitemap.xml'), 'utf8'),
    readFile(resolve(dist, 'generated/search-index.production.json'), 'utf8'),
    listFiles(dist)
  ]);
  const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/gu)].map((match) => match[1]);
  const htmlFiles = files.filter((file) => file.endsWith('.html'));
  const pageHtml = htmlFiles.filter((file) => !file.split('/').at(-1).startsWith('baidu_verify_'));
  const canonical = (await Promise.all(htmlFiles.map((file) => readFile(file, 'utf8')))).reduce((count, html) => count + (html.match(/<link\s+rel="canonical"\s+href="/giu) || []).length, 0);
  const searchDocs = JSON.parse(searchIndex).length;
  assertCount('sitemap URL', FROZEN_COUNTS.sitemap, sitemapUrls.length);
  assertCount('canonical tag', FROZEN_COUNTS.canonical, canonical);
  assertCount('page HTML', FROZEN_COUNTS.pageHtml, pageHtml.length);
  assertCount('production Search document', FROZEN_COUNTS.searchDocs, searchDocs);
  return { sitemap: sitemapUrls.length, canonical, pageHtml: pageHtml.length, searchDocs };
}

async function stylesheetRulesInDocumentOrder(page, pageFile, dist) {
  const rules = [];
  const state = { order: 0 };
  let embeddedStyleBlocks = 0;
  let stylesheetLinks = 0;
  for (const node of documentOrder(page)) {
    if (node.tag === 'style') {
      embeddedStyleBlocks += 1;
      rules.push(...readCssRules(node.raw, [], state));
      continue;
    }
    if (node.tag !== 'link' || !node.attrs.rel?.split(/\s+/u).map((value) => value.toLowerCase()).includes('stylesheet')) continue;
    const href = node.attrs.href?.split(/[?#]/u)[0];
    assert(href, `${pageFile}: stylesheet link has no href`);
    const physicalCandidate = href.startsWith('/') ? resolve(dist, `.${href}`) : resolve(dirname(pageFile), href);
    const stylesheet = physicalCandidate === dist || physicalCandidate.startsWith(`${dist}/`)
      ? physicalCandidate
      : resolve(dist, href.replace(/^(?:\.\.\/)+/u, ''));
    assert(stylesheet === dist || stylesheet.startsWith(`${dist}/`), `${pageFile}: stylesheet must resolve inside dist`);
    rules.push(...readCssRules(await readFile(stylesheet, 'utf8'), [], state));
    stylesheetLinks += 1;
  }
  assert(stylesheetLinks > 0, `${pageFile}: final HTML has no stylesheet link`);
  assert(rules.length > 0, `${pageFile}: stylesheet sources contain no readable CSS rules`);
  return { rules, embeddedStyleBlocks, stylesheetLinks };
}

async function verify({ dist }) {
  const pages = new Map();
  for (const page of new Set(targets.map((target) => target.page))) {
    try {
      pages.set(page, parseHtml(await readFile(resolve(dist, `${page}.html`), 'utf8')));
    } catch (error) {
      throw new Error(`Mobile decision table verifier requires current dist/${page}.html: ${error.message}`);
    }
  }
  for (const page of pages.values()) {
    const tables = descendants(page, (node) => node.tag === 'table');
    const expectedCount = page === pages.get('about') ? 6 : 1;
    assert.equal(tables.length, expectedCount, `built page table count changed: expected ${expectedCount}, actual ${tables.length}`);
  }
  const pageRules = new Map();
  let embeddedStyleBlocks = 0;
  for (const [pageName, page] of pages) {
    const sources = await stylesheetRulesInDocumentOrder(page, resolve(dist, `${pageName}.html`), dist);
    embeddedStyleBlocks += sources.embeddedStyleBlocks;
    pageRules.set(pageName, sources.rules);
  }
  for (const target of targets) {
    const page = pages.get(target.page);
    const wrappers = descendants(page, (node) => node.tag === 'div' && hasClass(node, 'responsive-table') && hasClass(node, `responsive-table--${target.variant}`));
    const candidates = wrappers.filter((wrapper) => previousHeading(documentOrder(page), wrapper) === target.heading);
    assert.equal(candidates.length, 1, `${target.page} ${target.heading}: expected one responsive wrapper matched to its heading, actual ${candidates.length}`);
    const wrapper = candidates[0];
    assert.equal(wrapper.attrs.role, 'region', `${target.page} ${target.heading}: wrapper role must remain region`);
    assert(wrapper.attrs['aria-label'], `${target.page} ${target.heading}: wrapper accessible label missing`);
    assert.equal(wrapper.attrs.tabindex, '0', `${target.page} ${target.heading}: wrapper tabindex must remain 0`);
    const table = directTable(wrapper);
    assertNativeTable(table, target, `${target.page} ${target.heading}`);
    const scopes = descendants(table, (node) => node.tag === 'th').map((node) => node.attrs.scope);
    assert(scopes.every((scope) => scope === 'col' || scope === 'row'), `${target.page} ${target.heading}: th scope missing`);
    assertLocalOverflowContract(wrapper, table, pageRules.get(target.page), descendants(page, (node) => node.tag === 'html')[0], target);
  }
  const about = pages.get(giftTable.page);
  const giftCandidates = descendants(about, (node) => node.tag === 'table' && previousHeading(documentOrder(about), node) === giftTable.heading);
  assert.equal(giftCandidates.length, 1, '实体收藏版礼盒: expected one native table matched to its heading');
  const gift = giftCandidates[0];
  assertNativeTable(gift, giftTable, '实体收藏版礼盒');
  for (let ancestor = gift.parent; ancestor && ancestor.tag !== '#document'; ancestor = ancestor.parent) assert(!hasClass(ancestor, 'responsive-table'), '实体收藏版礼盒: must retain its non-forced-scroll table strategy');
  assert.equal(minimumWidthPixels(computedStyle(gift, pageRules.get(giftTable.page), 320)['min-width'], rootFontSizePixels(descendants(about, (node) => node.tag === 'html')[0], pageRules.get(giftTable.page), 320)), 0, '实体收藏版礼盒: must not receive a forced mobile min-width');
  return { ...(await verifyFrozenCounts(dist)), embeddedStyleBlocks };
}

async function mutateFile(file, transform) {
  const value = await readFile(file, 'utf8');
  const next = transform(value);
  assert.notEqual(next, value, `fixture mutation did not change ${file}`);
  await writeFile(file, next, 'utf8');
}

async function expectFixtureFailure(name, mutate) {
  const fixture = await mkdtemp(join(tmpdir(), 'yingzhirenling-mobile-table-'));
  try {
    await cp(resolve(root, 'dist'), fixture, { recursive: true });
    await mutate(fixture);
    await assert.rejects(() => verify({ dist: fixture }), undefined, `${name}: verifier unexpectedly passed`);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
}

async function expectFixturePass(name, mutate) {
  const fixture = await mkdtemp(join(tmpdir(), 'yingzhirenling-mobile-table-'));
  try {
    await cp(resolve(root, 'dist'), fixture, { recursive: true });
    await mutate(fixture);
    await assert.doesNotReject(() => verify({ dist: fixture }), `${name}: verifier unexpectedly failed`);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
}

async function runFixtures() {
  await expectFixtureFailure('missing responsive wrapper', (dist) => mutateFile(resolve(dist, 'about.html'), (html) => html.replace('responsive-table responsive-table--facts', 'responsive-table--facts')));
  await expectFixtureFailure('missing overflow contract', (dist) => mutateFile(resolve(dist, 'css/style.css'), (css) => css.replace(/(\.responsive-table\s*\{[\s\S]*?)overflow-x\s*:\s*auto\s*;/u, '$1overflow-x: visible;')));
  await expectFixtureFailure('missing table min-width contract', (dist) => mutateFile(resolve(dist, 'css/style.css'), (css) => css.replace('min-width: 28rem;', 'min-width: 0;')));
  await expectFixtureFailure('native table replaced by div', (dist) => mutateFile(resolve(dist, 'about.html'), (html) => html.replace('<table class="data-table">', '<div class="data-table">').replace('</table>', '</div>')));
  await expectFixtureFailure('header column removed', (dist) => mutateFile(resolve(dist, 'about.html'), (html) => html.replace('<th scope="col">平台</th>', '')));
  await expectFixtureFailure('target table absent from final dist', (dist) => mutateFile(resolve(dist, 'about-site.html'), (html) => html.replace('<table class="data-table">', '<div class="data-table">').replace('</table>', '</div>')));
  await expectFixtureFailure('sitemap membership drift', (dist) => mutateFile(resolve(dist, 'sitemap.xml'), (xml) => xml.replace(/<url>[\s\S]*?<\/url>/u, '')));
  await expectFixtureFailure('canonical count drift', (dist) => mutateFile(resolve(dist, 'about.html'), (html) => html.replace(/<link\s+rel="canonical"\s+href="[^"]+">/u, '')));
  await expectFixtureFailure('Search document count drift', async (dist) => {
    const file = resolve(dist, 'generated/search-index.production.json');
    const documents = JSON.parse(await readFile(file, 'utf8'));
    documents.pop();
    await writeFile(file, `${JSON.stringify(documents, null, 2)}\n`, 'utf8');
  });
  await expectFixtureFailure('late CSS min-width override', (dist) => mutateFile(resolve(dist, 'css/style.css'), (css) => `${css}\n.responsive-table table { min-width: 1px !important; }\n`));
  await expectFixtureFailure('inline target-table min-width override', (dist) => mutateFile(resolve(dist, 'about.html'), (html) => html.replace('<table class="data-table">', '<table class="data-table" style="min-width:1px !important">')));
  await expectFixtureFailure('inline wrapper overflow override', (dist) => mutateFile(resolve(dist, 'about.html'), (html) => html.replace('class="responsive-table responsive-table--facts"', 'class="responsive-table responsive-table--facts" style="overflow-x:hidden !important"')));
  await expectFixtureFailure('inline ancestor overflow override', (dist) => mutateFile(resolve(dist, 'about.html'), (html) => html.replace('<div class="article">', '<div class="article" style="overflow-x:hidden">')));
  await expectFixtureFailure('embedded style after stylesheet min-width override', (dist) => mutateFile(resolve(dist, 'about.html'), (html) => html.replace('</head>', '<style>.responsive-table table { min-width: 1px !important; }</style></head>')));
  await expectFixtureFailure('wrapper fixed min-width override', (dist) => mutateFile(resolve(dist, 'css/style.css'), (css) => `${css}\n.responsive-table { min-width: 1000px !important; }\n`));
  await expectFixtureFailure('ancestor fixed min-width override', (dist) => mutateFile(resolve(dist, 'css/style.css'), (css) => `${css}\n.article { min-width: 1000px !important; }\n`));
  await expectFixtureFailure('inline wrapper fixed min-width override', (dist) => mutateFile(resolve(dist, 'about.html'), (html) => html.replace('class="responsive-table responsive-table--facts"', 'class="responsive-table responsive-table--facts" style="min-width:1000px !important"')));
  await expectFixtureFailure('inline ancestor fixed min-width override', (dist) => mutateFile(resolve(dist, 'about.html'), (html) => html.replace('<div class="article">', '<div class="article" style="min-width:1000px !important">')));
  await expectFixtureFailure('target em min-width override', (dist) => mutateFile(resolve(dist, 'about.html'), (html) => html.replace('<table class="data-table">', '<table class="data-table" style="min-width:28em !important">')));
  await expectFixturePass('embedded style before stylesheet respects later external rule', (dist) => mutateFile(resolve(dist, 'about.html'), (html) => html.replace('<link rel="stylesheet" href="../css/style.css">', '<style>@media (max-width: 600px) { .responsive-table--facts .data-table { min-width: 1px; } }</style>\n  <link rel="stylesheet" href="../css/style.css">')));
  await expectFixtureFailure('root pseudo-class specificity beats later html font-size', (dist) => mutateFile(resolve(dist, 'css/style.css'), (css) => `${css}\n:root { font-size: 10px; }\nhtml { font-size: 16px; }\n`));
  await expectFixtureFailure('later root font-size still lowers rem contract', (dist) => mutateFile(resolve(dist, 'css/style.css'), (css) => `${css}\nhtml { font-size: 16px; }\n:root { font-size: 10px; }\n`));
  await expectFixturePass('important html font-size beats root specificity', (dist) => mutateFile(resolve(dist, 'css/style.css'), (css) => `${css}\nhtml { font-size: 16px !important; }\n:root { font-size: 10px; }\n`));
  await expectFixtureFailure('important root font-size beats important html by specificity', (dist) => mutateFile(resolve(dist, 'css/style.css'), (css) => `${css}\n:root { font-size: 10px !important; }\nhtml { font-size: 16px !important; }\n`));
  console.log('Mobile decision table mutations passed: 22 destructive wrapper/overflow/min-width/semantic/count/late-style/root-font cases failed; before-link source order and important-html root-font fixtures correctly passed.');
}

const fixtureMode = process.argv.includes('--fixtures');
const counts = await verify({ dist: resolve(root, 'dist') });
if (fixtureMode) await runFixtures();
console.log(`Mobile decision table dist verification passed: built HTML/CSS semantics, local overflow contracts, ${counts.embeddedStyleBlocks} embedded style block(s), and frozen counts (sitemap ${counts.sitemap}, canonical ${counts.canonical}, page HTML ${counts.pageHtml}, Search docs ${counts.searchDocs}).${fixtureMode ? ' Fixture mutations used temporary copies of the current dist.' : ''}`);
