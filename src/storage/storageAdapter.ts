import type {
  AppData,
  AppearanceTheme,
  CloseBehavior,
  CloudSyncConfig,
  ReviewFeedback,
  ScheduleEntry,
  StartupView,
} from "../domain/types";
import { normalizePlanInput } from "../domain/planInput";
import { syncWeakKnowledgeTags } from "../domain/feedbackStats";
import {
  consolidateScheduleEntries,
  createId,
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
  const knowledgeById = new Map(knowledgeItems.map((item) => [item.id, item]));
  const scheduleEntries = knowledgeItems.flatMap((item) => {
    const plan = planById.get(item.planId);
    if (!plan) return [];
    return createScheduleEntriesForKnowledge(plan, item, rawScheduleEntries);
  });
  const remedialEntries = extractRemedialEntries(rawScheduleEntries, planById, knowledgeById);
  const syncedKnowledgeItems = syncWeakKnowledgeTags(
    knowledgeItems,
    [...scheduleEntries, ...remedialEntries],
  );
  const customAppearanceThemes = normalizeCustomAppearanceThemes(data.customAppearanceThemes);

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    plans,
    knowledgeItems: syncedKnowledgeItems,
    scheduleEntries: consolidateScheduleEntries([...scheduleEntries, ...remedialEntries]),
    activePlanId,
    appearanceThemeId: normalizeAppearanceThemeId(data.appearanceThemeId, customAppearanceThemes),
    customAppearanceThemes,
    startupView: normalizeStartupView(data.startupView),
    launchAtLogin: data.launchAtLogin === true,
    closeBehavior: normalizeCloseBehavior(data.closeBehavior),
    cloudSync: normalizeCloudSyncConfig(data.cloudSync),
    lastSyncTime: typeof data.lastSyncTime === "string" ? data.lastSyncTime : undefined,
  };
}

// ---------------------------------------------------------------------------
// Remedial entry preservation helpers
// ---------------------------------------------------------------------------

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const VALID_FEEDBACKS: readonly ReviewFeedback[] = [
  "remembered",
  "fuzzy",
  "forgotten",
  "skipped",
];

function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return false;
  const year = parsed.getFullYear();
  const month = `${parsed.getMonth() + 1}`.padStart(2, "0");
  const day = `${parsed.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}` === value;
}

function normalizeFeedback(value: unknown): ReviewFeedback | undefined {
  return VALID_FEEDBACKS.includes(value as ReviewFeedback)
    ? (value as ReviewFeedback)
    : undefined;
}

function extractRemedialEntries(
  rawEntries: unknown[],
  planById: Map<string, AppData["plans"][number]>,
  knowledgeById: Map<string, AppData["knowledgeItems"][number]>,
): ScheduleEntry[] {
  const result: ScheduleEntry[] = [];

  for (const raw of rawEntries) {
    if (!raw || typeof raw !== "object") continue;
    const candidate = raw as Partial<ScheduleEntry>;
    if (candidate.kind !== "remedial") continue;
    if (typeof candidate.planId !== "string" || !planById.has(candidate.planId)) continue;
    if (typeof candidate.knowledgeId !== "string" || !knowledgeById.has(candidate.knowledgeId)) continue;
    if (!isValidIsoDate(candidate.date)) continue;

    const id =
      typeof candidate.id === "string" && candidate.id.length > 0
        ? candidate.id
        : createId("entry");
    const createdAt =
      typeof candidate.createdAt === "string" && candidate.createdAt.length > 0
        ? candidate.createdAt
        : `${candidate.date}T00:00:00.000Z`;
    const completed = candidate.completed === true;
    const completedDate =
      completed && isValidIsoDate(candidate.completedDate) ? candidate.completedDate : undefined;
    const completedAt =
      completed && typeof candidate.completedAt === "string" && candidate.completedAt.length > 0
        ? candidate.completedAt
        : undefined;
    const deferredUntil = isValidIsoDate(candidate.deferredUntil)
      ? candidate.deferredUntil
      : undefined;
    const postponedAt =
      typeof candidate.postponedAt === "string" && candidate.postponedAt.length > 0
        ? candidate.postponedAt
        : undefined;
    const adaptiveSourceEntryId =
      typeof candidate.adaptiveSourceEntryId === "string" && candidate.adaptiveSourceEntryId.length > 0
        ? candidate.adaptiveSourceEntryId
        : undefined;

    result.push({
      id,
      planId: candidate.planId,
      knowledgeId: candidate.knowledgeId,
      date: candidate.date,
      kind: "remedial",
      completed,
      completedDate,
      completedAt,
      feedback: normalizeFeedback(candidate.feedback),
      postponedAt,
      deferredUntil,
      adaptiveSourceEntryId,
      adaptiveFeedback: normalizeFeedback(candidate.adaptiveFeedback),
      createdAt,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Other normalization helpers
// ---------------------------------------------------------------------------

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

function normalizeCloudSyncConfig(value: unknown): CloudSyncConfig | undefined {
  if (!value || typeof value !== "object") return undefined;
  const cfg = value as Partial<CloudSyncConfig>;
  if (
    typeof cfg.url === "string" && cfg.url.trim().length > 0 &&
    typeof cfg.username === "string" && cfg.username.trim().length > 0 &&
    typeof cfg.password === "string" && cfg.password.trim().length > 0
  ) {
    return {
      url: cfg.url.trim(),
      username: cfg.username.trim(),
      password: cfg.password,
    };
  }
  return undefined;
}
