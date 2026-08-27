# P1-4B Production Search Integration

## 1. Runtime architecture

生产搜索现在由两层组成：

```text
js/main.js 中现有页面级 SEARCH_INDEX（基础层、立即可用）
  +
/generated/search-index.production.json（Entity 渐进增强层）
```

页面级 `SEARCH_INDEX` 保持原样，没有移动到 JSON，也没有被 Entity 文档替代。`DOMContentLoaded` 后调用一次 `initEntitySearchIndex()`，该函数在后台异步请求 Entity 数据，不阻塞搜索弹窗、导航、主题或其他页面初始化。

浏览器只读取根路径绝对地址 `/generated/search-index.production.json`，从不读取 shadow 文件，也不增加随机参数、localStorage、Service Worker 或其他缓存层。

## 2. Entity loader 与状态

最小状态为：

- `idle`：尚未启动；
- `loading`：单次 fetch 进行中，搜索继续使用页面文档；
- `ready`：合法数组已转换为内部 Entity 搜索文档；
- `failed`：HTTP、JSON 或 runtime contract 失败，Entity 数组保持为空。

初始化守卫保证一个页面生命周期最多正常请求一次。失败后不重试，输入和打开搜索框也不会触发新请求。

## 3. Runtime validation

顶层必须为数组；合法空数组也是 `ready`。每条文档至少验证：

- 非空唯一 `id`；
- `documentType=entity`；
- `entityType=weapon`；
- 非空 `route`、`displayName`；
- `summary` 为 string；
- `aliases`、`displayAliases`、`keywords` 均为 string array；
- `recordState=published`；
- `sourceSchemaVersion=1.0-implementation`。

任意一条不合法或 id 重复，整次 Entity enhancement fail closed，不静默生成部分索引。浏览器没有复制 Fact、Source、GameVersion 或 Alias status 的 Knowledge Validator。

## 4. Page + Entity normalization

现有页面条目在搜索时派生：

```text
id = page:<url>
documentType = page
```

Entity 映射为现有搜索模板字段：

| Entity 字段 | 内部搜索字段 |
| --- | --- |
| `id` | `id` |
| `documentType` | `documentType` |
| `entityType` | `entityType` |
| `displayName` | `title` |
| `summary` | `desc` |
| `route` | `url` |
| `aliases + keywords` | `keywords` |
| — | `tag=武器` |

`displayAliases` 当前没有安全的现成 UI 位置，因此不展示。`recordState` 和 `sourceSchemaVersion` 只用于加载校验，不进入结果文案。

Page 与 Entity 按当前顺序共同进入原有字符串过滤算法。不会按 route 去重，所以 `/weapons` 页面结果可以与唐横刀、牙横刀 Entity 结果共存。本轮没有新增 ranking、badge 或高亮。

## 5. Async race

用户可以在 `loading` 时立即搜索，此时正常获得页面结果。Entity 状态变为 `ready` 后，如果当前 `#searchInput` 存在且 query 非空，代码用同一个 query 再调用一次现有 `doSearch()`。

刷新不会重新打开弹窗、重建监听器、修改输入、关闭窗口或主动改变焦点。慢响应浏览器测试确认：输入“唐横刀”期间页面结果持续可用；ready 后 Entity 结果自动出现，query 与输入焦点均保持。

## 6. Failure fallback 与空数组

- HTTP 非 2xx、JSON 解析失败、顶层错误、字段非法或重复 id：状态变为 `failed`；
- Entity 数据清空，页面级 `SEARCH_INDEX` 继续工作；
- Entity 加载、解析、校验和转换阶段的 Promise rejection 被 `.catch()` 处理；
- 只输出一次 `console.warn('Entity search enhancement unavailable')`；
- 不向用户显示技术错误；
- `[]`：状态为 `ready`、0 Entity，页面搜索正常，不产生 warning。

Entity 成功进入 `ready` 后才在 loader catch 边界之外调用 `refreshCurrentSearch()`。因此搜索刷新或结果渲染自身的异常不会被误报为 Entity 加载失败，也不会清空已经加载的 Entity 数据或把状态改回 `failed`。

构建仍然 strict；浏览器 resilient 只表示安全回退，不表示接受损坏数据。

## 7. Local HTTP and browser verification

使用临时 Node 静态 HTTP 服务和本机无头 Chrome 验证，测试结束后服务和临时脚本均已删除。

通过项目：

1. `/generated/search-index.production.json` 经 HTTP 返回 200 和 2 条文档；
2. `/`、`/guide`、`/weapons`、`/bosses` 均从根路径正确加载 production JSON；
3. 每个页面生命周期只请求一次 production JSON，未请求 shadow JSON；
4. 页面查询“攻略”“Boss”“视频”“武器”继续返回页面结果；
5. “唐横刀”“牙横刀”出现 Entity 结果；
6. “青龙掠月刀”没有 Entity 标题结果，但仍允许命中 `/weapons` 页面条目；
7. Page 与 Entity 可同时共享 `/weapons`；
8. 800ms 延迟响应下，loading 使用页面 fallback，ready 后自动刷新且保留 query/focus；
9. HTTP 404、HTTP 500、损坏 JSON、顶层 object、错误 documentType/entityType/recordState、缺少 id/displayName、aliases 非数组、重复 Entity id 均 fail closed，页面搜索仍正常；
10. 空数组进入 ready，页面搜索正常；
11. 390px 下搜索打开、输入、Entity 结果、点击、关闭、Escape 均正常，无横向溢出。

正常加载环境无新增 console error、warning 或 pageerror。失败环境只有预期的一次 enhancement warning；HTTP 404/500 时 Chrome 自身会记录对应的资源加载网络日志，但没有未处理异常或 Promise rejection。

## 8. Remaining limitations

1. Weapon Entity 仍统一跳转 `/weapons`；
2. 没有 Entity 详情页；
3. 没有 Page/Entity type badge；
4. 没有复杂 ranking，页面条目仍排在 Entity 条目前；
5. 没有搜索词高亮；
6. 没有搜索历史；
7. 没有服务端搜索；
8. 青龙掠月刀仍为 draft，不进入 Entity production index；
9. Page `SEARCH_INDEX` 仍手工维护；
10. 当前只接入 Weapon Entity；
11. runtime 浏览器矩阵暂为人工运行的临时测试，没有引入项目测试框架。

本地 P1-4B Gate 通过后仍需部署到 Netlify，再验证真实 production JSON 的 HTTP 状态、缓存和线上浏览器行为；本文件不宣称线上已经通过。
