# P1-3 Search Index Shadow Generation

## 1. 范围与输入

本轮只验证以下 shadow 链路：

```text
data/weapons/*.json
  -> scripts/build-search-index.mjs
  -> generated/search-index.json
  -> 与 js/main.js 中现有 SEARCH_INDEX 只读比较
```

`data/` 是事实来源，`generated/` 是可删除、可重复生成的派生产物。生成器不读取 HTML、`js/main.js`、Source title 或 GameVersion 文案来补齐 Search Document，也不接入生产搜索。

生成前，脚本用当前 Node 可执行文件直接运行 `scripts/validate-data.mjs`。只有完整知识库校验通过后才读取 Weapon 数据，因此没有复制 validator 的 Source、Fact、引用和 Entity resolution 规则。

本轮输入为 3 个 `schemaVersion=1.0-implementation` 的 Weapon：青龙掠月刀、唐横刀、牙横刀。没有新增或修改知识数据。

## 2. Search Document 模型

```json
{
  "id": "weapon:tang-hengdao",
  "entityType": "weapon",
  "slug": "tang-hengdao",
  "route": "/weapons",
  "displayName": "唐横刀",
  "aliases": [],
  "displayAliases": [],
  "keywords": ["demo", "单手刀", "武器", "试玩"],
  "summary": "...",
  "recordState": "draft",
  "sourceSchemaVersion": "1.0-implementation"
}
```

- `aliases` 是可匹配的扁平别名，不表示官方认可，也不应由 UI 自动展示。
- `displayAliases` 是状态和 kind 均允许用户可见展示的保守子集。
- `keywords` 是构建时派生的匹配词，不是新的业务事实。
- 不生成 `searchText`。未来搜索可在运行时统一匹配 `displayName`、`aliases`、`keywords` 和 `summary`，无需在索引中再复制一遍所有文本。
- 不包含 Fact、Source、sourceIds、status、`reviewNote`、评分或内部核查说明。

## 3. Weapon 到 Search Document 的映射

| Search 字段 | 来源/规则 |
| --- | --- |
| `id` | `Weapon.id`，不推导 |
| `entityType` | `Weapon.entityType`，当前必须为 `weapon` |
| `slug` | `Weapon.slug`，不从文件名或显示名推导 |
| `route` | 当前真实集合路由常量 `/weapons` |
| `displayName` | 直接使用 `Weapon.displayName` |
| `aliases` | 从 `Weapon.aliases[]` 按搜索规则扁平化、去重和排序 |
| `displayAliases` | `aliases` 中满足展示状态和 kind 的子集 |
| `keywords` | 实体类型导航词及少量允许的结构化 Fact 派生词 |
| `summary` | 直接使用 `Weapon.summary`，并要求 `summaryFactIds` 非空且全部属于当前 Weapon |
| `recordState` | 直接使用 `Weapon.recordState` |
| `sourceSchemaVersion` | 直接使用 `Weapon.schemaVersion` |

生成器处理 `draft` 和 `published`，跳过 `archived`。这是 shadow 阶段为了审查 3 个 draft 样本的策略，不自动决定 P1-4 的生产发布门槛。未知 recordState 会报错。

生成器检查重复 `id`、`slug`、`displayName`。当前没有实体详情页，所有条目按要求共享 `/weapons`；因此 route 重复是有意的集合页行为，不能当作实体重复。生成器会拒绝任何不等于真实 `/weapons` 的 Weapon route。

## 4. Alias 规则

可进入匹配的 kind：

- `official-zh`
- `official-en`
- `transliteration`
- `community`
- `community-temporary`
- `legacy-title`
- `search-only`
- `descriptive`

任何已通过 schema 校验、且 kind 在上述列表内的 Alias 都可进入 `aliases` 帮助发现实体。未知 kind 会让构建失败，防止新增语义被静默公开。

只有 status 为 `official` 或 `observation`，且 kind 不属于 `community-temporary`、`search-only` 的 Alias 才进入 `displayAliases`。`pending-review` Alias 只用于匹配，不展示为正式别名；其 status、Source、版本和核查说明仍只保留在原始 Weapon 数据中。

当前“偃月刀”为 `descriptive + pending-review`，所以结果是：

```json
{
  "aliases": ["偃月刀"],
  "displayAliases": []
}
```

这既保留当前用户可能使用的搜索词，也不把待核称呼升级为正式别名。

## 5. Keyword 规则

关键词保持保守，只来自：

1. `entityType=weapon` 的导航词“武器”；
2. status 为 `official`、`observation` 或 `third-party` 的 `weapon.kind` 字符串；
3. 同样状态边界内的 `weapon.publicAppearance` 枚举及固定搜索映射，例如 `demo -> demo / 试玩`、`trailer -> trailer / 预告片`。

`displayName` 和 Alias 已有独立字段，不重复塞入 `keywords`。`weapon.editorRating`、`weapon.acquisition`、`weapon.observedTrait`、所有 `pending-review` Fact 和所有 `reviewNote` 都不参与关键词生成。生成器不会从评分派生“最强”“T0”“毕业”等营销词。

## 6. Summary 规则

`summary` 直接使用实体已审核的 `Weapon.summary`，不从 Fact value 拼接，不使用 Source title，也不将 `reviewNote` 或未知占位值拼入文案。生成器要求：

- summary 为非空字符串；
- `summaryFactIds` 非空；
- 每个 summaryFactId 都存在且属于当前 Weapon。

这能验证结构化支持关系，但不能自动理解中文摘要中每个结论是否与 Fact 完全语义等价。当前三条摘要均用“发售前”“观察/整理”“待确认”等措辞保留证据边界；该语义仍需内容审核负责。生成器不会把摘要改写得比原实体更确定。

## 7. Deterministic 规则

- 输入文件按文件名进行与系统 locale 无关的稳定排序；
- Search Document 按 `entityType -> slug -> id` 稳定排序；
- Alias 和关键词规范化去重并稳定排序；
- JSON 固定使用两个空格缩进和结尾换行；
- 不写入时间、机器路径、随机值或环境信息；
- 内容未变化时不重写输出文件。

因此连续运行生成器会得到完全相同的字节内容。

## 8. 当前生产 SEARCH_INDEX 对比

当前生产搜索只有一个页面级 Weapon 条目：

| 对比项 | Current Production | Generated Shadow |
| --- | --- | --- |
| 粒度 | 1 条“武器图鉴”集合页 | 3 条 Weapon 实体文档 |
| route | `/weapons` | 三条均为 `/weapons` |
| 名称 | keywords 含唐横刀、青龙掠月刀；不含牙横刀 | displayName 分别为青龙掠月刀、唐横刀、牙横刀 |
| Alias | keywords 含偃月刀，未表达待核状态 | 偃月刀可匹配，但 `displayAliases=[]` |
| 描述 | 武器系统级描述，含官方武器数量 | 各实体自己的保守 summary |
| 关键词范围 | 同时列出尚未迁移的多件武器及“影之武、配装”等页面词 | 只使用 3 个实体已有的结构化名称、类型和公开出现方式 |
| 可信度边界 | 页面级文字说明获取与强度待验证 | 每条摘要继承实体级证据边界；评分和 pending-review 原始内容不进入关键词 |

生产描述中的“超过 30 种主要武器及 25 种影之武”属于系统级事实，不属于这 3 个 Weapon Entity，也不应为追求字面一致而复制进每个实体文档。生产 keywords 中黑伤、残钢刃、拳套、大盾等内容尚无 shadow Weapon 数据，本轮不能从 HTML 回填；这是迁移覆盖范围差异，不是 Search Document 或 Weapon schema 缺陷。

当前生产条目没有“最强”“T0”等明显营销承诺。generated shadow 更细粒度、更保守，也能让“牙横刀”成为独立可发现实体，但它不能取代集合页的系统级导航语义。P1-4 应保留集合页文档，并把实体文档作为增量合并，而非二选一替换。

## 9. 信息损失与潜在误导

- Search Document 有意不携带完整 Alias status/Source；展示安全性由 `displayAliases` 派生规则保证，原始可信度仍在 `data/`。
- 搜索索引不承载 Fact 证据链，结果页若将来需要可信度徽标，应按实体 id 回查知识数据，而不是扩张索引为第二份知识库。
- 所有实体目前都是 `recordState=draft`。P1-4 必须明确生产索引是否只接受 `published`；本轮纳入 draft 仅用于 shadow 审查。
- 三条实体共用集合页，点击后不能定位到页面内对应条目。这不产生虚假 URL，但 P1-4 可评估现有页面锚点；在没有真实锚点前不能生成虚构详情 URL。
- `summaryFactIds` 只能验证引用存在，无法机器证明摘要语义。这是内容审核边界，不要求新增搜索字段。

## 10. Schema 与原始字段结论

当前 Weapon schema 足以生成稳定 Search Document。没有被迫新增 `searchDescription`、`searchKeywords`、`searchRoute`、`searchText` 或其他 search-only 原始业务字段。

- `displayName` 足以提供主标题；
- `aliases` 足以提供名称变体匹配，并能通过派生规则区分展示与仅匹配；
- `summary` 与 `summaryFactIds` 足以提供并约束摘要；
- Fact status 足以阻止 editorial rating 和 pending-review 原始值进入关键词；
- `recordState` 足以建立后续生产发布门槛；
- route 应继续由生成策略提供，不应写回每个 Weapon。

没有发现必须修改 1.0 schema 的结构性问题。已知限制是 Alias kind 当前没有独立 Registry、摘要语义不能完全自动验证；生成器对 kind 采用 fail-closed 列表，摘要继续依赖人工审核，均不阻止下一阶段。

## 11. P1-4 readiness

P1-3 的数据到搜索派生链路成立，未来可以删除 Weapon 实体搜索信息的手工副本。P1-4 接入时仍需明确：

1. 保留当前 `/weapons` 页面级集合文档；
2. 结构化实体文档以增量方式合并；
3. 决定 `draft` 与 `published` 的生产准入规则；
4. 搜索 UI 只展示 `displayAliases`，但匹配 `aliases`；
5. 在没有真实详情页或锚点前继续使用 `/weapons`。

这些是生产接入策略，不要求修改 schema。因此最终结论为：

**C. P1-3 通过，建议进入 P1-4 生产接入。**

本轮没有修改生产 `SEARCH_INDEX` 或任何生产页面行为。
