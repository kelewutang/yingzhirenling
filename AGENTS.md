# Project Mission

我们正在建设面向全球玩家的《影之刃零》知识库、攻略搜索引擎和未来 Build 工具。

当前仍处于游戏发售前阶段。生产内容首先要可信、可核验、可索引和可持续扩展，不能用推测假装正式版攻略。

# Core Priorities

按以下顺序权衡实现：

1. Data trust
2. SEO
3. Performance
4. Maintainability
5. User experience

不要为了架构更新或开发速度牺牲已验证的生产行为。

# Current Architecture

当前生产架构是：

- Static HTML / CSS / Vanilla JavaScript
- `data/` 下的 Knowledge JSON
- 零 npm 依赖的 Node.js validator 与 generator
- 提交到仓库的 generated static artifacts
- Netlify static hosting

Netlify 当前不运行数据生成器；生成和验证在提交前完成，Netlify 提供已提交的静态产物。

当前不是 React、Next.js、Astro production、Vue、Svelte、Tailwind、shadcn/ui、CMS、SSR、SPA 或数据库应用。

# Architecture Rule

未经当前任务明确批准，不得擅自：

- 迁移前端框架或重写网站
- 引入大依赖或 npm runtime dependency
- 改变核心 URL、canonical、redirect 或 sitemap 规则
- 修改 Knowledge Schema 或 Fact key
- 引入数据库、CMS、Server API 或账号体系

当前继续使用 JSON + Node generator + static HTML。Astro 只是 static-output 中期候选；Next.js 只在真实服务端需求出现后重评。

# Knowledge Rule

- Fact 是最小可信度单元；Entity 和 Page 不是整体可信度单元。
- `Source.authority` 不等于 `Fact.status`。
- `recordState=published` 不等于 official 或 verified。
- draft 只能进入 shadow 派生，不进入 production Search、详情页或 sitemap。
- 发售前生产数据禁止 `release-verified`。
- 不根据模型记忆填充游戏事实，不虚构 Source。
- `data/` 是结构化知识 Source of Truth；`generated/` 是派生产物，不能反向充当知识来源。

# Production Rule

核心 SEO 内容必须在 build time 形成静态 HTML。不得在浏览器中 fetch Knowledge JSON 后才渲染 H1、summary、Fact 或 Source。

运行时 JavaScript 只能做 progressive enhancement。Entity Search 失败时，静态页面和 Page Search 必须继续工作。

生产运行时只加载 `generated/search-index.production.json`，不得加载 shadow index。

# Current P1-6 Boundary

- Weapon 详情生成器：`scripts/build-weapon-pages.mjs`
- 生成目录：`pages/generated/weapons/*.html`
- canonical route：`/weapons/{slug}`
- 已发布：唐横刀、牙横刀
- draft：青龙掠月刀；不得生成生产详情页
- Page Search 的 `/weapons` 结果继续保留
- 当前 sitemap 共 11 个 URL
- 当前两个 Weapon 不需要 Markdown

# Open Source Rule

重要模块优先 benchmark 成熟开源项目，关注 repository activity、license、架构经验、适配点和不适配点。

不要整项目照搬。直接复用代码前必须确认许可证和归属要求。

# Development Rule

- 修改前先检查 `git status --short`、当前分支和最新 commit。
- 先读现有实现与相关治理文档，不凭记忆重新设计已经冻结的边界。
- 保持最小、可审查、可回滚的 diff，不顺手修无关问题。
- 实现任务必须完整、可运行、可验证；不得以核心伪代码、fake data 或 TODO 代替功能。
- Research、Audit 或只读任务不得越权修改文件。
- Generator 必须 deterministic、strict，并在 published 数据损坏时非零退出。
- JSON 文本输出到 HTML 前必须转义；外部 URL 仅允许 HTTP/HTTPS。
- 生成产物不得包含当前时间、随机 ID、本机绝对路径或不安全 raw HTML。

# Git Rule

未经用户明确批准：

- 不要 `git add`
- 不要 commit
- 不要 push
- 不要 amend、force push 或重写共享历史

提交时只包含当前阶段文件；push 默认使用明确批准的 `git push origin main`。

# Documentation Links

- [项目目标与阶段](docs/PROJECT.md)
- [当前生产架构](docs/ARCHITECTURE.md)
- [Knowledge Schema 1.0](docs/knowledge-schema-1.0.md)
- [页面与 SEO 标准](docs/PAGE-SEO-STANDARD.md)
- [UI 与模板标准](docs/UI-TEMPLATE-STANDARD.md)
- [开发执行规则](docs/DEVELOPMENT-RULES.md)
- [Git 工作流](docs/GIT-WORKFLOW.md)

上述文档各自是对应主题的主要 Source of Truth。阶段 Prompt 只应描述当前 scope、gate、允许文件和验证要求。
