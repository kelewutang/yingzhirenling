import { getPublishedGuideEntries, guideRoute } from '../../lib/guides.mjs';
import { loadKnowledge } from '../../lib/knowledge.mjs';

export const prerender = true;

export async function GET() {
  const knowledge = await loadKnowledge();
  const guides = await getPublishedGuideEntries(knowledge);
  const body = guides.map((guide) => ({
    id: guide.id,
    spoilerLevel: guide.data.spoilerLevel,
    title: guide.data.title,
    description: guide.data.description,
    guideType: guide.data.guideType,
    route: guideRoute(guide),
    keywords: guide.data.keywords || [],
    relatedEntityNames: (guide.data.relatedEntityIds || []).map((id) => knowledge.entityById.get(id)?.displayName).filter(Boolean),
    updatedAt: guide.data.updatedAt,
    recordState: guide.data.status
  }));
  return new Response(`${JSON.stringify(body, null, 2)}\n`, { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
