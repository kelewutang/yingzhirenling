// ===== 影之刃零攻略站 - 交互脚本 =====

document.addEventListener('DOMContentLoaded', function () {
  initMobileNav();
  initBackToTop();
  initActiveNav();
  initCountdown();
  initThemeSwitcher();
  initBaiduTongji();
  initBaiduPush();
  initPageMeta();
  initEntitySearchIndex();
});

// 移动端导航切换
function initMobileNav() {
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  if (!toggle || !links) return;

  if (!links.id) links.id = 'primary-navigation';
  toggle.setAttribute('aria-controls', links.id);
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-label', '打开菜单');

  toggle.addEventListener('click', function () {
    links.classList.toggle('open');
    const isOpen = links.classList.contains('open');
    toggle.textContent = isOpen ? '✕' : '☰';
    toggle.setAttribute('aria-expanded', String(isOpen));
    toggle.setAttribute('aria-label', isOpen ? '关闭菜单' : '打开菜单');
  });

  // 点击链接后关闭菜单
  links.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', function () {
      links.classList.remove('open');
      toggle.textContent = '☰';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', '打开菜单');
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
  { title: '首页', url: '/', desc: '影之刃零发售前玩家资料站，汇总官方信息、公开实机观察、第三方动态与栏目导航', tag: '首页', keywords: '影之刃零 攻略 首页 简介 资讯 数据 发售 预售' },
  { title: '攻略中心', url: '/guide', desc: '整理官方公开的难度与武器构筑信息、试玩观察及发售前入门建议，完整流程待发售后验证', tag: '攻略', keywords: '攻略 新手 入门 难度 旅人 破路者 地狱行者 六十六天 开荒 探索 构筑 build' },
  { title: '武器图鉴', url: '/weapons', desc: '整理官方确认的武器系统与公开实机观察；官方称超过30种主要武器及25种影之武，获取与强度待正式版验证', tag: '武器', keywords: '武器 唐横刀 黑伤 残钢刃 偃月刀 青龙掠月刀 拳套 大盾 链钩 手甲 醉剑 白蛇 赤蛇 软蛇剑 虎炮 影之武 配装' },
  { title: '角色图鉴', url: '/characters', desc: '整理当前已公开角色资料，并区分《影之刃零》确认信息、宣传素材观察与系列旧作待核资料', tag: '角色', keywords: '角色 魂 左殇 瞳媚 沐小葵 魔渊 甄子丹 玄玉 玄鱼 剑玄 沐天邈 眼镜女 炼邪 妙手小张 旧作 人物关系' },
  { title: 'Boss攻略', url: '/bosses', desc: '整理公开实机中的Boss与敌人、招式观察和发售前应对思路，正式打法待发售后验证', tag: 'Boss', keywords: 'Boss 荒行子 魔渊 残钢 舞狮尊主 剑痴 双刀女 组织追击者 打法 招式 状态变化' },
  { title: '世界观设定', url: '/world', desc: '整理当前公开的武林世界观、场景观察，并单独标注系列旧作设定与待核内容', tag: '世界观', keywords: '世界观 影境 功夫朋克 武侠朋克 杀气 改造 怪面 组织 正道联盟 十一人阁 蜃楼 暗魔天堡 圣母娘娘 旧作 雨血 场景' },
  { title: '视频中心', url: '/videos', desc: '索引官方预告、实机演示、State of Play与甄子丹相关公开影像，并附具体来源链接', tag: '视频', keywords: '视频 PV 实机 演示 State of Play 甄子丹 预告 B站 11分钟 20分钟' },
  { title: '购买指南', url: '/about', desc: '汇总官方商店发售、版本、预购与PC配置，并单独标注价格快照和第三方估算', tag: '购买', keywords: '购买 售价 标准版 豪华版 实体收藏版 预购 特典 配置 Steam Epic PS5 WeGame TapTap 第三方数据' }
];

var ENTITY_SEARCH_INDEX_URL = '/generated/search-index.production.json';
var entitySearchIndex = [];
var entitySearchState = 'idle';

function isStringArray(value) {
  return Array.isArray(value) && value.every(function(item) {
    return typeof item === 'string';
  });
}

function validateEntitySearchDocuments(documents) {
  if (!Array.isArray(documents)) return false;
  var ids = {};

  return documents.every(function(document) {
    if (!document || typeof document !== 'object' || Array.isArray(document)) return false;
    if (typeof document.id !== 'string' || !document.id.trim() || ids[document.id]) return false;
    ids[document.id] = true;
    return document.documentType === 'entity' &&
      document.entityType === 'weapon' &&
      typeof document.route === 'string' && document.route.trim() !== '' &&
      typeof document.displayName === 'string' && document.displayName.trim() !== '' &&
      typeof document.summary === 'string' &&
      isStringArray(document.aliases) &&
      isStringArray(document.displayAliases) &&
      isStringArray(document.keywords) &&
      document.recordState === 'published' &&
      document.sourceSchemaVersion === '1.0-implementation';
  });
}

function normalizePageSearchDocument(item) {
  return {
    id: 'page:' + item.url,
    documentType: 'page',
    title: item.title,
    url: item.url,
    desc: item.desc,
    tag: item.tag,
    keywords: item.keywords
  };
}

function normalizeEntitySearchDocument(document) {
  return {
    id: document.id,
    documentType: document.documentType,
    entityType: document.entityType,
    title: document.displayName,
    url: document.route,
    desc: document.summary,
    tag: '武器',
    keywords: document.aliases.concat(document.keywords).join(' ')
  };
}

function getSearchDocuments() {
  var pageDocuments = SEARCH_INDEX.map(normalizePageSearchDocument);
  return pageDocuments.concat(entitySearchIndex);
}

function refreshCurrentSearch() {
  var input = document.getElementById('searchInput');
  if (input && input.value.trim() !== '') doSearch();
}

function initEntitySearchIndex() {
  if (entitySearchState !== 'idle') return;
  if (typeof fetch !== 'function') {
    entitySearchState = 'failed';
    console.warn('Entity search enhancement unavailable');
    return;
  }
  entitySearchState = 'loading';

  fetch(ENTITY_SEARCH_INDEX_URL)
    .then(function(response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    })
    .then(function(documents) {
      if (!validateEntitySearchDocuments(documents)) {
        throw new Error('Invalid entity search document contract');
      }
      entitySearchIndex = documents.map(normalizeEntitySearchDocument);
      entitySearchState = 'ready';
    })
    .catch(function() {
      entitySearchIndex = [];
      entitySearchState = 'failed';
      console.warn('Entity search enhancement unavailable');
    })
    .then(function() {
      if (entitySearchState === 'ready') refreshCurrentSearch();
    });
}

var searchOverlay = null;
var searchReturnFocus = null;

function openSearch() {
  searchReturnFocus = document.activeElement;
  if (searchOverlay) {
    searchOverlay.classList.add('active');
    searchOverlay.querySelector('input').focus();
    return;
  }
  searchOverlay = document.createElement('div');
  searchOverlay.className = 'search-overlay';
  searchOverlay.innerHTML =
    '<div class="search-modal" role="dialog" aria-modal="true" aria-label="站内搜索">' +
      '<div class="search-modal-header">' +
        '<input type="text" id="searchInput" aria-label="输入站内搜索关键词" placeholder="搜索Boss、武器、角色、攻略..." autocomplete="off">' +
        '<button type="button" class="search-close" onclick="closeSearch()" aria-label="关闭搜索">✕</button>' +
      '</div>' +
      '<div class="search-results" id="searchResults"></div>' +
    '</div>';
  document.body.appendChild(searchOverlay);
  searchOverlay.classList.add('active');
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
    setTimeout(function() {
      if (searchOverlay) {
        searchOverlay.remove();
        searchOverlay = null;
      }
      if (searchReturnFocus && searchReturnFocus.focus && document.contains(searchReturnFocus)) {
        searchReturnFocus.focus();
      }
      searchReturnFocus = null;
    }, 200);
  }
}

function containSearchFocus(e) {
  if (e.key !== 'Tab' || !searchOverlay || !searchOverlay.classList.contains('active')) return;
  var focusable = searchOverlay.querySelectorAll('input, button, a[href], [tabindex]:not([tabindex="-1"])');
  if (focusable.length === 0) return;
  var first = focusable[0];
  var last = focusable[focusable.length - 1];

  if (e.shiftKey && (document.activeElement === first || !searchOverlay.contains(document.activeElement))) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && (document.activeElement === last || !searchOverlay.contains(document.activeElement))) {
    e.preventDefault();
    first.focus();
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
  var results = getSearchDocuments().filter(function(item) {
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
  containSearchFocus(e);
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
