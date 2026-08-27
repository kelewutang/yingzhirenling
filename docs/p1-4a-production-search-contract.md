# P1-4A Production Search Contract & Publication Gate

> P1-4A.1 后续批准：唐横刀与牙横刀于 `2026-08-27` 首次获准进入生产派生层；青龙掠月刀继续保持 draft。P1-4A.2 将该日期落实为必需的 publication metadata。

## 1. 契约状态与范围

本文件冻结结构化 Entity 进入生产搜索派生层的最低规则。它不修改生产 `js/main.js`、搜索 UI、排序、URL 或页面内容，也不批准任何真实 Weapon 发布。

Production Publication Gate 与 Fact 可信度是两个独立维度：

- `Entity.recordState` 决定该实体是否获准进入生产派生层；
- `Fact.status` 继续分别表达 `official`、`observation`、`third-party`、`editorial`、`pending-review` 等事实状态。

`recordState=published` 只表示“这个实体可以被生产网站展示或检索”，不表示整个 Entity 是官方确认、正式版验证或所有 Fact 均已确认。Search Document 禁止生成实体级 `status=official` 或 `trustLevel`。

## 2. recordState 准入矩阵

| recordState | Schema validator | Shadow index | Production entity index | Active result |
| --- | --- | --- | --- | --- |
| `draft` | 校验 | 输出 | 跳过 | 否 |
| `published` | 校验 | 输出 | 输出 | 是 |
| `archived` | 校验 | 跳过 | 跳过 | 否 |

冻结规则：

1. `draft` 表示结构合法但尚未取得生产发布批准；文件存在、validator 通过或 shadow 构建成功均不等于发布。
2. `published` 必须由明确的人工发布动作产生，生成器不得修改 `recordState`。
3. `archived` 不成为正常 active result。
4. `pending-review` Fact 本身不是自动阻止 Entity 发布的条件；是否会让公开标题或摘要误导用户才是发布审核重点。
5. `published` Entity 必须记录首次进入本站生产数据的 `publishedAt`；该日期不得晚于 `updatedAt`。draft 可以为 `null`，未发布即归档的 Entity 也可以为 `null`。

## 3. Shadow / Production CLI

唯一 CLI 形式：

```text
node scripts/build-search-index.mjs --mode=shadow
node scripts/build-search-index.mjs --mode=production
```

- 缺少 `--mode`：失败并显示用法；
- 未知 mode：失败；
- 不保留 `--shadow`、`--production` 等近义参数；
- P1-3 的无参数调用方式属于一次有意的安全性 breaking change。

Shadow mode 输出 `draft + published`，跳过 `archived`。Production mode 只输出 `published`，跳过 `draft + archived`。

## 4. Generated 文件策略

采用显式双文件：

```text
generated/search-index.shadow.json
generated/search-index.production.json
```

理由：

- 文件名直接表达准入规则，降低 shadow 数据被误接生产的风险；
- P1-4B 只能消费 `.production.json`，不得读取 `.shadow.json`；
- 两个文件均由同一生成器和同一 Search Document 映射产生，不是两份手工数据；
- 当前将派生文件提交为人工审查快照，未来是否由部署流水线即时生成可以另行决定。

旧的模糊文件 `generated/search-index.json` 已移除。`data/` 仍是 source of truth，`generated/` 不是新的知识数据源。

## 5. Entity Search Document

```json
{
  "id": "weapon:tang-hengdao",
  "documentType": "entity",
  "entityType": "weapon",
  "slug": "tang-hengdao",
  "route": "/weapons",
  "displayName": "唐横刀",
  "aliases": [],
  "displayAliases": [],
  "keywords": ["demo", "单手刀", "武器", "试玩"],
  "summary": "...",
  "recordState": "published",
  "sourceSchemaVersion": "1.0-implementation"
}
```

`documentType=entity` 是搜索派生字段，不写回 Weapon。`entityType=weapon` 是知识实体类型，两者不得混用。

保留 `recordState` 便于构建产物审计；production 文件内出现非 `published` Entity 应视为契约破坏。浏览器不得把 `recordState` 当作可信度标签。

未来出现真实详情页后，只修改 route 派生策略，不修改 Weapon id、Fact、Alias 或 Search Document 基础结构。当前 route 继续使用真实 `/weapons`，不得虚构详情 URL。

## 6. Page 与 Entity 共存

Page Search Document 与 Entity Search Document 是不同 document class：

- Page 表达栏目、系统说明和导航入口；
- Entity 表达唐横刀等可发现的知识实体。

P1-4B 最低映射规则：

- 现有页面级 `SEARCH_INDEX` 继续作为基础索引；
- 页面条目在统一结果模型中派生 `documentType=page`；
- Page 不使用 `entityType=page`，`entityType` 应为空或不存在；
- Entity 使用稳定知识 id，例如 `weapon:tang-hengdao`；
- 页面 id 可以在搜索派生层使用稳定形式，例如 `page:/weapons`，无需写回 HTML。

页面与实体不能互相替代。泛词“武器”应保留 `/weapons` 页面入口；具体实体名称应允许 Entity 参与匹配。本阶段不冻结复杂 ranking score。

## 7. Identity、shared route 与重复规则

1. Search Document 身份由 `id` 与 `documentType` 表达，route 不是唯一键。
2. 多个 Weapon 共享 `/weapons` 合法，不得按 route 自动去重。
3. Page 与 Entity 即使 route 相同也可以同时存在。
4. duplicate id：构建失败。
5. duplicate slug：当前 Weapon entityType 内构建失败；生成器目前只有 Weapon，因而直接检查 slug 唯一。
6. duplicate displayName：当前构建失败，避免两个无法区分的活跃结果；未来确有合法同名实体时应先定义可区分展示规则，不静默放宽。
7. shared route fixture 必须保留两条独立 Entity 文档。

## 8. Archived 与 Entity resolution

有 resolution 的旧 Entity 必须是 `archived`，因此不会输出 active Search Document。canonical target 只有在其自身 recordState 符合当前 mode 时才输出。

最低继承规则：

- archived Entity 不输出独立结果；
- 不自动把旧 Entity 的 displayName、aliases 或关键词迁移到 target；
- duplicate、merge、split 均等待明确、可审计的 Alias/迁移规则；
- `misidentified` 的旧名称尤其不得无条件继承；
- 若希望旧名称命中 canonical target，应在 target 上建立经过审核的 Alias，或未来设计独立且可追踪的 resolution 搜索派生规则。

这样可避免旧实体和 canonical target 同时出现，也避免错误名称污染新实体。

## 9. Build strict / Runtime resilient

### Build strict

以下情况必须非零退出，不得跳过坏数据后生成“看似成功”的文件：

- knowledge validator 失败；
- JSON 无法解析；
- schemaVersion 不兼容；
- recordState 未知；
- summary 支持引用无效；
- Alias kind 没有搜索策略；
- id、slug 或 displayName 重复；
- mode 缺失或非法。

合法 production 空数组 `[]` 不属于失败。

### Runtime resilient

P1-4B 应采用 Progressive Enhancement：

1. 现有页面级 `SEARCH_INDEX` 是基础 fallback；
2. production entity index 是增强层；
3. 文件不存在、加载失败、JSON 损坏、顶层非数组、版本不兼容或单条文档非法时，忽略 Entity 增强层并继续使用页面搜索；
4. 合法空数组表示当前没有获准发布的 Entity，不应显示错误；
5. entity index 失败不得导致整个站内搜索不可用。

构建阶段严格失败与浏览器运行阶段宽容 fallback 是不同责任，不能互相替代。

## 10. Entity Publication Checklist

真实 Entity 从 `draft` 改为 `published` 前，至少确认：

1. Knowledge schema validation 通过；
2. id 已稳定，不跟随显示名或页面变化；
3. slug 已稳定且无冲突；
4. displayName 达到可公开标准，并明确其证据边界；
5. summary 非空；
6. summaryFactIds 非空、有效且属于当前 Entity；
7. summary 没有扩大 Fact 能支持的确定性；
8. 待核 Alias 不会作为正式别名展示；
9. `reviewNote`、内部方法说明或未知占位不会泄漏；
10. 不含“最强”“T0”等无结构化依据的营销词；
11. route 指向真实生产 URL；
12. active Entity 的 `resolution=null`；
13. 审核开始时 recordState 仍为 `draft`；
14. 获批发布时记录首次进入生产派生层的 `publishedAt`，并确认它不晚于 `updatedAt`；
15. 只有明确人工批准后才把 recordState 改为 `published`。

`pending-review` Fact 可以与 published Entity 共存，但公开 summary 必须清楚表达未知边界。

## 11. 当前 Weapon publication review

### 唐横刀 — Ready for publication

- Fact：7；`observation=5`、`editorial=1`、`pending-review=1`。
- summaryFactIds：5/5 均存在且属于当前 Entity。
- displayName：来自媒体直接试玩观察，不是官方正式名称；现有 summary 明确限定为发售前公开试玩，没有把名称包装成 official。
- pending-review：获取方式待确认；没有待核 Alias。
- 误导风险：评级不进入搜索，摘要明确写“获取方式仍待确认”。
- 建议：达到实体搜索的可公开标准，可进入后续人工 Publication Approval；本轮不改状态。

### 青龙掠月刀 — Keep draft

- Fact：7；`observation=5`、`editorial=1`、`pending-review=1`。
- summaryFactIds：5/5 均有效。
- displayName：来自当前页面对公开画面的整理，名称 Fact 的 reviewNote 明确说明尚无官方文字确认。
- Alias：“偃月刀”为 `pending-review`，只匹配、不展示。
- pending-review：获取方式待确认。
- 误导风险：摘要本身保守，但主显示名可能被用户理解成已经确认的正式名称。
- 建议：在人工确认该显示名作为公开站点约定名称是否可接受前保持 draft。

### 牙横刀 — Ready for publication

- Fact：6；`observation=4`、`pending-review=2`。
- summaryFactIds：5/5 均有效。
- displayName：来自媒体直接试玩记录，尚不是官方文字确认，但公开来源边界明确。
- pending-review：具体特点与获取方式均待确认；没有待核 Alias。
- 误导风险：内容较少，但摘要直接说明详细特点和获取方式仍待可靠资料，不会用空缺制造确定性。
- 建议：达到保守实体搜索结果的可公开标准，可进入后续人工 Publication Approval；本轮不改状态。

Ready for publication 是审核建议，不是发布动作，也不改变三者当前 `recordState=draft`。

## 12. Fixture 契约

`tests/fixtures/search-index-cases.json` 全部标记为虚构测试数据，不进入 `data/` 或生产统计。`scripts/check-search-index.mjs` 验证：

1. draft 在 shadow 可见；
2. draft 在 production 隐藏；
3. published 在 production 可见；
4. Entity 文档带 `documentType=entity`；
5. pending-review Alias 可匹配但不可展示，`reviewNote` 与评级营销词不泄漏；
6. archived resolution 旧实体隐藏、canonical target 保留；
7. 多个 Entity 共享 `/weapons` 合法；
8. duplicate id 失败；
9. duplicate slug 失败；
10. duplicate displayName 失败；
11. 相同输入的纯派生结果 deterministic。

## 13. Schema 结论与 Gate

Production Search Contract 不需要修改 Weapon、Fact、Source、Entity resolution、recordState 或 schemaVersion。

- `documentType` 属于搜索派生层；
- mode 与 publication filtering 属于构建流程层；
- Page + Entity 合并和 runtime fallback 属于生产搜索集成层。

P1-4A.1 已批准唐横刀与牙横刀，当前 production entity output 为这两个 Entity；青龙掠月刀仍因显示名边界保持 draft。P1-4A.2 补齐二者的 `publishedAt=2026-08-27`，在进入 P1-4B 前落实首次生产发布日期约束。

最终结论：

**C. P1-4A 通过，可以进入 Publication Approval Gate，但暂不接生产。**
