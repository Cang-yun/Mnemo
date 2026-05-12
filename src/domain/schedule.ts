import { addDays, todayIso } from "./date";
import type {
  CreateKnowledgeInput,
  KnowledgeItem,
  Plan,
  ReviewFeedback,
  ScheduleEntry,
} from "./types";

import { normalizeReviewOffsets } from "./planInput";

// The added date is study day 1. Stored review values are study-day numbers.
export const CLASSIC_REVIEW_OFFSETS = [1, 2, 4, 7, 15, 30] as const;

function getScheduleOffsets(plan: Plan) {
  return normalizeReviewOffsets(plan.reviewOffsets).map((studyDay) => studyDay - 1);
}

function getScheduleGaps(plan: Plan) {
  const offsets = getScheduleOffsets(plan);
  return offsets.slice(1).map((offset, index) => offset - offsets[index]);
}

export function isLearningPlan(plan: Plan | undefined) {
  return (plan?.kind ?? "learning") === "learning";
}

export function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function isDateInsidePlan(startDate: string, dayCount: number, date: string) {
  const offset = daysBetweenPlanStart(startDate, date);
  return offset >= 0 && offset < dayCount;
}

function daysBetweenPlanStart(startDate: string, date: string) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${date}T00:00:00`);
  return Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

export function normalizeTags(tags: string[]) {
  return Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)));
}

export function getDefaultPlanTag(plan: Plan) {
  return plan.name.trim();
}

export function mergeKnowledgeTags(plan: Plan | undefined, tags: string[]) {
  return normalizeTags([...(plan ? [getDefaultPlanTag(plan)] : []), ...tags]);
}

export function ensurePlanTag(item: KnowledgeItem, plan: Plan) {
  return {
    ...item,
    tags: mergeKnowledgeTags(plan, item.tags ?? []),
  };
}

function shouldAutoCompleteScheduledEntry(offset: number, date: string, today: string) {
  return date < today || (offset === 0 && date <= today);
}

function autoCompletedAt(date: string) {
  return `${date}T00:00:00.000Z`;
}

export function createKnowledgeWithSchedule(input: CreateKnowledgeInput, now = new Date()) {
  const timestamp = now.toISOString();
  const today = todayIso(now);
  const knowledge: KnowledgeItem = {
    id: createId("knowledge"),
    planId: input.plan.id,
    title: input.title.trim(),
    tags: normalizeTags([getDefaultPlanTag(input.plan)]),
    noteMarkdown: "",
    firstDate: input.date,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const entries: ScheduleEntry[] = getScheduleOffsets(input.plan)
    .map((offset, stepIndex) => ({
      offset,
      stepIndex,
      date: addDays(input.date, offset),
    }))
    .filter(({ date }) => isDateInsidePlan(input.plan.startDate, input.plan.dayCount, date))
    .map(({ offset, stepIndex, date }) => {
      const learning = isLearningPlan(input.plan);
      const completed = shouldAutoCompleteScheduledEntry(offset, date, today);

      return {
        id: createId("entry"),
        planId: input.plan.id,
        knowledgeId: knowledge.id,
        stepIndex,
        date,
        kind: learning ? (stepIndex === 0 ? "new" : "review") : "task",
        completed,
        completedDate: completed ? date : undefined,
        completedAt: completed ? autoCompletedAt(date) : undefined,
        createdAt: timestamp,
      } satisfies ScheduleEntry;
    });

  return { knowledge, entries };
}

export function createScheduleEntriesForKnowledge(
  plan: Plan,
  knowledge: KnowledgeItem,
  existingEntries: ScheduleEntry[] = [],
  now = new Date(),
) {
  const timestamp = now.toISOString();
  const today = todayIso(now);
  const existingForKnowledge = existingEntries.filter((entry) => entry.knowledgeId === knowledge.id);

  return getScheduleOffsets(plan)
    .map((offset, stepIndex) => ({
      offset,
      stepIndex,
      date: addDays(knowledge.firstDate, offset),
    }))
    .filter(({ date }) => isDateInsidePlan(plan.startDate, plan.dayCount, date))
    .map(({ offset, stepIndex, date }) => {
      const learning = isLearningPlan(plan);
      const kind = learning ? (stepIndex === 0 ? "new" : "review") : "task";
      // Prefer matching by stepIndex so plan edits that shift a step's date
      // (e.g. tweaking reviewOffsets) still preserve completion, feedback and
      // remedial linkage. Fall back to (date, kind) matching for older
      // entries created before stepIndex became authoritative.
      const existingEntry =
        existingForKnowledge.find(
          (entry) => typeof entry.stepIndex === "number" && entry.stepIndex === stepIndex,
        ) ??
        existingForKnowledge.find(
          (entry) => entry.date === date && entry.kind === kind,
        );
      const completed =
        existingEntry?.completed ?? shouldAutoCompleteScheduledEntry(offset, date, today);

      return {
        id: existingEntry?.id ?? createId("entry"),
        planId: plan.id,
        knowledgeId: knowledge.id,
        stepIndex,
        date,
        kind,
        completed,
        completedDate: existingEntry?.completedDate ?? (completed ? date : undefined),
        completedAt: existingEntry?.completedAt ?? (completed ? autoCompletedAt(date) : undefined),
        feedback: existingEntry?.feedback,
        postponedAt: existingEntry?.postponedAt,
        deferredUntil: existingEntry?.deferredUntil,
        adaptiveSourceEntryId: existingEntry?.adaptiveSourceEntryId,
        adaptiveFeedback: existingEntry?.adaptiveFeedback,
        createdAt: existingEntry?.createdAt ?? timestamp,
      } satisfies ScheduleEntry;
    });
}

function getEntriesForKnowledge(entries: ScheduleEntry[], knowledgeId: string) {
  const relevantEntries = entries
    .filter((entry) => entry.knowledgeId === knowledgeId && entry.kind !== "remedial")
    .sort((a, b) => {
      const leftStep = a.stepIndex ?? Number.MAX_SAFE_INTEGER;
      const rightStep = b.stepIndex ?? Number.MAX_SAFE_INTEGER;
      return (
        leftStep - rightStep ||
        a.date.localeCompare(b.date) ||
        a.createdAt.localeCompare(b.createdAt)
      );
    });
  const byStep = new Map<number, ScheduleEntry>();

  for (const [fallbackStep, entry] of relevantEntries.entries()) {
    const stepIndex = entry.stepIndex ?? fallbackStep;
    if (!byStep.has(stepIndex)) byStep.set(stepIndex, { ...entry, stepIndex });
  }

  return byStep;
}

export function deriveScheduleEntries(
  plans: Plan[],
  knowledgeItems: KnowledgeItem[],
  storedEntries: ScheduleEntry[],
  today = todayIso(),
) {
  const planById = new Map(plans.map((plan) => [plan.id, plan]));

  return consolidateScheduleEntries(
    knowledgeItems.flatMap((knowledge) => {
      const plan = planById.get(knowledge.planId);
      if (!plan) return [];

      return deriveScheduleEntriesForKnowledge(plan, knowledge, storedEntries, today);
    }),
  );
}

export function deriveScheduleEntriesForKnowledge(
  plan: Plan,
  knowledge: KnowledgeItem,
  storedEntries: ScheduleEntry[],
  today = todayIso(),
) {
  const storedByStep = getEntriesForKnowledge(storedEntries, knowledge.id);
  const derivedEntries: ScheduleEntry[] = [];
  const learning = isLearningPlan(plan);
  let nextDate = knowledge.firstDate;
  const scheduleOffsets = getScheduleOffsets(plan);
  const scheduleGaps = getScheduleGaps(plan);

  for (let stepIndex = 0; stepIndex < scheduleOffsets.length; stepIndex += 1) {
    const offset = scheduleOffsets[stepIndex];
    const baseDate = addDays(knowledge.firstDate, offset);
    const storedEntry = storedByStep.get(stepIndex);
    const dueDate = maxIsoDate(nextDate, storedEntry?.deferredUntil);
    const carriedToToday = !storedEntry?.completed && dueDate < today;
    const displayDate = carriedToToday ? today : dueDate;

    if (!isDateInsidePlan(plan.startDate, plan.dayCount, displayDate)) break;

    const entry: ScheduleEntry = {
      id: storedEntry?.id ?? createId("entry"),
      planId: plan.id,
      knowledgeId: knowledge.id,
      stepIndex,
      date: displayDate,
      kind: learning ? (stepIndex === 0 ? "new" : "review") : "task",
      completed: storedEntry?.completed ?? false,
      completedDate: storedEntry?.completedDate,
      completedAt: storedEntry?.completedAt,
      feedback: storedEntry?.feedback,
      originalDate: carriedToToday ? dueDate : undefined,
      postponedAt: storedEntry?.postponedAt,
      deferredUntil: storedEntry?.deferredUntil,
      adaptiveSourceEntryId: storedEntry?.adaptiveSourceEntryId,
      adaptiveFeedback: storedEntry?.adaptiveFeedback,
      createdAt: storedEntry?.createdAt ?? knowledge.createdAt,
    };

    derivedEntries.push(entry);

    const nextGap = scheduleGaps[stepIndex];
    if (typeof nextGap !== "number") break;

    if (entry.completed) {
      const completedDate = entry.completedDate ?? localDateFromCompletedAt(entry.completedAt) ?? dueDate;
      nextDate = addDays(completedDate, nextGap);
    } else {
      nextDate = addDays(displayDate, nextGap);
    }

    if (baseDate > displayDate && !entry.completed) {
      nextDate = addDays(baseDate, nextGap);
    }
  }

  if (learning) {
    derivedEntries.push(...deriveRemedialEntries(plan, knowledge, storedEntries, today));
  }

  return derivedEntries;
}

function deriveRemedialEntries(
  plan: Plan,
  knowledge: KnowledgeItem,
  storedEntries: ScheduleEntry[],
  today: string,
) {
  const remedialEntries: ScheduleEntry[] = [];

  for (const entry of storedEntries) {
    if (entry.knowledgeId !== knowledge.id || entry.kind !== "remedial") continue;

      const carriedToToday = !entry.completed && entry.date < today;
      const displayDate = carriedToToday ? today : entry.date;
      if (!isDateInsidePlan(plan.startDate, plan.dayCount, displayDate)) continue;

      remedialEntries.push({
        ...entry,
        date: displayDate,
        originalDate: carriedToToday ? entry.date : undefined,
      });
  }

  return remedialEntries;
}

export function getAdaptiveReviewDelay(feedback: ReviewFeedback) {
  if (feedback === "forgotten") return 1;
  if (feedback === "fuzzy") return 2;
  return null;
}

function maxIsoDate(left: string, right?: string) {
  if (!right) return left;
  return left >= right ? left : right;
}

export function localDateFromCompletedAt(completedAt?: string) {
  if (!completedAt) return null;

  if (/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/.test(completedAt)) {
    return completedAt.slice(0, 10);
  }

  const date = new Date(completedAt);
  if (Number.isNaN(date.getTime())) return completedAt.slice(0, 10);
  return todayIso(date);
}

export function consolidateScheduleEntries(entries: ScheduleEntry[]) {
  const byScheduleKey = new Map<string, ScheduleEntry>();

  for (const entry of entries) {
    const key =
      typeof entry.stepIndex === "number"
        ? `${entry.planId}:${entry.knowledgeId}:step:${entry.stepIndex}`
        : `${entry.planId}:${entry.knowledgeId}:${entry.date}:${entry.kind}`;
    const existing = byScheduleKey.get(key);
    if (!existing) {
      byScheduleKey.set(key, entry);
      continue;
    }

    byScheduleKey.set(key, {
      ...existing,
      completed: existing.completed || entry.completed,
      completedDate: existing.completedDate ?? entry.completedDate,
      completedAt: existing.completedAt ?? entry.completedAt,
      feedback: existing.feedback ?? entry.feedback,
      originalDate: existing.originalDate ?? entry.originalDate,
      postponedAt: existing.postponedAt ?? entry.postponedAt,
      deferredUntil: existing.deferredUntil ?? entry.deferredUntil,
      adaptiveSourceEntryId: existing.adaptiveSourceEntryId ?? entry.adaptiveSourceEntryId,
      adaptiveFeedback: existing.adaptiveFeedback ?? entry.adaptiveFeedback,
      createdAt: existing.createdAt <= entry.createdAt ? existing.createdAt : entry.createdAt,
    });
  }

  return Array.from(byScheduleKey.values()).sort((a, b) =>
    a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
  );
}

export function rebuildPlanScheduleEntries(
  plan: Plan,
  knowledgeItems: KnowledgeItem[],
  existingEntries: ScheduleEntry[],
  now = new Date(),
) {
  return knowledgeItems.flatMap((knowledge) =>
    createScheduleEntriesForKnowledge(plan, knowledge, existingEntries, now),
  );
}

export function removeKnowledgeAndSchedule(
  knowledgeId: string,
  knowledgeItems: KnowledgeItem[],
  scheduleEntries: ScheduleEntry[],
) {
  return {
    knowledgeItems: knowledgeItems.filter((item) => item.id !== knowledgeId),
    scheduleEntries: scheduleEntries.filter((entry) => entry.knowledgeId !== knowledgeId),
  };
}

export function getKnowledgeProgress(knowledgeId: string, entries: ScheduleEntry[]) {
  const relevantEntries = entries.filter((entry) => entry.knowledgeId === knowledgeId);
  const completed = relevantEntries.filter((entry) => entry.completed).length;
  return {
    completed,
    total: relevantEntries.length,
    ratio: relevantEntries.length === 0 ? 0 : completed / relevantEntries.length,
  };
}
