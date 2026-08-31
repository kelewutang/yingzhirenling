# High-Level Architecture

当前生产架构是静态优先的数据派生链：

```text
Knowledge JSON
    ↓
Validator
    ↓
Node Generators
    ↓
Generated Static Artifacts
    ↓
Git / Netlify Static Hosting
    ↓
Browser
```

浏览器运行时由静态 HTML、CSS 和 Vanilla JavaScript 组成，JavaScript 只提供导航、主题、搜索等 progressive enhancement。

Netlify 当前 `build.command` 不执行 Knowledge validator 或 generator。生成器在提交前运行，经过审查的 JSON 和 HTML 派生产物与源代码一起提交，Netlify 直接发布仓库静态文件。

当前生产栈不是 Next.js、React、Vue、Svelte、Astro production、Tailwind、shadcn/ui、SSR、SPA、CMS 或数据库应用。

# Repository Layers

| Layer | Current location | Responsibility |
| --- | --- | --- |
| Hand-authored pages | `index.html`, `pages/*.html` | 现有页面与长篇内容 |
| Styles/runtime | `css/`, `js/` | 全站视觉和渐进增强 |
| Knowledge source | `data/` | Entity、Fact、Source、Version、Registry |
| Media source | `data/media.json` + `assets/media/` | 独立、经审核的 Entity presentation media；不属于 Fact 或 Knowledge Schema |
| Validation/build | `scripts/` | 严格校验和 deterministic 派生 |
| Derived search | `generated/` | shadow/production Search Documents |
| Derived pages | `pages/generated/` | published Entity 静态详情页 |
| Contracts/history | `docs/` | 架构、Schema、阶段契约与治理规则 |
| Hosting/routing | `netlify.toml` | 静态发布、headers、rewrite、redirect、404 |

`data/` 是结构化知识 Source of Truth。`generated/` 和 `pages/generated/` 是派生产物，不得被反向当作 Fact 或 Source 的证据。

# Knowledge Layer

当前核心类型：

- Entity：具有稳定游戏身份的对象；
- Fact：拥有独立 value、status、Source、日期、版本和 scope 的最小可信度单元；
- Source：可被多个 Fact 引用的独立来源记录；
- Relation：Entity 之间经过证据支持的有向关系；
- GameVersion：资料阶段、Demo、正式版本或补丁；
- Registry：Fact key、平台、难度等受控词表。

字段、状态、Entity Resolution 和校验规则以 [Knowledge Schema 1.0](knowledge-schema-1.0.md) 为唯一规范，不在本文件复制完整 Schema。

# Fact Trust Model

```text
Fact = trust boundary
Entity ≠ trust boundary
Page ≠ trust boundary
Source.authority ≠ Fact.status
```

官方主体发布的视频中可观察到的信息仍可能是 `observation`。`recordState=published` 只授予生产派生资格，不表示 Entity 整体 official、confirmed 或 release-verified。

发售前允许的 Fact 状态包括 official、observation、third-party、editorial 和 pending-review。`release-verified` 发售前禁止用于生产数据。

# Publication Model

| recordState | Validator | Shadow derivation | Production derivation |
| --- | --- | --- | --- |
| `draft` | 校验 | 可进入 | 排除 |
| `published` | 校验 | 进入 | 进入 |
| `archived` | 校验 | 排除 active output | 排除 active output |

状态变更由人工 Publication Gate 批准，generator 不得自动修改 `recordState`。

当前：

- `weapon:tang-hengdao`：published；
- `weapon:ya-hengdao`：published；
- `weapon:qinglong-lueyue-dao`：draft，不得进入生产详情页、Production Entity Search 或 sitemap。

# Search Architecture

生产搜索由两个独立层组成：

```text
js/main.js 内的 Page Search Documents
    +
/generated/search-index.production.json
```

页面加载后最多 fetch 一次 production Entity index，再把合法 Entity 文档映射到现有搜索结果结构。Page 和 Entity 使用各自 identity，不按 route 强制去重，因此“武器图鉴”页面结果可以与唐横刀、牙横刀 Entity 结果同时存在。

Entity index 的网络、HTTP、JSON 或 contract 错误只使 enhancement 进入 failed；Page Search 必须继续工作。成功进入 ready 后的搜索渲染错误不得被误报为 Entity loader 错误。

`generated/search-index.shadow.json` 只供构建和审查，生产运行时从不加载。

# Weapon Detail Architecture

已验证链路：

```text
data/weapons/*.json
  + data/sources/*.json
  + data/versions/*.json
  + data/registries/*.json
        ↓
scripts/validate-data.mjs
        ↓
scripts/build-weapon-pages.mjs
        ↓
pages/generated/weapons/<slug>.html
        ↓
Netlify exact rewrite
        ↓
/weapons/<slug>
```

生成器只为 `recordState=published` 的 Weapon 输出页面。核心 Fact、Source、title、description、canonical、H1 和 summary 已存在于静态 HTML；浏览器不 fetch Weapon Knowledge JSON 来生成核心内容。

当前 production canonical routes：

- `/weapons/tang-hengdao`
- `/weapons/ya-hengdao`

青龙掠月刀保持 draft，没有生产详情页。

# Rendering Principle

面向搜索引擎和无 JavaScript 用户的核心内容必须在 build time 写入 HTML，包括：

- title、meta description、canonical；
- H1、summary、breadcrumb；
- Fact value、status、checkedAt 和 version context；
- 实际被 Fact 引用的 Source。

浏览器 runtime 可以增强搜索、导航、主题和交互，但不得成为核心知识的唯一渲染路径。

# SEO Derivation

```text
Entity.slug
  → detail route
  → canonical
  → title / description / H1
  → sitemap URL + updatedAt lastmod
  → Production Search Document route
```

上述派生必须保持一致。详情文件缺失或 canonical 不匹配时，production Search build 应非零失败，不能静默回退到错误 route。

# Routing Principle

- Collection route：`/weapons`
- Weapon Entity detail：`/weapons/{slug}`
- `slug` 来自显式 `Entity.slug`
- `displayName` 改变不自动改变稳定 Entity ID 或 slug
- `.html` 物理路径不是独立 SEO 页面，应单跳归一到 canonical
- canonical 使用无尾斜杠短路由

Boss 和 Character 详情路由尚未上线，不得把候选模式写成 current production。

# Sitemap and Metadata

当前 sitemap 共 11 个 URL：原有 9 个页面加 2 个 published Weapon 详情页。Weapon `lastmod` 来自 `updatedAt`，不使用 build 当前时间。

当前 sitemap 仍人工同步。生成器数量扩大后，应让同一 published Entity projection 派生页面、Search route 和 sitemap，避免多处漂移。

# Long-form Content Boundary

结构化事实留在 JSON。攻略长文、论证和编辑内容继续使用现有 HTML，未来出现真实需求时可增加可选 Markdown。

唐横刀和牙横刀当前仅凭 summary、Fact 与 Source 已构成完整最小详情页，因此没有 Markdown layer。不要为了架构对称创建空 Markdown 文件。

# Known Non-blocking Technical Debt

1. **Header/Footer template duplication**：Weapon generator 复制现有结构；跨 Entity 类型继续复制前应抽共享模板或重评 Astro。
2. **Fact renderer growth**：已处理 status、value type、pending-review、editorial、observation、Source 和 basis Fact；继续分叉会模糊模板边界。
3. **Manual sitemap**：当前 11 个 URL 可控，Entity 增长时优先自动生成。
4. **Explicit Netlify Entity routes**：Pilot 的两条精确规则可接受，不适合几十或几百实体。
5. **Trailing-slash duplicate 200**：部分 `/weapons/{slug}/` 也能返回 200，canonical 已统一到无尾斜杠；这是全站 URL normalization 技术债。
6. **Third-party Baidu failures**：`hm.baidu.com`、`zz.bdstatic.com` 在部分网络环境可能失败或拖延 load；不能自动归因于 Knowledge、Search 或 Weapon 架构。

这些问题当前不阻塞 P1-6，不应在无关阶段顺手修改。

# Migration Direction

## Current

继续 JSON + zero-dependency Node generator + static HTML。

## Candidate: Astro Static Output

出现下列信号时重新评估，而不是自动迁移：

- 第二个 Entity 类型进入详情页；
- 详情页接近或超过 20 个；
- Header/Footer 复制明显；
- Fact renderer 持续膨胀；
- route、canonical、metadata 和 sitemap 多处重复维护；
- JSON + Markdown 成为真实需求；
- generator 开始演变成自制静态站框架；
- Boss/Character 需要共享详情模板。

Astro 候选必须保持 static output、现有 URL 和静态 SEO 内容。

## Future Server Framework

只有用户账号、跨设备 Build 保存、数据库、服务端 API、私有后台、UGC、个性化推荐、服务端计算或动态排行榜等真实需求出现后，才重新评估 Next.js 等服务端框架。

# Related Standards

- 项目目标：[PROJECT.md](PROJECT.md)
- 页面与 SEO：[PAGE-SEO-STANDARD.md](PAGE-SEO-STANDARD.md)
- UI 与模板：[UI-TEMPLATE-STANDARD.md](UI-TEMPLATE-STANDARD.md)
- 开发规则：[DEVELOPMENT-RULES.md](DEVELOPMENT-RULES.md)
