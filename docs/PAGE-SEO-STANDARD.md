# URL Standard

- 每个可索引页面只有一个 canonical short route。
- slug 必须稳定、显式，不从显示名临时推断。
- 对外 URL 不使用不必要的 `.html`。
- 旧 URL 和物理路径最多一次 301 到首选 URL。
- canonical 必须直接指向最终 200 URL，不能指向会再次重定向的地址。
- 不改变已有 slug 或公共 URL，除非当前任务明确批准迁移方案。

# Entity Route

推荐模式：

```text
/{entity-type-plural}/{slug}
```

当前唯一经过生产验证的 Entity detail pattern 是：

```text
/weapons/{slug}
```

Boss 和 Character 详情页尚未上线，不得将候选 route 写成 current production。

# Head Requirements

每个生产可索引页面至少包含：

- 唯一、准确的 `<title>`；
- 与页面实际内容一致的 meta description；
- 唯一 canonical；
- responsive viewport；
- 与页面语言一致的文档语言声明。

metadata 应从同一内容或 Entity projection 派生，避免 title、H1、canonical、Search route 相互漂移。

# Heading

- 每页一个主要 H1。
- H2 表达主要内容区，H3 表达其内部 Fact、Source 或小节。
- 不为视觉字号跳级，不用多个 H1 代替布局。
- 生成器必须防止空标题和内部 key 直接泄漏到用户界面。

# Breadcrumb

Entity Detail Page 使用：

```text
首页 > 分类页 > Entity
```

当前 Weapon 示例：

```text
首页 > 武器图鉴 > 唐横刀
```

前两级应为正常内部链接，当前 Entity 可以是文本。

# Static SEO Content

以下核心知识必须已经存在于响应 HTML：

- title、description、canonical；
- H1、summary 和 breadcrumb；
- 主要 Fact 及其信息状态；
- 页面实际引用的 Source。

不得依赖浏览器 fetch Knowledge JSON 后再插入上述内容。JavaScript 只能提供 progressive enhancement。

# Sitemap

- 只包含应被索引的 canonical URL。
- published Entity 可以进入 sitemap；draft 和 archived active records 必须排除。
- `lastmod` 来自数据中的 `updatedAt` 或页面真实内容更新时间。
- 不使用 build 当前时间，也不在内容未变化时批量刷新日期。
- 当前 sitemap 是人工同步的 11 URL 文件；Entity 数量增加后应自动派生。

# Internal Linking

优先建立：

```text
collection → detail
detail → collection
```

Search route 可以提供发现能力，但不能长期替代正常站内链接。

Relation 只有在存在经过 Schema 校验的真实 Relation 时才生成链接。无 Relation 时不显示空 Related 区块，也不根据名称猜关联。

# Search and Canonical Consistency

published Entity 的 Production Search route 必须指向真实详情 canonical。详情文件不存在、canonical 不一致或 Entity 未发布时，production build 应失败或排除记录，而不是发布死链。

Page Search 文档可以继续指向 collection；Page 与 Entity 不因 route 或主题相关而强制合并。

# Open Graph

Open Graph 可以在形成统一 metadata 模板后逐步加入。本治理阶段不要求修改现有页面，也不鼓励只给少量页面添加不一致实现。

新增 OG 字段必须来自已有内容，不得编造发布日期、图片权属或官方身份。

# JSON-LD

只使用语义正确且能由页面内容支持的 Schema.org 类型和字段。

禁止：

- 因为 Weapon 有名称就把它伪装成可购买 `Product`；
- 把 Fact trust status 映射成不存在的 Schema.org authority；
- 添加页面未展示或来源不支持的数据；
- 为追求数量堆叠互相矛盾的结构化数据。

# Pre-release Content Rule

在可靠证据出现前，页面和 metadata 不得无条件使用：

- “最强”“T0”“毕业”；
- 未证实获取方法、掉落地点或数值；
- 伪造的完整 Build；
- 正式版平衡结论；
- `release-verified`。

editorial 判断可以存在，但必须明确是本站分析，不能写成官方评级或客观数据。

# URL Normalization Debt

当前部分 Weapon 详情的尾斜杠版本也可能返回 200：

```text
/weapons/tang-hengdao
/weapons/tang-hengdao/
```

canonical 已统一到无尾斜杠短路由，当前风险低。这是全站级 URL normalization 技术债，不要求每个无关阶段分别修复。

未来修复必须一次性审计 Netlify Pretty URLs、现有 collection routes、物理别名和 canonical，避免循环、多跳或破坏已收录 URL。

# Verification Minimum

涉及页面、route 或 SEO 的任务按风险至少检查：

- HTTP status 与最终 URL；
- redirect 数量和 Location；
- canonical、title、description、H1；
- 物理别名与不存在路径；
- sitemap published/draft 边界；
- 静态 HTML 无 JavaScript 可读性；
- 390px 与 1280px；
- Netlify Deploy Preview 或 production behavior。

# Source of Truth

- 当前架构：[ARCHITECTURE.md](ARCHITECTURE.md)
- UI 与 Fact 展示：[UI-TEMPLATE-STANDARD.md](UI-TEMPLATE-STANDARD.md)
- Knowledge 状态规则：[knowledge-schema-1.0.md](knowledge-schema-1.0.md)
