import { useEffect, useMemo, useRef, useState } from "react";
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
import { FileStorageAdapter } from "./fileStorageAdapter";
import { createEmptyAppData, migrateAppData } from "./storageAdapter";
import { useTodayIso } from "../ui/useTodayIso";

export function useAppStore() {
  const storage = useMemo(() => new FileStorageAdapter(), []);
  const [data, setData] = useState<AppData>(() => createEmptyAppData());
  const [loaded, setLoaded] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const today = useTodayIso();

  // Persistence is asynchronous (IPC to the main process writes
  // state.json). We serialize saves through a promise chain so that a later
  // mutation never races ahead of an earlier one and overwrites fresher data.
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());
  // Mirror the latest state in a ref so the close-confirm path can perform a
  // synchronous final flush without reading stale React state.
  const latestDataRef = useRef<AppData>(data);
  latestDataRef.current = data;

  useEffect(() => {
    let cancelled = false;
    void storage.load().then((loadedData) => {
      if (cancelled) return;
      setData(loadedData);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [storage]);

  const derivedScheduleEntries = useMemo(
    () => deriveScheduleEntries(data.plans, data.knowledgeItems, data.scheduleEntries, today),
    [data.plans, data.knowledgeItems, data.scheduleEntries, today],
  );
  const visibleData = useMemo(
    () => ({ ...data, scheduleEntries: derivedScheduleEntries }),
    [data, derivedScheduleEntries],
  );

  function scheduleSave(next: AppData) {
    saveChainRef.current = saveChainRef.current
      .catch(() => undefined)
      .then(async () => {
        try {
          await storage.save(next);
          setSaveError((previous) => (previous ? null : previous));
        } catch (error) {
          const message = describeSaveError(error);
          console.error("Failed to persist state:", error);
          setSaveError(message);
        }
      });
  }

  function updateData(updater: (current: AppData) => AppData) {
    // Don't let mutations commit before the initial load has populated state,
    // otherwise we would overwrite user data with an empty dataset.
    if (!loaded) return;
    setData((current) => {
      const next = updater(current);
      scheduleSave(next);
      return next;
    });
  }

  function clearSaveError() {
    setSaveError(null);
  }

  /**
   * Synchronously flush the latest state to disk. Intended for the close-
   * confirm path: the main process is about to destroy the window, so any
   * pending async save would be aborted. Returns true if the sync write
   * succeeded (or if there is nothing to flush).
   */
  function flushPendingSavesSync(): boolean {
    if (!loaded) return true;
    return storage.saveSync(latestDataRef.current);
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
    const next = migrateAppData(rawData);
    setData(next);
    scheduleSave(next);
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
    updateData((current) => ({
      ...current,
      plans: current.plans.filter((plan) => plan.id !== planId),
      knowledgeItems: current.knowledgeItems.filter((item) => item.planId !== planId),
      scheduleEntries: current.scheduleEntries.filter((entry) => entry.planId !== planId),
      activePlanId:
        current.activePlanId === planId
          ? (current.plans.find((plan) => plan.id !== planId)?.id ?? null)
          : current.activePlanId,
    }));
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
    loaded,
    today,
    activePlan,
    activePlanItems,
    activePlanEntries,
    saveError,
    clearSaveError,
    flushPendingSavesSync,
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

function describeSaveError(error: unknown): string {
  const name = (error as { name?: string } | null)?.name ?? "";
  const message = (error as { message?: string } | null)?.message ?? "";
  const haystack = `${name} ${message}`;
  if (/ENOSPC/i.test(haystack)) {
    return "磁盘空间不足，最近的更改未能写入 state.json。请清理磁盘后再试；在此之前请先在设置里导出一份备份。";
  }
  if (/EACCES|EPERM/i.test(haystack)) {
    return "没有写入数据文件的权限。请检查用户目录 state.json 是否被其他程序占用，或换一个可写路径。";
  }
  if (/quota/i.test(haystack)) {
    return "浏览器存储配额已满。请切换到桌面版使用，或在设置里导出备份后清理数据。";
  }
  return "保存失败，最近的更改尚未落盘。请尽快在设置里导出一份备份，避免数据丢失。";
}
