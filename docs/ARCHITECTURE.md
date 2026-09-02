# High-Level Architecture

当前生产架构是 Astro static output 的静态优先数据派生链：

```text
Knowledge JSON + Media contract
    ↓
Validators
    ↓
Astro build-time loaders / projections
    ↓
Astro static pages + generated Production Search index + generated sitemap
    ↓
legacy static-copy bridge
    ↓
dist verification
    ↓
Netlify static hosting
    ↓
Browser
```

浏览器运行时由静态 HTML、native CSS 和 Vanilla JavaScript 组成，JavaScript 只提供导航、主题、搜索等 progressive enhancement。核心 SEO 内容不依赖 runtime Knowledge JSON fetch。

Netlify production 和 Deploy Preview 都运行 `npm ci && npm run build`，发布 `dist/`。该 build chain 包含 Knowledge / Media validation、Astro static build、Production Search generation、legacy bridge copy 和 static output verification。

当前生产栈不是 Next.js、React、Vue、Svelte、Tailwind、shadcn/ui、SSR、SPA、CMS 或数据库应用。

# Repository Layers

| Layer | Current location | Responsibility |
| --- | --- | --- |
| Astro production implementation | `src/layouts/`, `src/components/`, `src/lib/`, `src/pages/` | shared layout/components, Knowledge loaders/projections, Collection/detail routes and sitemap |
| Styles/runtime | `css/`, `js/` | 全站视觉和 progressive enhancement |
| Knowledge source | `data/` | Entity、Fact、Source、Version、Registry |
| Media source | `data/media.json` + `assets/media/` | 独立、经审核的 Entity presentation media；不属于 Fact 或 Knowledge Schema |
| Validation/build | `scripts/`, `scripts/astro/` | validators, Search generation, bridge copy and static output checks |
| Derived search | `generated/` | shadow/production Search Documents |
| Legacy bridge inputs | `pages/*.html`, `404.html` | guide/videos/about/about-site/404 compatibility pages copied into `dist/` |
| Legacy compatibility artifacts | `pages/generated/` | historical Weapon paths retained only for explicit redirects/compatibility |
| Deployment output | `dist/` | derived static output published by Netlify; never a Knowledge source |
| Contracts/history | `docs/` | 架构、Schema、阶段契约与治理规则 |
| Hosting/routing | `netlify.toml` | 静态发布、headers、rewrite、redirect、404 |

`data/` 是结构化知识 Source of Truth。`generated/`、legacy compatibility artifacts 和 `dist/` 都是派生产物，不得被反向当作 Fact 或 Source 的证据。

P2-UI-4 uses a shared Astro `EntityDetailLayout` with small type adapters in `src/lib/detail-models.mjs`. The layout owns the static breadcrumb, Hero/media fallback, Quick Facts, Fact sections, Relation slot, Source Panel, and return link; adapters only select type-appropriate Fact emphasis. Media remains a build-time presentation lookup, not a Knowledge or Fact field.

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

状态变更由人工 Publication Gate 批准，build-time projection 不得自动修改 `recordState`。当前四类 Entity 都使用此 contract；draft 不得进入 Production Search、static detail output 或 sitemap。精确 operational inventory 以 [CURRENT-STATE.md](CURRENT-STATE.md) 为准。

# Search Architecture

生产搜索由两个独立层组成：

```text
js/main.js 内的 Page Search Documents
    +
/generated/search-index.production.json
```

页面加载后最多 fetch 一次 production Entity index，再把合法 Entity 文档映射到现有搜索结果结构。Page 和 Entity 使用各自 identity，不按 route 强制去重，因此 Collection Page result 可以与其 Entity result 同时存在。

Entity index 的网络、HTTP、JSON 或 contract 错误只使 enhancement 进入 failed；Page Search 必须继续工作。成功进入 ready 后的搜索渲染错误不得被误报为 Entity loader 错误。

`generated/search-index.shadow.json` 只供构建和审查，生产运行时从不加载。

# Entity Detail Architecture

所有四类 Entity 使用 shared Astro detail architecture：

```text
data/<entity-type>/*.json + Sources / Relations / Versions / Registries
        ↓
validators
        ↓
src/lib/ Knowledge loaders + type projections
        ↓
src/pages/<collection>/[slug].astro + published-only getStaticPaths
        ↓
BaseLayout + EntityDetailLayout + type-appropriate detail model
        ↓
dist/<collection>/<slug>.html
        ↓
Netlify canonical rewrite
```

`BaseLayout` owns static document structure and shared shell. `EntityDetailLayout` owns breadcrumb, Hero/media fallback, Quick Facts, Fact sections, Relation slot, Source Panel and return link; detail-model adapters select type-appropriate Fact emphasis. `CollectionLayout` and `EntityCard` provide the matching Collection pattern. Media remains a build-time presentation lookup, not a Knowledge or Fact field.

Only `recordState=published` records receive static detail output. Core Fact, Source, title, description, canonical, H1 and summary are present in static HTML; browsers do not fetch Knowledge JSON to render them.

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

- Collection routes：`/weapons`、`/characters`、`/bosses`、`/world`
- Entity detail routes：`/weapons/{slug}`、`/characters/{slug}`、`/bosses/{slug}`、`/world/{slug}`
- `slug` 来自显式 `Entity.slug`
- `displayName` 改变不自动改变稳定 Entity ID 或 slug
- `.html` 物理路径不是独立 SEO 页面，应单跳归一到 canonical
- canonical 使用无尾斜杠短路由

legacy bridge routes remain for `/guide`, `/videos`, `/about`, `/about-site` and `/404`; they are not the primary Astro Entity architecture.

# Sitemap and Metadata

Astro sitemap route combines stable legacy canonical pages with the same published Entity projection used by static details and Production Search. Entity `lastmod` comes from `updatedAt`, never build current time. Draft and archived active records are excluded. Use [CURRENT-STATE.md](CURRENT-STATE.md) for the current URL count.

# Long-form Content Boundary

结构化事实留在 JSON。攻略长文、论证和编辑内容继续使用现有 HTML，未来出现真实需求时可增加可选 Markdown。

当前 Entity details use summary, Fact and Source without a required Markdown layer. Do not create empty Markdown merely for architectural symmetry.

# Known Non-blocking Technical Debt

1. **Legacy bridge**：五个 bridge pages and explicit compatibility redirects remain until separately migrated.
2. **Netlify explicit Entity rewrites**：published-only route rules protect unknown/draft 404 behavior; future route-scale changes require a dedicated audit.
3. **Trailing-slash duplicate 200**：部分 detail trailing-slash aliases may remain reachable; canonical is the no-trailing-slash short route.
4. **Third-party Baidu failures**：`hm.baidu.com`、`zz.bdstatic.com` 在部分网络环境可能失败或拖延 load；不能自动归因于 Knowledge、Search 或 Entity architecture。

这些问题不应在无关阶段顺手修改。

# Migration Direction

## Current

继续保护 Astro static output、Knowledge JSON、build-time projection、static SEO 与 Vanilla JavaScript progressive enhancement。不要在 English Site Phase 1 重新建设平行 production architecture。

## Future Server Architecture Triggers

只有用户账号、跨设备 Build 保存、数据库、服务端 API、私有后台、UGC、个性化推荐、服务端计算或动态排行榜等真实需求出现后，才重新评估 Next.js 等服务端框架。

# Related Standards

- 项目目标：[PROJECT.md](PROJECT.md)
- 页面与 SEO：[PAGE-SEO-STANDARD.md](PAGE-SEO-STANDARD.md)
- UI 与模板：[UI-TEMPLATE-STANDARD.md](UI-TEMPLATE-STANDARD.md)
- 开发规则：[DEVELOPMENT-RULES.md](DEVELOPMENT-RULES.md)
