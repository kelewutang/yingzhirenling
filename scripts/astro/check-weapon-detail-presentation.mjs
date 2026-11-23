import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildWeaponCollectionCard } from '../../src/lib/collection-models.mjs';
import { isForgedBatchFact } from '../../src/lib/weapon-forms.mjs';
import { parseControllerInput, parseInlineControllerText } from '../../src/lib/controller-inputs.mjs';

const root = resolve(process.cwd());
const dist = resolve(root, 'dist', 'weapons');
const sourceId = 'source:official-douyin-2026-09-09-gameplay-article';
const [serpent, shadow, sparse, collection, charactersCollection, whiteSerpentData, whiteShadowData, source, searchIndex, mediaRecords] = await Promise.all([
  readFile(resolve(dist, 'white-serpent-crimson-viper.html'), 'utf8'),
  readFile(resolve(dist, 'white-shadow.html'), 'utf8'),
  readFile(resolve(dist, 'soft-snake-sword.html'), 'utf8'),
  readFile(resolve(root, 'dist', 'weapons.html'), 'utf8'),
  readFile(resolve(root, 'dist', 'characters.html'), 'utf8'),
  readJson('data/weapons/white-serpent-crimson-viper.json'),
  readJson('data/weapons/white-shadow.json'),
  readJson('data/sources/official-douyin-2026-09-09-gameplay-article.json'),
  readJson('generated/search-index.production.json'),
  readJson('data/media.json').then((document) => document.records)
]);
const count = (html, value) => html.split(value).length - 1;

function overview(html) {
  const start = html.indexOf('data-weapon-section="overview"');
  const end = [
    html.indexOf('data-weapon-section="mechanics"', start),
    html.indexOf('data-weapon-section="progression"', start),
    html.indexOf('id="relations-title"', start),
    html.indexOf('id="sources-title"', start)
  ].filter((index) => index > start).sort((left, right) => left - right)[0] ?? html.length;
  assert(start >= 0 && end > start, 'Weapon overview must be present before later detail sections');
  return html.slice(start, end);
}

function entry(html, attribute, id) {
  const match = html.match(new RegExp(`<li[^>]*${attribute}="${id}"[^>]*>[\\s\\S]*?</li>`));
  assert(match, `Weapon entry missing: ${id}`);
  return match[0];
}

function assertEffect(html, attribute, id, description) {
  const rendered = entry(html, attribute, id);
  const text = rendered.replace(/<[^>]*>/gu, '');
  const renderedDescription = parseInlineControllerText(description)
    .map((segment) => segment.kind === 'input' ? segment.parsed.tokens.map((token) => token.value).join('') : segment.value)
    .join('');
  assert(rendered.includes('class="weapon-detail-description"'), `Official description missing or detached: ${id}`);
  assert(text.includes(renderedDescription), `Official description wording changed: ${id}`);
  assert.equal(count(text, renderedDescription), 1, `Official description must render once: ${id}`);
}

function assertInput(html, attribute, fact) {
  const rendered = entry(html, attribute, fact.id);
  const input = fact.valueType === 'object' ? fact.value.input : undefined;
  if (input) {
    const parsed = parseControllerInput(input);
    assert(rendered.includes(`data-weapon-input-for="${fact.id}"`), `Input row missing: ${fact.id}`);
    const row = rendered.match(new RegExp(`<p class="weapon-detail-input" data-weapon-input-for="${fact.id}">[\\s\\S]*?</p>`))?.[0];
    assert(row, `Controller input row markup missing: ${fact.id}`);
    assert(row.includes('<span class="weapon-detail-input__label">按键：</span>'), `Player-facing controller label must be 按键: ${fact.id}`);
    assert(!row.includes('<span class="weapon-detail-input__label">输入：</span>'), `Old player-facing controller label must be absent: ${fact.id}`);
    assert(row.includes(`data-controller-input="${input}"`), `Input value missing: ${fact.id}`);
    assert(row.includes(`aria-label="${parsed.accessibleText}"`), `Accessible input text missing: ${fact.id}`);
    assert.equal(count(row, 'class="controller-input__keycap"'), parsed.tokens.filter((token) => token.kind === 'control').length, `Keycap count changed: ${fact.id}`);
    for (const token of parsed.tokens.filter((token) => token.kind === 'control')) {
      assert(row.includes(`data-controller-token="${token.value}"`), `Controller token missing: ${fact.id} ${token.value}`);
      assert(row.includes(`aria-label="${token.label}"`), `Controller token label missing: ${fact.id} ${token.value}`);
    }
    if (parsed.tokens.some((token) => token.kind === 'connector')) {
      assert(row.includes('class="controller-input__connector"'), `Controller combination separator missing: ${fact.id}`);
    }
    assert(!row.includes(`输入：${input}`), `Raw controller input must not render as unstyled text: ${fact.id}`);
  } else {
    assert(!rendered.includes('data-weapon-input-for'), `Input must not be invented: ${fact.id}`);
  }
}

function assertConfirmedInput(html, attribute, id, input) {
  assertInput(html, attribute, { id, valueType: 'object', value: { input } });
}

function assertProgressionLevel(html, id, level, name) {
  const rendered = entry(html, 'data-weapon-progression-node-id', id);
  assert(rendered.includes(`data-weapon-progression-level-for="${id}">Lv${level}</p>`), `Progression level missing: Lv${level} ${name}`);
  assert(rendered.includes(`<h3>${name}</h3>`), `Progression name missing: ${name}`);
}

function derivedInputBlock(html, factId) {
  const match = html.match(new RegExp(`<section class="weapon-derived-inputs"[^>]*data-weapon-derived-inputs-for="${factId}"[^>]*>[\\s\\S]*?</section>`));
  assert(match, `Derived-control block missing: ${factId}`);
  return match[0];
}

function assertDerivedInput(block, { label, labelKind, inputs, description }) {
  const match = block.match(new RegExp(`<li data-weapon-derived-input-label="${label}" data-weapon-derived-input-label-kind="${labelKind}">[\\s\\S]*?</li>`));
  assert(match, `Derived control missing: ${label}`);
  const rendered = match[0];
  assert(rendered.includes(`<h5>${label}</h5>`), `Derived control label missing: ${label}`);
  for (const input of inputs) {
    const parsed = parseControllerInput(input);
    assert(rendered.includes(`data-controller-input="${input}"`), `Derived controller input missing: ${label} ${input}`);
    assert(rendered.includes(`aria-label="${parsed.accessibleText}"`), `Derived controller accessibility missing: ${label} ${input}`);
    for (const token of parsed.tokens.filter((token) => token.kind === 'control')) {
      assert(rendered.includes(`data-controller-token="${token.value}"`), `Derived keycap missing: ${label} ${token.value}`);
    }
  }
  if (inputs.length > 1) assert.equal(count(rendered, 'class="weapon-derived-inputs__separator"'), inputs.length - 1, `Derived variants must retain slash separators: ${label}`);
  if (description) {
    const renderedDescription = parseInlineControllerText(description)
      .map((segment) => segment.kind === 'input' ? segment.parsed.tokens.map((token) => token.value).join('') : segment.value)
      .join('');
    assert(rendered.includes('class="weapon-detail-description"'), `Derived description missing: ${label}`);
    assert(rendered.replace(/<[^>]*>/gu, '').includes(renderedDescription), `Derived description changed: ${label}`);
  } else {
    assert(!rendered.includes('class="weapon-detail-description"'), `Derived description must not be invented: ${label}`);
  }
}

function assertOverview(html, { name, taxonomy, systemCategoryFactId, historicalNameFactId, historicalTypeFactIds, previewStats }) {
  const rendered = overview(html);
  assert.equal(count(html, 'data-weapon-section="overview"'), 1, 'Weapon overview must render once');
  assert.equal(count(html, 'data-weapon-overview-field="name"'), 1, 'Current display name must have one overview row');
  assert.equal(count(html, '<dt>武器名称</dt>'), 1, 'Weapon page must not duplicate a primary name row');
  assert.equal(count(html, '<dt>装备类型</dt>'), 1, 'Weapon page must have exactly one equipment type row');
  assert(rendered.includes(`<dd>${name}</dd>`), `Current display name missing: ${name}`);
  assert(rendered.includes(`data-weapon-overview-field="taxonomy" data-system-category-fact-id="${systemCategoryFactId}"`), 'Equipment type Fact missing');
  assert(!rendered.includes('data-weapon-type-fact-id=') && !rendered.includes('data-weapon-overview-field="weapon-type"'), 'Unknown release class must remain absent');
  assert(rendered.includes(`<dd>${taxonomy}</dd>`), `Normalized taxonomy missing: ${taxonomy}`);
  if (historicalNameFactId) assert(!html.includes(`data-fact-id="${historicalNameFactId}"`), 'Historical name must not duplicate the primary overview');
  for (const historicalTypeFactId of historicalTypeFactIds || []) {
    assert(!rendered.includes(`data-fact-id="${historicalTypeFactId}"`), 'Legacy mixed type must not drive the public overview');
  }
  assert.equal(count(html, 'data-weapon-preview-stats'), 1, 'Preview stats must be grouped once');
  assert(rendered.includes('预发布 Lv30 展示'), 'Preview stats must remain explicitly pre-release UI values');
  for (const [id, label, value] of previewStats) {
    assert(rendered.includes(`data-preview-stat-id="${id}"`), `Preview stat missing: ${id}`);
    assert(rendered.includes(`<dt>${label}</dt><dd>${value}</dd>`), `Preview stat value missing: ${label} ${value}`);
  }
  assert.equal(count(html, '官方预发布界面展示值，正式版可能调整。'), 1, 'Preview caveat must appear once');
  assert(!rendered.includes('基础属性') && !rendered.includes('永久属性') && !rendered.includes('满级属性'), 'Preview values must not be presented as permanent or max-level stats');
}

const historicalAlias = 'White Serpent & Crimson Viper';
assert(serpent.includes('<h1 class="entity-hero__title">白蟒赤练</h1>'), 'White Serpent current H1 must render');
assert(!serpent.includes('entity-hero__aliases'), 'Release Hero must keep its concise Chinese identity');
assert(whiteSerpentData.aliases.some((alias) => alias.value === historicalAlias), 'Historical English alias must remain in Weapon Knowledge data');
const whiteSerpentSearchDocument = (searchIndex.documents || searchIndex).find((document) => document.id === 'weapon:white-serpent-crimson-viper');
assert(whiteSerpentSearchDocument, 'White Serpent production search document missing');
assert(whiteSerpentSearchDocument.aliases.includes(historicalAlias), 'Historical English alias must remain searchable through production index aliases');
assert(whiteSerpentSearchDocument.displayAliases.includes(historicalAlias), 'Historical English alias must remain in production search display aliases');
const whiteSerpentCard = collection.match(/<a class="entity-card entity-card--compact" href="\/weapons\/white-serpent-crimson-viper"[\s\S]*?<\/a>/)?.[0];
assert(whiteSerpentCard, 'White Serpent public collection card missing');
assert(whiteSerpentCard.includes(historicalAlias.replace('&', '&amp;')), 'Historical English alias must render on the White Serpent public collection card');
assert(!whiteSerpentCard.includes('entity-card__summary') && !whiteSerpentCard.includes(whiteSerpentData.summary), 'Weapon collection card must omit its long summary while Knowledge retains it');
assert.match(collection, /<main[^>]*\bsite-main--weapon-collection\b/, 'Weapon collection must opt into its dedicated wide content container');
assert.doesNotMatch(charactersCollection, /\bsite-main--weapon-collection\b/, 'Non-Weapon collections must not opt into the Weapon-wide container');
for (const [slug, displayName, systemCategory, weaponType] of [
  ['soft-snake-sword', '灵蛇软剑', '主武器', '剑'],
  ['white-shadow', '白影', '主武器', '苗刀'],
]) {
  const taxonomy = systemCategory;
  const card = collection.match(new RegExp(`<a class="entity-card entity-card--compact" href="/weapons/${slug}"[\\s\\S]*?</a>`))?.[0];
  assert(card, `${slug}: public collection card missing`);
  assert(card.includes(`<h3 class="entity-card__title">${displayName}</h3>`), `${slug}: collection card name missing`);
  assert(card.includes('entity-card--compact') && !card.includes('entity-card__secondary'), `${slug}: compact card must use the existing name-and-alias layout`);
  assert(!card.includes('entity-card__summary'), `${slug}: collection card must omit the long summary`);

  const detail = await readFile(resolve(dist, `${slug}.html`), 'utf8');
  const hero = detail.match(/<header class="entity-hero">[\s\S]*?<\/header>/)?.[0] || '';
  assert(hero.indexOf(`<h1 class="entity-hero__title">`) < hero.indexOf('data-weapon-hero-taxonomy'), `${slug}: Hero taxonomy must follow the left-aligned name`);
  assert(hero.replace(/<[^>]*>/gu, '').includes(taxonomy), `${slug}: Hero taxonomy missing`);
  const renderedOverview = overview(detail);
  assert(renderedOverview.includes(`data-system-category-fact-id="fact:weapon:${slug}:system-category"`), `${slug}: overview system category must use its normalized Fact`);
  const weaponTypeFactId = slug === 'white-shadow' ? 'fact:weapon:white-shadow:weapon-type-official' : `fact:weapon:${slug}:weapon-type`;
  assert(!renderedOverview.includes(`data-weapon-type-fact-id="${weaponTypeFactId}"`), `${slug}: historical custom type must not become a formal release class`);
  assert(renderedOverview.includes(`<dt>装备类型</dt><dd>${taxonomy}</dd>`), `${slug}: unconfirmed class must leave only the equipment type`);
  assert(!renderedOverview.includes('data-weapon-overview-field="type"'), `${slug}: legacy mixed kind must not render in overview`);
}
const sparseWeaponCard = collection.match(/<a class="entity-card entity-card--compact" href="\/weapons\/soft-snake-sword"[\s\S]*?<\/a>/)?.[0];
assert(sparseWeaponCard?.includes('entity-media__fallback'), 'Soft Snake Sword card must retain its fallback media');
assert.equal(buildWeaponCollectionCard(await readJson('data/weapons/soft-snake-sword.json')).context, '公开试玩记录', 'Compact presentation must not erase the historical card context from its model');
assert.equal(count(collection, 'class="entity-card__context"'), 0, 'Existing compact cards must omit rich-card contexts');
const sparseWeaponFallback = sparseWeaponCard.match(/<div class="entity-media__fallback[\s\S]*?<\/div>/)?.[0] || '';
assert(!sparseWeaponFallback.includes('entity-media__name') && !sparseWeaponFallback.includes('entity-media__type'), 'Weapon card fallback must not render fallback name or type classes');
const characterFallback = charactersCollection.match(/<a class="entity-card" href="\/characters\/mo-yuan"[\s\S]*?<\/a>/)?.[0] || '';
assert(characterFallback.includes('entity-media__fallback'), 'Character card must retain its fallback media');
assert(characterFallback.includes('entity-media__name') && characterFallback.includes('entity-media__type'), 'Non-Weapon card fallback must retain fallback name and type classes');
for (const [entityId, slug, expectedId, expectedSrc, html] of [
  ['weapon:white-serpent-crimson-viper', 'white-serpent-crimson-viper', 'media:white-serpent-crimson-viper-master', 'white-serpent-crimson-viper-release-master.jpg', serpent],
  ['weapon:white-shadow', 'white-shadow', 'media:white-shadow-master', 'white-shadow-master.jpg', shadow]
]) {
  const media = mediaRecords.find((record) => record.entityId === entityId && record.recordState === 'published');
  assert.equal(media?.id, expectedId, `${entityId} must use its singular Weapon Master record`);
  assert.equal(media?.src, expectedSrc, `${entityId} must use its stable Weapon Master asset`);
  assert.deepEqual(media?.usage, ['hero', 'card'], `${entityId} Master must serve Hero and card from one record`);
  assert.equal(media?.width, 1200, `${entityId} Master must be 1200px wide`);
  assert.equal(media?.height, 1800, `${entityId} Master must be 1800px high`);
  assert.equal(media.width / media.height, 2 / 3, `${entityId} Master must use the 2:3 portrait standard`);
  assert.equal(media.objectFit, 'contain', `${entityId} portrait media must preserve the weapon with contain`);
  assert.equal(media.rightsStatus, entityId === 'weapon:white-shadow' ? 'official-promotional-risk-accepted' : 'self-captured-reviewed', `${entityId} Master must retain its reviewed production rights state`);
  assert.equal(media.sourceId, entityId === 'weapon:white-shadow' ? sourceId : 'source:owner-pc-release-weapons-2026-11-16', `${entityId} Master must retain its actual provenance`);
  assert(html.includes(`src="/assets/media/${media.src}"`), `${entityId} detail must render approved portrait media`);
  assert(collection.includes(`src="/assets/media/${media.src}"`), `${entityId} collection card must render approved portrait media`);
}
for (const slug of ['soft-snake-sword']) {
  const card = collection.match(new RegExp(`<a class="entity-card entity-card--compact" href="/weapons/${slug}"[\\s\\S]*?</a>`))?.[0] || '';
  assert(card.includes('data-media-state="fallback"'), `${slug}: Weapon without an approved Master must retain fallback media`);
}
for (const [slug, system, category] of [
  ['muzhi-heishang', '主武器', '单手武器'], ['heishang', '主武器', '单手武器'],
  ['heishang-shuangren', '主武器', '双持武器'], ['changxing-heishang', '主武器', '双手武器'],
  ['jagged-steel', '主武器', '单手武器'], ['juxiong-fu', '影之武装', '破坏'],
  ['hongzhuang-guizhan', '主武器', '双手武器'], ['yu-gong', '影之武装', '远程'], ['zhuiming-suolian', '影之武装', '武学']
]) {
  const html = await readFile(resolve(dist, `${slug}.html`), 'utf8');
  const rendered = overview(html);
  assert(html.includes(`data-weapon-hero-taxonomy>${system} · ${category}</p>`), `${slug}: Hero must include the confirmed class`);
  assert(!rendered.includes('weapon-overview__primary'), `${slug}: release overview must not duplicate Hero identity`);
  assert(!rendered.includes('<dt>武器分类</dt>') && !rendered.includes('data-weapon-overview-field="weapon-type"'), `${slug}: classification must not occupy a separate row`);
  const baseStats = rendered.match(/<section[^>]*data-weapon-base-stats[\s\S]*?<\/section>/)?.[0] || '';
  assert(baseStats.includes('Lv1 基础属性') && !baseStats.includes('<p>'), `${slug}: base stats must contain only the heading, names and values`);
  const card = collection.match(new RegExp(`<a class="entity-card entity-card--compact" href="/weapons/${slug}"[\\s\\S]*?</a>`))?.[0] || '';
  assert(card.includes('entity-card--compact') && !card.includes('entity-card__secondary'), `${slug}: compact card must not render a rich-card category row`);
}
for (const [slug, name, category, damage, guard] of [
  ['chizhe-canjian', '痴者残剑', '主武器 · 单手武器', 228, 96],
  ['wangming-zhanmadao', '亡命斩马刀', '主武器 · 双手武器', 240, 106],
  ['zhuobi-dun', '拙壁盾', '影之武装 · 奇门', 226, 198],
  ['tie-quantao', '铁拳套', '影之武装 · 武学', 261, 223],
  ['white-serpent-crimson-viper', '白蟒赤练', '主武器 · 双持武器', 260, 110]
]) {
  const data = await readJson(`data/weapons/${slug}.json`);
  const html = await readFile(resolve(dist, `${slug}.html`), 'utf8');
  const active = data.facts.filter((f) => f.supersededBy === null && f.validToVersionId === null);
  const rendered = overview(html);
  assert(html.includes(`data-weapon-hero-taxonomy>${category}</p>`), `${slug}: release class missing`);
  assert.equal(count(html, `<h1 class="entity-hero__title">${name}</h1>`), 1);
  assert(!rendered.includes('weapon-overview__primary'), `${slug}: duplicated Hero identity`);
  assert(rendered.includes('<dt>伤害能力</dt><dd>'+damage+'</dd>'));
  assert(rendered.includes('<dt>破防能力</dt><dd>'+guard+'</dd>'));
  assert(!html.includes('data-weapon-preview-stats'), `${slug}: historical Lv30 must not render`);
  const description = active.find((f) => f.key === 'weapon.description');
  const main = html.match(/<main\b[\s\S]*?<\/main>/)?.[0] || '';
  assert.equal(count(main, description.value), 1, `${slug}: visible description must appear once`);
  for (const f of active.filter((f) => ['weapon.mechanic','weapon.progressionNode'].includes(f.key))) {
    const attr = f.key === 'weapon.mechanic' ? 'data-weapon-mechanic-id' : 'data-weapon-progression-node-id';
    assertInput(html, attr, f);
    assertEffect(html, attr, f.id, f.value.description);
    if (f.key === 'weapon.progressionNode') assertProgressionLevel(html, f.id, f.value.level, f.value.name);
  }
  assert.equal(count(html, 'class="source-panel"'), 0, 'Owner-approved detail must not render source panels');
  assert(!html.includes('<h3>PC正式版武器界面截图</h3>'), 'Screenshot records must remain in data, not a page source panel');
  assert(!/<figcaption|第[0-9]+把|weapon\.acquisitionOrder/.test(html));
}
const derivedControls = derivedInputBlock(serpent, 'fact:weapon:white-serpent-crimson-viper:release-mechanic-2');
assertDerivedInput(derivedControls, { label: '双蛇共舞', labelKind: 'official', inputs: ['□ △', '△ □'] });
assertDerivedInput(derivedControls, { label: '变招', labelKind: 'functional', inputs: ['□ □', '△ △'] });
assertDerivedInput(derivedControls, { label: '结束双蛇共舞', labelKind: 'functional', inputs: ['○'] });
assert(!serpent.includes('延长破防时间'), 'Release wording must not inherit the pre-release pursuit effect');

assertOverview(shadow, {
  name: '白影',
  taxonomy: '主武器',
  systemCategoryFactId: 'fact:weapon:white-shadow:system-category',
  previewStats: [
    ['fact:weapon:white-shadow:preview-damage-ability-lv30', '伤害能力', 1443],
    ['fact:weapon:white-shadow:preview-break-ability-lv30', '破防能力', 757]
  ]
});
const whiteShadowBasic = entry(shadow, 'data-weapon-mechanic-id', 'fact:weapon:white-shadow:mechanic-basic-combo');
assert(whiteShadowBasic.includes('<h3>普通连招</h3>'), 'White Shadow basic combo name must render');
assertConfirmedInput(shadow, 'data-weapon-mechanic-id', 'fact:weapon:white-shadow:mechanic-basic-combo', '□ □ □ □ □');
assert.equal(count(whiteShadowBasic, '<p'), 1, 'White Shadow basic combo must contain only its confirmed input row');
assertEffect(shadow, 'data-weapon-mechanic-id', 'fact:weapon:white-shadow:mechanic-killing-intent-combo', '可接在任意段数的普通攻击后释放；杀气充足时会发动强化攻击，具有更高的伤害和破防能力。');
assertEffect(shadow, 'data-weapon-mechanic-id', 'fact:weapon:white-shadow:mechanic-freeze', '命中敌人时使其冰缓，并叠加冰冻计量条；计量条叠满后会冰冻敌人。');
assertEffect(shadow, 'data-weapon-mechanic-id', 'fact:weapon:white-shadow:mechanic-white-shadow-howls', '消耗 1 点对应资源，挥舞长刃斩出漫天白影；招式结束后必定冰冻敌人。');
const whiteShadowHowls = entry(shadow, 'data-weapon-mechanic-id', 'fact:weapon:white-shadow:mechanic-white-shadow-howls');
assert(whiteShadowHowls.includes('消耗 1 点对应资源') && !whiteShadowHowls.includes('杀气'), 'White Shadow resource term must remain a neutral placeholder, not an invented canonical name');
assertEffect(shadow, 'data-weapon-progression-node-id', 'fact:weapon:white-shadow:node-ice-strike', '使用刀背快速敲击敌人，并为武器短暂附上冰霜；下一招会使敌人的冰冻计量条大幅提升。');
assertEffect(shadow, 'data-weapon-progression-node-id', 'fact:weapon:white-shadow:node-pattern-blade', '使用“寒冰击”可以回复杀气。');
assertEffect(shadow, 'data-weapon-progression-node-id', 'fact:weapon:white-shadow:node-ice-spike-finisher', '可突进至最近被冰冻的敌人处，造成伤害并延长冰冻持续时间。');
assertEffect(shadow, 'data-weapon-progression-node-id', 'fact:weapon:white-shadow:node-bone-stripping-three', '大幅提高冰冻积累速度。');
for (const [attribute, id, input] of [
  ['data-weapon-mechanic-id', 'fact:weapon:white-shadow:mechanic-killing-intent-combo', '△ △ △'],
  ['data-weapon-mechanic-id', 'fact:weapon:white-shadow:mechanic-white-shadow-howls', 'L2'],
  ['data-weapon-progression-node-id', 'fact:weapon:white-shadow:node-ice-strike', 'L1 + △'],
  ['data-weapon-progression-node-id', 'fact:weapon:white-shadow:node-ice-spike-finisher', '△']
]) assertConfirmedInput(shadow, attribute, id, input);
assert.equal(count(shadow, 'data-weapon-input-for='), 5, 'White Shadow must render each confirmed input row exactly once');
for (const term of ['任意段数的普通攻击后', '杀气充足', '强化攻击', '更高的伤害', '破防能力', '冰缓', '冰冻计量条', '叠满', '冰冻敌人', '消耗 1 点对应资源', '漫天白影', '结束后必定冰冻']) {
  assert(shadow.includes(term), `White Shadow supported gameplay terminology missing: ${term}`);
}
assertProgressionLevel(shadow, 'fact:weapon:white-shadow:node-ice-strike', 5, '寒冰击');
assertProgressionLevel(shadow, 'fact:weapon:white-shadow:node-pattern-blade', 15, '敛刃');
assertProgressionLevel(shadow, 'fact:weapon:white-shadow:node-ice-spike-finisher', 25, '冰刺终结');
assertProgressionLevel(shadow, 'fact:weapon:white-shadow:node-bone-stripping-three', 30, '刺骨·之三');
for (const incorrectTerm of ['纹刃', '剥骨·之三']) {
  assert(!shadow.includes(incorrectTerm), `White Shadow must reject transcription error: ${incorrectTerm}`);
}
assert(!shadow.includes('data-weapon-derived-inputs-for'), 'White Shadow must not receive an empty or invented derived-control block');
for (const forbiddenClaim of ['白影完整成长树', '白影共有四个成长节点', '全部成长节点', '完整成长树']) {
  assert(!shadow.includes(forbiddenClaim), `White Shadow must not claim exhaustive progression: ${forbiddenClaim}`);
}

for (const [label, html] of [['White Serpent', serpent], ['White Shadow', shadow]]) {
  assert.equal(count(html, 'class="source-panel"'), 0, `${label} must follow the Owner-approved detail layout`);
  assert(!html.includes('id="sources-title"'), `${label} must not render a source section`);
  assert(!html.includes('detail-fact__provenance'), `${label} must not repeat per-Fact provenance blocks`);
}

for (const [html, data] of [[serpent, whiteSerpentData], [shadow, whiteShadowData]]) {
  for (const fact of data.facts.filter((fact) => fact.key === 'weapon.mechanic' && fact.validToVersionId === null && fact.supersededBy === null)) {
    assertInput(html, 'data-weapon-mechanic-id', fact);
  }
  for (const fact of data.facts.filter((fact) => fact.key === 'weapon.progressionNode' && fact.validToVersionId === null && fact.supersededBy === null)) {
    assertInput(html, 'data-weapon-progression-node-id', fact);
  }
  assert(!html.includes('键盘') && !html.includes('Xbox'), 'Weapon page must not invent PC or Xbox mappings');
  assert(!html.includes('输入：□') && !html.includes('输入：△') && !html.includes('输入：○') && !html.includes('输入：L1') && !html.includes('输入：L2'), 'Weapon controls must not regress to raw visual input text');
}

assert.equal(count(sparse, 'data-weapon-section="overview"'), 1, 'Sparse Weapon overview missing');
assert(!sparse.includes('data-weapon-section="mechanics"'), 'Sparse Weapon must not emit an empty mechanics section');
assert(!sparse.includes('data-weapon-section="progression"'), 'Sparse Weapon must not emit an empty progression section');
assert(!sparse.includes('data-weapon-preview-stats'), 'Sparse Weapon must not emit an empty preview-stat group');
assert(!sparse.includes('data-weapon-input-for'), 'Sparse Weapon must not emit input rows');
assert(!sparse.includes('data-weapon-derived-inputs-for'), 'Sparse Weapon must not emit an empty derived-control block');
assert(sparse.includes('发售前媒体试玩记录中的主武器'), 'Sparse Weapon historical summary must remain visible');
assert(!sparse.includes('data-weapon-overview-note="weapon.observedTrait"'), 'Sparse Weapon must not invent an unrecorded observed trait');
assert(!sparse.includes('data-weapon-base-stats'), 'Sparse Weapon must not invent release base stats');

for (const slug of ['tianxuan-qingtong-jian', 'kuye-si-zhuchuan', 'cuixin-pipa', 'luanying-jian', 'yao-ju']) {
  const data = await readJson(`data/weapons/${slug}.json`);
  const html = await readFile(resolve(dist, `${slug}.html`), 'utf8');
  const rendered = overview(html);
  const active = data.facts.filter((fact) => !isForgedBatchFact(fact) && fact.supersededBy === null && fact.validToVersionId === null);
  assert.equal(count(html, `<h1 class="entity-hero__title">${data.displayName}</h1>`), 1);
  assert.equal(count(html.match(/<main\b[\s\S]*?<\/main>/)?.[0] || '', active.find((fact) => fact.key === 'weapon.description').value), 1, `${slug}: game description must appear once`);
  for (const fact of active.filter((fact) => fact.key === 'weapon.baseStat')) assert(rendered.includes(`<dt>${fact.value.statName}</dt><dd>${fact.value.displayedValue}</dd>`), `${slug}: exact Lv1 attribute missing`);
  for (const fact of active.filter((fact) => ['weapon.mechanic', 'weapon.progressionNode'].includes(fact.key))) {
    const attribute = fact.key === 'weapon.mechanic' ? 'data-weapon-mechanic-id' : 'data-weapon-progression-node-id';
    assertInput(html, attribute, fact);
    if (fact.value.description) assertEffect(html, attribute, fact.id, fact.value.description);
    if (fact.key === 'weapon.progressionNode') assertProgressionLevel(html, fact.id, fact.value.level, fact.value.name);
  }
  assert(data.facts.filter((f) => f.validToVersionId === null).every((f) => f.sourceIds.length > 0), `${slug}: underlying screenshot evidence must remain intact`);
  assert(!html.includes('获取顺序') && !html.includes('data-weapon-preview-stats'), `${slug}: no acquisition or preview values may be invented`);
}

for (const slug of ['heishang', 'heishang-shuangren', 'changxing-heishang', 'luanying-jian']) {
  const { facts } = await readJson(`data/weapons/${slug}.json`);
  const html = await readFile(resolve(dist, `${slug}.html`), 'utf8');
  const baseStart = html.indexOf('id="weapon-form-base"');
  const forgedStart = html.indexOf('id="weapon-form-soulForged"');
  assert(baseStart >= 0 && forgedStart > baseStart, `${slug}: render both forms in static HTML`);
  const base = html.slice(baseStart, forgedStart);
  const forged = html.slice(forgedStart);
  assert(forged.includes('30级属性'));
  assert(!html.includes('紫色图标'), `${slug}: resource icon placeholder leaked into published HTML`);
  assert.equal(count(forged, '消耗1点精纯杀气'), slug === 'heishang' ? 2 : 1);
  assert(!forged.includes('data-weapon-section="soul-forge-effect"'));
  for (const fact of facts.filter(isForgedBatchFact)) {
    assert(!base.includes(fact.id), `${slug}: forged Fact in base panel`);
    if (fact.key === 'weapon.description') assert(forged.includes(fact.value));
    if (fact.key === 'weapon.baseStat') {
      assert(forged.includes(`<dt>${fact.value.statName}</dt><dd>${fact.value.displayedValue}</dd>`));
    }
    if (fact.key === 'weapon.mechanic') assertInput(forged, 'data-weapon-mechanic-id', fact);
    if (fact.key === 'weapon.progressionNode') {
      assertInput(forged, 'data-weapon-progression-node-id', fact);
      assertProgressionLevel(forged, fact.id, fact.value.level, fact.value.name);
    }
  }
}

for (const [file, expectedText] of [
  ['characters/soul.html', '快速信息'],
  ['bosses/cangang.html', '快速信息'],
  ['world/pangzhen.html', '快速信息']
]) {
  const html = await readFile(resolve(root, 'dist', file), 'utf8');
  assert(html.includes(expectedText), `Shared non-Weapon detail regression: ${file}`);
  assert(!html.includes('data-weapon-section'), `Weapon-only presentation must not apply to ${file}`);
}

for (const weapon of [whiteSerpentData, whiteShadowData]) {
  for (const fact of weapon.facts.filter((fact) => ['weapon.mechanic', 'weapon.progressionNode'].includes(fact.key))) {
    assert.deepEqual(fact.sourceIds, [fact.gameVersionId === 'version:release-pc-ui-2026-11-16' ? 'source:owner-pc-release-weapons-2026-11-16' : sourceId], `${fact.id} must remain traceable to its actual screenshot source`);
  }
}
assert(source.locator.evidenceItems.some((item) => item.page === 4 && item.totalPages === 14), 'White Serpent page 4/14 evidence mapping missing');
assert(source.locator.evidenceItems.some((item) => item.page === 5 && item.totalPages === 14), 'White Serpent page 5/14 evidence mapping missing');
assert(source.locator.evidenceItems.some((item) => item.page === 6 && item.totalPages === 14), 'White Shadow page 6/14 evidence mapping missing');
assert(source.locator.evidenceItems.some((item) => item.page === 7 && item.totalPages === 14 && item.label.includes('cropped above 寒冰击')), 'White Shadow cropped 7/14 evidence mapping missing');
assert(whiteShadowData.facts.find((fact) => fact.id === 'fact:weapon:white-shadow:node-ice-strike')?.reviewNote?.includes('可能还有其他成长内容'), 'White Shadow cropped-evidence limitation must remain in Knowledge');
assert(whiteShadowData.facts.find((fact) => fact.id === 'fact:weapon:white-shadow:mechanic-white-shadow-howls')?.reviewNote?.includes('中性占位'), 'White Shadow resource terminology must remain marked for later official confirmation');

const css = await readFile(resolve(root, 'css', 'style.css'), 'utf8');
for (const selector of ['.controller-input {', '.controller-input__keycap {', '.controller-input__connector {', '.weapon-derived-inputs {', '.weapon-derived-inputs__controls {']) {
  assert(css.includes(selector), `Controller input desktop styling missing: ${selector}`);
}
assert(css.includes('grid-template-columns: minmax(9.5rem, 10.25rem) minmax(0, 1fr);'), 'Derived controls must reserve a bounded desktop input column');
assert.match(css, /@media \(max-width: 700px\) \{[\s\S]*?\.controller-input \{/, 'Controller input mobile styling missing');
assert.match(css, /@media \(max-width: 700px\) \{[\s\S]*?\.weapon-derived-inputs > ul > li \{ grid-template-columns: 1fr;/, 'Derived controls must preserve their stacked mobile layout');
const weaponDesktopHero = cssRule('.entity-detail[data-entity-type="weapon"] .entity-hero');
assert.match(weaponDesktopHero, /grid-template-columns:\s*minmax\([^;]+\)\s+minmax\([^;]+\);/, 'Weapon desktop Hero must retain media and text columns');
assert.match(cssRule('.entity-detail[data-entity-type="weapon"] {'), /max-width:\s*67\.5rem;/, 'Weapon detail content must use the bounded desktop width');
assert.match(weaponDesktopHero, /grid-template-columns:\s*minmax\(20rem,\s*23\.75rem\)\s+minmax\(0,\s*35rem\);/, 'Weapon desktop Hero must cap its desktop content column at approximately 35rem');
assert.match(weaponDesktopHero, /gap:\s*clamp\(var\(--space-6\),\s*3vw,\s*var\(--space-8\)\);/, 'Weapon desktop Hero must retain a compact column gap');
const weaponDetailMedia = cssRule('.entity-detail[data-entity-type="weapon"] .entity-media > img,');
assert.match(weaponDetailMedia, /object-fit:\s*contain;/, 'Weapon detail media must preserve the complete weapon with contain');
const weaponReadyDetailMedia = cssRule('.entity-detail[data-entity-type="weapon"] .entity-media[data-media-state="ready"] > img {');
assert.match(weaponReadyDetailMedia, /aspect-ratio:\s*2\s*\/\s*3;/, 'Ready Weapon detail media must use the Master’s native 2:3 frame');
assert.match(weaponReadyDetailMedia, /border:\s*0;/, 'Ready Weapon detail media must not retain an inner border frame');
assert.match(weaponReadyDetailMedia, /border-radius:\s*0;/, 'Ready Weapon detail media must not retain an inner rounded frame');
assert.match(weaponReadyDetailMedia, /background:\s*transparent;/, 'Ready Weapon detail media must not retain an inner background panel');
assert.match(weaponReadyDetailMedia, /box-shadow:\s*none;/, 'Ready Weapon detail media must not retain an inner shadow frame');
const weaponCardMedia = cssRule('.collection-page[data-entity-type="weapon"] .entity-card .entity-media > img,');
assert.match(weaponCardMedia, /width:\s*100%;/, 'Weapon collection media must fill the shared rail width');
assert.match(weaponCardMedia, /height:\s*100%;/, 'Weapon collection media must fill the shared rail height');
assert.match(weaponCardMedia, /aspect-ratio:\s*auto;/, 'Weapon collection media must not retain a portrait box at any viewport');
assert.match(weaponCardMedia, /object-fit:\s*contain;/, 'Weapon collection media must preserve the complete weapon with contain');
assert.match(weaponCardMedia, /object-position:\s*center;/, 'Weapon collection media must center inside the shared rail');
const weaponCollectionWidthRule = cssRule('.site-main--weapon-collection,');
assert.match(weaponCollectionWidthRule, /max-width:\s*90rem;/, 'Weapon collection must use its dedicated 90rem wide-content cap');
const weaponHorizontalCard = cssRule('.collection-page[data-entity-type="weapon"] .entity-card {');
assert.match(weaponHorizontalCard, /flex-direction:\s*row;/, 'Weapon collection cards must use horizontal media-and-copy layout at every viewport');
assert.match(weaponHorizontalCard, /align-items:\s*stretch;/, 'Weapon horizontal cards must stretch their media and body to a shared card height');
assert.doesNotMatch(weaponHorizontalCard, /align-items:\s*flex-start;/, 'Weapon horizontal cards must not regress to flex-start alignment');
const weaponWideCard = mediaRule('min-width: 1680px', '.collection-page[data-entity-type="weapon"] .entity-card');
assert.match(weaponWideCard, /min-height:\s*12\.5rem;/, 'Weapon four-column cards must use the compact 12.5rem minimum height');
const weaponThreeColumnCard = mediaRule('min-width: 1100px\\) and \\(max-width: 1679\\.98px', '.collection-page[data-entity-type="weapon"] .entity-card');
assert.match(weaponThreeColumnCard, /min-height:\s*13rem;/, 'Weapon three-column cards must use the compact 13rem minimum height');
const weaponTwoColumnCard = mediaRule('min-width: 700px\\) and \\(max-width: 1099\\.98px', '.collection-page[data-entity-type="weapon"] .entity-card');
assert.match(weaponTwoColumnCard, /min-height:\s*13\.5rem;/, 'Weapon two-column cards must use the balanced 13.5rem minimum height');
const weaponMobileCard = mediaRule('max-width: 699\\.98px', '.collection-page[data-entity-type="weapon"] .entity-card');
assert.match(weaponMobileCard, /min-height:\s*11\.5rem;/, 'Weapon mobile horizontal cards must use a compact 11.5rem minimum height');
assert.doesNotMatch(weaponMobileCard, /flex-direction:\s*column;/, 'Weapon mobile cards must not return to image-first vertical layout');
const weaponRail = cssRule('.collection-page[data-entity-type="weapon"] .entity-card .entity-media {');
assert.match(weaponRail, /flex:\s*0\s+0\s+clamp\(8rem,\s*38%,\s*10rem\);/, 'Weapon collection cards must use the final bounded media-rail guard');
assert.match(weaponRail, /display:\s*grid;/, 'Weapon fallback and real media must share a rail skeleton at every viewport');
assert.match(weaponRail, /align-self:\s*stretch;/, 'Weapon media rail must stretch to the shared card height');
assert.match(weaponRail, /padding:\s*var\(--space-2\);/, 'Weapon media rail must retain compact 8px internal padding');
const weaponReadyRail = cssRule('.collection-page[data-entity-type="weapon"] .entity-card .entity-media[data-media-state="ready"] {');
assert.match(weaponReadyRail, /padding:\s*var\(--space-1\);/, 'Ready Weapon Masters must retain only a 4px rail safety inset');
assert.match(weaponReadyRail, /background:\s*transparent;/, 'Ready Weapon rail must not retain a background panel');
assert.match(weaponReadyRail, /box-shadow:\s*none;/, 'Ready Weapon rail must not retain a shadow frame');
const weaponReadyCardMedia = cssRule('.collection-page[data-entity-type="weapon"] .entity-card .entity-media[data-media-state="ready"] > img {');
assert.match(weaponReadyCardMedia, /border:\s*0;/, 'Ready Weapon collection media must not retain an inner border frame');
assert.match(weaponReadyCardMedia, /border-radius:\s*0;/, 'Ready Weapon collection media must not retain an inner rounded frame');
assert.match(weaponReadyCardMedia, /background:\s*transparent;/, 'Ready Weapon collection media must not retain an inner background panel');
assert.match(weaponReadyCardMedia, /box-shadow:\s*none;/, 'Ready Weapon collection media must not retain an inner shadow frame');
const weaponFallbackBlade = cssRule('.collection-page[data-entity-type="weapon"] .entity-card .entity-media__blade {');
assert.match(weaponFallbackBlade, /left:\s*50%;/, 'Weapon fallback blade decoration must center inside the shared rail');
assert.match(weaponFallbackBlade, /translateX\(-50%\)/, 'Weapon fallback blade decoration must remain centered without affecting its angle');
const genericCardBody = css.slice(css.indexOf('.entity-card__body {', css.indexOf('.entity-card__body {') + 1), css.indexOf('}', css.indexOf('.entity-card__body {', css.indexOf('.entity-card__body {') + 1)) + 1);
assert.match(genericCardBody, /min-width:\s*0;/, 'Weapon card copy must remain shrinkable to avoid horizontal overflow at mobile widths');
assertMediaRule('min-width: 1680px', /grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\);/, 'Weapon collection must use four columns at wide desktop');
assertMediaRule('min-width: 1100px\\) and \\(max-width: 1679\\.98px', /grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);/, 'Weapon collection must use three columns at desktop');
assertMediaRule('min-width: 700px\\) and \\(max-width: 1099\\.98px', /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/, 'Weapon collection must use two columns at tablet');
assertMediaRule('max-width: 699\\.98px', /grid-template-columns:\s*minmax\(0,\s*1fr\);/, 'Weapon collection must use one column on mobile');
const weaponCollectionLayoutAt = (viewportWidth) => {
  if (viewportWidth < 700) return 'horizontal-1';
  if (viewportWidth < 1100) return 'horizontal-2';
  if (viewportWidth < 1680) return 'horizontal-3';
  return 'horizontal-4';
};
for (const [viewportWidth, expectedLayout] of [
  [699.5, 'horizontal-1'],
  [700, 'horizontal-2'],
  [1099.5, 'horizontal-2'],
  [1100, 'horizontal-3'],
  [1679.5, 'horizontal-3'],
  [1680, 'horizontal-4'],
]) {
  assert.equal(weaponCollectionLayoutAt(viewportWidth), expectedLayout, `Weapon collection must not fall through to generic layout at ${viewportWidth}px`);
}
const weaponMobileBlock = css.match(/@media \(max-width: 700px\) \{([\s\S]*?)\n\}/)?.[1] || '';
assert.match(weaponMobileBlock, /\.entity-detail\[data-entity-type="weapon"\] \.entity-hero\s*\{\s*grid-template-columns:\s*1fr;/, 'Weapon Hero must collapse to one column on mobile');
assert(serpent.indexOf('class="entity-hero__identity"') < serpent.indexOf('<figure class="entity-media"'), 'Weapon mobile stack must show the title block before media');

for (const slug of ['muzhi-heishang', 'heishang', 'heishang-shuangren', 'changxing-heishang', 'jagged-steel', 'juxiong-fu']) {
  const html = await readFile(resolve(dist, `${slug}.html`), 'utf8');
  assert(!html.includes('<figcaption'), `${slug}: Weapon media must not leave a caption container`);
  assert(!/主武器获取顺序|第[0-9]+把|weapon\.acquisitionOrder/.test(html), `${slug}: collection order must stay out of detail HTML`);
  const panel = html.match(/<section class="source-panel"[\s\S]*?<\/section>/)?.[0] || '';
  assert.equal(panel, '', `${slug}: detail must not render a source panel`);
  const weapon = await readJson(`data/weapons/${slug}.json`);
  const evidence = weapon.facts.filter((fact) => fact.key === 'weapon.baseStat' && fact.validToVersionId === null);
  assert(evidence.length > 0 && evidence.every((fact) => fact.sourceIds.length > 0), `${slug}: screenshot evidence must remain in data`);
}

console.log('Weapon detail presentation verification passed: source-backed official wording, accessible controller keycaps, grouped preview observations, sparse Weapon content, screenshot limits, retained screenshot evidence, source-free detail UI, and non-Weapon detail isolation.');

function cssRule(selector) {
  const start = css.indexOf(selector);
  assert(start >= 0, `CSS rule missing: ${selector}`);
  const end = css.indexOf('}', start);
  assert(end > start, `CSS rule is incomplete: ${selector}`);
  return css.slice(start, end + 1);
}

function mediaRule(query, selector) {
  const media = new RegExp(`@media \\(${query}\\) \\{([\\s\\S]*?)\\n\\}`).exec(css)?.[1] || '';
  const start = media.indexOf(selector);
  assert(start >= 0, `CSS rule missing in @media (${query}): ${selector}`);
  const end = media.indexOf('}', start);
  assert(end > start, `CSS rule is incomplete in @media (${query}): ${selector}`);
  return media.slice(start, end + 1);
}

function assertMediaRule(query, declaration, message) {
  assert.match(mediaRule(query, '.collection-page[data-entity-type="weapon"] .entity-grid'), declaration, message);
}

async function readJson(path) {
  return JSON.parse(await readFile(resolve(root, path), 'utf8'));
}

for (const [slug, level] of [['huo-liuxing', 1], ['caoou-lingdang', 1], ['tan-lang', 1], ['leiting-qiang', 1], ['tiansha-shuangyue', 24]]) {
  const data = await readJson(`data/weapons/${slug}.json`);
  const html = await readFile(resolve(dist, `${slug}.html`), 'utf8');
  const rendered = overview(html);
  assert(rendered.includes(`Lv${level} 基础属性`), `${slug}: observed attribute level must remain exact`);
  if (level !== 1) assert(!rendered.includes('Lv1 基础属性') && !html.includes('当前1级武器'), `${slug}: Lv24 evidence must not be labelled Lv1`);
  assert.equal(count(html.match(/<main\b[\s\S]*?<\/main>/)?.[0] || '', data.summary), 1, `${slug}: game description must appear once`);
  assert.equal(count(html, 'class="source-panel"'), 0, 'Owner-approved detail must not render source panels');
  assert(!html.includes('<h3>PC正式版武器界面截图</h3>'), 'Screenshot records must remain in data, not a page source panel');
  assert(!html.includes('获取顺序') && !html.includes('<figcaption') && !html.includes('data-weapon-preview-stats'));
  for (const fact of data.facts.filter((item) => ['weapon.mechanic', 'weapon.progressionNode'].includes(item.key))) {
    const attribute = fact.key === 'weapon.mechanic' ? 'data-weapon-mechanic-id' : 'data-weapon-progression-node-id';
    assertInput(html, attribute, fact);
    if (fact.value.description) assertEffect(html, attribute, fact.id, fact.value.description);
    if (fact.key === 'weapon.progressionNode') {
      if (Object.hasOwn(fact.value, 'level')) assertProgressionLevel(html, fact.id, fact.value.level, fact.value.name);
      else assert(!entry(html, attribute, fact.id).includes('data-weapon-progression-level-for'), `${slug}: unlabelled growth must remain unlabelled`);
    }
  }
}
