# P1-2.1 Knowledge Schema Freeze Gate

> 历史 Gate 记录：本文件保留 P1-2.1 当时的判断。P1-2.2 已用 Entity `resolution` 取代顶层单值 `supersededBy`；其后经人工审核批准，当前可实施版本为 `1.0-implementation`，最终规范以 `docs/knowledge-schema-1.0.md` 为准。

## 1. 范围与前置状态

- 分支：`main`
- 基线提交：`7487f70 chore: finalize pre-release baseline cleanup`
- 开始前未提交内容：仅 P1-2 的 `data/`、`docs/`、`scripts/` 新文件
- 生产 HTML、CSS、现有 JS、路由、SEO 与部署配置均未修改

本轮没有扩大 Weapon 规模，也没有把 shadow data 接入生产页面。

## 2. official Weapon 正向样本审计

### 检查过的候选

1. [S-GAME 官网制作人信《清风拂山岗，明月照大江》](https://pbz.s-game.com/zh-CN/news/creative-director-letter/)以官方文字提到 2025 年展示过“醉剑”。该段没有明确说明“醉剑”是一件独立 Weapon、一个装备项或正式武器名称，因此不足以建立个体 Weapon `official` Fact。
2. [S-GAME 官网《蛇年实机演示》](https://pbz.s-game.com/zh-CN/news/year-of-the-snake-trailer/)把展示称为“双蛇大战七星阵”，但正文没有给出两件武器的正式名称或独立装备身份。不能从视频画面补推。
3. [德语 PlayStation Blog 的 gamescom 2025 hands-on 文章](https://blog.de.playstation.com/?p=193951)明确列出 `White Serpent & Crimson Viper`、`Soft Snake Sword` 等试玩武器，但署名为自由撰稿人，内容是作者直接试玩观察。它可以成为高质量 `observation` Source，不能仅因刊载于 PlayStation 域名而改成游戏官方确认。
4. 现有[由 S-GAME 创始人兼 CEO 发布的 PlayStation Blog State of Play 文章](https://blog.playstation.com/2026/08/17/phantom-blade-zero-state-of-play-dives-deep-into-combat-and-the-wulin-world/)明确确认整体武器数量、升级和重铸系统，但没有逐项写出个体武器名称。

### 结论

**未找到足够强的个体 Weapon official 正向样本。**

本轮不新增 Weapon，也不创建为了通过 validator 而设计的伪 official Fact。现有 validator 的规则仍保留：`status=official` 的 Fact 至少引用一个 `authority=official` Source；但该规则尚未获得真实个体 Weapon 正向数据验证。

## 3. 成对武器 Entity 边界：白蟒赤练

### 证据边界

当前生产页以“白蛇 & 赤蛇”记录一个“双刀组”。[机核对蛇年试玩的直接 hands-on 记录](https://www.gcores.com/articles/193907)使用组合名“白蟒赤练”，并把试玩中的两件新主武器列为“灵蛇软剑”与“白蟒赤练”；同文说明“白蟒赤练”这一个主武器由左手短刀赤练和右手长剑白蟒共同组成，并共享轻重攻击与组合连段。

该材料是第三方直接试玩观察，不足以冻结正式中文名称，但足以分析 Demo 中的装备身份。

| 判断维度 | 当前证据 | 结论 |
| --- | --- | --- |
| 是否拥有一个正式名称 | hands-on 使用组合名“白蟒赤练”；官方正文未直接确认正式名 | 组合名可作观察值，正式名仍待确认 |
| 是否作为一个装备项出现 | 文章把 Demo 的两件主武器列为“灵蛇软剑”与“白蟒赤练” | 支持一个装备身份 |
| 是否一次获取 | 没有可靠资料 | 未知 |
| 是否占用一个装备槽 | 作为一个“主武器”与灵蛇软剑并列，强烈支持单槽，但未取得正式版 UI 文字 | 发售前观察支持单槽 |
| 是否共享一套招式体系 | 左右手兵刃分别参与轻重攻击，并能组合成连续招式 | 是 |
| 是否可以独立拆分装备 | 没有证据 | 未知 |
| 是否拥有独立属性 | 没有证据 | 未知 |
| 官方称一件还是多件 | 官方文字只说“双蛇”；没有明确 Entity 数量 | 未冻结 |

### Entity 结论

**A. 应建一个 Weapon Entity。**

理由是 Entity 跟随 Demo 中的独立装备身份和共享招式体系，而不是左右手可见物体数量。若未来迁移该样本，应以一个 Weapon 保存组合身份；“白蟒”“赤练”可先作为组成部分名称或待确认别名处理，但本轮不新增字段、不写入 JSON。

该结论只冻结“物理上由多个部件组成，不自动拆成多个 Weapon”的规则，不冻结正式中文名称、获取方式、槽位或正式版是否允许拆分。

## 4. 身份不确定与 supersededBy 风险

当前 schema 可以安全等待身份确认，前提是遵循一条迁移纪律：证据不足以判断独立装备身份时，不要提前分配稳定 Weapon ID，只保留在映射报告或待核查清单中。`recordState=draft` 和 pending-review Fact 能表达事实不确定，但不能把一个错误的实体边界自动修正为多个实体。

现有单值 `supersededBy` 适合一对一记录替换，不足以无损表达一拆多或多合一。如果未来已入库的 Weapon 确实发生身份拆分/合并，不能把它硬塞进单值 `supersededBy`；届时需要单独设计迁移映射或多目标 supersession。当前白蟒赤练案例结论为一个 Entity，没有触发该问题，因此本轮不修改字段。

这是一项冻结前风险和建模纪律，不是当前三件 Weapon 数据的结构性错误。

## 5. internal editorial Source 审核

### 审核前使用情况

`source:yingzhirenling-weapons-editorial-2026-08-26` 只被以下两个 Fact 使用：

- `fact:weapon:tang-hengdao:editor-rating`
- `fact:weapon:qinglong-lueyue-dao:editor-rating`

两个 Fact 同时已有 `basisFactIds`，分别指向对应的 `weapon.observedTrait`。internal Source 只说明星级曾出现于本站旧 HTML，属于“判断最初出现在哪里”，不是支持判断正确性的独立证据。

### 本轮处理

- 两个 rating Fact 改为 `sourceIds: []`。
- 保留各自的 `basisFactIds`。
- 删除没有独立方法论、测量或调查价值的 internal Source 记录。
- validator 收紧为：editorial Fact 必须具备 `basisFactIds`；只有引用独立 `authority=internal` Source 时，才允许没有 basis。普通外部 Source 不能替代结构化依据。

### 冻结规范

**普通 editorial Fact 默认允许且优先使用空 `sourceIds`，不要求 internal Source；但必须有非空 `basisFactIds`。**

只有 internal Source 本身记录可独立核查的内部证据时才保留，例如：

- 明确的编辑评测方法论和评测版本
- 本站原创调查及样本说明
- 可复现的内部测试或测量
- 无法由已有 Fact 引用表达的原始内部数据

“本站旧 HTML 中曾写过这个结论”本身不构成证明该结论正确的 Source。

## 6. Freeze Gate 回答

1. **是否已有真实 official Weapon 正向样本？** 否；没有找到达到官方文字直接确认个体身份标准的样本。
2. **official Source → Fact 规则是否工作自然？** 规则本身自然，并阻止无官方 Source 的 official Fact；但仍缺真实正向数据验证。
3. **成对武器 Entity 边界是否有明确规则？** 有：跟随独立装备身份和共享招式体系，不跟随物体数量。白蟒赤练在当前 Demo 证据下判定为一个 Weapon。
4. **schema 能否应对身份暂不确定？** 可以安全等待，但必须延迟创建稳定实体；pending-review 只能表达 Fact 不确定，不能修复错误实体边界。
5. **一拆多/多合一是否破坏 supersededBy？** 会超出当前单值字段的表达能力；本案例未触发，但在首次真实拆分/合并需求出现前必须重新设计迁移表达。
6. **internal editorial Source 规范？** 普通 editorial 默认不要求 internal Source，优先 `sourceIds=[] + basisFactIds`；只有独立内部证据才使用 internal Source。
7. **是否新增违反 P1-1 的例外字段？** 否。本轮没有新增数据字段或 Entity Type。
8. **是否有必须立即修改 schema 的结构性问题？** 当前试点没有。单值 supersededBy 的拆分/合并限制是已记录风险；通过暂缓创建身份不清的 Entity，可在本阶段安全规避。

## 7. Freeze Gate 结论

**当时的结论：A. 保持 `1.0-draft`，继续验证。**

主要原因是 official 个体 Weapon 正向样本仍缺失，`official` 规则尚未完成真实正向验证；同时应在首次实际拆分/合并案例出现前验证 supersession 迁移方案。该历史建议已由后续 P1-2.2 验证及人工批准取代，不代表当前 schema 状态。
