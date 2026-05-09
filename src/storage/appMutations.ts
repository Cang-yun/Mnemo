import { addDays, todayIso } from "../domain/date";
import {
  createId,
  deriveScheduleEntries,
  getAdaptiveReviewDelay,
  getDefaultPlanTag,
  isDateInsidePlan,
  isLearningPlan,
  localDateFromCompletedAt,
  mergeKnowledgeTags,
  normalizeTags,
  rebuildPlanScheduleEntries,
} from "../domain/schedule";
import { normalizePlanInput } from "../domain/planInput";
import type { AppData, ReviewFeedback, UpdatePlanInput } from "../domain/types";

export function completeScheduleEntry(
  current: AppData,
  entryId: string,
  feedback: ReviewFeedback = "remembered",
  now = new Date(),
) {
  const actualDate = todayIso(now);
  const derivedEntries = deriveScheduleEntries(
    current.plans,
    current.knowledgeItems,
    current.scheduleEntries,
    actualDate,
  );
  const targetEntry = derivedEntries.find((entry) => entry.id === entryId);
  if (!targetEntry) return current.scheduleEntries;

  if (targetEntry.completed) {
    const completedDate =
      targetEntry.completedDate ?? localDateFromCompletedAt(targetEntry.completedAt);
    if (completedDate !== actualDate) return current.scheduleEntries;
    return cancelLatestCompletedScheduleEntry(current, derivedEntries, targetEntry);
  }

  if (targetEntry.date !== actualDate) return current.scheduleEntries;

  const plan = current.plans.find((candidate) => candidate.id === targetEntry.planId);
  const learning = isLearningPlan(plan);
  const completedAt = now.toISOString();
  const completedEntries = current.scheduleEntries.map((entry) =>
    entry.id === targetEntry.id
      ? {
          ...entry,
          completed: true,
          completedDate: actualDate,
          completedAt,
          feedback: learning ? feedback : undefined,
          deferredUntil: undefined,
          postponedAt: undefined,
          originalDate: undefined,
        }
      : entry,
  );

  if (!plan || !learning) return completedEntries;
  return appendRemedialEntryIfNeeded(current, completedEntries, targetEntry, feedback, actualDate, now);
}

function cancelLatestCompletedScheduleEntry(
  current: AppData,
  derivedEntries: AppData["scheduleEntries"],
  targetEntry: AppData["scheduleEntries"][number],
) {
  if (!isLatestCompletedEntry(derivedEntries, targetEntry)) {
    return current.scheduleEntries;
  }

  return current.scheduleEntries.map((entry) =>
    entry.id === targetEntry.id
      ? {
          ...entry,
          completed: false,
          completedDate: undefined,
          completedAt: undefined,
          feedback: undefined,
        }
      : entry,
  ).filter((entry) => entry.adaptiveSourceEntryId !== targetEntry.id);
}

function appendRemedialEntryIfNeeded(
  current: AppData,
  completedEntries: AppData["scheduleEntries"],
  sourceEntry: AppData["scheduleEntries"][number],
  feedback: ReviewFeedback,
  actualDate: string,
  now: Date,
) {
  const delay = getAdaptiveReviewDelay(feedback);
  const plan = current.plans.find((candidate) => candidate.id === sourceEntry.planId);
  if (!delay || !plan) return completedEntries;

  const remedialDate = addDays(actualDate, delay);
  if (!isDateInsidePlan(plan.startDate, plan.dayCount, remedialDate)) return completedEntries;

  const derivedAfterCompletion = deriveScheduleEntries(
    current.plans,
    current.knowledgeItems,
    completedEntries,
    actualDate,
  );
  const duplicate = derivedAfterCompletion.some(
    (entry) =>
      entry.knowledgeId === sourceEntry.knowledgeId &&
      entry.date === remedialDate &&
      !entry.completed,
  );
  if (duplicate) return completedEntries;

  const remedialEntry: AppData["scheduleEntries"][number] = {
    id: createId("entry"),
    planId: sourceEntry.planId,
    knowledgeId: sourceEntry.knowledgeId,
    date: remedialDate,
    kind: "remedial",
    completed: false,
    adaptiveSourceEntryId: sourceEntry.id,
    adaptiveFeedback: feedback,
    createdAt: now.toISOString(),
  };

  return [
    ...completedEntries,
    remedialEntry,
  ];
}

function isLatestCompletedEntry(
  entries: AppData["scheduleEntries"],
  targetEntry: AppData["scheduleEntries"][number],
) {
  return !entries.some((entry) => {
    if (
      entry.id === targetEntry.id ||
      !entry.completed ||
      entry.planId !== targetEntry.planId ||
      entry.knowledgeId !== targetEntry.knowledgeId
    ) {
      return false;
    }

    return compareCompletedEntries(entry, targetEntry) > 0;
  });
}

function compareCompletedEntries(
  left: AppData["scheduleEntries"][number],
  right: AppData["scheduleEntries"][number],
) {
  const stepOrder = (left.stepIndex ?? -1) - (right.stepIndex ?? -1);
  if (stepOrder !== 0) return stepOrder;

  const completedOrder = (left.completedAt ?? "").localeCompare(right.completedAt ?? "");
  if (completedOrder !== 0) return completedOrder;

  return left.createdAt.localeCompare(right.createdAt);
}

export function postponeScheduleEntry(
  current: AppData,
  entryId: string,
  days = 1,
  now = new Date(),
) {
  const actualDate = todayIso(now);
  const derivedEntries = deriveScheduleEntries(
    current.plans,
    current.knowledgeItems,
    current.scheduleEntries,
    actualDate,
  );
  const targetEntry = derivedEntries.find((entry) => entry.id === entryId);
  if (!targetEntry || targetEntry.completed || targetEntry.date !== actualDate) {
    return current.scheduleEntries;
  }

  return current.scheduleEntries.map((entry) =>
    entry.id === targetEntry.id
      ? {
          ...entry,
          completed: false,
          completedDate: undefined,
          completedAt: undefined,
          feedback: undefined,
          deferredUntil: addDays(actualDate, days),
          postponedAt: now.toISOString(),
        }
      : entry,
  );
}

export function updateKnowledgeTagsInData(current: AppData, knowledgeId: string, tags: string[]) {
  return current.knowledgeItems.map((item) => {
    if (item.id !== knowledgeId) return item;

    const plan = current.plans.find((candidate) => candidate.id === item.planId);
    return {
      ...item,
      tags: mergeKnowledgeTags(plan, tags),
      updatedAt: new Date().toISOString(),
    };
  });
}

export function updatePlanInData(current: AppData, planId: string, input: UpdatePlanInput) {
  const existingPlan = current.plans.find((plan) => plan.id === planId);
  if (!existingPlan) return current;

  const normalizedInput = normalizePlanInput(input, existingPlan.name);
  const updatedPlan = {
    ...existingPlan,
    ...normalizedInput,
  };
  const oldPlanTag = getDefaultPlanTag(existingPlan);
  const nextPlanTag = getDefaultPlanTag(updatedPlan);
  const nextKnowledgeItems = current.knowledgeItems.map((item) => {
    if (item.planId !== planId) return item;

    const userTags = (item.tags ?? []).filter((tag) => tag !== oldPlanTag);
    return {
      ...item,
      tags: normalizeTags([nextPlanTag, ...userTags]),
      updatedAt: new Date().toISOString(),
    };
  });
  const planKnowledgeItems = nextKnowledgeItems.filter((item) => item.planId === planId);
  const otherPlanEntries = current.scheduleEntries.filter((entry) => entry.planId !== planId);
  const currentPlanEntries = current.scheduleEntries.filter((entry) => entry.planId === planId);
  const currentPlanRemedialEntries = currentPlanEntries.filter((entry) => entry.kind === "remedial");
  const rebuiltEntries = rebuildPlanScheduleEntries(
    updatedPlan,
    planKnowledgeItems,
    currentPlanEntries,
  );

  return {
    ...current,
    plans: current.plans.map((plan) => (plan.id === planId ? updatedPlan : plan)),
    knowledgeItems: nextKnowledgeItems,
    scheduleEntries: [...otherPlanEntries, ...rebuiltEntries, ...currentPlanRemedialEntries],
  };
}
