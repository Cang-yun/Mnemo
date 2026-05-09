import type { KnowledgeItem, ReviewFeedback, ScheduleEntry } from "./types";

export const WEAK_KNOWLEDGE_TAG = "薄弱";

export interface KnowledgeFeedbackStats {
  remembered: number;
  forgotten: number;
  fuzzy: number;
  skipped: number;
  weak: boolean;
  total: number;
}

export function createEmptyFeedbackStats(): KnowledgeFeedbackStats {
  return {
    remembered: 0,
    forgotten: 0,
    fuzzy: 0,
    skipped: 0,
    weak: false,
    total: 0,
  };
}

export function getKnowledgeFeedbackStats(
  knowledgeId: string,
  scheduleEntries: ScheduleEntry[],
): KnowledgeFeedbackStats {
  const stats = createEmptyFeedbackStats();

  for (const entry of scheduleEntries) {
    if (entry.knowledgeId !== knowledgeId || !entry.completed || !entry.feedback) continue;

    stats[entry.feedback] += 1;
    stats.total += 1;
  }

  stats.weak = stats.forgotten > 0 || stats.fuzzy > 0;
  return stats;
}

export function getKnowledgeFeedbackStatsMap(scheduleEntries: ScheduleEntry[]) {
  const statsByKnowledge = new Map<string, KnowledgeFeedbackStats>();

  for (const entry of scheduleEntries) {
    if (!entry.completed || !entry.feedback) continue;

    const stats = statsByKnowledge.get(entry.knowledgeId) ?? createEmptyFeedbackStats();
    stats[entry.feedback as ReviewFeedback] += 1;
    stats.total += 1;
    stats.weak = stats.forgotten > 0 || stats.fuzzy > 0;
    statsByKnowledge.set(entry.knowledgeId, stats);
  }

  return statsByKnowledge;
}

export function syncWeakKnowledgeTags(
  knowledgeItems: KnowledgeItem[],
  scheduleEntries: ScheduleEntry[],
) {
  const statsByKnowledge = getKnowledgeFeedbackStatsMap(scheduleEntries);

  return knowledgeItems.map((item) => {
    const stats = statsByKnowledge.get(item.id);
    const shouldHaveWeakTag = Boolean(stats?.weak);
    const currentTags = item.tags ?? [];
    const hasWeakTag = currentTags.includes(WEAK_KNOWLEDGE_TAG);

    if (shouldHaveWeakTag && !hasWeakTag) {
      return {
        ...item,
        tags: [...currentTags, WEAK_KNOWLEDGE_TAG],
        updatedAt: new Date().toISOString(),
      };
    }

    if (!shouldHaveWeakTag && hasWeakTag) {
      return {
        ...item,
        tags: currentTags.filter((tag) => tag !== WEAK_KNOWLEDGE_TAG),
        updatedAt: new Date().toISOString(),
      };
    }

    return item;
  });
}
