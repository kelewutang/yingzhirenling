# Knowledge Schema 1.0 核心规范

> 当前状态：`1.0-implementation`。这是经人工批准的当前可实施版本。

后续需求可通过 `1.1`、`1.2` 等版本渐进演进。`1.0-implementation` 只冻结当前已经验证并可实施的核心边界，不要求预见 Boss、Quest、Build 的全部未来需求。

## 1. Entity

Entity 表示游戏中具有独立身份的对象，例如 Weapon、Boss、Character。稳定 `id` 跟随游戏身份，不跟随页面、显示名称或画面中的物理部件数量。

Entity 至少包含：`schemaVersion`、`id`、`entityType`、显式 `slug`、`displayName`、`aliases`、`summary`、`summaryFactIds`、`facts`、`taxonomyIds`、日期、`recordState`、`resolution`。

`recordState` 使用 `draft`、`published`、`archived`。没有身份修正时必须显式使用 `resolution: null`。

`publishedAt` 表示 Entity 首次进入本站生产数据的日期。`recordState=published` 时必须是合法的 `YYYY-MM-DD` 日期，且不得晚于 `updatedAt`；draft 可以使用 `null`；archived 可以保留合法历史发布日期，也可以为 `null`（未发布即归档）。

`system` 是唯一的知识专用 Entity 类型，用于难度、模式、成就路径和整体武器成长等不归属于单件 Weapon、Character、Boss 或 Location 的事实。它不生成公共详情页、Collection 卡片、Production Search Document 或 sitemap URL；不得为难度、成就、存档等概念各自扩展新的 Entity 类型。

## 2. Fact

Fact 是最小可信度单元。一个 Entity 的存在、名称、类型、获取方式、强度评价等必须能够分别拥有 `value`、`valueType`、`status`、`sourceIds`、`basisFactIds`、`checkedAt`、`gameVersionId` 和适用 scope。

Fact 的更新使用单值 `supersededBy` 指向直接替代它的新 Fact。它只表达“同一事实位的新陈替换”，不处理 Entity 身份拆分或合并。

`weapon.previewStat` 是受限的 `object` Fact：必须同时包含 `statName`、`displayedValue`、`displayedLevel` 与 `displayContext: "official-pre-release-ui"`，且必须是 `observation`。它只记录发售前官方 UI 的显示观察，不能表示正式版固定属性。只有官方或正式版证据明确显示该等级为实际最高 Weapon 等级时，才可在页面称为“满级属性”；其余一律使用“LvX 预览属性”或等价的预发布措辞。`weapon.mechanic` 与 `weapon.progressionNode` 可以保留兼容的字符串名称，或使用受限 object。两者的 `name` 必填，`description` 可选且只能记录截图中可明确读出的简短说明；两者都可额外有已明确读出的控制器 `input`，`weapon.progressionNode` 还可额外有正整数 `level`。两者可选用有上限的 `derivedInputs`：每项仅允许已验证输入的 `inputs`、非空 `label`、`labelKind: "official" | "functional"` 与可选简短 `description`，用于从该招式派生的后续操作；输入继续遵守现有控制器语法。派生按键默认只展示控制器输入和动作/功能标签；仅当说明补充 primary description 未覆盖的信息时才展示 `description`。页面将 primary `input` 标为“按键”，将 `derivedInputs` 标为“派生按键”。官方已有动作/招式名时使用 `official` 标签；未确认正式名称时使用 `functional` 的简洁功能标签，不能为补全 UI 而虚构技能名或把功能标签当作官方术语。不得推断效果、数值、持续时间、其他平台映射或完整技能树。

## 3. Source

Source 独立存储，并由多个 Fact 引用。Source 的 `authority` 只描述来源主体：`official`、`third-party`、`community`、`internal`。

`authority` 不自动决定 Fact `status`。官方视频画面中直接观察到的信息通常仍是 `observation`；`official` Fact 必须有官方文字或其他满足官方确认标准的直接来源。

常规 Source 继续要求 HTTP(S) `url`。当用户直接提供官方截图、且无法可靠取得稳定 canonical URL 时，Source 可以使用 `locator.type: "user-supplied-screenshot"` 并将 `url: null`。该 locator 必须明确平台、官方账号/内容语境、内容标题、提供日期、原始发布时间、`no-stable-canonical-url` 原因和稳定截图页标识；它不表示本站拥有、重托管或发布截图。未知 locator 类型、缺失 URL 的 URL Source，以及为截图猜测的 URL 均为无效数据。

## 4. Relation

Relation 使用独立的有向记录表达 Entity 之间的明确关系，包含稳定 id、source/target Entity、受控 relation type，以及 Fact 同级的 status、来源、时间、版本和 scope。Relation 不要求图数据库；构建时通过索引解析引用。

## 5. GameVersion

GameVersion 独立记录发售前材料阶段、Demo、正式版本、补丁或热修复。发售前不得虚构官方版本号。Fact 通过 `gameVersionId`、`validFromVersionId`、`validToVersionId` 表达版本适用范围。

GameVersion 自身的版本替代关系不属于 Entity identity resolution。

## 6. Registry

Registry 管理 Fact key、平台、难度等受控词表。Fact key 至少声明适用 Entity 类型、允许的 valueType、描述，以及是否强制 `asOf`。不得用近义 key 表达同一语义。

## 7. Fact status

合法状态：

- `official`：官方文字或官方发布材料直接确认。
- `observation`：试玩、Demo、实机或其他可直接观察的信息。
- `third-party`：媒体报道、统计平台、非官方统计或估算。
- `editorial`：本站推断、评级、推荐或分析。
- `pending-review`：值或证据尚不能可靠确认。
- `release-verified`：仅在正式发售后、且有正式版验证依据时使用。

发售前生产数据禁止 `release-verified`。

## 8. Weapon 内容保真与准入流程

Weapon 的玩法信息以可取得的官方材料为事实基线，包括官方游戏内截图、实机视频、文章和宣传 UI。官方 UI 文本清晰可读时，本站保留其术语和玩法含义，不为制造不同措辞而改写。

以下已准入字段必须与官方证据完全一致，除非后续官方证据明确替代：Weapon 名称、招式/技能名称、成长节点名称、等级、控制器按键、数值、资源量、触发条件、状态名称、命名机制及 canonical Weapon 术语。术语变更必须有证据，不能由编辑偏好决定；例如 `赤练短刃` 不能写为 `赤练短刀`，`白蟒长刃` 不能写为 `白蟒长刀`，`敛刃` 不能写为 `纹刃`，`刺骨·之三` 不能写为 `剥骨·之三`。

技能说明以官方玩法文本为事实基础，不必机械复制 UI 的换行、布局碎片、重复句式或由布局造成的标点。仅可为网页可读性作最小规范化：合并明显重复句、改善句间连接、统一标点、删除冗余重复用语，或把已确认按键移至更清楚的句中位置。不得改变机制含义、条件、先后顺序、强度、持续时间、资源消耗、按键、状态交互、影响目标或成长含义；官方文案已经清楚自然时，应少改或不改，不能只为原创而释义。

“技能说明”只呈现来源支持的玩法描述；“攻略说明/攻略提示”才是本站的解释、建议、连招或战术。未有已批准的编辑洞见时不得编造，也不得混入技能说明；本阶段不新增攻略说明 schema。

截图或视频文字被裁切、遮挡、模糊、含义不明或不可读时，只记录可自信支持的内容，不得补全或猜测。例如 White Shadow 7/14 在“寒冰击”上方被裁切，本站只能称已确认可见的成长节点，不能声称完整成长树、全部成长节点或白影只有四个成长节点。发售前 UI 数值始终是观察值，保持既有预览提示，不得静默变为最终、基础或正式版数值。

当机制和数值资源消耗已确认、但资源的官方术语尚未确认时，保留已确认机制并使用中性占位表述；在内部文档或 review note 中标记其仍待官方术语确认。中性占位不是 canonical 游戏术语，待发售或后续官方证据确认后必须替换为正式名称。

新 Weapon Fact、截图、玩法说明、按键、属性、成长节点或术语的准入固定按以下顺序执行：

```text
原始材料/截图/官方来源
→ 内容审阅与措辞定稿（确认准确术语、数值、等级、按键、证据支持含义、可见/裁切/歧义限制、本站最终文案及禁止推断项）
→ 项目负责人确认
→ Codex 一次性实现已批准内容
→ 只读 Work/diff 审阅（证据保真、实现正确性、回归、schema/展示边界）
→ Browser Gate（实际渲染、移动端、视觉层级、字体、按键和玩家可用性）
```

未提供已批准内容规格时，Codex 不得自行重新解释新材料或发明最终站点文案；实现中遇到规格未覆盖的实质歧义必须停止并报告，不得猜测。

## 9. Editorial 规则

普通 editorial Fact 默认使用：

```json
{
  "status": "editorial",
  "sourceIds": [],
  "basisFactIds": ["fact:..."]
}
```

只有 Source 记录独立方法论、原创调查、可复现测试或内部测量时，才允许用 `authority=internal` Source 作为没有 `basisFactIds` 的例外。旧 HTML 中曾出现某个判断，不构成证明该判断正确的证据。

## 10. Alias 与 rename

Alias 自身携带 value、locale、kind、status、sourceIds、checkedAt、gameVersionId；待确认别名还必须有 reviewNote。

普通改名不创建新 Entity：保持 id，更新 `displayName`，旧名称进入 aliases，`resolution` 保持 null。禁止使用 `resolution.type=rename`。

## 11. ID 与 slug

所有 id 全局唯一且稳定。slug 必须显式提供，在同一 Entity 类型内唯一，并使用 ASCII kebab-case。更改显示名不能隐式改变 id 或 slug。

## 12. Entity identity resolution

Entity 顶层不使用 `supersededBy`。身份判断修正统一使用：

```json
{
  "recordState": "archived",
  "resolution": {
    "type": "split",
    "targetEntityIds": [
      "weapon:example-a",
      "weapon:example-b"
    ],
    "reason": "旧记录后来确认包含两个独立装备身份。"
  }
}
```

最小类型集合：

- `duplicate`：重复记录与 canonical Entity 是同一身份；必须正好一个 target。
- `merge`：多个过去认为独立的 Entity 应合并；每个旧 Entity 正好指向一个 canonical target。
- `split`：一个旧 Entity 应拆分为多个独立身份；至少两个 targets。
- `misidentified`：旧记录身份判断错误，不能作为普通改名或同一实体重复处理；必须正好一个纠正 target，旧 Fact 不自动继承。

有 resolution 的 Entity 必须 archived；target 必须存在、不得指向自身、不得重复；resolution 链不得形成循环。链式修正可以存在，但应最终收敛到有效 Entity。

## 13. Entity resolution 与 Fact supersession 分工

- Entity `resolution`：修正“这个记录究竟代表哪个游戏实体”，支持 duplicate、merge、split、misidentified。
- Fact `supersededBy`：修正“同一实体的某条事实后来被哪条新事实替代”，保持单目标。

Entity 不保留一对一 `supersededBy`，避免 replacement 与 resolution 同时表达同一身份变化。

## 14. checkedAt 与 asOf

`checkedAt` 表示本站最后核查时间。`asOf` 只对会随时间、补丁、市场、排名或重新计算自然变化的数据强制，例如价格、销量、播放量、版本伤害和 Build 计算结果。普通静态编辑评价不因 `editorial` 自动要求 `asOf`。`asOf` 不得晚于 `checkedAt`。

## 15. 发布与迁移边界

Knowledge JSON 是结构化事实的 Source of Truth，generated artifacts 和 `dist/` 是可重建的派生产物。Weapon、Character、Boss 和 Location 都在同一冻结的 Knowledge contract 下进入 production projection；这些类型中只有 `recordState=published` 的 Entity 可以进入对应的 Production Search、static detail output 和 sitemap。`system` 即使为 published 也始终只保留在 Knowledge 层。

Entity detail 的核心 SEO 内容在构建时写入静态 HTML，浏览器不会 runtime fetch Knowledge JSON 后再生成 H1、summary、Fact 或 Source。四类 Entity 都使用这一 production chain；这只是 implementation / migration status 更新，不构成 Schema version、field、enum、publication 或 validation semantics 的变化。

长篇攻略、论证和编辑文章继续使用 HTML，未来出现真实需求时可以采用可选 Markdown；JSON 只承载可校验的结构化事实、来源、关系、版本和搜索字段。

扩大数据或生成搜索索引前，必须先通过：

```text
node scripts/validate-data.mjs
node scripts/validate-data.mjs --fixtures
```
