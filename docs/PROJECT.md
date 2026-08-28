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

阶段结论：继续 **JSON + generator**，当前不迁 Astro。实施边界见 [P1-6 Weapon Detail Page Pilot](p1-6-weapon-detail-pilot.md)。

# Current Production Capabilities

- 现有静态页面与 Page Search；
- 两条 published Weapon Entity 的 Production Search；
- `/weapons/tang-hengdao` 与 `/weapons/ya-hengdao` 静态详情页；
- Fact-level status 与实际引用 Source 展示；
- canonical 短路由和物理路径单跳归一；
- published Entity 搜索结果指向详情页；
- `/weapons` 页面级搜索结果继续存在；
- 含 9 个原页面和 2 个 Weapon 详情页的 11-URL sitemap；
- 无 runtime Weapon Knowledge JSON 渲染依赖。

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

P1-7 Character Shadow + Relation Pilot、P1-8 Character Publication Readiness Gate 和 P1-9 Astro Migration Preparation Gate 已完成。

下一阶段计划为 **P1-10：Astro Production Migration Candidate + Deploy Preview Gate**。该阶段只验证 Astro static output 候选方案在 Deploy Preview 中的 URL、canonical、redirect、SEO、搜索与回滚边界，不表示 Astro 已成为生产架构。

当前 production 仍是现有 **static site + Knowledge JSON + Node generator + Netlify**；只有 P1-10 Gate 通过并完成单独的生产切换决策后，才能更新生产架构声明。

# Related Sources of Truth

- 当前生产架构：[ARCHITECTURE.md](ARCHITECTURE.md)
- Knowledge Schema：[knowledge-schema-1.0.md](knowledge-schema-1.0.md)
- 页面与 SEO：[PAGE-SEO-STANDARD.md](PAGE-SEO-STANDARD.md)
- UI 与模板：[UI-TEMPLATE-STANDARD.md](UI-TEMPLATE-STANDARD.md)
- 开发执行：[DEVELOPMENT-RULES.md](DEVELOPMENT-RULES.md)
- Git 工作流：[GIT-WORKFLOW.md](GIT-WORKFLOW.md)
