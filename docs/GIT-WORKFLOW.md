# Branch

默认生产分支是 `main`。

不要擅自创建 branch 或 worktree。当前任务明确要求隔离开发、指定分支或 Codex worktree 时再创建，并使用任务批准的命名。

# Commit Principle

一个 commit 对应一个清晰阶段或目的：

- 只包含当前任务相关文件；
- 不混入 unrelated formatting、临时产物或历史遗留修复；
- generated artifact 与产生它的 source/build change 可以在同一阶段 commit 中提交；
- commit 前再次确认工作区没有未知修改。

# Prefix

推荐 Conventional Commit 风格：

- `feat:` 新增可见能力或阶段实现；
- `fix:` 修复生产行为；
- `refactor:` 不改变外部行为的结构调整；
- `docs:` 纯文档；
- `test:` 测试或 fixture；
- `chore:` 基线、维护或工具事务。

# Recommended Phase Style

使用简洁、命令式、能够说明阶段结果的 message，例如：

```text
feat: integrate production weapon entity search
feat: add weapon detail page pilot
docs: establish project governance baseline
```

不要把多个阶段、验证记录和实现细节塞入一个过长 subject。

# Before Commit

至少运行：

```text
git status --short
git diff --stat
git diff --check
```

如果已经 staged，再运行：

```text
git diff --cached --stat
git diff --cached --check
```

同时运行当前任务要求的 syntax、validator、fixtures、build 或 browser checks。不要仅因为 `git diff --check` 通过就认为功能已验证。

# Staging

- 使用明确文件路径暂存当前阶段文件。
- 暂存后用 `git diff --cached --name-only` 或 `--stat` 核对范围。
- 不使用会意外包含未知文件的宽泛操作，除非已确认整个工作区都属于当前任务。
- 用户只授权 commit 某个文件列表时，严格按该列表执行。

# Generated Artifacts

项目明确需要审查和部署的派生产物可以提交，例如：

- `generated/search-index.shadow.json`
- `generated/search-index.production.json`
`pages/generated/weapons/*.html` 是历史 compatibility artifact；除非任务明确涉及对应旧路径，不得把它作为当前 primary Entity page output 修改或提交。

`dist/` 是 Netlify build 产生的 derived deployment output，并由 `.gitignore` 排除；不得作为正常 Git artifact 提交。

提交前必须由对应 generator 重新生成并验证 deterministic。不要手工编辑后伪装成生成结果。

临时 HTTP server 文件、截图、日志、调试脚本和一次性测试产物不得提交。

# Push

只有用户明确批准后才执行 push。Feature work 默认推送当前获批准的 feature branch；`main` 只在明确授权的 merge / post-merge workflow 中推送。

push 后至少核对：

- 命令结果成功；
- 对应 remote branch 指向预期 commit；
- 工作区状态；
- 需要时等待 Netlify 并执行 Deploy Preview 或 production verification。

commit 授权不自动包含 push 授权。

# Forbidden

禁止在没有明确批准时：

- force push `main`；
- reset、checkout 或删除未知用户工作；
- stage unrelated files；
- amend 已共享 commit；
- rebase/rewrite production history；
- 用 destructive Git 命令清理脏工作区；
- 因测试失败偷偷丢弃用户修改。

# Production Workflow

标准生产阶段：

```text
main
→ approved feature branch
→ implementation
→ local verification
→ human review
→ commit
→ push feature branch
→ PR
→ Netlify Deploy Preview
→ applicable independent browser QA / Gate
→ explicit merge authorization
→ merge
→ post-merge verification
→ phase close
```

PR 可合并不等于获得 merge 授权。Gate 后如果实现、数据、route 或 deploy-relevant output 发生变化，必须重新判断适用 Gate；不得自行 merge、force-push shared production history 或 rewrite `main`。

如果 production verification 发现问题，只在用户授权的新修复阶段修改；不要在只读验收中直接热修。

# Commit Handoff

提交完成后报告：

- commit hash 与 message；
- 实际提交文件范围；
- `git status --short`；
- 已运行检查；
- 是否执行 push。

Push 完成后额外报告远端分支是否指向该 commit。

# Related Rule

详细开发与安全约束见 [DEVELOPMENT-RULES.md](DEVELOPMENT-RULES.md)。
