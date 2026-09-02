# Project Vision

yingzhirenling.cn 是面向真实玩家和搜索引擎的《影之刃零》非官方玩家站点。长期产品定位是：

1. 可核验的玩家知识库；
2. 能同时发现页面与结构化实体的攻略搜索引擎；
3. 在正式版数据稳定后逐步建立的 Build 工具。

当前游戏仍未正式发售。网站现阶段的价值不是假装拥有完整攻略，而是把官方确认、试玩观察、第三方信息、编辑推测和待核查信息清楚分开，保护用户判断和长期 SEO 资产。

## Target Users

- 希望了解游戏、平台、公开演示和发售信息的潜在玩家；
- 搜索武器、角色、Boss 和攻略线索的中文玩家；
- 正式发售后需要版本化知识、Build 与检索能力的长期玩家；
- 需要明确来源和资料时间边界的编辑与贡献者。

# Product Pillars

## 1. Knowledge Base

以 Entity、Fact、Source、GameVersion 和 Relation 表达可校验的结构化知识。Fact 是可信度边界，同一实体中的不同事实可以拥有不同状态、来源、时间和版本。

## 2. Guide and Search

保留长篇 HTML/未来可选 Markdown 内容，同时从结构化数据派生 Entity Search Document。Page Search 是基础层，Entity Search 是渐进增强层，两者可以同时指向相关页面而不按 route 强制去重。

## 3. Build Tool

Build 工具是长期方向，不是当前已实现能力。它需要正式版属性、版本、平台、难度和关系数据达到可靠程度后再设计，不能用发售前推测填充。

# Current Phase

当前阶段：**Pre-release**。

重点是：

- official facts 与一手来源；
- 可直接观察的演示、Demo 或媒体试玩；
- editorial 判断与客观事实的明确区分；
- 页面与 Entity discovery；
- 购买、平台和背景理解；
- 稳定 canonical URL 与 SEO footprint。

禁止把预测包装成正式版结论，禁止虚构“全流程”“毕业 Build”“T0”或未证实获取方式。

# Development Priorities

1. 数据可信度
2. SEO
3. 性能
4. 可维护性
5. 用户体验
6. 功能交付速度

# Strategy

项目采用渐进演进：在现有静态生产站上增加结构化知识、严格校验、派生搜索和静态详情页，而不是推倒重做。

每次演进必须保护：

- yingzhirenling.cn 域名与当前公开 URL；
- canonical 和历史 SEO 资产；
- Netlify 生产稳定性；
- 已冻结并验证的 Knowledge Schema；
- Page Search 和无 JavaScript 基础内容；
- draft 与 published 的发布边界。

# Completed Milestones

## P0 — Pre-release Trusted Baseline

完成发售前事实边界、URL/canonical/redirect/404、信息来源与状态展示、基础搜索、移动端与生产可用性清理。

## P1-2 — Knowledge Schema and Weapon Shadow Data

冻结 Knowledge Schema `1.0-implementation`，建立 Entity、Fact、Source、GameVersion、Registry、Entity Resolution、validator 和 fixtures。

## P1-3 — Search Index Shadow Generation

从 Knowledge JSON deterministic 派生 Weapon shadow search documents，不接入生产运行时。

## P1-4A — Production Search Contract

冻结 Publication Gate，明确 `recordState` 与 Fact status 分工；批准唐横刀、牙横刀进入 production 派生层，青龙掠月刀保持 draft。

## P1-4B — Production Entity Search

以 progressive enhancement 方式把 production Entity Search 接入现有 Page Search。加载失败时 Page Search 保持可用，生产运行时不读取 shadow index。

## P1-6 — Weapon Detail Page Pilot

Weapon Detail Page Pilot 已上线并完成 production verification。唐横刀与牙横刀使用 Knowledge JSON 生成静态详情页，canonical 为 `/weapons/{slug}`；青龙掠月刀不生成生产页面。

这是当时的 Weapon-only pilot 结论。后续 P1-10 / P1-11 已完成 Astro static production switch；P1-6 不再描述当前架构。实施边界见 [P1-6 Weapon Detail Page Pilot](p1-6-weapon-detail-pilot.md)。

# Current Production Capabilities

- Astro static production with build-time Knowledge validation, projection, static SEO and Netlify `dist/` publishing;
- unified production pipeline for Weapon, Character, Boss and Location Collections and Entity Details;
- Fact-level status, actual cited Sources, verified Relations where data exists, and stable canonical routes;
- Page Search plus progressive-enhancement Production Entity Search, with published-only and draft-isolation enforcement;
- sitemap derived from published Entity projection;
- deterministic no-media fallback while Production Media remains separately governed;
- legacy static-copy bridge for guide, videos, about, about-site and 404.

For current operational counts and completed-stage status, use [CURRENT-STATE.md](CURRENT-STATE.md) rather than duplicating a mutable snapshot here.

# Explicit Non-goals Now

当前不实施：

- 用户账号、登录和跨设备状态；
- 论坛、评论平台、UGC 或投稿后台；
- CMS 或生产数据库；
- 完整 Build simulator；
- AI chatbot；
- 全站框架重写；
- 在可靠资料出现前建立完整游戏数据库；
- 用发售前材料声称正式版平衡、掉落或强度结论。

# Next Direction

P1-10 Astro Production Migration Candidate 与 P1-11 Astro Production Switch Gate 已通过，当前生产构建使用 Astro static output，并继续保留 Knowledge JSON、构建时静态 SEO 与 Vanilla JavaScript progressive enhancement 边界。

P1-12 Character Publication Batch 已完成：魂、魔渊和 The Hunt 的角色详情、两条已验证人物关系、集合页入口、Production Search 与 sitemap 已进入生产派生链。

P1-13 Boss Entity Batch 已完成：Tie Sha the Frenzy、Commander Cleave 与 Huangxing, the Sunken Pillar of Kunlun 以第三方实机视频明确标注的 Boss 身份接入同一生产派生链；页面不推断打法、阶段、弱点、掉落或位置。

P1-14 Weapon Expansion Batch 已完成：基于 PlayStation 官方博客发布的 Gamescom 2025 直接试玩记录，新增 6 个 published Weapon identity，并通过现有 Astro、Collection、Search、Sitemap 与 redirect pipeline 批量发布；青龙掠月刀因名称与独立身份仍缺直接文字依据而继续保持 draft。

P1-15 World / Location Entity Batch 已完成：庞镇基于 S-GAME 官方中英文资料，以首个 published Location identity 接入 `/world/{slug}`、Collection、Production Search、sitemap 与 explicit redirect pipeline；官方解说中的山谷、仓库、铁塔和大湖仍是描述性场景，不建立未经命名依据支持的 Location Entity。

四类核心 Entity（Weapon、Character、Boss、Location）已进入统一 production pipeline。P2-UI-0 through P2-UI-8 and Visual Atmosphere stages are completed historical milestones.

The next main stage is **English Site Phase 1**. It must reuse the mature Chinese Astro/static architecture rather than rebuild it from zero, while the Chinese site remains the active production site and continues content expansion in parallel.

The approved English deployment direction is a separate English site at `pbzguides.com`, using a separate GitHub repository and a separate Netlify site.

Chinese and English pages remain self-canonical. Where an approved corresponding page exists, the two sites may declare language alternates through `hreflang`; this does not imply automatic language redirect.

Knowledge sharing/localization, locale abstraction, English Search contract, sitemap implementation details, exact hreflang language codes, missing-translation behavior, `x-default`, and page-mapping mechanism still require a separate architecture decision before implementation.

# Related Sources of Truth

- 当前生产架构：[ARCHITECTURE.md](ARCHITECTURE.md)
- Knowledge Schema：[knowledge-schema-1.0.md](knowledge-schema-1.0.md)
- 页面与 SEO：[PAGE-SEO-STANDARD.md](PAGE-SEO-STANDARD.md)
- UI 与模板：[UI-TEMPLATE-STANDARD.md](UI-TEMPLATE-STANDARD.md)
- 开发执行：[DEVELOPMENT-RULES.md](DEVELOPMENT-RULES.md)
- Git 工作流：[GIT-WORKFLOW.md](GIT-WORKFLOW.md)
