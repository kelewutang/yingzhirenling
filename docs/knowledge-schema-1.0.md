# Knowledge Schema 1.0 核心规范

> 当前状态：`1.0-implementation`。这是经人工批准的当前可实施版本。

后续需求可通过 `1.1`、`1.2` 等版本渐进演进。`1.0-implementation` 只冻结当前已经验证并可实施的核心边界，不要求预见 Boss、Quest、Build 的全部未来需求。

## 1. Entity

Entity 表示游戏中具有独立身份的对象，例如 Weapon、Boss、Character。稳定 `id` 跟随游戏身份，不跟随页面、显示名称或画面中的物理部件数量。

Entity 至少包含：`schemaVersion`、`id`、`entityType`、显式 `slug`、`displayName`、`aliases`、`summary`、`summaryFactIds`、`facts`、`taxonomyIds`、日期、`recordState`、`resolution`。

`recordState` 使用 `draft`、`published`、`archived`。没有身份修正时必须显式使用 `resolution: null`。

`publishedAt` 表示 Entity 首次进入本站生产数据的日期。`recordState=published` 时必须是合法的 `YYYY-MM-DD` 日期，且不得晚于 `updatedAt`；draft 可以使用 `null`；archived 可以保留合法历史发布日期，也可以为 `null`（未发布即归档）。

## 2. Fact

Fact 是最小可信度单元。一个 Entity 的存在、名称、类型、获取方式、强度评价等必须能够分别拥有 `value`、`valueType`、`status`、`sourceIds`、`basisFactIds`、`checkedAt`、`gameVersionId` 和适用 scope。

Fact 的更新使用单值 `supersededBy` 指向直接替代它的新 Fact。它只表达“同一事实位的新陈替换”，不处理 Entity 身份拆分或合并。

## 3. Source

Source 独立存储，并由多个 Fact 引用。Source 的 `authority` 只描述来源主体：`official`、`third-party`、`community`、`internal`。

`authority` 不自动决定 Fact `status`。官方视频画面中直接观察到的信息通常仍是 `observation`；`official` Fact 必须有官方文字或其他满足官方确认标准的直接来源。

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

## 8. Editorial 规则

普通 editorial Fact 默认使用：

```json
{
  "status": "editorial",
  "sourceIds": [],
  "basisFactIds": ["fact:..."]
}
```

只有 Source 记录独立方法论、原创调查、可复现测试或内部测量时，才允许用 `authority=internal` Source 作为没有 `basisFactIds` 的例外。旧 HTML 中曾出现某个判断，不构成证明该判断正确的证据。

## 9. Alias 与 rename

Alias 自身携带 value、locale、kind、status、sourceIds、checkedAt、gameVersionId；待确认别名还必须有 reviewNote。

普通改名不创建新 Entity：保持 id，更新 `displayName`，旧名称进入 aliases，`resolution` 保持 null。禁止使用 `resolution.type=rename`。

## 10. ID 与 slug

所有 id 全局唯一且稳定。slug 必须显式提供，在同一 Entity 类型内唯一，并使用 ASCII kebab-case。更改显示名不能隐式改变 id 或 slug。

## 11. Entity identity resolution

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

## 12. Entity resolution 与 Fact supersession 分工

- Entity `resolution`：修正“这个记录究竟代表哪个游戏实体”，支持 duplicate、merge、split、misidentified。
- Fact `supersededBy`：修正“同一实体的某条事实后来被哪条新事实替代”，保持单目标。

Entity 不保留一对一 `supersededBy`，避免 replacement 与 resolution 同时表达同一身份变化。

## 13. checkedAt 与 asOf

`checkedAt` 表示本站最后核查时间。`asOf` 只对会随时间、补丁、市场、排名或重新计算自然变化的数据强制，例如价格、销量、播放量、版本伤害和 Build 计算结果。普通静态编辑评价不因 `editorial` 自动要求 `asOf`。`asOf` 不得晚于 `checkedAt`。

## 14. 发布与迁移边界

Knowledge JSON 是结构化事实的 Source of Truth，generated artifacts 是可重建的派生产物。当前 Weapon JSON 已用于派生 Production Entity Search Index 和静态 Weapon Detail HTML；只有 `recordState=published` 的 Weapon 可以进入对应生产输出。

Weapon 详情页的核心 SEO 内容在构建时写入静态 HTML，浏览器不会 runtime fetch Weapon Knowledge JSON 后再生成 H1、summary、Fact 或 Source。当前只有 Weapon 完成了这条生产派生链，Boss、Character 等 Entity 类型尚未全面迁移。

长篇攻略、论证和编辑文章继续使用 HTML，未来出现真实需求时可以采用可选 Markdown；JSON 只承载可校验的结构化事实、来源、关系、版本和搜索字段。

扩大数据或生成搜索索引前，必须先通过：

```text
node scripts/validate-data.mjs
node scripts/validate-data.mjs --fixtures
```
