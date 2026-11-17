# P3-CN-REL-01 地点 / Boss / 武器关联

## 基线与授权

从 main / Published `b5bf33f18aeb047fc2e1c5b787ac3f71785c66c9`（PR #83）建立隔离工作区与 `feat/location-boss-weapon-relations`。附件所列21武器/46 URL是此前基线；本轮按最新26武器、5 Boss、4地点、6角色、1 Guide及51/51/52/42维持不变。允许实施、测试、提交与Preview；不允许合并或生产部署。

## 关系审计

| Boss ID | Location ID | Weapon ID | 依据来源 | 结论 |
|---|---|---|---|---|
| boss:cangang | location:beiqi-xigu | weapon:jagged-steel | [source:gamersky-boss-1-2026-10-29](https://www.gamersky.com/handbook/202610/2235534.shtml)、[source:gamersky-reward-cangang-2026-10-29](https://www.gamersky.com/handbook/202610/2235539_4.shtml) | third-party；可建立导航，非本站实测 |
| boss:peng-meng | location:beiqi-xigu | weapon:juxiong-fu | [source:gamersky-boss-2-2026-10-29](https://www.gamersky.com/handbook/202610/2235534_2.shtml)、[source:gamersky-reward-peng-meng-2026-10-29](https://www.gamersky.com/handbook/202610/2236646.shtml) | third-party；可建立导航，非本站实测 |
| boss:a-hua | location:beiqi-xigu | weapon:hongzhuang-guizhan | [source:gamersky-boss-3-2026-10-29](https://www.gamersky.com/handbook/202610/2235534_3.shtml)、[source:gamersky-reward-a-hua-2026-10-29](https://www.gamersky.com/handbook/202610/2235539_6.shtml) | third-party；可建立导航，非本站实测 |
| boss:zhui-ming | location:beiqi-xigu | weapon:zhuiming-suolian | [source:gamersky-creek-tower-2026-11-06](https://www.gamersky.com/handbook/202611/2241946_3.shtml) | third-party；可建立导航，非本站实测 |
| boss:hua-qianxiao | location:xuese-senlin | weapon:chizhe-canjian | [source:gamersky-boss-5-2026-10-29](https://www.gamersky.com/handbook/202610/2235534_5.shtml)、[source:gamersky-reward-hua-qianxiao-2026-10-29](https://www.gamersky.com/handbook/202610/2235539_7.shtml) | third-party；可建立导航，非本站实测 |

10条新关系分别引用同一Boss的现有location/reward Fact：状态、来源、版本、scope不变。原Source/Fact核验日期2026-11-16保留；2026-11-17实际重新读取9个原始URL并核对关联，不批量刷新Source.checkedAt。资料阶段仍为“发售后公开攻略（截至2026-11-16）”，范围按原攻略未区分平台/难度处理。原试玩获取Fact保留历史有效期，不升级为正式版实测。

## 模型与展示

- 新类型：appearsIn（Boss→Location）、awardsWeapon（Boss→Weapon）；内部只用稳定ID。
- 新关系必需basisFactIds单项，引用原Boss位置/奖励Fact，不复制地点或奖励文字。
- 保留status/sourceIds/checkedAt/gameVersionId/scope/validFromVersionId/validToVersionId/reviewNote，并显式分类spoilerLevel。
- 同三元组在相交范围和有效期内不得重复；历史非相交区间可共存。原人物关系及严格重复约束不变。
- 静态构建生成地点→Boss→奖励与武器→Boss→地点。允许多个Boss、多个奖励；无证据不生成获取模块，不宣称“无掉落”。既有其他获取Fact不覆盖。
- Draft/archived端点、待核验关系及结束/取代的依据均不进入当前公开投影。版本定向查询使用左闭右开区间。
- 任一关系、依据或端点重大剧透，将整个条目及附属链接放入既有默认关闭details，标题只使用通用披露提示；SourcePanel只收集非隐藏关联，Search/JSON-LD不扩充关系。
- 复用现有relation-panel样式；不新增runtime JS、CSS、依赖、URL、结构化数据类型，不修改图片或字体。

## 本地实际验证

- 原93项扩展测试保留，新增23项，合计116/116 PASS；完整构建原32项+23项=55/55 PASS，含Sharp原生PNG。
- 数据及原fixtures、Media/Video、字体、Search、移动表格负例、Production Context Guard、audit0、npm ls及diff-check通过。
- 新静态检查器核对12页30条正反向/附属展示，公开链接、资料阶段和折叠边界有效。
- 与当前生产对应产物比较：仅5 Boss+5关联武器+2地点共12 HTML变化，其余40 HTML字节不变；Search42、图片、字体、shared shell、路由、lock不变。
- 仓库外重大关系负例：常规构建到静态输出检查均通过；原Launch Spoiler Guard因未批准的新重大关系按预期BLOCK。未更改审批规则或部署此负例。
- 本地Chromium390/1280：五组链路正反往返共10条流程、30个页面状态、无JS导航通过。既有页面33组、图鉴16项、Search17项及菜单/Sticky/旧别名/图片回归通过；重大关联隔离负例6组（两视口各3页）默认隐藏、可展开关闭、无JS通过。Preview尚未执行，结果见最终Gate报告。

## 边界

不创建游戏实体、不推断地图坐标、掉落概率或新获取顺序。第三方资料可能随补丁失效，届时保留历史关系并重新核验。当前没有本站正式版实测；没有扩大重大剧透批准。

## Owner展示修订（2026-11-17）

Owner明确要求移除详情正文中全部状态标签、来源/资料阶段/核验说明，并确认页底来源区也移除。关系导航只展示名称、获取入口和必要位置描述；后端Source/Fact/Relation的状态、来源、日期、版本和范围保持原样，发布及剧透守卫不改变。对应展示断言按此明确授权改为不展示，并继续校验完整数据证据。Guide、About及图片授权记录不受影响。
