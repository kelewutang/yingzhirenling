# 影之刃零攻略站 - 部署到 Netlify 指南

## 项目结构

```
yingzhirenling-site/
├── index.html          # 首页
├── netlify.toml        # Netlify 配置（含重定向规则）
├── css/
│   └── style.css       # 全站样式
├── js/
│   └── main.js         # 交互脚本（导航、倒计时、回到顶部、评论、主题切换）
├── pages/
│   ├── guide.html      # 攻略中心
│   ├── weapons.html    # 武器图鉴
│   ├── characters.html # 角色图鉴
│   ├── bosses.html     # Boss攻略
│   ├── world.html      # 世界观设定
│   ├── videos.html     # 视频中心
│   └── about.html      # 购买指南
└── assets/             # 图片资源目录（预留）
```

## 部署方法

### 方法一：拖拽部署（最简单）

1. 登录 https://app.netlify.com
2. 进入 Sites 页面
3. 将整个 `yingzhirenling-site` 文件夹拖拽到页面的 "Drag and drop your site folder here" 区域
4. 等待部署完成，Netlify 会自动生成一个 `*.netlify.app` 域名

### 方法二：GitHub 持续部署（推荐）

1. 将本项目推送到 GitHub 仓库
2. 在 Netlify 点击 "Add new site" → "Import an existing project"
3. 选择对应的 GitHub 仓库
4. 构建设置：
   - Build command: 留空（静态站不需要构建）
   - Publish directory: `.`（根目录）
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
- **评论系统**：基于Giscus（GitHub Discussions），需配置后启用，见下方说明
- **主题切换**：导航栏右侧3套配色——赤焰（红金默认）、墨青（青银）、昼白（浅色阅读），自动记忆选择
- **百度统计**：已预埋代码，配置ID后自动启用，见下方说明
- **百度自动推送**：已内置，站点验证通过后自动生效，用户访问页面时自动推送给百度加快收录
- **B站视频内嵌**：首页和视频页直接嵌入官方PV
- **响应式布局**：手机端汉堡菜单，自适应各尺寸
- **短链接重定向**：/guide、/weapons等简洁URL

## 评论系统配置（Giscus）

本站使用 Giscus——基于 GitHub Discussions 的免费评论系统，无需后端、无广告。

**配置步骤（5分钟）：**

1. 创建一个公开的 GitHub 仓库（如 `yingzhirenling-site`）
2. 进入仓库 Settings → Features → 勾选 **Discussions** 并保存
3. 安装 Giscus App：访问 https://github.com/apps/giscus ，点 Install，选择刚才的仓库
4. 访问 https://giscus.app ，在页面中：
   - 仓库：填 `你的用户名/仓库名`
   - 页面映射：选 `pathname`
   - 讨论分类：选 `General`（或新建一个）
   - 主题：选 `dark`
   - 语言：`zh-CN`
5. 页面下方会生成代码，复制其中的 `data-repo-id` 和 `data-category-id`
6. 编辑 `js/main.js`，找到 `GISCUS_CONFIG`，填入你的 repo、repoId、category、categoryId
7. 保存后评论区自动出现在所有内容页底部

未配置时，评论区会显示配置提示，不影响网站运行。

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
