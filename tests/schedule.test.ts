import { describe, expect, it } from "vitest";
import type { KnowledgeItem, Plan, ScheduleEntry } from "../src/domain/types";
import {
  createKnowledgeWithSchedule,
  createScheduleEntriesForKnowledge,
} from "../src/domain/schedule";

const plan: Plan = {
  id: "plan_1",
  name: "English",
  kind: "learning",
  themeId: "sage",
  startDate: "2026-05-01",
  dayCount: 45,
  reviewOffsets: [1, 2, 4, 7, 15, 30],
  createdAt: "2026-05-01T00:00:00.000Z",
};

function createKnowledge(firstDate: string): KnowledgeItem {
  return {
    id: "knowledge_1",
    planId: plan.id,
    title: "word",
    tags: [plan.name],
    noteMarkdown: "",
    firstDate,
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
  };
}

describe("schedule generation", () => {
  it("uses study-day numbering where the added date is day 1", () => {
    const { entries } = createKnowledgeWithSchedule(
      { plan, date: "2026-05-07", title: "word" },
      new Date("2026-05-07T08:00:00.000Z"),
    );

    expect(entries.map((entry) => entry.date)).toEqual([
      "2026-05-07",
      "2026-05-08",
      "2026-05-10",
      "2026-05-13",
      "2026-05-21",
      "2026-06-05",
    ]);
    expect(entries.map((entry) => entry.kind)).toEqual([
      "new",
      "review",
      "review",
      "review",
      "review",
      "review",
    ]);
  });

  it("uses custom review intervals from the plan", () => {
    const { entries } = createKnowledgeWithSchedule(
      {
        plan: { ...plan, dayCount: 70, reviewOffsets: [1, 2, 4, 7, 15, 30, 50] },
        date: "2026-05-07",
        title: "word",
      },
      new Date("2026-05-07T08:00:00.000Z"),
    );

    expect(entries.map((entry) => entry.date)).toContain("2026-06-25");
    expect(entries).toHaveLength(7);
  });

  it("can create a daily-task plan with only study day 1", () => {
    const { entries } = createKnowledgeWithSchedule(
      {
        plan: { ...plan, reviewOffsets: [1] },
        date: "2026-05-07",
        title: "word",
      },
      new Date("2026-05-07T08:00:00.000Z"),
    );

    expect(entries.map((entry) => entry.date)).toEqual(["2026-05-07"]);
  });

  it("marks the first-day entry complete when adding knowledge for today", () => {
    const { entries } = createKnowledgeWithSchedule(
      { plan, date: "2026-05-07", title: "word" },
      new Date("2026-05-07T08:00:00.000Z"),
    );

    expect(entries[0]).toMatchObject({
      date: "2026-05-07",
      kind: "new",
      completed: true,
    });
    expect(entries.slice(1).every((entry) => entry.completed === false)).toBe(true);
  });

  it("marks past schedule entries complete when backfilling old knowledge", () => {
    const { entries } = createKnowledgeWithSchedule(
      { plan, date: "2026-05-03", title: "old word" },
      new Date("2026-05-07T08:00:00.000Z"),
    );

    expect(entries.map((entry) => [entry.date, entry.completed])).toEqual([
      ["2026-05-03", true],
      ["2026-05-04", true],
      ["2026-05-06", true],
      ["2026-05-09", false],
      ["2026-05-17", false],
      ["2026-06-01", false],
    ]);
  });

  it("uses the same auto-completion rule when rebuilding schedule entries", () => {
    const knowledge = createKnowledge("2026-05-03");
    const existingEntries: ScheduleEntry[] = [
      {
        id: "entry_existing",
        planId: plan.id,
        knowledgeId: knowledge.id,
        date: "2026-05-09",
        kind: "review",
        completed: true,
        completedAt: "2026-05-09T08:00:00.000Z",
        createdAt: "2026-05-03T08:00:00.000Z",
      },
    ];

    const entries = createScheduleEntriesForKnowledge(
      plan,
      knowledge,
      existingEntries,
      new Date("2026-05-07T08:00:00.000Z"),
    );

    expect(entries.find((entry) => entry.date === "2026-05-03")).toMatchObject({
      kind: "new",
      completed: true,
    });
    expect(entries.find((entry) => entry.date === "2026-05-04")?.completed).toBe(true);
    expect(entries.find((entry) => entry.date === "2026-05-06")?.completed).toBe(true);
    expect(entries.find((entry) => entry.id === "entry_existing")).toMatchObject({
      date: "2026-05-09",
      completed: true,
      completedAt: "2026-05-09T08:00:00.000Z",
    });
  });
});
