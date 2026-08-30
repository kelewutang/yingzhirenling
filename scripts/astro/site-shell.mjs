export const primaryNavigation = [
  { href: '/weapons', label: '武器', section: 'weapons' },
  { href: '/characters', label: '角色', section: 'characters' },
  { href: '/bosses', label: 'Boss', section: 'bosses' },
  { href: '/world', label: '世界', section: 'world' }
];

export const secondaryNavigation = [
  { href: '/', label: '首页', section: 'home' },
  { href: '/guide', label: '攻略中心', section: 'guide' },
  { href: '/videos', label: '视频中心', section: 'videos' },
  { href: '/about', label: '购买指南', section: 'about' },
  { href: '/about-site', label: '关于本站', section: 'about-site' }
];

export const footerGroups = [
  {
    title: '资料库',
    links: primaryNavigation
  },
  {
    title: '内容与项目',
    links: secondaryNavigation.filter(({ section }) => section !== 'home')
  },
  {
    title: '官方渠道',
    links: [
      { href: 'https://www.taptap.cn/app/358885', label: 'TapTap', external: true },
      { href: 'https://store.steampowered.com/app/4115450/', label: 'Steam', external: true }
    ]
  }
];

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderNavLink({ href, label, section }, activeSection) {
  const active = section === activeSection;
  return `<li><a href="${escapeHtml(href)}" data-nav-section="${escapeHtml(section)}"${active ? ' class="active" aria-current="page"' : ''}>${escapeHtml(label)}</a></li>`;
}

function renderFooterLink({ href, label, external = false }) {
  const attributes = external ? ' target="_blank" rel="noopener noreferrer"' : '';
  return `<li><a href="${escapeHtml(href)}"${attributes}>${escapeHtml(label)}${external ? '<span class="external-link-label" aria-hidden="true"> ↗</span>' : ''}</a></li>`;
}

export function renderLegacyHeader(activeSection = '') {
  const primaryLinks = primaryNavigation.map((item) => renderNavLink(item, activeSection)).join('');
  const secondaryLinks = secondaryNavigation.map((item) => renderNavLink(item, activeSection)).join('');
  const secondaryActive = secondaryNavigation.some(({ section }) => section === activeSection);

  return `<a class="skip-link" href="#main-content">跳至主要内容</a>
<header class="site-header">
  <nav class="navbar" aria-label="主导航">
    <div class="nav-inner">
      <a href="/" class="nav-logo" aria-label="影之刃零攻略站首页"><span class="nav-logo__mark" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M6 18 17.5 6.5l-1.8 6.1L20 14l-6 1.5L6 18Z" fill="currentColor"/></svg></span><span>影之刃零</span></a>
      <ul class="nav-links" id="primary-navigation">
        ${primaryLinks}
        <li class="nav-more${secondaryActive ? ' is-active' : ''}"><details><summary>更多<span aria-hidden="true">⌄</span></summary><ul class="nav-more__menu">${secondaryLinks}</ul></details></li>
      </ul>
      <div class="nav-actions">
        <button class="nav-search-btn" type="button" onclick="openSearch()" aria-label="搜索知识库"><svg aria-hidden="true" viewBox="0 0 24 24" focusable="false"><circle cx="10.8" cy="10.8" r="5.8" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m15.3 15.3 4.2 4.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg><span class="search-trigger__label">搜索</span><kbd class="search-key">⌘K</kbd></button>
        <button class="nav-toggle" type="button" aria-label="打开菜单" aria-expanded="false" aria-controls="primary-navigation"><span class="nav-toggle__open" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></span><span class="nav-toggle__close" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></span></button>
      </div>
    </div>
  </nav>
</header>`;
}

export function renderLegacyFooter() {
  const groups = footerGroups.map((group) => `<section class="footer-col"><h2>${escapeHtml(group.title)}</h2><ul>${group.links.map(renderFooterLink).join('')}</ul></section>`).join('');

  return `<footer class="footer site-footer">
  <div class="footer-inner">
    <div class="footer-brand"><a class="footer-logo" href="/">影之刃零攻略站</a><p>面向全球玩家的《影之刃零》知识库。内容按 Fact 与 Source 保留可核查边界，发售前信息不替代正式版验证。</p></div>
    ${groups}
  </div>
  <div class="footer-bottom"><span>© 2026 影之刃零攻略站 · yingzhirenling.cn</span><span>非官方玩家公益站点，与灵游坊无官方关联。</span></div>
</footer>`;
}

export function resolveLegacyActiveSection(route) {
  const routes = new Map([
    ['/', 'home'],
    ['/guide', 'guide'],
    ['/weapons', 'weapons'],
    ['/characters', 'characters'],
    ['/bosses', 'bosses'],
    ['/world', 'world'],
    ['/videos', 'videos'],
    ['/about', 'about'],
    ['/about-site', 'about-site']
  ]);
  return routes.get(route) || '';
}
