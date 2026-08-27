# P1-6 Weapon Detail Page Pilot

## 1. 范围与结论

本试点只为 `recordState=published` 的唐横刀和牙横刀生成静态详情页。青龙掠月刀保持 draft，不生成页面，也不进入 production Entity Search。

详情页核心内容完全来自 `data/weapons/*.json` 及其引用的 Source、GameVersion 和 Registry。`pages/weapons.html` 只作为现有视觉结构参考，不是生成数据源。本轮不修改 Knowledge Schema，不建立 Markdown 内容，不引入依赖或运行时 Knowledge JSON 请求。

## 2. 构建架构

链路：

```text
Knowledge validator
  -> data/weapons + data/sources + data/versions + registries
  -> scripts/build-weapon-pages.mjs
  -> pages/generated/weapons/<slug>.html
  -> /weapons/<slug>（Netlify Pretty URLs）
  -> generated/search-index.*.json
```

`build-weapon-pages.mjs` 使用一个 `renderWeaponPage()` 模板函数和少量 Fact/Source helper，不使用模板引擎。所有 JSON 文本按纯文本 HTML escape；外部 URL 只接受 HTTP/HTTPS。生成器先完成全部验证和渲染，再写文件。

严格失败条件包括：

- Knowledge validator 失败；
- published Weapon 缺少稳定 slug、summary、核心 Fact 或引用对象；
- 出现 `release-verified`；
- Fact status、key、value 或 Source 类型没有安全展示规则；
- duplicate slug / output route；
- published Weapon 的 `weapon.exists` 不为 `true`；
- pending-review 携带非 null 待核值；
- 输出目录存在无生成标记的文件。

draft / archived 被正常跳过。输出目录内带生成标记、但不再属于 published Entity 的旧 HTML 会被清理，避免 stale active page。

## 3. URL 策略

公开路由固定为：

- `/weapons/tang-hengdao`
- `/weapons/ya-hengdao`

物理输出使用与现有短路由一致的生成目录和 flat HTML：

- `pages/generated/weapons/tang-hengdao.html`
- `pages/generated/weapons/ya-hengdao.html`

方案比较：

- 目录 `weapons/<slug>/index.html` 容易让平台将最终 URL 规范化为尾斜杠；不选。
- 根目录 `weapons/<slug>.html` 会创建与集合路由 `/weapons` 同名的真实目录，存在 Netlify 静态文件 shadowing 风险；不选。
- `pages/generated/...` 加精确 rewrite 与现有 `/pages/*.html` 短路由策略一致，能隔离集合页和实体页；本轮采用。

每个物理 `.html` 和 extensionless 内部路径都 301 到 canonical；`/weapons/<slug>` 再以 200 rewrite 提供生成文件。canonical 始终是无尾斜杠的 `https://www.yingzhirenling.cn/weapons/<slug>`。Deploy Preview 仍必须确认真实 Netlify 路由没有循环、多跳或尾斜杠偏差。

## 4. Fact 与 Source 展示

Fact 是页面可信度边界。页面没有 Entity-level official/observation 状态，每条展示 Fact 独立显示以下中文状态：

- official：官方确认
- observation：试玩观察
- third-party：第三方信息
- editorial：编辑推测
- pending-review：待后续核查

`weapon.exists=true` 转成“已在可核查的发售前材料中出现”，不显示后台式“存在：是”。`weapon.publicAppearance` 使用枚举到用户文案的显式映射。

pending-review 不输出 `null`、`undefined`、`N/A` 或 `reviewNote`。获取方式与观察特点分别使用固定安全文案。editorial rating 同时显示“本站发售前编辑判断，不是官方评分或试玩客观数值”，并通过 `basisFactIds` 显示判断依据。

Source 区只收集本页展示 Fact 实际引用的 Source，按稳定 ID 排序，并按 URL 去重。用户界面显示 publisher、title、可读来源类型、发布日期与原始链接，不显示内部 `authority` 枚举。官方来源中的画面观察仍保持 observation。

## 5. 页面与 SEO

页面复用现有 `/css/style.css` 和 `/js/main.js`，核心知识已经写入静态 HTML，关闭 JavaScript 后仍保留 H1、summary、Fact、Source、title、description 与 canonical。

页面包含：

1. 可见 breadcrumb；
2. H1、summary、资料更新时间；
3. 发售前状态边界说明；
4. 核心 Fact；
5. observation / editorial / pending-review 区域（只有真实 Fact 时才输出）；
6. 去重 Source；
7. 返回 `/weapons` 的内部链接。

本轮不增加 Open Graph 或 JSON-LD。现有全站尚无统一 OG 模板；错误或孤立的结构化数据收益低于统一模板后实施。

`sitemap.xml` 保留原有 URL，并最小加入两个详情页，`lastmod` 使用 Weapon.updatedAt。当前只有两个页面，不新增 sitemap generator。

## 6. Search route

`build-search-index.mjs` 只在已发布详情文件真实存在、包含生成标记且 canonical 匹配时，才把 published Weapon route 派生为 `/weapons/<slug>`。缺失页面会非零失败，不回退到一个看似成功但错误的生产 route。

draft shadow route 继续使用 `/weapons`，避免暗示尚不存在的生产详情页。页面级“武器图鉴”搜索文档仍保留 `/weapons`，Entity identity 和 Page + Entity 合并逻辑不变。

## 7. Markdown 判断

唐横刀和牙横刀当前只需 Entity summary、Fact 与 Source 即可形成完整、可信的最小详情页。没有真实长篇分析需求，因此不创建空的 `content/weapons/*.md`，也不实现 Markdown parser。

未来出现独立实战分析、历史梳理等长文时，再采用可选 `content/weapons/<slug>.md`，以稳定 Entity ID 关联 JSON；结构化事实仍保留在 Knowledge Data。

## 8. 已知技术债与后续边界

- 生成模板复制了现有 header/footer；全站改导航时需要同步生成器。
- 模板是手写 HTML 字符串；当前两个页面可控，但多个 Entity 类型会增加维护成本。
- sitemap 仍手动同步。
- `/weapons` 集合页尚未链接到两个详情页；P1-6B 应在不改正文事实的前提下，把对应卡片/名称变为详情链接，补足正常站内发现路径。
- Relation 尚无生产数据，因此不渲染 Related 区域。
- 没有 Markdown layer，这是当前有意边界而非阻塞。
- 当前详情投影要求一个 Entity 内每个 Fact key 只有一个待展示事实；正式版出现同 key 的历史版本后，需要先定义“当前有效 Fact”选择规则，再放宽生成器。
- Netlify 对新增精确 rewrite、物理路径 301 与尾斜杠变体的行为需在 Deploy Preview 复核。

本轮只出现 header/footer 复制、手写模板、手动 sitemap 三项信号；Fact helper 仍小，Markdown/Relation 尚无真实需求，详情页数量为 2。因此尚未达到“任意三项且即将扩展多实体/20+ 页面”的 Astro 迁移压力，建议继续 JSON + generator，并在 Character 或 Boss 详情模块开始前重新评估。
