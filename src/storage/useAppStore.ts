import { useEffect, useMemo, useState } from "react";
import type {
  AppData,
  CreatePlanInput,
  KnowledgeItem,
  ReviewFeedback,
  ScheduleEntry,
  UpdatePlanInput,
  AppearanceThemeId,
  AppearanceTheme,
  StartupView,
  CloseBehavior,
} from "../domain/types";
import { syncWeakKnowledgeTags } from "../domain/feedbackStats";
import {
  createId,
  createKnowledgeWithSchedule,
  deriveScheduleEntries,
  removeKnowledgeAndSchedule,
} from "../domain/schedule";
import { normalizePlanInput } from "../domain/planInput";
import {
  completeScheduleEntry,
  postponeScheduleEntry,
  updateKnowledgeTagsInData,
  updatePlanInData,
} from "./appMutations";
import { LocalStorageAdapter } from "./localStorageAdapter";
import { migrateAppData } from "./storageAdapter";

export function useAppStore() {
  const storage = useMemo(() => new LocalStorageAdapter(), []);
  const [data, setData] = useState<AppData>(() => storage.load());
  const derivedScheduleEntries = useMemo(
    () => deriveScheduleEntries(data.plans, data.knowledgeItems, data.scheduleEntries),
    [data.plans, data.knowledgeItems, data.scheduleEntries],
  );
  const visibleData = useMemo(
    () => ({ ...data, scheduleEntries: derivedScheduleEntries }),
    [data, derivedScheduleEntries],
  );

  useEffect(() => {
    storage.save(data);
  }, [data, storage]);

  function updateData(updater: (current: AppData) => AppData) {
    setData((current) => updater(current));
  }

  function createPlan(input: CreatePlanInput) {
    const now = new Date().toISOString();
    const normalizedInput = normalizePlanInput(input);
    const plan = {
      id: createId("plan"),
      name: normalizedInput.name,
      kind: normalizedInput.kind,
      themeId: normalizedInput.themeId,
      startDate: normalizedInput.startDate,
      dayCount: normalizedInput.dayCount,
      reviewOffsets: normalizedInput.reviewOffsets,
      createdAt: now,
    };

    updateData((current) => ({
      ...current,
      plans: [plan, ...current.plans],
      activePlanId: plan.id,
    }));
  }

  function updatePlan(planId: string, input: UpdatePlanInput) {
    updateData((current) => updatePlanInData(current, planId, input));
  }

  function setActivePlan(planId: string) {
    updateData((current) => ({ ...current, activePlanId: planId }));
  }

  function setAppearanceTheme(themeId: AppearanceThemeId) {
    updateData((current) => ({ ...current, appearanceThemeId: themeId }));
  }

  function createAppearanceTheme(input: Omit<AppearanceTheme, "id">) {
    const theme: AppearanceTheme = {
      ...input,
      id: createId("custom"),
      name: input.name.trim() || "Custom Theme",
      description: input.description.trim() || "自定义配色方案。",
    };

    updateData((current) => ({
      ...current,
      customAppearanceThemes: [...current.customAppearanceThemes, theme],
      appearanceThemeId: theme.id,
    }));
  }

  function deleteAppearanceTheme(themeId: AppearanceThemeId) {
    updateData((current) => {
      const hasCustomTheme = current.customAppearanceThemes.some((theme) => theme.id === themeId);
      if (!hasCustomTheme) return current;

      const customAppearanceThemes = current.customAppearanceThemes.filter(
        (theme) => theme.id !== themeId,
      );

      return {
        ...current,
        customAppearanceThemes,
        appearanceThemeId:
          current.appearanceThemeId === themeId ? "frostGray" : current.appearanceThemeId,
      };
    });
  }

  function setStartupView(startupView: StartupView) {
    updateData((current) => ({ ...current, startupView }));
  }

  function setLaunchAtLogin(launchAtLogin: boolean) {
    updateData((current) => ({ ...current, launchAtLogin }));
  }

  function setCloseBehavior(closeBehavior: CloseBehavior) {
    updateData((current) => ({ ...current, closeBehavior }));
  }

  function replaceData(rawData: unknown) {
    setData(migrateAppData(rawData));
  }

  function addKnowledge(planId: string, date: string, title: string) {
    updateData((current) => {
      const plan = current.plans.find((candidate) => candidate.id === planId);
      if (!plan || !title.trim()) return current;

      const { knowledge, entries } = createKnowledgeWithSchedule({
        plan,
        date,
        title,
      });

      return {
        ...current,
        knowledgeItems: [knowledge, ...current.knowledgeItems],
        scheduleEntries: [...current.scheduleEntries, ...entries],
      };
    });
  }

  function toggleEntry(entryId: string) {
    completeEntry(entryId, "remembered");
  }

  function completeEntry(entryId: string, feedback: ReviewFeedback = "remembered") {
    updateData((current) => {
      const scheduleEntries = completeScheduleEntry(current, entryId, feedback);

      return {
        ...current,
        knowledgeItems: syncWeakKnowledgeTags(current.knowledgeItems, scheduleEntries),
        scheduleEntries,
      };
    });
  }

  function postponeEntry(entryId: string, days = 1) {
    updateData((current) => {
      const scheduleEntries = postponeScheduleEntry(current, entryId, days);

      return {
        ...current,
        knowledgeItems: syncWeakKnowledgeTags(current.knowledgeItems, scheduleEntries),
        scheduleEntries,
      };
    });
  }

  function skipEntry(entryId: string) {
    completeEntry(entryId, "skipped");
  }

  function updateKnowledgeNote(knowledgeId: string, noteMarkdown: string) {
    updateData((current) => ({
      ...current,
      knowledgeItems: current.knowledgeItems.map((item) =>
        item.id === knowledgeId
          ? { ...item, noteMarkdown, updatedAt: new Date().toISOString() }
          : item,
      ),
    }));
  }

  function updateKnowledgeTitle(knowledgeId: string, title: string) {
    updateData((current) => ({
      ...current,
      knowledgeItems: current.knowledgeItems.map((item) =>
        item.id === knowledgeId
          ? { ...item, title: title.trim() || item.title, updatedAt: new Date().toISOString() }
          : item,
      ),
    }));
  }

  function updateKnowledgeTags(knowledgeId: string, tags: string[]) {
    updateData((current) => ({
      ...current,
      knowledgeItems: syncWeakKnowledgeTags(
        updateKnowledgeTagsInData(current, knowledgeId, tags),
        current.scheduleEntries,
      ),
    }));
  }

  function deleteKnowledge(knowledgeId: string) {
    updateData((current) => ({
      ...current,
      ...removeKnowledgeAndSchedule(
        knowledgeId,
        current.knowledgeItems,
        current.scheduleEntries,
      ),
    }));
  }

  function deletePlan(planId: string) {
    updateData((current) => {
      const planKnowledgeIds = new Set(
        current.knowledgeItems
          .filter((item) => item.planId === planId)
          .map((item) => item.id),
      );
      return {
        ...current,
        plans: current.plans.filter((plan) => plan.id !== planId),
        knowledgeItems: current.knowledgeItems.filter((item) => item.planId !== planId),
        scheduleEntries: current.scheduleEntries.filter(
          (entry) => entry.planId !== planId,
        ),
        activePlanId:
          current.activePlanId === planId
            ? (current.plans.find((plan) => plan.id !== planId)?.id ?? null)
            : current.activePlanId,
      };
    });
  }

  const activePlan = data.plans.find((plan) => plan.id === data.activePlanId) ?? data.plans[0] ?? null;
  const activePlanItems: KnowledgeItem[] = activePlan
    ? data.knowledgeItems.filter((item) => item.planId === activePlan.id)
    : [];
  const activePlanEntries: ScheduleEntry[] = activePlan
    ? derivedScheduleEntries.filter((entry) => entry.planId === activePlan.id)
    : [];

  return {
    data: visibleData,
    rawData: data,
    activePlan,
    activePlanItems,
    activePlanEntries,
    createPlan,
    updatePlan,
    setActivePlan,
    setAppearanceTheme,
    createAppearanceTheme,
    deleteAppearanceTheme,
    setStartupView,
    setLaunchAtLogin,
    setCloseBehavior,
    replaceData,
    addKnowledge,
    toggleEntry,
    completeEntry,
    postponeEntry,
    skipEntry,
    updateKnowledgeNote,
    updateKnowledgeTitle,
    updateKnowledgeTags,
    deleteKnowledge,
    deletePlan,
  };
}
