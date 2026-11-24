import {
  getPublishedBosses,
  getPublishedCharacters,
  getPublishedLocations,
  getPublishedWeapons,
  loadKnowledge
} from './knowledge.mjs';
import { publishedItems } from './items.mjs';
import { isSafeForDiscovery } from './spoilers.mjs';

const categoryDefinitions = [
  {
    id: 'characters',
    label: '角色',
    eyebrow: '人 / CHARACTER',
    href: '/characters',
    description: '查看已整理的角色身份、关系与资料边界。',
    variant: 'character',
    marker: '人',
    getEntities: getPublishedCharacters
  },
  {
    id: 'bosses',
    label: 'Boss',
    eyebrow: '敌 / BOSS',
    href: '/bosses',
    description: '从公开实机与资料中查找已发布的 Boss 身份。',
    variant: 'boss',
    marker: '敌',
    getEntities: getPublishedBosses
  },
  {
    id: 'weapons',
    label: '武器',
    eyebrow: '兵 / WEAPON',
    href: '/weapons',
    description: '浏览当前已发布的武器身份与公开资料。',
    variant: 'weapon',
    marker: '兵',
    getEntities: getPublishedWeapons
  },
  {
    id: 'world',
    label: '世界',
    eyebrow: '地 / LOCATION',
    href: '/world',
    description: '了解当前有可靠名称依据的地点与世界资料。',
    variant: 'location',
    marker: '地',
    getEntities: getPublishedLocations
  }
];

export async function buildHomepageModel() {
  const knowledge = await loadKnowledge();
  const categories = categoryDefinitions.map(({ getEntities, ...category }) => ({
    ...category,
    count: getEntities(knowledge).filter(isSafeForDiscovery).length
  }));

  return {
    categories,
    secondaryLinks: [
      { href: '/accessories', label: '饰品图鉴', description: `${publishedItems(knowledge, 'accessory').filter(isSafeForDiscovery).length}件饰品，按游戏分类查看当前强化效果。` },
      { href: '/flasks', label: '药瓶图鉴', description: `${publishedItems(knowledge, 'flask').filter(isSafeForDiscovery).length}种药瓶，查看等级、使用次数与完整效果。` },
      { href: '/guide', label: '攻略中心', description: '按现有公开资料整理的入门与系统入口。' },
      { href: '/videos', label: '视频中心', description: '索引可追溯的公开影像与演示材料。' },
      { href: '/about-site', label: '关于本站', description: '了解资料范围、来源标注与项目说明。' }
    ]
  };
}
