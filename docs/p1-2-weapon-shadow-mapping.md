# P1-2 Weapon Shadow Data 映射报告

## 1. 试点边界

- `schemaVersion` 已冻结为当前可实施版本 `1.0-implementation`；后续需求通过 `1.1`、`1.2` 等版本演进。
- 生产页面仍以 `pages/weapons.html` 为唯一真实渲染来源。
- 本轮 JSON 只用于验证 Source、GameVersion、Weapon、内嵌 Fact 和最小 Registry；生产 HTML、搜索、路由与部署不读取这些数据。
- 不使用 `release-verified`，不建立 Relation、Boss、Character 或 Build 数据。

## 2. 样本与选择原因

| Weapon | 选择原因 |
| --- | --- |
| 唐横刀 | 当前 HTML 同时包含试玩出现、类型、观察描述、四星编辑预估，并缺少可靠获取方式；可在同一实体上测试 `observation`、`editorial`、`pending-review`。 |
| 青龙掠月刀 | 当前 HTML 同时写作“青龙掠月刀（偃月刀）”；可测试 `displayName` 与待确认 Alias 分离，以及预告片观察、五星编辑预估和未知获取方式。 |
| 牙横刀 | 当前 HTML 明确写“试玩版提及”“待详细信息”“未知”；适合验证未知特点和获取方式不被补写，而以 `null + pending-review + reviewNote` 保存。 |

没有为了覆盖状态而增加当前页面不存在的武器。

## 3. Source 记录

| Source ID | authority | 用途 |
| --- | --- | --- |
| `source:playstation-blog-state-of-play-2026-08-17` | `official` | 当前生产页已经引用的官方文章与内嵌实机；文章文字可支持整体武器系统的官方事实，个体武器从画面整理时仍使用 `observation`。 |
| `source:ucg-demo-report-2024-06-08` | `third-party` | 对唐横刀、牙横刀在 2024 试玩中的出现和名称进行具体追溯。媒体直接试玩所见仍是 `observation`，不是 `official`。 |

`authority` 描述来源主体，`status` 描述单条 Fact 的信息性质。官方来源中的画面观察不会因为域名或账号身份被自动提升为 `official`。普通本站评级不再把旧 HTML 当作证据来源，而由 `basisFactIds` 指向其依据的结构化 Fact。

## 4. GameVersion 记录

| GameVersion ID | stage | 用途 |
| --- | --- | --- |
| `version:prelaunch-demo-2024` | `prelaunch-demo` | 统一承载 2024 公开试玩阶段的唐横刀、牙横刀观察。没有虚构 Demo 版本号。 |
| `version:prelaunch-materials-2026-08` | `prelaunch-materials` | 统一承载 2026 年 8 月 State of Play 公开材料阶段的观察和本页编辑复核。 |

未为每个视频单独建立版本；两个阶段以 `sequence` 表达先后，不假装存在官方补丁号。

## 5. Fact key 最小词表

| key | valueType | 说明 |
| --- | --- | --- |
| `weapon.exists` | `boolean` | 个体武器已在可核查材料中出现。 |
| `weapon.name` | `string` | 当前材料中的名称；是否为官方正式名称由 Fact status 决定。没有采用容易与 status 冲突的 `weapon.officialName`。 |
| `weapon.kind` | `string` | 当前材料支持的武器类型描述。 |
| `weapon.publicAppearance` | `enum` | 公开出现方式；用 `demo`、`trailer` 等枚举替代多个近义布尔 key。 |
| `weapon.observedTrait` | `string` | 公开演示中直接观察到的特点；未知时可为 pending-review 的 `null`。 |
| `weapon.editorRating` | `rating` | 本站编辑星级，必须保持 `editorial`。普通静态编辑评价不强制 `asOf`。 |
| `weapon.acquisition` | `string` | 获取方式；未知时为 `null + pending-review + reviewNote`。 |

`requiresAsOf` 由 Registry 按 key 声明。本轮所有 key 都不是自然随时间、补丁、市场或重新计算变化的动态数据，因此均为 `false`。

## 6. HTML → JSON 映射

### 唐横刀

| 当前 HTML | JSON | status | Source | 信息损失 |
| --- | --- | --- | --- | --- |
| `唐横刀` | `displayName` + `weapon.name` | `observation` | UCG 试玩报告 | 无；没有把媒体试玩名称提升为正式名。 |
| `单手刀` | `weapon.kind` | `observation` | UCG 试玩报告 | 无。 |
| `试玩展示` | `weapon.publicAppearance = demo` | `observation` | UCG 试玩报告 | 无。 |
| `演示中呈现较均衡的攻防节奏` | `weapon.observedTrait` | `observation` | PlayStation Blog 内嵌实机 | 无；保持观察措辞。 |
| `★★★★` | `weapon.editorRating = {score: 4, max: 5}` | `editorial` | `sourceIds` 为空，basis 指向观察特点 | 无；JSON 比星形字符更明确。 |
| HTML 未给出可靠获取方式 | `weapon.acquisition = null` | `pending-review` | 无，使用 `reviewNote` | 无；显式保存未知状态。 |

### 青龙掠月刀

| 当前 HTML | JSON | status | Source | 信息损失 |
| --- | --- | --- | --- | --- |
| `青龙掠月刀（偃月刀）` | `displayName = 青龙掠月刀`；Alias `偃月刀` | 名称 Fact 为 `observation`；Alias 为 `pending-review` | PlayStation Blog 内嵌实机 | 无；括号称呼没有污染主显示名，Alias 说明尚不确定它是正式别名还是通用类型。 |
| `长柄重武器` | `weapon.kind` | `observation` | PlayStation Blog 内嵌实机 | 无。 |
| `预告片展示` | `weapon.publicAppearance = trailer` | `observation` | PlayStation Blog 内嵌实机 | 无。 |
| `演示中具有较大攻击范围与刀气动作` | `weapon.observedTrait` | `observation` | PlayStation Blog 内嵌实机 | 无。 |
| `★★★★★` | `weapon.editorRating = {score: 5, max: 5}` | `editorial` | `sourceIds` 为空，basis 指向观察特点 | 无；不把编辑判断混入试玩观察。 |
| 正文明确说获取方式不能确定 | `weapon.acquisition = null` | `pending-review` | 无，使用 `reviewNote` | 无。 |

### 牙横刀

| 当前 HTML | JSON | status | Source | 信息损失 |
| --- | --- | --- | --- | --- |
| `牙横刀` | `displayName` + `weapon.name` | `observation` | UCG 试玩报告 | 无；保留媒体试玩来源边界。 |
| `刀类` | `weapon.kind` | `observation` | UCG 试玩报告 | 无。 |
| `试玩版提及` | `weapon.publicAppearance = demo` | `observation` | UCG 试玩报告 | 无。 |
| `待详细信息` | `weapon.observedTrait = null` | `pending-review` | 无，使用 `reviewNote` | 无；没有把占位文本误当作事实值。 |
| `未知`（编辑预估列） | 不创建 rating Fact | — | — | 无；“未知”是展示占位，不是评分。 |
| HTML 未确认获取方式 | `weapon.acquisition = null` | `pending-review` | 无，使用 `reviewNote` | 无；没有迁移早期未经确认的掉落说法。 |

## 7. official 覆盖边界

现有材料能以官方文字确认“超过 30 种主要武器、25 种影之武、升级和重铸机制”等系统级事实，但本轮只允许创建 Weapon 个体数据，不创建 GameSystem 实体。当前所选三件武器的个体名称或存在主要来自试玩、预告画面或媒体试玩记录，因此按既定状态定义使用 `observation`。

本轮没有为了凑齐状态，把官方渠道承载的实机观察错误标为 `official`。校验器已经实现 `official Fact → 至少一个 authority=official Source` 规则，但真实数据尚未提供 official 正向样本。后续只有找到能以官方文字直接确认个体武器名称/存在的材料，才应增加该状态。

## 8. 模型验收结论

1. **同一 Weapon 能否同时拥有不同 status？** 能。唐横刀和青龙掠月刀已经在各自 `facts[]` 中同时包含 `observation`、`editorial`、`pending-review`；结构上也允许再加入有合格来源的 `official` Fact，互不覆盖。
2. **Source 是否只存一份并复用？** 是。两个证据 Source 独立存储；UCG 和 PlayStation Blog 均被多个 Fact 引用。普通编辑判断通过 `basisFactIds` 追溯，不为旧 HTML 建立自证 Source。
3. **暂称是否通过 Alias 表达？** 是。“偃月刀”保存在结构化 Alias 中，并带独立 status、sourceIds、checkedAt、gameVersionId 和 reviewNote。
4. **编辑评级是否与试玩观察分离？** 是。rating Fact 为 `editorial`，并通过 `basisFactIds` 指向观察 Fact；它不是观察 Fact 的字段。
5. **未知获取方式能否显式表达？** 是。三个样本都使用 `value: null + status: pending-review + reviewNote`。
6. **是否需要违反 P1-1 的例外字段？** 不需要。`weapon.publicAppearance` 是最小 Fact key 词表的一部分，不是实体例外字段。
7. **是否足以扩大到更多 Weapon？** 对同类发售前清单足够；在扩大前仍应补一个有直接官方文字证据的个体武器样本，正向验证 `official` 规则，并观察成对武器、可变形武器是否需要明确的实体边界规则。

## 9. 草案建议

P1-2.2 已确立成对武器应跟随独立装备身份、而非物体数量，并用 Entity `resolution` 取代顶层单值 `supersededBy`，从而表达 duplicate、merge、split 和 misidentified。最终冻结建议与核心规范以 `docs/knowledge-schema-1.0.md` 为准。
