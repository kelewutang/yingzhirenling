# PR #71 → #72 隔离组合候选

本分支仅用于组合发布准备与Deploy Preview审核。没有合并GitHub PR #71、#72或#73，没有修改生产部署；原始工作区及其tmp保持原状。

## 固定输入与顺序

- main／Production基线：`e91bc78c2e43cb8f3d9b5db8380a7e6345cdd137`。
- 先在隔离worktree合入#71：`95f7c739d53bf43a822e7976439bd2dc9904f495`。
- 再合入#72：`e944437b68e4c5afc98f68f82c1cda4769e96e05`。
- 最后应用独立来源修复#73：原提交 `77e7aa4e8c3be9f7d747c7b10e421f8e883c3551`；本分支等价提交 `df5e996c9502d87835bbd5d8cccff5263d872e28`。

以上均为本地审核分支操作，不是GitHub上的生产合并。两项相关Codex任务均已完成且无活动写入；没有更改其他worktree文件。实际隔离目录位于原仓库之外。

## 冲突与必要修正

1. `netlify.toml`取双方显式路由并集：新增14组短路由200／.html单次301，保留原有规则和最终404，不用参数化catch-all替代。
2. 字体按组合data／src语料重新生成，而非选择任一方的WOFF2。1256码点、423,000 B；SHA-256 `f46b4f085c662c64c789a763e5e7474dfdb0d6b0ff2ae2a0508e724ca8a91210`。README同步真实体积及校验值；两次生成一致。
3. Collection、Targeted Content、Launch Operations计数精确合并；保留双方武器展示、来源、剧透及负例断言，不跳过检查。
4. Search重新运行构建器，37条文档；重复生成逐字节一致，SHA-256 `af4be6c489d24034dc0f18a53b300f7e63fb8d0d2445e600db84ae5fe222f73b`。
5. 实际数据检查发现两个同日GameVersion批次都用了sequence=102。按集成先后，武器截图批次保持102，公开攻略批次改为103，只消除注册序号重复；稳定版本ID、事实、来源、实际日期、客户端版本未知状态均不变。
6. #73测试与#72新增的审批范围测试同时保留。显式发售状态复核标记只影响必需发售来源；历史日期顺序、三天阈值、商业／实体版／PC来源日期都未改。

全部武器JSON逐字节匹配#71，全部角色／Boss／地点JSON逐字节匹配#72；未重做媒体或内容研究。没有夹入未合并的PR #70攻略。

## 已实际完成的本地检查

完整Release Candidate：`npm run check:launch -- --mode=release-candidate --as-of=2026-11-16`，AUTOMATED CHECKS PASS，BLOCK=0。该命令真实执行完整Build并验证Sitemap46／Canonical48／页面HTML49／Search37；公开武器18、角色6、Boss8、地点4、Guide1。

保留3个Source WARN：commercial-pricing82天、physical-edition82天、pc-requirements21天；发售来源复核为0天。Release Version引用合法，release-verified Fact为0；生命周期仍为released。Production Context Build Guard通过，剧透范围未扩大。

Launch Operations24项、Knowledge7项、Release evidence6项、数据fixtures、媒体回归、控制器解析及Search12个fixtures通过。生成产物确定性与git diff --check通过。

Preview、HTTP与真实浏览器验收结果须以本集成PR最终说明的提交SHA及部署为准，不把本地检查提前记为Preview PASS。证据保存在仓库外 `/tmp/pbz-release-prep-20261116/`及相关日志／截图目录。

## 人工合并边界

本集成PR是审核用完整组合候选，不能与原PR盲目重复合并。建议先审查独立修复#73，再按#71 → #72发布；届时须把本分支已经验证的冲突解法和GameVersion序号修正应用到实际后续PR，并核对最终HEAD／Preview。也可以由负责人明确选择以本组合候选替代原内容PR交付。两条路径均需要人工批准；本轮不执行任何合并或Production部署。
