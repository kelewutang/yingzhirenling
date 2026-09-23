import assert from 'node:assert/strict';
import test from 'node:test';
import { applyLifecycleTokens, getLifecycleCopy, isPreRelease, isReleased, siteLifecycle } from '../src/lib/site-lifecycle.mjs';

test('current production lifecycle remains explicitly pre-release', () => {
  assert.equal(siteLifecycle.state, 'pre-release');
  assert.equal(isPreRelease(), true);
  assert.equal(isReleased(), false);
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
});
