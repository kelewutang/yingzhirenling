# 发售后地图、角色与Boss资料：2026-11-16

本批从远端main及Production共同基线 `e91bc78c2e43cb8f3d9b5db8380a7e6345cdd137` 开始。负责人授权实施、Commit、Push、新PR和Preview；不授权Merge或Production部署。仅操作独立分支 `content/release-world-characters-bosses-20261116`。

## 内容与证据

发布三处新区域：悲泣溪谷、血色森林、陆家村；三名新角色：玉儿、左殇、沐小葵。复用原draft Boss残钢、彭猛、花千笑的ID及slug，保留旧Fact、英文别名和原来源；另建阿花与追命的Boss记录。原有武器、Guide、图片、生命周期和商业来源日期不变。

正文资料来自游民星空Wioud／Agent原创发售后攻略、署名lzlzmc并标明来自bilibili的图文流程、Game8转载采药流程，以及明确标为本作序章／陆家村图鉴的BWIKI社区转录。24个本批Source均实际访问成功，逐项记录原始URL、署名、日期与2026-11-16核查日期；网页访问清单、原HTML及SHA-256保存在仓库外 `/tmp/pbz-world-20261116-evidence/`。BWIKI更新时间不冒充首发日期，无法确认的publishedAt保持null。没有重托管媒体图片、宣称看过未观看的视频或记录不存在的游戏测试会话。

官方[1.0302256补丁](https://pbz.s-game.com/zh-CN/news/patch-notes-2026-11-03/)只支持阿花在入阵者／破局者难度下投技频率降低；作为单独official Fact记录。其余新内容为third-party，未标release-verified。`version:release-guides-2026-11-16`仅表示发售后攻略资料批次，未知客户端版本保持null，不是本站测试的补丁版本。

未采用其他站点的自动译名、未核实数值、套用旧作的铁扇等人物设定或攻略间冲突的任务截止点；不补造角色势力、血缘关系或任务结局。左殇与魂的昔日同伴关系复用现有formerCompanionOf；没有把The Hunt强行映射为追命。旧三把无中文名武器仍为draft。现有三个英文Boss不在本批擅自合并或改名。

## 获批最小技术范围

负责人明确批准只增补必要Fact key及对应投影／校验，保持现有模型和设计。新增Boss位置／机制／应对／奖励、区域路线／铃铛／回访／任务／连接、角色势力／相遇／任务共12个key；具名条目只允许name与description，空值、额外字段与错误实体类型仍拒绝。详情沿用现有来源、Fact卡和原生details组件，无CSS／运行时JS／框架重构。

新增11条详情的显式短路由200 rewrite和.html单次301，其他稳定URL保持。Search由构建器生成，字体按现有PBZ Serif流程生成；数量基线精确变为Sitemap43／Canonical45／页面HTML46／Search34。集合公开数量为武器15／角色6／Boss8／地点4，仍不触发20条Collection Browser门槛。

## 本批剧透审批与Browser证据

负责人在本轮明确批准以下精确范围及最小守卫更新：

- 五个minor Boss实体：`boss:cangang`、`boss:peng-meng`、`boss:hua-qianxiao`、`boss:a-hua`、`boss:zhui-ming`，允许轻度剧透公开。
- 两个major Fact：`fact:location:beiqi-xigu:release-hidden-outpost`（驿站隐藏区回访条件）、`fact:character:mu-xiaokui:release-encounter`（陆家村后段相遇）。继续默认折叠，须主动展开，不进入公开摘要或Search。
- 原PR #63痴者残剑minor实体与获取Fact的审批继续保留。

没有把PR #63的批准扩大解释为本批批准。保留 `approvedP3Cn8gSpoilerScope` 与原全部负例；新增独立 `release-world-2026-11-16` 精确范围。未知实体／Fact、级别变化、其他Guide／Media、额外重大披露、默认展开、缺少data-nosnippet均拒绝。仍保留Source currentness、Lifecycle、Release evidence及所有其他检查规则。

本地真实Chrome157完成33组页面／视口检查：三个集合320／390／1280px，11条详情各390／1280px，魂与白影1280px回归；另做11次Search查询与真实结果点击、无JS静态阅读。两条重大Fact在390／1280px下共四次样本默认关闭，Enter可展开并再次关闭，焦点轮廓可见；页面无横向溢出，滚动800px时Header top=0，无未处理JS异常或非预期第一方HTTP错误。

本地证据在仓库外 `/tmp/pbz-world-browser-local/`，包括截图及几何JSON。CDP须开启focus emulation并发送完整Enter文本事件；最初不完整的按键注入未激活浏览器默认行为，已用独立原生details探针核对后重新执行完整检查，没有修改生产JS来配合测试。Preview验收结果应以本PR最终部署SHA及PR说明为准，不用本地Browser证据冒充Preview PASS。

## 发布边界

本批只提供已核实资料的简要路线与战斗要点，不声称完整地图、全收集、全难度通用打法或已核实全部人物关系。新增实体沿用缺图fallback，不抓取未获准图片。所有测试证据均在仓库外；仓库tmp不读取、枚举、修改或暂存。

## 提交前自动化结果

完整npm run build通过（25项内置测试），Production Context Build Guard通过；Launch Operations 23项、Knowledge投影7项、数据校验79个fixture、Search12个fixture通过。字体覆盖1210个码点，子集406,996 B（相对基线增加29,924 B），SHA-256为 `87ada7eee61a18e60c792e774cc025cde0f9bb732cee628b2af453115784d5e4`。

旧23条Search文档逐项保持一致，仅追加11条；三条复用Boss的9个旧Fact均保留原值、日期及来源，仅登记新Fact替代关系。三个集合lastmod随实际重要内容更新至2026-11-16，其余日期不批量刷新。没有修改武器、Guide、图片、CSS或运行时JS；git diff --check通过。
