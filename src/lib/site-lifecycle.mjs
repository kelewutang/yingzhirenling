const lifecycleCopy = Object.freeze({
  'pre-release': Object.freeze({
    homepage: Object.freeze({
      title: '影之刃零攻略站 - 发售前可核验资料库',
      description: '影之刃零非官方玩家知识库，整理可核验的公开武器、角色、Boss 与世界资料，明确区分官方资料、公开素材观察与第三方信息。',
      eyebrow: 'PRE-RELEASE KNOWLEDGE BASE',
      status: '游戏尚未正式发售；当前内容以官方公开资料、公开素材观察与明确标注的第三方资料为基础。'
    }),
    guide: Object.freeze({
      metaDescription: '影之刃零发售前攻略中心，整理官方公开的难度、武器构筑信息与实机观察；完整流程将在正式发售后核验更新。',
      jsonLdHeadline: '影之刃零攻略中心 - 发售前系统信息与实机观察',
      jsonLdDescription: '影之刃零发售前攻略，整理官方公开的难度、武器构筑信息和公开实机观察；完整流程待正式发售后核验。',
      status: '官方系统信息 · 试玩观察 · 发售前准备',
      notice: '游戏计\u5212于2026年10月29日发售（见 <a href="https://store.steampowered.com/app/4115450/Phantom_Blade_Zero/" target="_blank" rel="noopener noreferrer">Steam 官方\u5546品页</a>）。以下内容来自官方发布材料与公开试玩；试玩版本的数值、规则和操作可能在正式版调整。'
    }),
    aboutSite: Object.freeze({
      introduction: '《影之刃零》仍处于正式发售前阶段。本站于 2026 年 8 月开始整理公开资料，目标是\u9010\u6b65形成\u4fbf于检索的中文玩家知识库；现阶段内容以官方\u5546\u5e97、官方公告、公开影像和明确标注的编辑整理为主。',
      evidenceNotice: '发售前宣传信息可能变化，页面上的玩法观察、角色关系和数据不会自动视为正式版事实。没有可靠来源的内容会保留“待核”状态，正式版上线后再\u9010项复核。'
    }),
    collections: Object.freeze({
      weapon: Object.freeze({
        description: '影之刃零发售前武器资料，整理官方确认的武器系统与公开实机中出现的武器；获取方式和强度待正式版验证。',
        intro: '当前已确认并整理的公开武器实体。每个条目只展示已有 Fact 与 Source 支持的资料，获取方式与强度不作正式版推断。',
        supportingText: '本集合只收录当前可发布的武器实体；公开试玩与演示中的观察会在详情页按事实状态和来源分别呈现。'
      }),
      boss: Object.freeze({
        description: '影之刃零发售前Boss资料，整理公开试玩与实机演示中的敌人和战斗观察；完整名单与打法待正式版验证。',
        intro: '当前已确认并整理的公开 Boss 实体。集合页只帮助浏览已发布身份，不推断弱点、掉落、打法或正式版战斗机制。',
        supportingText: '当前收录的 Boss 记录来自公开实机视频说明，名称与 Boss 身份均保持为引用第三方来源的信息。本页收录不代表官方完整 Boss 名单；策略、遭遇流程与正式版战斗机制仍待发售版本核验。'
      })
    }),
    detail: Object.freeze({
      defaultScope: '本页整理发售前公开资料。每条事实与关系均单独标注来源状态；公开画面观察不自动等同于官方文字确认。',
      weaponScope: '本页整理发售前公开资料；招式和成长说明仅在官方截图文字可明确读取时展示。'
    }),
    footer: '面向全球玩家的《影之刃零》知识库。内容按 Fact 与 Source 保留可核查边界，发售前信息不替代正式版验证。',
    pageSearch: Object.freeze({
      guide: '整理官方公开的难度与武器构筑信息、试玩观察及发售前入门建议，完整流程待发售后验证',
      weapons: '影之刃零发售前武器资料，整理官方确认的武器系统与公开实机中出现的武器；获取方式和强度待正式版验证。',
      bosses: '影之刃零发售前Boss资料，整理公开试玩与实机演示中的敌人和战斗观察；完整名单与打法待正式版验证。'
    })
  }),
  released: Object.freeze({
    homepage: Object.freeze({
      title: '影之刃零攻略站 - 正式版可核验资料库',
      description: '影之刃零非官方玩家知识库，整理按版本、平台和核验状态标注的正式版资料，并保留公开资料的来源边界。',
      eyebrow: 'RELEASE KNOWLEDGE BASE',
      status: '本站已进入正式版攻略与实测更新阶段；内容按版本、平台和核验状态持续更新。'
    }),
    guide: Object.freeze({
      metaDescription: '影之刃零攻略中心，整理按版本与核验状态更新的正式版资料，并保留公开试玩内容的来源边界。',
      jsonLdHeadline: '影之刃零攻略中心 - 正式版资料与公开资料边界',
      jsonLdDescription: '影之刃零攻略中心持续整理正式版资料与公开试玩观察；内容按版本、平台和核验状态更新。',
      status: '正式版资料 · 公开试玩观察 · 持续核验',
      notice: '本站已进入正式版攻略与实测更新阶段；下方公开试玩内容仍按原始资料范围标注。'
    }),
    aboutSite: Object.freeze({
      introduction: '《影之刃零》已进入正式版持续维护阶段。本站持续整理可核验的资料，并按版本与实际测试更新内容。',
      evidenceNotice: '发售前宣传信息可能与正式版不同；页面上的玩法观察、角色关系和数据仍会按各自来源与核验状态呈现。没有可靠来源的内容会保留“待核”状态。'
    }),
    collections: Object.freeze({
      weapon: Object.freeze({
        description: '影之刃零武器资料，整理当前已发布武器与可核验信息；部分条目仍保留发售前公开材料，已实测内容会明确标注。',
        intro: '当前已发布的武器实体按 Fact 与 Source 展示资料。部分条目仍来自公开材料，获取方式与强度只在有明确证据时更新。',
        supportingText: '本集合收录当前可发布的武器实体；公开试玩与演示中的观察会保留原始资料边界，正式版实测内容会单独标注。'
      }),
      boss: Object.freeze({
        description: '影之刃零 Boss 资料，整理当前可核验的敌人与战斗信息；部分条目仍保留公开试玩观察，已实测内容会明确标注。',
        intro: '当前已发布的 Boss 实体按 Fact 与 Source 展示资料。集合页不会把尚未核验的弱点、掉落或战斗机制写成正式版结论。',
        supportingText: '部分 Boss 记录仍来自公开实机视频说明；名称、身份、策略、遭遇流程与战斗机制会按各自来源和正式版核验状态更新。'
      })
    }),
    detail: Object.freeze({
      defaultScope: '本页整理公开资料与已核验内容。每条事实与关系均单独标注来源状态和核验范围；历史公开画面观察不会自动等同于正式版事实。',
      weaponScope: '本页保留公开资料；招式和成长说明只展示有明确文字或正式版实测支持的内容。'
    }),
    footer: '面向全球玩家的《影之刃零》知识库。内容按 Fact 与 Source 保留可核查边界，并按游戏版本与实际核验持续更新。',
    pageSearch: Object.freeze({
      guide: '整理按版本与核验状态更新的正式版资料，并保留公开试玩观察的来源边界',
      weapons: '影之刃零武器资料，整理当前已发布武器与可核验信息；部分条目仍保留公开材料，已实测内容会明确标注。',
      bosses: '影之刃零 Boss 资料，整理当前可核验的敌人与战斗信息；部分条目仍保留公开试玩观察，已实测内容会明确标注。'
    })
  })
});

export const siteLifecycle = Object.freeze({
  state: 'pre-release',
  copy: lifecycleCopy['pre-release']
});

export function getLifecycleCopy(state = siteLifecycle.state) {
  const copy = lifecycleCopy[state];
  if (!copy) throw new Error(`Unsupported site lifecycle state: ${state}`);
  return copy;
}

export function isPreRelease(state = siteLifecycle.state) {
  return state === 'pre-release';
}

export function isReleased(state = siteLifecycle.state) {
  return state === 'released';
}

export function applyLifecycleTokens(content, state = siteLifecycle.state) {
  const copy = getLifecycleCopy(state);
  const replacements = new Map([
    ['__SITE_LIFECYCLE_GUIDE_META_DESCRIPTION__', copy.guide.metaDescription],
    ['__SITE_LIFECYCLE_GUIDE_JSONLD_HEADLINE__', copy.guide.jsonLdHeadline],
    ['__SITE_LIFECYCLE_GUIDE_JSONLD_DESCRIPTION__', copy.guide.jsonLdDescription],
    ['__SITE_LIFECYCLE_GUIDE_STATUS__', copy.guide.status],
    ['__SITE_LIFECYCLE_GUIDE_NOTICE__', copy.guide.notice],
    ['__SITE_LIFECYCLE_ABOUT_SITE_INTRODUCTION__', copy.aboutSite.introduction],
    ['__SITE_LIFECYCLE_ABOUT_SITE_EVIDENCE_NOTICE__', copy.aboutSite.evidenceNotice],
    ['__SITE_LIFECYCLE_SEARCH_GUIDE_DESCRIPTION__', copy.pageSearch.guide],
    ['__SITE_LIFECYCLE_SEARCH_WEAPONS_DESCRIPTION__', copy.pageSearch.weapons],
    ['__SITE_LIFECYCLE_SEARCH_BOSSES_DESCRIPTION__', copy.pageSearch.bosses]
  ]);

  let output = content;
  for (const [token, value] of replacements) output = output.replaceAll(token, value);
  if (output.includes('__SITE_LIFECYCLE_')) throw new Error('Unknown site lifecycle token remains in output');
  return output;
}
