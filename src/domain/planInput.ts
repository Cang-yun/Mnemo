import { todayIso } from "./date";
import { planThemes } from "./themes";
import type { CreatePlanInput, PlanKind, PlanThemeId, UpdatePlanInput } from "./types";

const MAX_PLAN_DAYS = 365;
const DEFAULT_PLAN_DAYS = 45;
const MAX_REVIEW_DAY = 365;
const REVIEW_DAY_SPLITTER = new RegExp("[\\s,\\uFF0C]+");

export const DEFAULT_REVIEW_OFFSETS = [1, 2, 4, 7, 15, 30];

export const REVIEW_OFFSET_TEMPLATES = [
  {
    id: "classic",
    name: "\u7ecf\u5178\u827e\u5bbe\u6d69\u65af",
    description: "\u957f\u671f\u5de9\u56fa\uff1a1/2/4/7/15/30 \u5929",
    kind: "learning",
    offsets: DEFAULT_REVIEW_OFFSETS,
  },
  {
    id: "sprint",
    name: "\u5bc6\u96c6\u51b2\u523a",
    description: "\u8fde\u7eed 6 \u5929\u6bcf\u5929\u590d\u4e60",
    kind: "task",
    offsets: [1, 2, 3, 4, 5, 6],
  },
  {
    id: "daily",
    name: "\u6bcf\u65e5\u4efb\u52a1",
    description: "\u53ea\u751f\u6210\u65b0\u589e\u5f53\u5929",
    kind: "task",
    offsets: [1],
  },
] as const;

function normalizePlanKind(value: unknown): PlanKind {
  return value === "task" ? "task" : "learning";
}

function isPlanThemeId(value: string): value is PlanThemeId {
  return planThemes.some((theme) => theme.id === value);
}

export function normalizeDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return todayIso();

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return todayIso();
  }

  return value;
}

export function normalizeDayCount(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_PLAN_DAYS;
  return Math.min(MAX_PLAN_DAYS, Math.max(1, Math.floor(value)));
}

export function normalizeReviewOffsets(value: unknown) {
  if (value === undefined || value === null) return DEFAULT_REVIEW_OFFSETS;

  const source = Array.isArray(value) ? value : DEFAULT_REVIEW_OFFSETS;
  const days = source
    .map((offset) => Number(offset))
    .filter((offset) => Number.isFinite(offset))
    .map((offset) => Math.floor(offset))
    .filter((offset) => offset >= 1 && offset <= MAX_REVIEW_DAY);

  const uniqueDays = Array.from(new Set(days)).sort((left, right) => left - right);
  return uniqueDays.length > 0 ? uniqueDays : [1];
}

export function parseReviewOffsets(value: string) {
  const trimmedValue = value.trim();
  if (!trimmedValue) return [1];

  return normalizeReviewOffsets(trimmedValue.split(REVIEW_DAY_SPLITTER));
}

export function stringifyReviewOffsets(value: number[] | undefined) {
  return normalizeReviewOffsets(value).join(", ");
}

export function normalizePlanInput(
  input: CreatePlanInput | UpdatePlanInput,
  fallbackName = "\u672a\u547d\u540d\u8ba1\u5212",
) {
  return {
    name: input.name.trim() || fallbackName,
    kind: normalizePlanKind(input.kind),
    themeId: isPlanThemeId(input.themeId) ? input.themeId : "sage",
    startDate: normalizeDate(input.startDate),
    dayCount: normalizeDayCount(input.dayCount),
    reviewOffsets: normalizeReviewOffsets(input.reviewOffsets),
  };
}
