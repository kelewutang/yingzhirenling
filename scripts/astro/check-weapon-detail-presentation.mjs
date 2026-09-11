import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseControllerInput, parseInlineControllerText } from '../../src/lib/controller-inputs.mjs';

const root = resolve(process.cwd());
const dist = resolve(root, 'dist', 'weapons');
const sourceId = 'source:official-douyin-2026-09-09-gameplay-article';
const [serpent, shadow, sparse, whiteSerpentData, whiteShadowData, source, searchIndex] = await Promise.all([
  readFile(resolve(dist, 'white-serpent-crimson-viper.html'), 'utf8'),
  readFile(resolve(dist, 'white-shadow.html'), 'utf8'),
  readFile(resolve(dist, 'tang-hengdao.html'), 'utf8'),
  readJson('data/weapons/white-serpent-crimson-viper.json'),
  readJson('data/weapons/white-shadow.json'),
  readJson('data/sources/official-douyin-2026-09-09-gameplay-article.json'),
  readJson('generated/search-index.production.json')
]);
const count = (html, value) => html.split(value).length - 1;

function overview(html) {
  const start = html.indexOf('data-weapon-section="overview"');
  const end = html.indexOf('data-weapon-section="mechanics"');
  assert(start >= 0 && end > start, 'Weapon overview must precede mechanics');
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

function assertOverview(html, { name, type, typeFactId, historicalNameFactId, historicalTypeFactId, previewStats }) {
  const rendered = overview(html);
  assert.equal(count(html, 'data-weapon-section="overview"'), 1, 'Weapon overview must render once');
  assert.equal(count(html, 'data-weapon-overview-field="name"'), 1, 'Current display name must have one overview row');
  assert.equal(count(html, '<dt>武器名称</dt>'), 1, 'Weapon page must not duplicate a primary name row');
  assert.equal(count(html, '<dt>武器类型</dt>'), 1, 'Weapon page must not duplicate a primary type row');
  assert(rendered.includes(`<dd>${name}</dd>`), `Current display name missing: ${name}`);
  assert(rendered.includes(`data-weapon-overview-field="type" data-fact-id="${typeFactId}"`), 'Preferred type Fact missing');
  assert(rendered.includes(`<dd>${type}</dd>`), `Preferred type missing: ${type}`);
  if (historicalNameFactId) assert(!html.includes(`data-fact-id="${historicalNameFactId}"`), 'Historical name must not duplicate the primary overview');
  if (historicalTypeFactId) assert(!html.includes(`data-fact-id="${historicalTypeFactId}"`), 'Historical type must not duplicate the primary overview');
  assert.equal(count(html, 'data-weapon-preview-stats'), 1, 'Preview stats must be grouped once');
  assert(rendered.includes('预发布 Lv30 展示'), 'Preview stats must remain explicitly pre-release UI values');
  for (const [id, label, value] of previewStats) {
    assert(rendered.includes(`data-preview-stat-id="${id}"`), `Preview stat missing: ${id}`);
    assert(rendered.includes(`<dt>${label}</dt><dd>${value}</dd>`), `Preview stat value missing: ${label} ${value}`);
  }
  assert.equal(count(html, '官方预发布界面展示值，正式版可能调整。'), 1, 'Preview caveat must appear once');
  assert(!rendered.includes('基础属性') && !rendered.includes('永久属性') && !rendered.includes('满级属性'), 'Preview values must not be presented as permanent or max-level stats');
}

assertOverview(serpent, {
  name: '白蟒赤练',
  type: '双持武器',
  typeFactId: 'fact:weapon:white-serpent-crimson-viper:kind-dual-wield',
  historicalNameFactId: 'fact:weapon:white-serpent-crimson-viper:name',
  historicalTypeFactId: 'fact:weapon:white-serpent-crimson-viper:kind',
  previewStats: [
    ['fact:weapon:white-serpent-crimson-viper:preview-damage-ability-lv30', '伤害能力', 1217],
    ['fact:weapon:white-serpent-crimson-viper:preview-break-ability-lv30', '破防能力', 640]
  ]
});
const historicalAlias = 'White Serpent & Crimson Viper';
assert(serpent.includes('<h1 class="entity-hero__title">白蟒赤练</h1>'), 'White Serpent current H1 must render');
assert(!serpent.includes(historicalAlias) && !serpent.includes(historicalAlias.replace('&', '&amp;')), 'Historical English alias must not render on the public Weapon page');
assert(whiteSerpentData.aliases.some((alias) => alias.value === historicalAlias), 'Historical English alias must remain in Weapon Knowledge data');
const whiteSerpentSearchDocument = (searchIndex.documents || searchIndex).find((document) => document.id === 'weapon:white-serpent-crimson-viper');
assert(whiteSerpentSearchDocument, 'White Serpent production search document missing');
assert(whiteSerpentSearchDocument.aliases.includes(historicalAlias), 'Historical English alias must remain searchable through production index aliases');
assert(whiteSerpentSearchDocument.displayAliases.includes(historicalAlias), 'Historical English alias must remain in production search display aliases');
assertEffect(serpent, 'data-weapon-mechanic-id', 'fact:weapon:white-serpent-crimson-viper:mechanic-basic-combo', '使用赤练短刃进行凌厉攻击。');
assertEffect(serpent, 'data-weapon-mechanic-id', 'fact:weapon:white-serpent-crimson-viper:mechanic-killing-intent-combo', '使用白蟒长刃进行斩击；交替点按可循环连招并进入“双蛇共舞”状态，期间伤害不断提升，可穿插变招，也可掷出赤练短刃结束“双蛇共舞”。');
assertEffect(serpent, 'data-weapon-mechanic-id', 'fact:weapon:white-serpent-crimson-viper:mechanic-crimson-viper-surround', '让赤练短刃围绕自身持续旋转；旋转期间持续消耗杀气，杀气不足时会强制回收，也可再次按下 L1 + △ 主动回收。');
assertEffect(serpent, 'data-weapon-mechanic-id', 'fact:weapon:white-serpent-crimson-viper:mechanic-ranged-execution', '当远距离敌人残血时，可进行处决。');
assertEffect(serpent, 'data-weapon-progression-node-id', 'fact:weapon:white-serpent-crimson-viper:node-crimson-viper-pursuit', '掷出赤练短刃时会标记敌人，提高其受到的伤害和杀气削减；若目标处于破防状态，标记还会延长破防时间。短刃脱手期间持续消耗杀气，杀气不足时强制回收，也可再次按下 L1 + △ 回收脱手的赤练短刃。');
assertEffect(serpent, 'data-weapon-progression-node-id', 'fact:weapon:white-serpent-crimson-viper:node-phantom-crimson-viper', '通过“赤练环身”或“赤练追魂”扔出赤练短刃后，手中会幻化出另一把赤练短刃，可继续使用“双蛇共舞”和赤练普通连招。');
assertEffect(serpent, 'data-weapon-progression-node-id', 'fact:weapon:white-serpent-crimson-viper:node-hold-tight', '通过“赤练环身”或“赤练追魂”扔出的赤练短刃，在切换武器后仍会继续存在。');
const killingIntentFactId = 'fact:weapon:white-serpent-crimson-viper:mechanic-killing-intent-combo';
const derivedControls = derivedInputBlock(serpent, killingIntentFactId);
assert(derivedControls.includes('>派生按键</h4>'), 'Derived-control block must use the approved player-facing label');
assertDerivedInput(derivedControls, { label: '双蛇共舞', labelKind: 'official', inputs: ['□ △', '△ □'], description: '交替点按可循环连招。' });
assertDerivedInput(derivedControls, { label: '变招', labelKind: 'functional', inputs: ['□ □', '△ △'] });
assertDerivedInput(derivedControls, { label: '结束双蛇共舞', labelKind: 'functional', inputs: ['○'], description: '掷出赤练短刃并结束“双蛇共舞”。' });
for (const [attribute, id, input] of [
  ['data-weapon-mechanic-id', 'fact:weapon:white-serpent-crimson-viper:mechanic-basic-combo', '□ □ □'],
  ['data-weapon-mechanic-id', 'fact:weapon:white-serpent-crimson-viper:mechanic-killing-intent-combo', '△ △'],
  ['data-weapon-mechanic-id', 'fact:weapon:white-serpent-crimson-viper:mechanic-crimson-viper-surround', 'L1 + △'],
  ['data-weapon-mechanic-id', 'fact:weapon:white-serpent-crimson-viper:mechanic-ranged-execution', '○'],
  ['data-weapon-progression-node-id', 'fact:weapon:white-serpent-crimson-viper:node-crimson-viper-pursuit', '○']
]) assertConfirmedInput(serpent, attribute, id, input);
assert.equal(count(serpent, 'data-weapon-input-for='), 5, 'White Serpent must render each confirmed input row exactly once');
for (const term of ['赤练短刃', '白蟒长刃', '交替点按', '伤害不断提升', '循环连招', '双蛇共舞', '变招', '结束双蛇共舞', '围绕自身', '持续消耗杀气', '强制回收', '远距离敌人', '残血', '处决']) {
  assert(serpent.includes(term), `White Serpent supported gameplay terminology missing: ${term}`);
}
for (const incorrectTerm of ['赤练短刀', '白蟒长刀', '交替输入', '伤害显著提升', '衍生输入：']) {
  assert(!serpent.includes(incorrectTerm), `White Serpent must reject transcription error: ${incorrectTerm}`);
}
assertProgressionLevel(serpent, 'fact:weapon:white-serpent-crimson-viper:node-crimson-viper-pursuit', 5, '赤练追魂');
assertProgressionLevel(serpent, 'fact:weapon:white-serpent-crimson-viper:node-phantom-crimson-viper', 15, '幻化赤练');
assertProgressionLevel(serpent, 'fact:weapon:white-serpent-crimson-viper:node-hold-tight', 25, '死死咬住');

assertOverview(shadow, {
  name: '白影',
  type: '双手武器',
  typeFactId: 'fact:weapon:white-shadow:kind',
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
  assert.equal(count(html, 'class="source-panel"'), 1, `${label} must have one grouped source panel`);
  assert(html.includes('《难度，武器，玩家》'), `${label} must retain the aggregated screenshot source`);
  assert(!html.includes('detail-fact__provenance'), `${label} must not repeat per-Fact provenance blocks`);
}

for (const [html, data] of [[serpent, whiteSerpentData], [shadow, whiteShadowData]]) {
  for (const fact of data.facts.filter((fact) => fact.key === 'weapon.mechanic')) {
    assertInput(html, 'data-weapon-mechanic-id', fact);
  }
  for (const fact of data.facts.filter((fact) => fact.key === 'weapon.progressionNode')) {
    assertInput(html, 'data-weapon-progression-node-id', fact);
  }
  assert(!html.includes('键盘') && !html.includes('PC') && !html.includes('Xbox'), 'Weapon page must not invent PC or Xbox mappings');
  assert(!html.includes('输入：□') && !html.includes('输入：△') && !html.includes('输入：○') && !html.includes('输入：L1') && !html.includes('输入：L2'), 'Weapon controls must not regress to raw visual input text');
}

assert.equal(count(sparse, 'data-weapon-section="overview"'), 1, 'Sparse Weapon overview missing');
assert(!sparse.includes('data-weapon-section="mechanics"'), 'Sparse Weapon must not emit an empty mechanics section');
assert(!sparse.includes('data-weapon-section="progression"'), 'Sparse Weapon must not emit an empty progression section');
assert(!sparse.includes('data-weapon-preview-stats'), 'Sparse Weapon must not emit an empty preview-stat group');
assert(!sparse.includes('data-weapon-input-for'), 'Sparse Weapon must not emit input rows');
assert(!sparse.includes('data-weapon-derived-inputs-for'), 'Sparse Weapon must not emit an empty derived-control block');
assert(sparse.includes('演示中呈现较均衡的攻防节奏'), 'Sparse Weapon observed trait content must remain visible');
assert(sparse.includes('★★★★☆（4/5）'), 'Sparse Weapon editor-rating content must remain visible');
assert(sparse.includes('获取方式尚待后续官方资料或正式版验证。'), 'Sparse Weapon acquisition content must remain visible');

for (const [file, expectedText] of [
  ['characters/soul.html', '快速信息'],
  ['bosses/commander-cleave.html', '快速信息'],
  ['world/pangzhen.html', '快速信息']
]) {
  const html = await readFile(resolve(root, 'dist', file), 'utf8');
  assert(html.includes(expectedText), `Shared non-Weapon detail regression: ${file}`);
  assert(!html.includes('data-weapon-section'), `Weapon-only presentation must not apply to ${file}`);
}

for (const weapon of [whiteSerpentData, whiteShadowData]) {
  for (const fact of weapon.facts.filter((fact) => ['weapon.mechanic', 'weapon.progressionNode'].includes(fact.key))) {
    assert.deepEqual(fact.sourceIds, [sourceId], `${fact.id} must remain traceable to the official screenshot source`);
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
assert.match(css, /@media \(max-width: 700px\) \{[\s\S]*?\.controller-input \{/, 'Controller input mobile styling missing');

console.log('Weapon detail presentation verification passed: source-backed official wording, accessible controller keycaps, grouped preview observations, sparse Weapon content, screenshot limits, and non-Weapon detail isolation.');

async function readJson(path) {
  return JSON.parse(await readFile(resolve(root, path), 'utf8'));
}
