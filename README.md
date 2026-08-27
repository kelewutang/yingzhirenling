# 影之刃零攻略站

yingzhirenling.cn 当前采用 Static HTML/CSS/Vanilla JavaScript、Knowledge JSON、零依赖 Node.js validator/generator、生成后的静态产物和 Netlify static hosting。

生产页面最终都是静态文件；部分 Search JSON 和 Weapon Detail HTML 需要在提交前由 Node.js 脚本生成并验证。当前 Netlify 直接发布仓库中已经提交的静态产物，不自动运行完整 generator pipeline。

详细说明：

- [项目目标与阶段](docs/PROJECT.md)
- [当前生产架构](docs/ARCHITECTURE.md)
- [Knowledge Schema 1.0](docs/knowledge-schema-1.0.md)
- [项目级开发入口](AGENTS.md)
- [详细开发规则](docs/DEVELOPMENT-RULES.md)

## 项目结构

```
yingzhirenling-site/
├── index.html                    # 首页
├── netlify.toml                  # Netlify 配置（含路由与重定向）
├── css/
│   └── style.css                 # 全站样式
├── js/
│   └── main.js                   # 渐进增强（导航、搜索、主题等）
├── data/                         # Knowledge JSON Source of Truth
├── generated/                    # 派生 Search JSON
├── scripts/                      # Validator 与静态生成器
├── docs/                         # Schema、架构、标准与阶段记录
├── pages/
│   ├── guide.html                # 攻略中心
│   ├── weapons.html              # 武器图鉴
│   ├── characters.html           # 角色图鉴
│   ├── bosses.html               # Boss攻略
│   ├── world.html                # 世界观设定
│   ├── videos.html               # 视频中心
│   ├── about.html                # 购买指南
│   ├── about-site.html           # 关于本站
│   └── generated/weapons/*.html  # 生成的 Weapon Detail HTML
└── assets/                       # 静态资源
```

## 部署方法

部署前必须确认需要更新的派生产物已经在本地完成生成、验证和审查。具体命令和验证范围以 [开发规则](docs/DEVELOPMENT-RULES.md) 及当前阶段任务为准。

### 方法一：拖拽部署（最简单）

此方式只适用于已经在本地完成生成和验证的完整静态目录。

1. 登录 https://app.netlify.com
2. 进入 Sites 页面
3. 将整个 `yingzhirenling-site` 文件夹拖拽到页面的 "Drag and drop your site folder here" 区域
4. 等待部署完成，Netlify 会自动生成一个 `*.netlify.app` 域名

### 方法二：GitHub 持续部署（推荐）

1. 将本项目推送到 GitHub 仓库
2. 在 Netlify 点击 "Add new site" → "Import an existing project"
3. 选择对应的 GitHub 仓库
4. 构建设置由仓库中的 `netlify.toml` 管理：
   - Publish directory: `.`（根目录）
   - 当前 Netlify 构建命令不执行 Knowledge validator 或 generator
   - Search JSON、Weapon Detail HTML 等派生产物必须在提交前生成并提交
5. 点击 "Deploy site"

### 方法三：Netlify CLI

```bash
npm install -g netlify-cli
cd yingzhirenling-site
netlify deploy --prod
```

## 绑定自定义域名（yingzhirenling.cn）

1. 在 Netlify 站点设置 → Domain management → Add custom domain
2. 输入 `yingzhirenling.cn` 和 `www.yingzhirenling.cn`
3. 在域名注册商处修改 DNS：
   - A 记录：`yingzhirenling.cn` → Netlify 提供的 IP
   - CNAME：`www` → `你的站点.netlify.app`
4. 等待 DNS 生效（几分钟到几小时）
5. Netlify 会自动申请 HTTPS 证书（Let's Encrypt）

## 已配置的重定向

netlify.toml 中已配置以下短链接重定向：
- `/` → index.html
- `/guide` → /pages/guide.html
- `/weapons` → /pages/weapons.html
- `/characters` → /pages/characters.html
- `/bosses` → /pages/bosses.html
- `/world` → /pages/world.html
- `/videos` → /pages/videos.html
- `/about` → /pages/about.html

## 已实现功能

- **发售倒计时**：首页实时显示距2026年10月29日的天数
- **武器搜索筛选**：武器图鉴页支持关键词搜索 + 主/副武器/四大类筛选
- **评论系统**：当前停用/未启用，不属于现有生产能力
- **主题切换**：导航栏右侧3套配色——赤焰（红金默认）、墨青（青银）、昼白（浅色阅读），自动记忆选择
- **百度统计**：已预埋代码，配置ID后自动启用，见下方说明
- **百度自动推送**：已内置，站点验证通过后自动生效，用户访问页面时自动推送给百度加快收录
- **B站视频内嵌**：首页和视频页直接嵌入官方PV
- **响应式布局**：手机端汉堡菜单，自适应各尺寸
- **短链接重定向**：/guide、/weapons等简洁URL

## 评论系统状态

评论系统当前停用/未启用。仓库和生产运行时不把 Giscus 作为现有能力，也不承诺恢复时间；未来如需重新引入，应作为独立阶段审查隐私、依赖、可用性和页面影响。

## 百度统计配置

1. 访问 https://tongji.baidu.com ，用百度账号登录
2. 管理 → 新增网站 → 填入域名 `yingzhirenling.cn`
3. 获取代码后，复制 `hm.js?` 问号后面的那串ID
4. 编辑 `js/main.js`，找到 `BAIDU_TONGJI_ID`，把ID填进引号里
5. 保存后统计自动生效，可在百度统计后台看访问数据

## 后续更新

- 发售后补充完整流程攻略、全Boss打法、全收集指南
- 在 assets/ 目录添加游戏截图和角色立绘
- 可扩展更多页面：新闻资讯、玩家Build分享、无伤速通专区
