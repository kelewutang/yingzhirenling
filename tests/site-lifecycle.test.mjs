import assert from 'node:assert/strict';
import test from 'node:test';
import { applyLifecycleTokens, getLifecycleCopy, isPreRelease, isReleased, siteLifecycle } from '../src/lib/site-lifecycle.mjs';

test('approved release transition keeps state and copy consistent without claiming gameplay tests', () => {
  assert.equal(siteLifecycle.state, 'released');
  assert.equal(siteLifecycle.copy, getLifecycleCopy(siteLifecycle.state));
  assert.equal(isPreRelease(), false);
  assert.equal(isReleased(), true);
  assert.equal(isPreRelease('pre-release'), true);
  assert.equal(isReleased('pre-release'), false);
  assert.equal(isPreRelease('released'), false);
  assert.equal(isReleased('released'), true);
  assert(siteLifecycle.copy.homepage.status.includes('已于2026年10月29日正式发售'));
  assert(siteLifecycle.copy.homepage.status.includes('尚未完成正式版玩法实测'));
  assert(siteLifecycle.copy.guide.notice.includes('尚未完成正式版玩法实测'));
  assert(siteLifecycle.copy.aboutSite.introduction.includes('正式版玩法尚待实测核验'));
  assert(siteLifecycle.copy.collections.boss.supportingText.includes('名称与 Boss 身份均保持为引用第三方来源的信息'));
  assert.equal(applyLifecycleTokens('__SITE_LIFECYCLE_GUIDE_NOTICE__'), siteLifecycle.copy.guide.notice);
});

test('released lifecycle copy removes only lifecycle-controlled stale copy', () => {
  const released = getLifecycleCopy('released');
  assert.equal(released.homepage.eyebrow, 'RELEASE KNOWLEDGE BASE');
  assert(!released.homepage.status.includes('尚未正式发售'));
  assert(!released.guide.status.includes('发售前准备'));
  assert(!released.aboutSite.introduction.includes('仍处于正式发售前阶段'));
  assert(!released.footer.includes('发售前信息不替代正式版验证'));

  const output = applyLifecycleTokens([
    '__SITE_LIFECYCLE_GUIDE_META_DESCRIPTION__',
    '__SITE_LIFECYCLE_GUIDE_JSONLD_HEADLINE__',
    '__SITE_LIFECYCLE_GUIDE_JSONLD_DESCRIPTION__',
    '__SITE_LIFECYCLE_GUIDE_STATUS__',
    '__SITE_LIFECYCLE_GUIDE_NOTICE__',
    '__SITE_LIFECYCLE_ABOUT_SITE_INTRODUCTION__',
    '__SITE_LIFECYCLE_ABOUT_SITE_EVIDENCE_NOTICE__',
    '__SITE_LIFECYCLE_SEARCH_GUIDE_DESCRIPTION__',
    '__SITE_LIFECYCLE_SEARCH_WEAPONS_DESCRIPTION__',
    '__SITE_LIFECYCLE_SEARCH_BOSSES_DESCRIPTION__',
    '发售前公开资料仍按来源标注。'
  ].join('\n'), 'released');
  for (const expected of [
    released.guide.metaDescription,
    released.guide.jsonLdHeadline,
    released.guide.jsonLdDescription,
    released.guide.status,
    released.guide.notice,
    released.aboutSite.introduction,
    released.aboutSite.evidenceNotice,
    ...Object.values(released.pageSearch)
  ]) assert(output.includes(expected));
  assert(output.includes('发售前公开资料仍按来源标注。'));
  assert(!output.includes('__SITE_LIFECYCLE_'));
});

test('lifecycle token replacement rejects unknown tokens', () => {
  assert.throws(() => applyLifecycleTokens('__SITE_LIFECYCLE_UNKNOWN__'), /Unknown site lifecycle token/);
  assert.throws(() => getLifecycleCopy('automatic'), /Unsupported site lifecycle state/);
});
