import type { AppData, AppearanceTheme, CloseBehavior, StartupView } from "../domain/types";
import { normalizePlanInput } from "../domain/planInput";
import { syncWeakKnowledgeTags } from "../domain/feedbackStats";
import {
  consolidateScheduleEntries,
  createScheduleEntriesForKnowledge,
  getDefaultPlanTag,
  normalizeTags,
} from "../domain/schedule";

export interface StorageAdapter {
  load(): AppData;
  save(data: AppData): void;
}

export const CURRENT_SCHEMA_VERSION = 7;

export function createEmptyAppData(): AppData {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    plans: [],
    knowledgeItems: [],
    scheduleEntries: [],
    activePlanId: null,
    appearanceThemeId: "frostGray",
    customAppearanceThemes: [],
    startupView: "today",
    launchAtLogin: false,
    closeBehavior: "quit",
  };
}

export function migrateAppData(rawData: unknown): AppData {
  if (!rawData || typeof rawData !== "object") return createEmptyAppData();

  const data = rawData as Partial<AppData>;
  const plans = Array.isArray(data.plans)
    ? data.plans
        .filter((plan) => plan && typeof plan === "object")
        .map((plan) => {
          const candidatePlan = plan as AppData["plans"][number];
          const normalizedPlan = normalizePlanInput({
            name: candidatePlan.name ?? "",
            kind: candidatePlan.kind,
            themeId: candidatePlan.themeId,
            startDate: candidatePlan.startDate ?? "",
            dayCount: candidatePlan.dayCount,
            reviewOffsets: candidatePlan.reviewOffsets,
          });

          return {
            ...candidatePlan,
            id: candidatePlan.id,
            createdAt: candidatePlan.createdAt,
            ...normalizedPlan,
          };
        })
        .filter((plan) => typeof plan.id === "string" && typeof plan.createdAt === "string")
    : [];
  const activePlanId: string | null = plans.some((plan) => plan.id === data.activePlanId)
    ? (data.activePlanId ?? null)
    : (plans[0]?.id ?? null);

  const planById = new Map(plans.map((plan) => [plan.id, plan]));
  const knowledgeItems = Array.isArray(data.knowledgeItems)
    ? data.knowledgeItems
        .filter((item) => item && typeof item === "object")
        .map((item) => {
          const candidateItem = item as AppData["knowledgeItems"][number];
          const plan = planById.get(candidateItem.planId);
          const createdAt =
            typeof candidateItem.createdAt === "string"
              ? candidateItem.createdAt
              : `${candidateItem.firstDate || new Date().toISOString().slice(0, 10)}T00:00:00.000Z`;
          const updatedAt = typeof candidateItem.updatedAt === "string" ? candidateItem.updatedAt : createdAt;

          return {
            ...candidateItem,
            createdAt,
            updatedAt,
            tags: normalizeTags([
              ...(plan ? [getDefaultPlanTag(plan)] : []),
              ...((candidateItem.tags as string[] | undefined) ?? []),
            ]),
          };
        })
        .filter(
          (item) =>
            typeof item.id === "string" &&
            typeof item.planId === "string" &&
            typeof item.title === "string" &&
            typeof item.firstDate === "string",
        )
    : [];

  const rawScheduleEntries = Array.isArray(data.scheduleEntries) ? data.scheduleEntries : [];
  const scheduleEntries = knowledgeItems.flatMap((item) => {
    const plan = planById.get(item.planId);
    if (!plan) return [];
    return createScheduleEntriesForKnowledge(plan, item, rawScheduleEntries);
  });
  const syncedKnowledgeItems = syncWeakKnowledgeTags(knowledgeItems, scheduleEntries);
  const customAppearanceThemes = normalizeCustomAppearanceThemes(data.customAppearanceThemes);

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    plans,
    knowledgeItems: syncedKnowledgeItems,
    scheduleEntries: consolidateScheduleEntries(scheduleEntries),
    activePlanId,
    appearanceThemeId: normalizeAppearanceThemeId(data.appearanceThemeId, customAppearanceThemes),
    customAppearanceThemes,
    startupView: normalizeStartupView(data.startupView),
    launchAtLogin: data.launchAtLogin === true,
    closeBehavior: normalizeCloseBehavior(data.closeBehavior),
  };
}

function normalizeStartupView(value: unknown): StartupView {
  if (
    value === "today" ||
    value === "month" ||
    value === "plans" ||
    value === "notebook" ||
    value === "progress"
  ) {
    return value;
  }

  return "today";
}

function normalizeCloseBehavior(value: unknown): CloseBehavior {
  if (value === "tray" || value === "quit") return value;
  return "quit";
}

function normalizeAppearanceThemeId(
  themeId: unknown,
  customThemes: AppearanceTheme[] = [],
): AppData["appearanceThemeId"] {
  if (themeId === "ivoryPlum") return "carbon";
  if (themeId === "linenClay") return "teaCream";
  if (themeId === "moss") return "frostGray";
  if (themeId === "warmPaper") return "teaCream";

  if (
    themeId === "frostGray" ||
    themeId === "graphite" ||
    themeId === "carbon" ||
    themeId === "teaCream" ||
    (typeof themeId === "string" && customThemes.some((theme) => theme.id === themeId))
  ) {
    return themeId;
  }

  return "frostGray";
}

function normalizeCustomAppearanceThemes(value: unknown): AppearanceTheme[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((theme) => theme && typeof theme === "object")
    .map((theme) => theme as Partial<AppearanceTheme>)
    .filter(
      (theme) =>
        typeof theme.id === "string" &&
        theme.id.startsWith("custom_") &&
        typeof theme.name === "string" &&
        typeof theme.description === "string" &&
        typeof theme.paper === "string" &&
        typeof theme.surface === "string" &&
        typeof theme.ink === "string" &&
        typeof theme.muted === "string" &&
        typeof theme.line === "string" &&
        typeof theme.accent === "string" &&
        typeof theme.accentStrong === "string" &&
        typeof theme.accentSoft === "string" &&
        typeof theme.weak === "string",
    )
    .map((theme) => ({
      id: theme.id!,
      name: theme.name!.trim() || "Custom Theme",
      description: theme.description!.trim() || "自定义配色方案。",
      titleFont:
        theme.titleFont ||
        "\"Noto Serif SC\", \"Songti SC\", \"SimSun\", Georgia, serif",
      bodyFont:
        theme.bodyFont ||
        "\"Segoe UI\", \"Noto Sans SC\", \"Microsoft YaHei\", system-ui, sans-serif",
      paper: theme.paper!,
      surface: theme.surface!,
      ink: theme.ink!,
      muted: theme.muted!,
      line: theme.line!,
      accent: theme.accent!,
      accentStrong: theme.accentStrong!,
      accentSoft: theme.accentSoft!,
      weak: theme.weak!,
    }));
}
