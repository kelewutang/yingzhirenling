# Scope

当前生产是 Astro static component system。本文件定义共享布局、组件、build-time static HTML 与 progressive enhancement 的 UI/Template 行为；它不批准引入平行 UI framework。

# Shared Page Anatomy

未来页面应尽量保持以下结构一致：

1. Header
2. Primary Navigation
3. Breadcrumb（适用时）
4. Main
5. Page 或 Entity Header
6. Fact / Content Sections
7. Source Section（存在真实引用时）
8. Return / Related Navigation
9. Footer

不要为单个 Entity 引入全新视觉主题。优先复用现有 `css/style.css` 和语义结构。

# Shared Production System

- `BaseLayout`、shared Header / Footer and Global Search;
- `CollectionLayout` and `EntityCard` for the four Entity Collections;
- `EntityDetailLayout`, type-appropriate detail-model adapters and shared Fact/Source/Relation presentation;
- deterministic no-media fallback backed by the separate Media contract;
- Ink & Steel design system and CSS-only global/type-specific atmosphere layers.

# Entity Page

Weapon、Character、Boss 和 Location 都使用统一的生产 detail pattern，包含：

- 首页、对应 Collection、当前 Entity 的 breadcrumb；
- 唯一 H1；
- summary 和资料更新时间；
- 发售前资料边界说明；
- 按主题分组的 Fact；
- 本页实际使用的 Source；
- 返回 `/weapons` 的链接。

只有真实数据存在时才输出可选区块。Relation、Build、获取地点等没有数据时，不显示空 section、占位列表或猜测内容。

# Fact Status UI

| Fact status | User-facing label |
| --- | --- |
| `official` | 官方确认 |
| `observation` | 试玩观察 |
| `third-party` | 第三方信息 |
| `editorial` | 编辑推测或编辑评价 |
| `pending-review` | 待后续核查 |
| `release-verified` | 正式版验证；仅发售后允许 |

颜色、badge 和小标题只能帮助识别，不能改变数据状态含义。

# Critical Trust Rule

不要显示 Entity-level 或 Page-level 的“整体官方”“整页试玩观察”“全部已验证”。

Fact status 才是可信度边界。同一个 Entity 可以同时具有 official、observation、editorial 和 pending-review Fact。

Source 是官方主体，也不自动把画面观察升级为 official；`recordState=published` 也不能显示成官方确认。

# Pending Review

用户界面不得显示：

- `null`
- `undefined`
- `N/A`
- 内部 `reviewNote`
- 内部枚举或待填 key

使用安全、具体但不制造事实的文案，例如：

- “详细动作与性能尚待更多可靠资料确认。”
- “获取方式尚待后续官方资料或正式版验证。”

pending-review 值为未知时，不在 HTML 中保留隐藏的待核值。

# Editorial

editorial 区块必须明确说明是本站编辑判断。评分、推荐或强度判断不得看起来像：

- 官方评级；
- 试玩客观数值；
- 正式版验证结果；
- 社区共识。

已有 observation/official Fact 作为判断依据时，使用 `basisFactIds` 呈现依据。本站旧 HTML 不是证明本站判断正确的证据。

# Observation

直接来自试玩、Demo、视频画面或实机演示的可观察内容显示为“试玩观察”。即使载体由官方发布，也不能仅因 Source authority 升级为“官方确认”。

# Source UI

Source 区只展示当前页面 Fact 实际引用的来源，建议包含：

- publisher；
- title；
- 可读来源类型；
- publishedAt（存在时）；
- 原始来源链接。

Fact status 与 Source type/authority 必须分开。不要直接向用户显示内部 authority 枚举来代替说明。

重复 URL 应稳定去重；排序必须 deterministic，避免每次构建产生无意义 diff。

# HTML Safety

- 来自 JSON 的文本一律 HTML escape。
- 普通 string 不作为 raw HTML 渲染。
- 外部 URL 只接受 `http:` 或 `https:`。
- `target="_blank"` 必须同时使用 `rel="noopener noreferrer"`。
- 不输出本机路径、内部文件名、reviewNote、未公开 ID 或调试信息。
- 属性值和文本节点分别正确转义。

# Accessibility

- Navigation 和主要 region 使用合理语义及可读 label。
- 交互使用 button/link，不用只响应鼠标的普通 div。
- 菜单的 `aria-expanded` 必须与实际状态一致。
- H1/H2/H3 层级表达结构，不只表达字号。
- status 不能只靠颜色区分，必须有可读文字。
- 键盘 Escape、focus return 和 modal 行为不得在无关模板任务中破坏。

# Responsive Baseline

最低实际验证：

- 390px mobile；
- 1280px desktop。

重点检查：

- Header 和移动导航；
- Breadcrumb、H1 和 summary；
- Fact/Source 卡片；
- 长 URL 与长标题；
- flex/grid 子元素最小宽度；
- 搜索打开、结果链接和关闭；
- 页面 `scrollWidth` 不大于 viewport/client width。

# Reuse Threshold

同一模板逻辑第三次出现时，必须评估抽取共享 helper/template，不应进行第三次复制。

尤其关注：

- Header/Footer；
- metadata 和 canonical；
- breadcrumb；
- Fact status/value renderer；
- Source renderer；
- route/sitemap projection。

第三次复制是评估现有 Astro helper/component 抽取边界的信号，不等于建立新的 UI framework。

# Current Boundary

- 四类 published Entity 使用 shared Astro Collection and Detail patterns；published-only routes 在 build time 生成静态 HTML。
- Relation 区只在有经过 Schema 校验的 production Relation 时输出；当前已有该条件下的展示。
- Current Production Media inventory is recorded in `CURRENT-STATE.md`; when no eligible Entity Media exists, the deterministic fallback is intentional. Background atmosphere is not Entity Media.
- Visual Atmosphere stages are complete. Bridge pages remain global-foundation only.
- English Site Phase 1 应复用稳定的 Astro/UI component architecture。已批准的 deployment direction 是独立 `pbzguides.com`、独立 GitHub repository 与独立 Netlify site；中文和英文页面保持 self-canonical，并在存在已批准页面映射时通过 `hreflang` 建立语言对应关系，不进行自动语言跳转。
- Knowledge localization、locale abstraction、具体 hreflang mapping、missing-translation behavior、English Search 和 sitemap implementation 仍需单独 architecture decision；本规范不预先实现这些能力。

# Related Sources of Truth

- 页面和 SEO：[PAGE-SEO-STANDARD.md](PAGE-SEO-STANDARD.md)
- 当前架构：[ARCHITECTURE.md](ARCHITECTURE.md)
- Fact/Source 数据规则：[knowledge-schema-1.0.md](knowledge-schema-1.0.md)
