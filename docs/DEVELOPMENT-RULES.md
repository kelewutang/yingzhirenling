# 1. Before Work

每个修改任务开始前执行：

```text
git status --short
git branch --show-current
git log -1 --oneline
```

如果工作区存在不属于当前任务的修改，不得覆盖、清理、暂存或提交。先确认来源；无法安全隔离时停止并报告。

# 2. Read Before Editing

- 先读当前实现和调用链。
- 先读 `AGENTS.md` 与相关 Source of Truth 文档。
- 查找现有 helper、validator、fixture 和生成模式。
- 不根据模型记忆重新设计已经冻结的 Schema、route 或 publication contract。
- 对当前生产事实做 read-only 验证，不把未来计划写成 implemented。

# 3. Scope Discipline

- 只修改 Prompt 明确允许的文件和直接必需的派生产物。
- 不顺手修 unrelated issue。
- 不把 audit/research 扩大为 implementation。
- 不因发现技术债就改变当前阶段 Gate。
- 需要新增权限、数据来源或架构决策时停止并报告，而不是自行扩大范围。

# 4. Minimal Diff

优先提交小、可审查、可回滚的改动。

避免：

- 无关格式化；
- 大范围重命名；
- 为单个修复重构整个模块；
- 改动未要求的视觉、正文、URL 或数据；
- 生成无意义时间戳 diff。

# 5. Architecture Protection

未经当前任务明确批准，不得：

- 迁移或重写现有 Astro static output，或转换为 SSR / SPA；
- 引入 Next.js、React、Vue、Svelte 或其他新的 production framework；
- Tailwind 或 shadcn/ui；
- production database、CMS 或 Server API；
- npm runtime dependency；
- 用户账号、持久化或后台系统。

未来任务明确批准并通过迁移 Gate 时可以演进；本条不是永久禁止。

# 6. Open Source Benchmark

搜索、Build parser、Markdown pipeline、静态生成和复杂 UI 等重要模块，优先 benchmark 成熟开源项目。

至少记录：

- repository 与近期 activity；
- license；
- 可借鉴的 architecture lesson；
- 与本项目的 fit；
- 明显 mismatch 和迁移成本。

benchmark 不等于照搬。直接复用代码前必须确认许可证、notice、归属和再分发要求。

# 7. Implementation Quality

实现任务必须：

- 完整；
- 可运行；
- 可验证；
- 不以核心伪代码或 TODO 代替能力；
- 不引入 fake production data；
- 不吞掉应阻止构建的错误。

Research/Audit/Review 如果要求只读，不得为了“顺便完成”修改文件、暂存、commit 或 push。

# 8. Game Fact Safety

不得：

- 根据模型记忆填生产 Fact 或 Source；
- 把画面 observation 写成 official；
- 把 editorial 写成客观数值；
- 把 pending-review 写成 confirmed；
- 发售前使用 `release-verified`；
- 用媒体转述冒充可获得的一手官方来源；
- 为页面完整度虚构掉落、位置、数值、Build 或版本信息。

无法确认时保留 `pending-review` 或不展示，不自行补全。

# 9. Data Flow

```text
data/ = structured Knowledge Source of Truth
src/ = Astro production layouts, components, loaders, projections and routes
generated/ = derived Search artifacts
dist/ = derived deployment output
legacy pages/generated artifacts = compatibility-only outputs, not the primary Entity page architecture
```

不得手工把 generated output 当作 Fact 证据。需要更正事实时修改并验证 Knowledge source，再重新生成派生产物。

长篇攻略和论证保持 HTML/未来可选 Markdown；不要强制把所有正文 JSON 化。

# 10. Production Search

- 生产 runtime 只加载 `/generated/search-index.production.json`。
- Shadow index 不得被生产浏览器加载。
- Page Search 是基础层，必须立即可用。
- Entity loader 每页面生命周期最多正常 fetch 一次。
- Entity loader 失败时 Page Search 继续工作。
- published 不得被解释为 official 或 verified。
- draft 不得进入 Production Entity Search。

# 11. Static-first

核心 SEO 页面必须在 build time 形成 HTML。title、description、canonical、H1、summary、Fact 和 Source 不能只在 JavaScript 执行后出现。

运行时 JavaScript 可以增强交互，但不能成为知识内容或搜索引擎可见性的单点故障。

# 12. Progressive Enhancement

增强层失败时必须安全回退：

- 静态页面仍可阅读；
- 主导航与内部链接仍可使用；
- Page Search 仍可工作；
- 不产生未处理 Promise rejection；
- 不把搜索渲染错误伪装成 Entity fetch/JSON 错误；
- 不无限 retry 或重复绑定 listener。

# 13. Generator Rules

Generator 必须：

- deterministic；
- 先 strict validation，再写输出；
- published 数据损坏时非零退出；
- 对 duplicate ID/slug/route 失败；
- 只写入明确的专用输出目录；
- 不覆盖无生成标记的人工文件；
- 清理 stale generated active artifact；
- 不生成 `generatedAt` 或使用当前 build 时间；
- 不包含随机值、本机路径或环境相关排序；
- HTML escape JSON 文本；
- 只接受安全 URL scheme；
- 不允许 unsafe raw HTML injection。

生成两次应产生字节一致结果或零更新。

# 14. Verification

根据风险选择并报告适用检查：

- `node --check`；
- Knowledge validator；
- fixtures；
- Search contract tests；
- `npm run build`（validators、Astro static build、Search generation、bridge copy 与 dist verification）；
- 对 generator、projection 或 derived artifact 变更按风险执行 deterministic rebuild / byte-stability check；
- `git diff --check`；
- local HTTP route；
- 404、redirect 和 canonical；
- Collection、Entity Detail 与 shared-shell verification；
- 390px / 1280px browser；
- no-JS/static HTML；
- Deploy Preview；
- production verification。

不要为了缺失的 lint/test 工具安装新依赖。若没有对应工具，如实记录。

# 15. Production Integration Pattern

高风险数据或架构优先使用：

```text
Research
→ Contract
→ Shadow
→ Fixtures
→ Publication Gate
→ Production Integration
→ Production Verification
```

这一流程用于数据模型、搜索、发布和路由等高风险变更，不要求每个 typo 机械执行全部阶段。

# 16. Known Third-party Failures

以下第三方域名在部分网络环境可能失败或拖延浏览器 load：

- `hm.baidu.com`
- `zz.bdstatic.com`

诊断时将第三方错误与本站主文档、CSS、JS、Production Search JSON 和功能错误分开。不得自动归因于当前 Knowledge/Search/Weapon 改动，也不得在无关阶段顺手删除。

# 17. Production File Safety

修改 build、Schema、data、route 或 production presentation 前先确认任务是否允许影响：

- `src/layouts/`、`src/components/`、`src/lib/` 与 `src/pages/`；
- legacy bridge inputs（`pages/*.html`、`404.html`）及 compatibility artifacts；
- `css/`、`js/`；
- `data/`、`generated/`、`dist/`；
- `netlify.toml`、`robots.txt`。

只读任务不得触碰这些文件内容。

# 18. Git Safety

未经用户明确批准，不要：

- `git add`；
- `git commit`；
- `git push`；
- amend shared commit；
- force push；
- reset、checkout 或删除未知用户工作；
- stage unrelated files。

任务明确授权时，只操作批准的文件、分支和远端。详细流程见 [GIT-WORKFLOW.md](GIT-WORKFLOW.md)。

# Sources of Truth

- 项目方向：[PROJECT.md](PROJECT.md)
- 生产架构：[ARCHITECTURE.md](ARCHITECTURE.md)
- Knowledge Schema：[knowledge-schema-1.0.md](knowledge-schema-1.0.md)
- 页面/SEO：[PAGE-SEO-STANDARD.md](PAGE-SEO-STANDARD.md)
- UI/Template：[UI-TEMPLATE-STANDARD.md](UI-TEMPLATE-STANDARD.md)
