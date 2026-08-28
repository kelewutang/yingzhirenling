# P1-9：Astro Migration Preparation Gate

## A. Repository Baseline

- 分支：`main`
- 基线 commit：`c9e38be fix: clarify character role fact semantics`
- 开始时工作区干净，HEAD 已包含 P1-8.1 `character.role` 语义修正。
- 根生产基线通过：Knowledge validation 为 Sources 3、GameVersions 2、Weapons 3、Characters 3、Relations 2、Facts 27；Shadow Search 为 6，Production Search 为 2；Weapon generator 仍只输出唐横刀、牙横刀。
- POC 没有修改现有生产页面、Knowledge Data、generated artifacts、root scripts、Netlify、sitemap、robots 或治理 Source of Truth。
- `docs/PROJECT.md` 的 “Next Direction” 仍把 P1-7 写成 planned work，与当前历史进度不一致；本轮权限禁止修改，作为非阻塞文档债记录。

## B. POC Files / Dependencies

POC 位于 `experiments/astro-migration-poc/`，可整目录删除。源码包含：

- `package.json`、`package-lock.json`、局部 `.gitignore`、`astro.config.mjs`；
- 一个 root validator 调用 helper；
- 一个 legacy page / asset copy bridge；
- shared layout、breadcrumb、entity header、Fact、Source、Relation components；
- build-time Knowledge loader 与 Weapon / Character projection；
- Weapon / Character dynamic routes；
- static sitemap endpoint。

直接依赖只有 `astro@7.2.8`。`package-lock.json` 为 lockfile v3，记录 286 个 package entries；本地实际安装约 186 个 package。`esbuild@0.28.2` 是 Astro 依赖树中唯一需要安装脚本的包，已通过精确版本 `allowScripts` 明确批准。

标准复现命令：

```text
cd experiments/astro-migration-poc
npm ci
npm run build
npm run preview -- --host 127.0.0.1 --port 4321
```

## C. Astro Version / License / Node Compatibility

- Astro：`7.2.8`，稳定版，无 alpha / beta / nightly 标记；npm registry 在实施时将其列为 latest。
- License：MIT。
- Astro engines：Node `>=22.12.0`、npm `>=9.6.5`、pnpm `>=7.1.0`。
- 验证环境：Node `24.19.0`、npm `11.17.0`，兼容。
- 初次 `npm ci` 在当前受限 NTFS / 网络环境约 4 分钟；依赖已缓存后，Astro 自身 build 约 2 秒，包含 validator 与 copy bridge 的完整 build 约十余秒。
- 安装没有报告 deprecated package。完整在线 vulnerability audit 在本轮收尾时被中止，因此不能声称依赖树零漏洞；这不影响静态 POC 结论，但正式迁移前应在 P1-10 / CI 重跑 audit。

## D. POC Architecture

```text
root scripts/validate-data.mjs
        ↓
root data/**/*.json (build-time read only)
        ↓
POC Knowledge loader + entity-specific projection
        ↓
shared Astro layout/components
        ↓
static .html + static sitemap
        ↓
POC-only copy bridge for legacy pages/assets
        ↓
dist/
```

Astro 配置固定 `output: static`、`trailingSlash: never`，默认 `build.format: file`。没有 adapter、SSR、server action、API backend、Content Collections、Markdown、前端 UI framework 或数据库。

## E. Knowledge Data Loading

`src/lib/knowledge.mjs` 在 build time 从仓库根目录直接读取当前 `data/weapons`、`data/characters`、`data/relations`、`data/sources` 和 `data/versions`。没有复制第二份 Knowledge JSON。

构建前由 `scripts/run-root-validator.mjs` 从正确 repo cwd 调用现有 `scripts/validate-data.mjs`。POC 没有复制或重写 validator 规则，Schema 仍为 `1.0-implementation`。

读取顺序按文件名稳定排序；Source、Version、Entity 建立 build-time Map。生成 HTML 不包含本机绝对路径，也不在浏览器运行时请求 Knowledge JSON。

## F. Shared Layout / Component Boundary

共享边界：

- `BaseLayout.astro`：document、head、title、description、canonical、CSS、header/nav、main shell、footer、现有 `main.js`；
- `Breadcrumb.astro`、`EntityHeader.astro`；
- `FactList.astro`、`SourceList.astro`、`RelationList.astro`；
- shared Knowledge / Source / status / URL-safety helpers。

Entity-specific 边界保留在 Weapon / Character projection 和各自 route。没有构造一个含大量 Entity type 分支的巨大 component。

## G. Weapon Static Route

`src/pages/weapons/[slug].astro` 的 `getStaticPaths()` 只投影 `recordState=published` 的 Weapon：

- `/weapons/tang-hengdao`
- `/weapons/ya-hengdao`

青龙掠月刀仍为 draft，不生成 POC Weapon page。每个页面直接从 `slug` 派生 route 与无尾斜杠 canonical。

## H. Character Preview Route

`src/pages/characters/[slug].astro` 使用实验层显式 allowlist：

- `character:soul`
- `character:mo-yuan`
- `character:the-hunt`

三条记录仍为 `recordState=draft`、`publishedAt=null`。页面带 `noindex,nofollow`，并显示 “POC publication candidate preview”。allowlist 只存在于实验 loader，不进入 Schema 或 production data。

## I. Relation Presentation

Relation 中文文案保留在 presentation layer：

- `parentOf`：source 页正向显示“子女”，target 页反向显示“父亲”；
- `formerCompanionOf`：正反向显示“昔日同伴”。

POC 不创建反向 Relation data。魂页面自然显示魔渊为父亲、The Hunt 为昔日同伴；魔渊页面显示魂为子女。

Character Source 汇总同时收集 displayed Fact 与 displayed Relation 的 `sourceIds`，再按 Source ID 与 URL 稳定去重。魂与魔渊各显示 2 个唯一 Source，The Hunt 显示 1 个。

## J. Published ↔ Draft Safety

POC 把 preview relation rendering 和 production relation projection 分开。production projection 严格要求：

```text
source Entity published
AND target Entity published
AND Relation valid
```

当前结果为 `0 production-visible relations`，并在 POC Character HTML 的 `data-production-relation-count="0"` 中留下可检查标记。Relation.status=official 没有绕过 Entity publication state。

Character 不进入 POC sitemap 或复制的 Production Search JSON。生产搜索仍只有唐横刀和牙横刀。

## K. Existing CSS Reuse

POC 原样复制并使用根 `/css/style.css`。源文件与 dist 文件 SHA-256 一致：

```text
5c0463618ce6d2233a2f0c9af34a586bc048f2ba8a4a7b08f4c33b3b8e6cfe9f
```

没有新增 Astro CSS、Tailwind、UI library 或视觉重设计。实体页面继续使用现有 `container`、`article`、`info-provenance`、`info-status`、`alert`、`btn` 等结构。

## L. Existing JavaScript Reuse

POC 原样复制并使用根 `/js/main.js`。源文件与 dist 文件 SHA-256 一致：

```text
5e53122a6285a90abba90bdb57f62c1062479c4f438be389297599c0958b8d64
```

只存在一个客户端 script：`/js/main.js`。Astro 没有注入 framework runtime，也没有 component hydration。

现有 JS 对 `.nav-toggle`、`.nav-links`、search trigger 与 theme switcher DOM 有结构约定；BaseLayout 为兼容这些约定保留现有 shell。这是迁移成本，但不要求重写 main.js。

## M. Search Compatibility

POC copy bridge 原样复制 `/generated/search-index.production.json`，源与 dist SHA-256 一致：

```text
4cf4ac69147bd8dab31bd07f1eb75258c7f96a4438d86a5a71143dd53feec7ac
```

本地 HTTP 返回 200，JSON 仍只有：

- `weapon:tang-hengdao`
- `weapon:ya-hengdao`

没有 shadow index，没有 Character preview document，也没有 runtime Knowledge fetch。现有 Page Search 与 Entity Search 合并逻辑未修改。

由于本轮可用工具没有浏览器自动化，未实际键入“唐横刀 / 牙横刀 / 武器”；但 main.js 与 production JSON 均为字节一致复制、对应 route 均返回 200，contract-level compatibility 通过。交互回归必须在 P1-10 Deploy Preview 补做。

## N. Sitemap Strategy

`sitemap.xml.js` 是小型 static endpoint，从同一个 published Weapon projection 自动追加 Entity route，同时保留 9 个 legacy canonical 的显式过渡清单。

实际输出 11 个 URL：9 个 legacy canonical + 2 个 published Weapon；3 个 Character preview 为 0。lastmod 来自现有页面固定日期或 Weapon.updatedAt，不使用 build current time。

这证明 Entity route 与 sitemap 可以共享 publication projection。所有 legacy page 迁入 Astro 后，过渡清单应改为 page route source 并删除 copy bridge。

## O. URL / Canonical / Trailing Slash

比较结果：

- directory style：`dist/weapons/tang-hengdao/index.html`；静态 host 往往偏向尾斜杠目录 URL。
- file style：`dist/weapons/tang-hengdao.html`；最接近当前 Netlify Pretty URL `/weapons/tang-hengdao`。

POC 选择 file style。Astro preview 实测：

- `/weapons/tang-hengdao` → 200
- `/weapons/tang-hengdao/` → 404
- `/characters/soul` → 200
- `/characters/soul/` → 404

Weapon canonical 精确保持现有无尾斜杠 URL。Character canonical 只属于 noindex POC candidate，并非生产发布。

Netlify Pretty URLs 是否继续让 slash variant 返回 200 尚未经过 Deploy Preview；不能把 Astro preview 结果冒充 Netlify 生产结论。

## P. Netlify Route Implications

file-style dist 直接拥有 `weapons/<slug>.html`，理论上可由 Netlify Pretty URLs 提供 extensionless route，不再需要每个 Entity 一条 200 rewrite。新增 published Entity 只需要 data + build 即可产生 HTML、canonical 与 sitemap entry。

正式切换时仍必须保留历史 301：`/home`、`/index(.html)`、`/pages/*.html`、旧 generated physical paths 等继续单跳到 canonical。当前 collection 200 rewrites、Entity 200 rewrites、catch-all 404 的删除/保留必须在 P1-10 Deploy Preview 逐条确认，本轮没有修改 `netlify.toml`。

## Q. Legacy Static Page Coexistence

POC build 后原样复制：

- `/`
- `/guide`
- `/weapons`
- `/characters`
- `/bosses`
- `/world`
- `/videos`
- `/about`
- `/about-site`
- `/404.html`

以及 CSS、JS、assets、favicon、Production Search JSON。首页源与 dist hash 一致。Astro preview 中 legacy pages 与 Astro Entity pages 同时返回 200，不存在一次性重写全站的要求。

copy bridge 只是渐进迁移过渡工具；全站迁入 Astro 后应删除，不能成为长期第二模板系统。

## R. Weapon Semantic Parity

POC Weapon HTML contract 包含：

- title、description、canonical、breadcrumb、H1、summary、updatedAt；
- `weapon.exists`、name、kind、public appearance；
- observation；
- editorial rating 及“不是官方评分或试玩客观数值”说明；
- acquisition / observed trait pending-review 安全文案；
- Fact status、checkedAt、GameVersion context、实际 Source；
- 返回 `/weapons`。

输出未出现 `null`、`undefined`、`release-verified`、本机路径或 runtime `/data/` 请求。关闭 JS 后核心内容仍在 HTML。

## S. Character Detail Feasibility

Character route 只需要现有 Entity、Fact、Relation、Source 与约 36 行 route projection，即可生成 name、aliases、summary、role、relations、sources、updatedAt、collection return link。

没有新增 skill、Build、武器推荐、强度、阵营、图片或剧情推测。Character publication 本身仍需独立人工 gate；Astro 只解决渲染和路由，不改变可信度规则。

未来 Boss 的实现预计为 Boss projection + `[slug].astro` route，继续复用 BaseLayout / Fact / Source primitives，不需要复制 600 行新 generator。

## T. Static / No-JS / Hydration

- Astro output：static。
- Entity HTML 已包含全部核心 Knowledge 与 SEO 内容。
- `_astro` 客户端资源数量：0。
- Astro component hydration：0。
- 新增客户端 framework bundle：0 bytes。
- 唯一客户端逻辑仍是现有 `main.js` progressive enhancement。

## U. 390px / 1280px

当前执行环境没有可用浏览器自动化或 Chromium，因此不能声称完成真实 390px / 1280px 截图验收。

静态风险检查通过：复用已验证 responsive CSS、没有新增固定宽度或新样式、Fact / Source 使用现有移动端结构、HTML 未出现长本机路径。正式迁移前仍必须在 P1-10 对 Weapon 与 Character 各做 390px / 1280px、scrollWidth、移动导航与 search modal 实测。

## V. Console / Network

Astro preview 的核心路由、CSS、JS、favicon、Production Search JSON、sitemap 均返回 200；不存在路径返回 404。没有 runtime Knowledge JSON 或 shadow 请求。

没有浏览器 console 工具，因此不能声称完成 console / request waterfall 观察。现有 Baidu `hm.baidu.com` 与 `zz.bdstatic.com` 网络问题仍属于已知第三方因素，不归因于 Astro。

## W. Deterministic Build

标准 npm 最终连续运行两次 `npm run build`，对 dist 全部 29 个文件做 SHA-256 清单比较，内容完全一致。

输出不包含 build current time、随机 ID、临时路径或本机绝对路径。`dist/`、`node_modules/`、`.astro/` 由局部 `.gitignore` 排除。

## X. Dependency / Build Cost

收益之外的真实成本：

- 从 root zero-dependency 增加到 POC 1 个 direct dependency；
- lockfile 约 149 KB / 4483 行；
- 依赖树约 186 个实际安装 package；
- 安装需要执行并显式批准 esbuild postinstall；
- Node 最低版本提高到 22.12；
- 依赖漏洞审计、锁文件更新和框架升级成为持续维护工作。

生产客户端没有增加框架 runtime，因此性能成本主要发生在 install/build，不发生在页面加载。

## Y. LOC / Duplication Comparison

- 当前 `scripts/build-weapon-pages.mjs`：634 行，只支持 Weapon。
- POC `src/ + scripts/`：545 行，已覆盖 Weapon + Character + Relation presentation + sitemap + legacy bridge。
- shared layout/components 约 150 行；shared loader/safety/relation helpers 约 186 行；copy/validator helpers 46 行；sitemap 26 行。
- 两个 Entity dynamic routes 合计 67 行；entity-specific projections 约 70 行。

总 LOC 不是直接少一半，因为 POC 同时验证了第二 Entity、Relation、sitemap 和 migration bridge；关键结果是 Header/Footer、Fact、Source、metadata 不再按 Entity type 复制。新增 Character 的专用 route + projection 远低于复制一个新的 600 行 generator，足以证实预期 50–70% 的重复维护可以避免。

## Z. Rollback Strategy

P1-10 应保持当前 Node generator 与生产静态文件，先以独立 Astro scaffold + Deploy Preview 验证。生产切换应使用一个可 revert 的路由/build 配置 commit；旧 generator 在 production verification 完成前不删除。

失败时 revert Astro production switch，即可恢复当前 committed static artifacts + Netlify 发布方式。POC 本身可直接删除，不影响生产。

## AA. Generated Artifacts: Commit vs Netlify Build

方案 A：commit Astro dist。

- 优点：生成 HTML 可审查、Netlify 不承担 build、回滚与当前模式一致。
- 缺点：dist diff 大、源与产物重复、跨平台构建噪音、仍需人工确保 build 已运行。

方案 B：source commit，Netlify 用 lockfile 执行 validator + Astro build 并发布 dist。

- 优点：单一派生链、不会忘记生成、Entity route/sitemap 原子化、减少 generated artifact diff。
- 缺点：部署依赖 npm registry/cache 与 Netlify build；需要明确 Node 版本、失败阻断、Deploy Preview、可重复构建与 CI/本地 gate。

建议 P1-10 用方案 B 做 Deploy Preview，但在 production verification 完成前保留旧生成器和静态生产文件作为 rollback。不要在 P1-9 直接改变现有 Netlify build。

## AB. Astro Benefits Proven

1. 直接读取现有 Knowledge JSON，不需要第二套 Schema。
2. Weapon 与 Character 共用 shell、Fact、Source、status 和 safety primitive。
3. Entity dynamic route 自动按 published / preview projection 扩展。
4. file output 有机会消除每 Entity Netlify rewrite。
5. sitemap 可复用同一 published projection。
6. legacy pages 可以渐进共存，不需要一次重写。
7. existing CSS、main.js、Production Search JSON 字节一致复用。
8. static SEO、no-JS、zero hydration 成立。
9. Relation UI registry 可以留在 presentation layer。
10. 新增 Boss 可沿用 projection + route，而非复制完整 generator。

## AC. Astro Costs / Risks Proven

1. 构建依赖树从 0 增至约 186 个 package，供应链与升级成本真实存在。
2. Node 最低版本变为 22.12。
3. file-style route 仍需 Netlify Deploy Preview 验证 Pretty URLs 与 slash 行为。
4. 现有 main.js 对导航 shell 有 DOM 约定。
5. legacy copy bridge 只能暂时存在。
6. browser 390px / 1280px、console、真实 search interaction 尚未执行。
7. full npm vulnerability audit 尚未完成。
8. `PROJECT.md` 有一处阶段状态过期，但不影响 POC 技术结论。

## AD. Node Generator vs Astro Matrix

以下评价表示 Astro 相对当前 JSON + Node generator：

| Dimension | Result | Evidence |
| --- | --- | --- |
| SEO safety | Same | 两者均 build-time static HTML；正式切换仍需 parity gate。 |
| URL safety | Same / potentially Better | file output 保持 canonical，并可能移除 per-Entity rewrite；需 Netlify preview。 |
| Performance | Same | 0 hydration、0 framework runtime，继续加载现有 main.js。 |
| Dependency cost | Worse | 1 direct / 约 186 installed packages，需 lock/audit/upgrade。 |
| Template reuse | Better | BaseLayout、Fact、Source、Relation 跨 Weapon/Character 复用。 |
| Data model reuse | Same | 直接使用 Schema 1.0-implementation，未复制 Schema。 |
| Search compatibility | Same | production JSON 与 main.js 原样复用。 |
| Sitemap | Better | 与 published route projection 同源生成。 |
| Netlify routing | Better after verification | file-style Entity HTML 可避免逐条 200 rewrite。 |
| Developer complexity | Better for pages, Worse for tooling | 页面模板明显简单；安装与依赖管理更复杂。 |
| Rollback | Same | 渐进共存并保留旧 generator 时可单 commit revert。 |
| Future Character / Boss growth | Better | 新增 projection + route，不复制完整 generator。 |
| Future Markdown | Better | Astro 有自然静态扩展路径，但本轮未引入。 |
| Future Build integration | Same | 静态 Build UI 可做；真实服务端保存仍需另行评估。 |

## AE. Recommended P1-10

建议 P1-10 只做：

1. Astro static production scaffold；
2. legacy static page coexistence；
3. Weapon HTML / SEO parity；
4. Character publication gate 与静态详情；
5. production relation projection；
6. file-style route、canonical、redirect、slash、404 Deploy Preview；
7. production Search、sitemap、collection link 原子化；
8. 390px / 1280px、console、no-JS、search interaction；
9. locked install、audit、deterministic build；
10. 保留旧 generator 的 rollback，生产验证后再讨论删除。

不要同时做 UI redesign、Schema 变更、Content Collections、Markdown migration、React/Tailwind 或账号系统。

## AF. Gate Checklist

1. Astro 隔离安装：是。
2. root package.json：没有。
3. production files：没有语义修改。
4. 直接读取 root Knowledge JSON：是。
5. Schema 仍为 1.0-implementation：是。
6. 两个 Weapon Astro pages：是。
7. 三个 Character POC pages：是。
8. Character 仍为 draft：是。
9. Weapon semantic parity：通过 contract-level 检查。
10. canonical 保持原 Weapon URL：是。
11. 可避免每 Entity Netlify rule：file output 已证明，Netlify preview 待验。
12. trailing slash 风险：Astro preview 可控，Netlify 待验。
13. existing CSS：字节一致复用。
14. existing main.js：字节一致复用。
15. Production Search JSON：字节一致复用。
16. runtime Knowledge fetch：没有。
17. Fact / Source shared renderer：是。
18. Relation presentation registry：是。
19. production Relation draft safety：0 条，已验证。
20. sitemap 更自动化：是。
21. legacy pages 渐进共存：是。
22. Markdown：不需要。
23. Content Collections：不需要。
24. framework hydration：0。
25. deterministic build：通过。
26. build/dependency cost：可接受但显著高于当前。
27. duplicate LOC：明显下降。
28. rollback：简单，前提是保留旧 generator 至生产验收。
29. 必须一次迁全站：否。
30. 推荐 P1-10：是，但必须以 Deploy Preview + parity verification 为 gate。

## AG. git status --short

预期只出现：

```text
?? docs/p1-9-astro-migration-preparation.md
?? experiments/astro-migration-poc/
```

`node_modules/`、`dist/`、`.astro/` 已由局部 `.gitignore` 忽略；根目录临时 pnpm store 已删除。

## AH. git diff --stat

普通 `git diff --stat` 不显示 untracked 文件。POC 候选文件为 18 个，加本报告共 19 个；POC executable source / script 约 545 行，另有约 149 KB 的 npm lockfile。

## AI. git diff --check

最终执行结果见本轮交付报告。检查范围应同时覆盖 untracked POC 源码与本报告；不得把 ignored node_modules / dist 误当提交文件。

## Final Gate

**Final Gate = C — Astro Migration Preparation 通过，建议进入 P1-10 Production Migration。**

该结论只批准下一阶段的生产迁移 Gate，不代表 Astro 已经成为当前 production，也不代表允许跳过 Netlify Deploy Preview、浏览器验收或 rollback。
