import { describe, expect, it } from "vitest";
import { computeCloudDiff, hasDiffChanges } from "../src/domain/cloudDiff";
import type { AppData, Plan, ScheduleEntry } from "../src/domain/types";

const plan: Plan = {
  id: "plan_1",
  name: "English",
  kind: "learning",
  themeId: "sage",
  startDate: "2026-05-01",
  dayCount: 30,
  reviewOffsets: [1, 2, 4],
  createdAt: "2026-05-01T00:00:00.000Z",
};

const baseEntry: ScheduleEntry = {
  id: "entry_1",
  planId: plan.id,
  knowledgeId: "knowledge_1",
  stepIndex: 0,
  date: "2026-05-07",
  kind: "new",
  completed: false,
  createdAt: "2026-05-07T00:00:00.000Z",
};

function data(entry: ScheduleEntry): AppData {
  return {
    schemaVersion: 7,
    plans: [plan],
    knowledgeItems: [
      {
        id: "knowledge_1",
        planId: plan.id,
        title: "word",
        tags: ["English"],
        noteMarkdown: "",
        firstDate: "2026-05-07",
        createdAt: "2026-05-07T00:00:00.000Z",
        updatedAt: "2026-05-07T00:00:00.000Z",
      },
    ],
    scheduleEntries: [entry],
    activePlanId: plan.id,
    appearanceThemeId: "frostGray",
    customAppearanceThemes: [],
    startupView: "today",
    launchAtLogin: false,
    closeBehavior: "quit",
  };
}

describe("cloud diff completion state", () => {
  it("reports schedule completion changes", () => {
    const diff = computeCloudDiff(
      data({
        ...baseEntry,
        completed: true,
        completedDate: "2026-05-07",
        feedback: "remembered",
      }),
      data(baseEntry),
    );

    expect(diff.modifiedCompletion).toEqual([
      "word：未完成 → 已完成 / 2026-05-07 / 记住",
    ]);
    expect(hasDiffChanges(diff)).toBe(true);
  });

  it("reports feedback changes on completed entries", () => {
    const diff = computeCloudDiff(
      data({
        ...baseEntry,
        completed: true,
        completedDate: "2026-05-07",
        feedback: "forgotten",
      }),
      data({
        ...baseEntry,
        completed: true,
        completedDate: "2026-05-07",
        feedback: "fuzzy",
      }),
    );

    expect(diff.modifiedCompletion).toEqual([
      "word：已完成 / 2026-05-07 / 模糊 → 已完成 / 2026-05-07 / 遗忘",
    ]);
  });

  it("ignores completedAt-only differences", () => {
    const diff = computeCloudDiff(
      data({
        ...baseEntry,
        completed: true,
        completedDate: "2026-05-07",
        completedAt: "2026-05-07T09:00:00.000Z",
      }),
      data({
        ...baseEntry,
        completed: true,
        completedDate: "2026-05-07",
        completedAt: "2026-05-07T08:00:00.000Z",
      }),
    );

    expect(diff.modifiedCompletion).toEqual([]);
    expect(hasDiffChanges(diff)).toBe(false);
  });
});
