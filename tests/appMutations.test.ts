import { describe, expect, it } from "vitest";
import { deriveScheduleEntries } from "../src/domain/schedule";
import type { AppData, ScheduleEntry } from "../src/domain/types";
import {
  completeScheduleEntry,
  postponeScheduleEntry,
  updateKnowledgeTagsInData,
  updatePlanInData,
} from "../src/storage/appMutations";

const baseData: AppData = {
  schemaVersion: 4,
  activePlanId: "plan_1",
  appearanceThemeId: "warmPaper",
  customAppearanceThemes: [],
  startupView: "today",
  launchAtLogin: false,
  closeBehavior: "quit",
  plans: [
    {
      id: "plan_1",
      name: "English",
      kind: "learning",
      themeId: "sage",
      startDate: "2026-05-07",
      dayCount: 45,
      reviewOffsets: [1, 2, 4, 7, 15, 30],
      createdAt: "2026-05-07T00:00:00.000Z",
    },
  ],
  knowledgeItems: [
    {
      id: "knowledge_1",
      planId: "plan_1",
      title: "word",
      tags: ["English", "vocabulary"],
      noteMarkdown: "",
      firstDate: "2026-05-07",
      createdAt: "2026-05-07T00:00:00.000Z",
      updatedAt: "2026-05-07T00:00:00.000Z",
    },
  ],
  scheduleEntries: createStoredEntries(),
};

function createStoredEntries(overrides: Partial<ScheduleEntry>[] = []): ScheduleEntry[] {
  const dates = ["2026-05-07", "2026-05-08", "2026-05-10", "2026-05-13", "2026-05-21", "2026-06-05"];
  return dates.map((date, stepIndex) => ({
    id: `entry_${stepIndex}`,
    planId: "plan_1",
    knowledgeId: "knowledge_1",
    stepIndex,
    date,
    kind: stepIndex === 0 ? "new" : "review",
    completed: false,
    createdAt: "2026-05-07T00:00:00.000Z",
    ...overrides[stepIndex],
  }));
}

function derive(data: AppData, today: string) {
  return deriveScheduleEntries(data.plans, data.knowledgeItems, data.scheduleEntries, today);
}

function createTaskData(): AppData {
  return {
    ...baseData,
    plans: [
      {
        ...baseData.plans[0],
        kind: "task",
        reviewOffsets: [1, 2, 3],
      },
    ],
    scheduleEntries: createStoredEntries().slice(0, 3).map((entry) => ({
      ...entry,
      kind: "task",
    })),
  };
}

describe("app mutations", () => {
  it("keeps the next formal review in place and adds a fuzzy remedial review", () => {
    const scheduleEntries = completeScheduleEntry(
      baseData,
      "entry_0",
      "fuzzy",
      new Date("2026-05-07T08:00:00.000Z"),
    );
    const derivedEntries = derive({ ...baseData, scheduleEntries }, "2026-05-07");

    expect(scheduleEntries.find((entry) => entry.id === "entry_0")).toMatchObject({
      completed: true,
      feedback: "fuzzy",
      completedAt: "2026-05-07T08:00:00.000Z",
    });
    expect(derivedEntries.find((entry) => entry.id === "entry_1")).toMatchObject({
      date: "2026-05-08",
      completed: false,
    });
    expect(derivedEntries.find((entry) => entry.kind === "remedial")).toMatchObject({
      date: "2026-05-09",
      completed: false,
      adaptiveSourceEntryId: "entry_0",
      adaptiveFeedback: "fuzzy",
    });
  });

  it("uses forgotten feedback to derive the next review tomorrow", () => {
    const scheduleEntries = completeScheduleEntry(
      baseData,
      "entry_0",
      "forgotten",
      new Date("2026-05-07T08:00:00.000Z"),
    );
    const derivedEntries = derive({ ...baseData, scheduleEntries }, "2026-05-07");

    expect(derivedEntries.find((entry) => entry.id === "entry_1")).toMatchObject({
      date: "2026-05-08",
      completed: false,
    });
  });

  it("keeps the local completion date when deriving and canceling today's review", () => {
    const data: AppData = {
      ...baseData,
      scheduleEntries: createStoredEntries([
        {
          completed: true,
          completedDate: "2026-05-07",
          completedAt: "2026-05-07T00:00:00.000Z",
        },
      ]),
    };

    const completedEntries = completeScheduleEntry(
      data,
      "entry_1",
      "remembered",
      new Date("2026-05-08T01:00:00.000"),
    );
    const derivedEntries = derive({ ...data, scheduleEntries: completedEntries }, "2026-05-08");
    const canceledEntries = completeScheduleEntry(
      { ...data, scheduleEntries: completedEntries },
      "entry_1",
      "remembered",
      new Date("2026-05-08T01:30:00.000"),
    );

    expect(completedEntries.find((entry) => entry.id === "entry_1")).toMatchObject({
      completed: true,
      completedDate: "2026-05-08",
      feedback: "remembered",
    });
    expect(derivedEntries.find((entry) => entry.id === "entry_2")).toMatchObject({
      date: "2026-05-10",
      completed: false,
    });
    expect(canceledEntries.find((entry) => entry.id === "entry_1")).toMatchObject({
      completed: false,
      completedDate: undefined,
      completedAt: undefined,
    });
  });

  it("does not allow future tasks to be completed early", () => {
    const scheduleEntries = completeScheduleEntry(
      baseData,
      "entry_1",
      "remembered",
      new Date("2026-05-07T08:00:00.000Z"),
    );

    expect(scheduleEntries.find((entry) => entry.id === "entry_1")?.completed).toBe(false);
  });

  it("carries the earliest overdue task to today and shifts all later entries", () => {
    const carriedEntries = derive(baseData, "2026-05-09");
    expect(carriedEntries).toHaveLength(6);
    expect(carriedEntries[0]).toMatchObject({
      id: "entry_0",
      date: "2026-05-09",
      originalDate: "2026-05-07",
      completed: false,
    });
    expect(carriedEntries[1]).toMatchObject({
      id: "entry_1",
      date: "2026-05-10",
      completed: false,
    });
    expect(carriedEntries[2]).toMatchObject({
      id: "entry_2",
      date: "2026-05-12",
      completed: false,
    });

    const scheduleEntries = completeScheduleEntry(
      baseData,
      "entry_0",
      "remembered",
      new Date("2026-05-09T08:00:00.000Z"),
    );
    const derivedEntries = derive({ ...baseData, scheduleEntries }, "2026-05-09");

    expect(derivedEntries.find((entry) => entry.id === "entry_0")?.completed).toBe(true);
    expect(derivedEntries.find((entry) => entry.id === "entry_1")).toMatchObject({
      date: "2026-05-10",
      completed: false,
    });
  });

  it("does not drift when the latest completion is canceled and completed again", () => {
    const completedOnce = completeScheduleEntry(
      baseData,
      "entry_0",
      "remembered",
      new Date("2026-05-09T08:00:00.000Z"),
    );
    const canceled = completeScheduleEntry(
      { ...baseData, scheduleEntries: completedOnce },
      "entry_0",
      "remembered",
      new Date("2026-05-09T08:30:00.000Z"),
    );
    const completedAgain = completeScheduleEntry(
      { ...baseData, scheduleEntries: canceled },
      "entry_0",
      "remembered",
      new Date("2026-05-09T09:00:00.000Z"),
    );

    expect(derive({ ...baseData, scheduleEntries: canceled }, "2026-05-09")[0]).toMatchObject({
      id: "entry_0",
      date: "2026-05-09",
      completed: false,
    });
    expect(derive({ ...baseData, scheduleEntries: completedAgain }, "2026-05-09")
      .find((entry) => entry.id === "entry_1")).toMatchObject({
        date: "2026-05-10",
      });
  });

  it("only allows the latest completed entry for a knowledge item to be canceled", () => {
    const data: AppData = {
      ...baseData,
      scheduleEntries: createStoredEntries([
        {
          completed: true,
          completedAt: "2026-05-07T08:00:00.000Z",
        },
        {
          completed: true,
          completedAt: "2026-05-08T08:00:00.000Z",
        },
      ]),
    };

    const oldAttempt = completeScheduleEntry(
      data,
      "entry_0",
      "remembered",
      new Date("2026-05-08T09:00:00.000Z"),
    );
    const latestAttempt = completeScheduleEntry(
      { ...data, scheduleEntries: oldAttempt },
      "entry_1",
      "remembered",
      new Date("2026-05-08T09:30:00.000Z"),
    );

    expect(oldAttempt.find((entry) => entry.id === "entry_0")?.completed).toBe(true);
    expect(latestAttempt.find((entry) => entry.id === "entry_0")?.completed).toBe(true);
    expect(latestAttempt.find((entry) => entry.id === "entry_1")?.completed).toBe(false);
  });

  it("postpones only today's open task and derives the visible date from the defer state", () => {
    const scheduleEntries = postponeScheduleEntry(
      baseData,
      "entry_0",
      1,
      new Date("2026-05-07T08:00:00.000Z"),
    );
    const derivedEntries = derive({ ...baseData, scheduleEntries }, "2026-05-07");

    expect(scheduleEntries.find((entry) => entry.id === "entry_0")).toMatchObject({
      completed: false,
      deferredUntil: "2026-05-08",
    });
    expect(derivedEntries.find((entry) => entry.id === "entry_0")).toMatchObject({
      date: "2026-05-08",
    });
  });

  it("appends knowledge tags while preserving the plan tag and existing tags", () => {
    const items = updateKnowledgeTagsInData(baseData, "knowledge_1", [
      "English",
      "vocabulary",
      "grammar",
    ]);

    expect(items.find((item) => item.id === "knowledge_1")?.tags).toEqual([
      "English",
      "vocabulary",
      "grammar",
    ]);
  });

  it("does not transfer completion state to a different date when review intervals change", () => {
    const data: AppData = {
      ...baseData,
      scheduleEntries: createStoredEntries([
        {},
        {},
        {
          completed: true,
          completedDate: "2026-05-10",
          completedAt: "2026-05-10T08:00:00.000Z",
        },
      ]),
    };

    const updated = updatePlanInData(data, "plan_1", {
      name: "English",
      kind: "learning",
      themeId: "sage",
      startDate: "2026-05-07",
      dayCount: 45,
      reviewOffsets: [1],
    });

    expect(updated.scheduleEntries.map((entry) => entry.date)).toEqual([
      "2026-05-07",
    ]);
    expect(updated.scheduleEntries.some((entry) => entry.completed && entry.date !== "2026-05-07")).toBe(false);
  });

  it("does not store learning feedback for task plans", () => {
    const data = createTaskData();
    const scheduleEntries = completeScheduleEntry(
      data,
      "entry_0",
      "forgotten",
      new Date("2026-05-07T08:00:00.000Z"),
    );

    expect(scheduleEntries.find((entry) => entry.id === "entry_0")).toMatchObject({
      completed: true,
      feedback: undefined,
    });
    expect(scheduleEntries.some((entry) => entry.kind === "remedial")).toBe(false);
  });

  it("shifts future task occurrences from the actual overdue completion date", () => {
    const data = createTaskData();
    const scheduleEntries = completeScheduleEntry(
      data,
      "entry_0",
      "remembered",
      new Date("2026-05-09T08:00:00.000Z"),
    );
    const derivedEntries = derive({ ...data, scheduleEntries }, "2026-05-09");

    expect(derivedEntries.find((entry) => entry.id === "entry_1")).toMatchObject({
      date: "2026-05-10",
      kind: "task",
    });
    expect(derivedEntries.find((entry) => entry.id === "entry_2")).toMatchObject({
      date: "2026-05-11",
      kind: "task",
    });
  });
});
