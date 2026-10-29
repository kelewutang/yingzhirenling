# PR #68：自然截断媒体准入与无中文名武器退稿

本轮沿用 `content/release-weapons-level-one` 及 Draft PR #68，起始提交 `aed84c643b81ef974aac9925fdf531937a88065b`。负责人已明确批准：本批本人PC正式版截图允许按白影既有先例保留自然截断，五把此前fallback的武器也要准入；没有已核实中文名的武器撤下公开界面。此前截图授权持续有效，不重复要求确认，不生成缺失部件。

## 实际媒体先例与本轮处理

`media:white-shadow-master` 的processing已经记录原画面未显示完整下段刀刃，保留截断，直接裁2:3并缩放；`media:white-serpent-crimson-viper-master` 同样直接取原图干净区域，不加canvas、matte或padding。本轮遵循这些实际处理记录，继续复用现有Hero／Card媒体组件与contain展示。

五张原图均为2560×1440，采用原图矩形 `[777,108,1665,1440]`（左、上、右、下，右／下为排除边界），取得888×1332干净区域，直接Lanczos缩放至1200×1800，progressive JPEG质量90、4:4:4。去除顶部菜单及两侧界面，不做旋转、抠图、填充、修复或生成。可见主体占比随原始截断而异，不为机械达到80%—90%而补画或添加边框。

| 武器 | 原图 | 局限 | JPEG大小 |
| --- | --- | --- | ---: |
| 木制黑伤 | 4115450_209.jpg | 下段刀刃延伸出原图底部；保留该截断 | 144,313 B |
| 黑伤 | 4115450_204.jpg | 下段刀刃延伸出原图底部；保留该截断 | 157,780 B |
| 长形黑伤 | 4115450_217.jpg | 原图上端刀柄、下段刀刃不完整；同时省略顶部菜单所在区域 | 131,105 B |
| 残钢刃 | 4115450_214.jpg | 下段刀刃延伸出原图底部；仅从1级页裁图，未混入3级属性 | 195,183 B |
| 巨凶斧 | 4115450_207.jpg | 顶部部件与菜单区域不在Master内；展示可见斧身与斧刃 | 177,124 B |

各Media记录保留具体原图SHA-256、裁剪矩形、输出SHA-256、局部／截断说明、本人PC截图来源与self-captured-reviewed权利记录。图注不声称完整武器。未知版本号、捕获日期保持未知；没有修改游戏Fact或Source日期来伪造新核验。

黑伤双刃Master及其元数据不改动，SHA-256继续为 `9758c9f0a3b71df99d02f617f6a1378a8e971b177bb115c8d6ce1d2344314d5b`。白影、白蟒赤练原Master也不改动。

## 确认退稿名单

| 旧公开名称 | 保留实体ID | 旧canonical短路由 | 处理 |
| --- | --- | --- | --- |
| Bashpole | weapon:bashpole | /weapons/bashpole | published → draft |
| Night Owl | weapon:night-owl | /weapons/night-owl | published → draft |
| Seamless Death | weapon:seamless-death | /weapons/seamless-death | published → draft |

三者目前都只有英文名称Fact、没有中文主名或中文别名证据。保留全部Fact、Source、aliases、首次publishedAt、ID与slug；只改recordState及实体updatedAt，原因由本文件记录。没有硬删历史文件、清空首次发布日期、生成中文译名或改用别的武器身份。

残钢刃／Jagged Steel、灵蛇软剑／Soft Snake Sword、白蟒赤练／White Serpent & Crimson Viper、痴者残剑／The Fanatic's Broken Blade都有中文主名，继续公开，英文历史别名继续可搜索。五把正式版主武器的指定获取顺序不变。

## URL与SEO影响

实施前已直接读取上述3条短路由：Production和原PR Preview均返回200，并各自self-canonical到生产短路由。退稿后它们不再生成静态详情，不进入图鉴、Production Search及sitemap。

删除对应3条canonical 200 rewrite及3条物理.html 301规则，让六个地址直接落入项目既有custom 404。没有对应的等价中文详情，故不重定向到首页／图鉴，也不把404页伪装成200。其它已发布武器原URL和单次301保持不变。未来名称核实后可沿用原ID和slug重新发布。

此变更将减少3个可索引详情入口。若旧URL已被搜索引擎收录，合并部署后的404与sitemap撤除可能导致这些旧页面退出索引；不声称已确认收录数量或何时移除。本轮没有请求搜索平台删除URL、发送Production IndexNow通知或部署生产，因此Production三条旧路由在本轮验收时应仍为200。

## 准确数量与验证边界

| 项目 | 本轮起始PR | 本轮目标 |
| --- | ---: | ---: |
| 武器实体总数 | 17 | 17 |
| published武器／图鉴卡／详情 | 15 | 12 |
| draft武器 | 2 | 5 |
| Sitemap | 32 | 29 |
| Canonical标签 | 34 | 31 |
| 页面HTML | 35 | 32 |
| Production Search文档 | 23 | 20 |
| 可生产Media | 4 | 9 |

当前Production main仍为本PR之前的 `7d281e11f6993fdd58380341c1896c38bbf0df3b`：10把公开武器、Sitemap27、Search18。因此本PR若将来获批合并，生产净变化是武器10→12、Sitemap27→29、Search18→20；不能把本轮PR内部的15→12描述成生产已经变化。

退稿及媒体调整本身保留Source17条、GameVersion6条和原235条Fact。随后负责人补充正式分类规则，按下节新增6条有确认依据的分类Fact，合计241条；release-verified及site-release-test仍为0。没有新增重复字段或重构媒体组件。必要的精确计数、已发布正例和fallback断言随实际publication及Media准入同步，草稿排除、已知中文名／英文别名保留、自然截断媒体和原双刃Master不变均有回归检查。

## 负责人后续确认的正式版分类

复用现有 `weapon.systemCategory` 与 `weapon.weaponType`，不新增category字段。已知分类在集合卡、Hero及详情概览中使用完整游戏术语；详情将装备类型与武器分类分别列出。已有grip事实保留，但有正式分类时不再重复显示简写持握行。

| 武器 | 装备类型 | 正式分类 |
| --- | --- | --- |
| 木制黑伤 | 主武器 | 单手武器 |
| 黑伤 | 主武器 | 单手武器 |
| 黑伤双刃 | 主武器 | 双持武器 |
| 长形黑伤 | 主武器 | 双手武器 |
| 残钢刃 | 主武器 | 单手武器 |
| 巨凶斧 | 影之武装 | 破坏 |

主武器允许单手武器／双手武器／双持武器，影之武装允许破坏／远程／奇门／武学／召唤；published当前分类按装备类型分别校验，交叉值、刀剑斧等自定义类别拒绝。分类词表准入不代表任何尚未确认武器被赋予该分类。

痴者残剑、灵蛇软剑、唐横刀、白蟒赤练、白影、牙横刀保持published和原中文名称、英文别名、URL。它们的旧剑／刀类／双剑／苗刀及混合kind记录保留原值和来源，但结束其作为当前分类和搜索分类关键词的适用范围；这不声称武器的物理形态改变。没有正式版分类确认的条目只展示已确认装备类型，不猜测单手、双手或双持归属。

负责人补充的分类确认已记入本批截图Source的notes，真实同日checkedAt保持不变。单件分类Fact仍为observation，不升级official或内部实测。

实际Build、Browser、HTTP／redirect与Netlify Preview结果在最终交接中记录，不预先宣称通过。任务只推进至现有PR #68的Preview；不合并、不部署Production、不触碰仓库tmp。

## 本轮本地验收

完整build通过（19项内置测试）；额外Knowledge／taxonomy／launch测试28项通过，Data fixtures、12项Search fixtures和Media回归通过。字体覆盖通过，子集354,552 B，SHA-256 `9867f69ba05e7e8d31b91193001f7cd66379f75fc4efd08d466a2f9434d59842`。连续两次build的54个dist文件逐字节一致。

真实Chromium完成26组本地页面检查及7项搜索查询：六把详情各390／1280px、集合320／390／900／1280／1800px（1／1／2／3／4列）、白影／白蟒赤练回归、无JS阅读、三把退稿各两种宽度404，以及索引失败时Page Search回退。正式分类、Master解码与contain、主武器顺序、局部图注均通过；无未处理JS异常或非预期第一方HTTP错误。

相对本轮起始HEAD的数据审计确认：原Fact零删除，新增6条分类Fact；退稿3实体除state／updatedAt外保持一致；原黑伤双刃、白影、白蟒赤练Master和原4条Media记录逐字节／结构保持一致。Preview结果需以最终交接的部署SHA及网络验收记录为准。
