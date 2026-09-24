import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const date = z.preprocess(
  (value) => value instanceof Date ? value.toISOString().slice(0, 10) : value,
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '必须是 YYYY-MM-DD 日期')
).nullable();

const guides = defineCollection({
  loader: glob({ base: process.env.PBZ_GUIDE_CONTENT_DIR || './src/content/guides', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string().trim().min(1),
    description: z.string().trim().min(1),
    spoilerLevel: z.enum(['none', 'minor', 'major']),
    safeTitle: z.string().trim().min(1).optional(),
    safeDescription: z.string().trim().min(1).optional(),
    status: z.enum(['draft', 'published']),
    guideType: z.enum(['walkthrough', 'boss', 'weapon', 'system', 'performance']),
    publishedAt: date,
    updatedAt: date,
    sourceIds: z.array(z.string().min(1)),
    gameVersionId: z.string().min(1).optional(),
    factIds: z.array(z.string().min(1)).optional(),
    relatedEntityIds: z.array(z.string().min(1)).optional(),
    platformIds: z.array(z.string().min(1)).optional(),
    difficultyIds: z.array(z.string().min(1)).optional(),
    keywords: z.array(z.string().trim().min(1)).optional()
  })
});

export const collections = { guides };
