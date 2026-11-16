# 当前发售状态来源复核（2026-11-16）

基线为远端main与Published Production共同提交 `e91bc78c2e43cb8f3d9b5db8380a7e6345cdd137`。本修复独立于PR #71、#72的内容，用户已批准本轮必要修复、Commit、Push和审核PR；未批准合并或生产部署。

## 实际复核

- [S-GAME中文官网](https://pbz.s-game.com/zh-CN/)：网页读取工具返回“现已发售”及2026/10/29。直接Python HTTP访问收到403，保留此限制记录，没有将它记为HTTP 200。
- [PlayStation中国大陆商品页](https://store.playstation.com/zh-hans-cn/product/UP8428-PPSA39223_00-0712664832266556)：PS5已发行商品，提供购物车入口，发售日期2026/10/29；网页读取与直接HTTP均成功。本轮只复核发售状态，不刷新价格核查日期。
- [Steam商品页](https://store.steampowered.com/app/4115450/Phantom_Blade_Zero/)及[中国大陆API](https://store.steampowered.com/api/appdetails?appids=4115450&cc=cn&l=schinese)：已发行、提供购买，API success=true、coming_soon=false。商店本次地区化日期为2026年10月28日，不由此推断具体时区或解锁时间，不覆盖既有北京时间公告。

核查日期为2026-11-16；实际网页证据和成功响应SHA-256保存在仓库外 `/tmp/pbz-release-prep-20261116/`。这不是客户端实际可玩测试。

## 最小实现

`pages/about.html`保留历史安排核查2026-10-26、首次发售状态核查2026-10-29及全部历史预下载／发售事件；追加一条真实当前状态复核，使用 `data-review-subject="release-date-platform-store"` 标明用途。时间顺序没有调整。新增Steam来源入口，明确三家网页状态和证据边界。

检查器只对release-date-platform-store读取唯一的显式复核标记。标记缺失、重复、无日期时不回退历史日期；错误日期、未来日期、超过3天均继续BLOCK。其他来源仍按原规则取日期。三天阈值、mandatory规则、价格、实体版、PC来源日期和生命周期均未修改。

## 验证与交付边界

本分支完整Release Candidate执行 `--mode=release-candidate --as-of=2026-11-16` 已返回AUTOMATED CHECKS PASS。必需发售来源为0天，BLOCK=0；commercial-pricing、physical-edition各82天，pc-requirements为21天，保留三项真实WARN。22项Launch Operations测试及完整Build通过；数量仍为32／34／35／23，不包含两个待集成内容PR。

本修复的Preview以及组合版本验收在各自PR最终说明记录，不将本地结果充当Preview证据。本PR不授权合并、生产部署、更新其他来源或重做T-14。
