// ===== 影之刃零攻略站 - 交互脚本 =====

document.addEventListener('DOMContentLoaded', function () {
  initMobileNav();
  initBackToTop();
  initActiveNav();
  initCountdown();
  initComments();
  initThemeSwitcher();
  initBaiduTongji();
  initBaiduPush();
  initPageMeta();
});

// 移动端导航切换
function initMobileNav() {
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  if (!toggle || !links) return;

  toggle.addEventListener('click', function () {
    links.classList.toggle('open');
    toggle.textContent = links.classList.contains('open') ? '✕' : '☰';
  });

  // 点击链接后关闭菜单
  links.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', function () {
      links.classList.remove('open');
      toggle.textContent = '☰';
    });
  });
}

// 回到顶部按钮
function initBackToTop() {
  const btn = document.querySelector('.back-to-top');
  if (!btn) return;

  window.addEventListener('scroll', function () {
    if (window.scrollY > 400) {
      btn.classList.add('visible');
    } else {
      btn.classList.remove('visible');
    }
  });

  btn.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// 高亮当前导航
function initActiveNav() {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(function (link) {
    const href = link.getAttribute('href');
    if (!href) return;
    const linkPage = href.split('/').pop();
    if (linkPage === currentPage) {
      link.classList.add('active');
    }
  });
}

// 发售倒计时
function initCountdown() {
  const el = document.getElementById('countdown');
  if (!el) return;

  const target = new Date('2026-10-29T00:00:00+08:00').getTime();

  function update() {
    const now = Date.now();
    const diff = target - now;

    if (diff <= 0) {
      el.innerHTML = '<div class="stat-number">已发售</div><div class="stat-label">游戏现已上线</div>';
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    el.innerHTML =
      '<div class="stat-number">' + days + '天</div><div class="stat-label">距发售还有 ' +
      hours + '小时' + mins + '分</div>';
  }

  update();
  setInterval(update, 60000);
}

// ===== Giscus 评论系统 =====
// 配置说明：
// 1. 创建一个公开的 GitHub 仓库
// 2. 在仓库 Settings → Features 中开启 Discussions
// 3. 安装 https://github.com/apps/giscus 到该仓库
// 4. 访问 https://giscus.app 获取 repo-id 和 category-id，替换下面两行
// 5. 评论区会自动出现在每个内容页底部
const GISCUS_CONFIG = {
  repo: 'kelewutang/yingzhirenling',
  repoId: 'R_kgDOT8TPFg',
  category: 'General',
  categoryId: 'DIC_kwDOT8TPFs4DDo9Q'
};

function initComments() {
  const container = document.getElementById('comments');
  if (!container) return;

  // 如果未配置，显示提示
  if (GISCUS_CONFIG.repo === 'your-name/your-repo') {
    container.innerHTML =
      '<div class="alert alert-info" style="margin:0;">' +
      '<strong>评论区待配置：</strong>本站使用 Giscus（基于GitHub Discussions的免费评论系统）。' +
      '请编辑 <code>js/main.js</code> 中的 <code>GISCUS_CONFIG</code>，填入你的GitHub仓库信息即可启用。' +
      '详细步骤见项目 README.md。' +
      '</div>';
    return;
  }

  const script = document.createElement('script');
  script.src = 'https://giscus.app/client.js';
  script.setAttribute('data-repo', GISCUS_CONFIG.repo);
  script.setAttribute('data-repo-id', GISCUS_CONFIG.repoId);
  script.setAttribute('data-category', GISCUS_CONFIG.category);
  script.setAttribute('data-category-id', GISCUS_CONFIG.categoryId);
  script.setAttribute('data-mapping', 'pathname');
  script.setAttribute('data-strict', '0');
  script.setAttribute('data-reactions-enabled', '1');
  script.setAttribute('data-emit-metadata', '0');
  script.setAttribute('data-input-position', 'bottom');
  script.setAttribute('data-theme', 'dark');
  script.setAttribute('data-lang', 'zh-CN');
  script.setAttribute('crossorigin', 'anonymous');
  script.async = true;
  container.appendChild(script);
}

// ===== 主题切换 =====
function switchTheme(theme) {
  var body = document.body;
  body.classList.remove('theme-qing', 'theme-light');
  if (theme === 'qing') body.classList.add('theme-qing');
  if (theme === 'light') body.classList.add('theme-light');

  document.querySelectorAll('.theme-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.theme === theme);
  });

  try { localStorage.setItem('pbz_theme', theme); } catch(e) {}
}

function initThemeSwitcher() {
  var saved = 'default';
  try { saved = localStorage.getItem('pbz_theme') || 'default'; } catch(e) {}
  switchTheme(saved);
}

// ===== 百度统计 =====
// 配置方法：访问 https://tongji.baidu.com 注册，获取站点ID后填入下方
const BAIDU_TONGJI_ID = '41e0ebb795aee22818c90e6039e59e03';

function initBaiduTongji() {
  if (!BAIDU_TONGJI_ID) return; // 未配置则不加载

  var _hmt = _hmt || [];
  var hm = document.createElement('script');
  hm.src = 'https://hm.baidu.com/hm.js?' + BAIDU_TONGJI_ID;
  var s = document.getElementsByTagName('script')[0];
  s.parentNode.insertBefore(hm, s);
}

// ===== 百度自动推送（链接提交）=====
// 验证站点后自动生效，无需配置。用户每次访问页面时自动推送给百度，加快收录。
function initBaiduPush() {
  var bp = document.createElement('script');
  var curProtocol = window.location.protocol.split(':')[0];
  if (curProtocol === 'https') {
    bp.src = 'https://zz.bdstatic.com/linksubmit/push.js';
  } else {
    bp.src = 'http://push.zhanzhang.baidu.com/push.js';
  }
  var s = document.getElementsByTagName('script')[0];
  s.parentNode.insertBefore(bp, s);
}

// ===== 全站搜索 =====
var SEARCH_INDEX = [
  { title: '首页', url: '/', desc: '影之刃零攻略站首页，游戏简介、最新资讯、核心数据、攻略导航', tag: '首页', keywords: '影之刃零 攻略 首页 简介 资讯 数据 发售 预售' },
  { title: '攻略中心', url: '/guide', desc: '新手入门、难度选择、开荒推荐、主线流程、探索系统、武器构筑系统', tag: '攻略', keywords: '攻略 新手 入门 难度 旅人 破路者 地狱行者 六十六天 开荒 主线 探索 构筑 build' },
  { title: '武器图鉴', url: '/weapons', desc: '30种主武器+25种副武器大全，含获取方式、连招技巧、强度排行、配装推荐', tag: '武器', keywords: '武器 唐横刀 黑伤 残钢刃 偃月刀 青龙掠月刀 拳套 大盾 链钩 手甲 醉剑 白蛇 赤蛇 软蛇剑 虎炮 副武器 影之武装 配装' },
  { title: '角色图鉴', url: '/characters', desc: '魂、左殇、瞳媚、沐小葵、魔渊、玄玉、眼镜女、炼邪、妙手小张等全角色背景与关系', tag: '角色', keywords: '角色 魂 左殇 瞳媚 沐小葵 魔渊 甄子丹 玄玉 玄鱼 剑玄 沐天邈 眼镜女 炼邪 妙手小张 人物关系' },
  { title: 'Boss攻略', url: '/bosses', desc: '荒行子、魔渊、残钢、舞狮尊主、剑痴等全Boss招式拆解与打法解析', tag: 'Boss', keywords: 'Boss 荒行子 魔渊 残钢 舞狮尊主 剑痴 双刀女 极端追击者 打法 招式 二阶段 杀气暴走' },
  { title: '世界观设定', url: '/world', desc: '影境世界、功夫朋克、杀气改造、六大势力、编年史、前作回顾、8幅水墨地图', tag: '世界观', keywords: '世界观 影境 功夫朋克 武侠朋克 杀气 改造 怪面 组织 正道联盟 十一人阁 蜃楼 暗魔天堡 圣母娘娘 编年史 雨血 水墨地图' },
  { title: '视频中心', url: '/videos', desc: '官方PV、实机演示、State of Play专场、甄子丹动捕特辑，B站高清视频一站式观看', tag: '视频', keywords: '视频 PV 实机 演示 State of Play 甄子丹 预告 B站 11分钟 20分钟' },
  { title: '购买指南', url: '/about', desc: '各平台售价对比、版本区别、预购特典、PC配置要求、实体收藏版、预售数据', tag: '购买', keywords: '购买 售价 标准版 豪华版 实体收藏版 预购 特典 配置 Steam Epic PS5 WeGame 预售 销量' }
];

var searchOverlay = null;

function openSearch() {
  if (searchOverlay) {
    searchOverlay.classList.add('active');
    searchOverlay.querySelector('input').focus();
    return;
  }
  searchOverlay = document.createElement('div');
  searchOverlay.className = 'search-overlay';
  searchOverlay.innerHTML =
    '<div class="search-modal">' +
      '<div class="search-modal-header">' +
        '<input type="text" id="searchInput" placeholder="搜索Boss、武器、角色、攻略..." autocomplete="off">' +
        '<button class="search-close" onclick="closeSearch()">✕</button>' +
      '</div>' +
      '<div class="search-results" id="searchResults"></div>' +
    '</div>';
  document.body.appendChild(searchOverlay);
  setTimeout(function() { searchOverlay.classList.add('active'); }, 10);
  var input = searchOverlay.querySelector('#searchInput');
  input.focus();
  input.addEventListener('input', doSearch);
  searchOverlay.addEventListener('click', function(e) {
    if (e.target === searchOverlay) closeSearch();
  });
  doSearch();
}

function closeSearch() {
  if (searchOverlay) {
    searchOverlay.classList.remove('active');
    setTimeout(function() { if (searchOverlay) { searchOverlay.remove(); searchOverlay = null; } }, 200);
  }
}

function doSearch() {
  var input = document.getElementById('searchInput');
  var resultsEl = document.getElementById('searchResults');
  if (!input || !resultsEl) return;
  var q = input.value.trim().toLowerCase();
  if (!q) {
    resultsEl.innerHTML = '<div class="search-empty">输入关键词搜索，如"荒行子"、"偃月刀"、"六十六天"</div>';
    return;
  }
  var results = SEARCH_INDEX.filter(function(item) {
    return item.title.toLowerCase().indexOf(q) > -1 ||
           item.desc.toLowerCase().indexOf(q) > -1 ||
           item.keywords.toLowerCase().indexOf(q) > -1 ||
           item.tag.toLowerCase().indexOf(q) > -1;
  });
  if (results.length === 0) {
    resultsEl.innerHTML = '<div class="search-empty">未找到相关内容，试试其他关键词</div>';
    return;
  }
  resultsEl.innerHTML = results.map(function(item) {
    return '<a class="search-result-item" href="' + item.url + '" onclick="closeSearch()">' +
      '<span class="result-tag">' + item.tag + '</span>' +
      '<div class="result-title">' + item.title + '</div>' +
      '<div class="result-desc">' + item.desc + '</div>' +
    '</a>';
  }).join('');
}

document.addEventListener('keydown', function(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    openSearch();
  }
  if (e.key === 'Escape') {
    closeSearch();
  }
});

// ===== 页面元信息（更新日期+阅读时间）=====
var PAGE_META = {
  'guide.html': { date: '2026-08-18', read: '5分钟' },
  'weapons.html': { date: '2026-08-18', read: '8分钟' },
  'characters.html': { date: '2026-08-18', read: '6分钟' },
  'bosses.html': { date: '2026-08-18', read: '7分钟' },
  'world.html': { date: '2026-08-18', read: '10分钟' },
  'videos.html': { date: '2026-08-18', read: '3分钟' },
  'about.html': { date: '2026-08-18', read: '4分钟' },
  'about-site.html': { date: '2026-08-18', read: '2分钟' }
};

function initPageMeta() {
  var path = window.location.pathname;
  var filename = path.substring(path.lastIndexOf('/') + 1);
  var meta = PAGE_META[filename];
  if (!meta) return;
  var titleEl = document.querySelector('.page-title');
  if (!titleEl) return;
  var metaEl = document.createElement('div');
  metaEl.className = 'page-meta';
  metaEl.innerHTML = '📅 更新于 ' + meta.date + ' · ⏱ 预计阅读 ' + meta.read;
  titleEl.parentNode.insertBefore(metaEl, titleEl.nextSibling);
}
