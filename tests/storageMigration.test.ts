import { describe, expect, it } from "vitest";
import { migrateAppData } from "../src/storage/storageAdapter";

describe("storage migration", () => {
  it("backfills knowledge timestamps for older saved data", () => {
    const data = migrateAppData({
      schemaVersion: 1,
      plans: [
        {
          id: "plan-1",
          name: "旧计划",
          themeId: "sage",
          startDate: "2026-05-07",
          dayCount: 30,
          createdAt: "2026-05-07T00:00:00.000Z",
        },
      ],
      knowledgeItems: [
        {
          id: "knowledge-1",
          planId: "plan-1",
          title: "旧知识点",
          noteMarkdown: "",
          firstDate: "2026-05-08",
          tags: [],
        },
      ],
      scheduleEntries: [],
      activePlanId: "plan-1",
    });

    expect(data.knowledgeItems[0].createdAt).toBe("2026-05-08T00:00:00.000Z");
    expect(data.knowledgeItems[0].updatedAt).toBe("2026-05-08T00:00:00.000Z");
    expect(data.plans[0].reviewOffsets).toEqual([1, 2, 4, 7, 15, 30]);
    expect(data.startupView).toBe("today");
    expect(data.knowledgeItems[0].tags).toContain("旧计划");
  });

  it("keeps custom appearance themes and maps retired theme ids", () => {
    const data = migrateAppData({
      schemaVersion: 4,
      plans: [],
      knowledgeItems: [],
      scheduleEntries: [],
      activePlanId: null,
      appearanceThemeId: "ivoryPlum",
      customAppearanceThemes: [
        {
          id: "custom_reader",
          name: "Reader",
          description: "Custom reader theme.",
          titleFont: "\"Noto Serif SC\", Georgia, serif",
          bodyFont: "\"Inter\", system-ui, sans-serif",
          paper: "#F2F2EE",
          surface: "#FFFFFF",
          ink: "#202020",
          muted: "#777777",
          line: "#DDDDDD",
          accent: "#445566",
          accentStrong: "#223344",
          accentSoft: "#E6EAEE",
          weak: "#AA5544",
        },
      ],
    });

    expect(data.appearanceThemeId).toBe("carbon");
    expect(data.customAppearanceThemes).toHaveLength(1);
    expect(data.customAppearanceThemes[0].id).toBe("custom_reader");
  });

  it("preserves remedial entries during migration", () => {
    const data = migrateAppData({
      schemaVersion: 5,
      plans: [
        {
          id: "plan_1",
          name: "English",
          kind: "learning",
          themeId: "sage",
          startDate: "2026-05-01",
          dayCount: 60,
          reviewOffsets: [1, 2, 4, 7, 15, 30],
          createdAt: "2026-05-01T00:00:00.000Z",
        },
      ],
      knowledgeItems: [
        {
          id: "knowledge_1",
          planId: "plan_1",
          title: "word",
          tags: ["English"],
          noteMarkdown: "",
          firstDate: "2026-05-07",
          createdAt: "2026-05-07T00:00:00.000Z",
          updatedAt: "2026-05-07T00:00:00.000Z",
        },
      ],
      scheduleEntries: [
        {
          id: "entry_0",
          planId: "plan_1",
          knowledgeId: "knowledge_1",
          stepIndex: 0,
          date: "2026-05-07",
          kind: "new",
          completed: true,
          completedDate: "2026-05-07",
          completedAt: "2026-05-07T08:00:00.000Z",
          feedback: "fuzzy",
          createdAt: "2026-05-07T00:00:00.000Z",
        },
        {
          id: "remedial_1",
          planId: "plan_1",
          knowledgeId: "knowledge_1",
          date: "2026-05-09",
          kind: "remedial",
          completed: false,
          adaptiveSourceEntryId: "entry_0",
          adaptiveFeedback: "fuzzy",
          createdAt: "2026-05-07T08:00:00.000Z",
        },
      ],
      activePlanId: "plan_1",
    });

    const remedialEntries = data.scheduleEntries.filter((entry) => entry.kind === "remedial");
    expect(remedialEntries).toHaveLength(1);
    expect(remedialEntries[0]).toMatchObject({
      id: "remedial_1",
      planId: "plan_1",
      knowledgeId: "knowledge_1",
      date: "2026-05-09",
      kind: "remedial",
      completed: false,
      adaptiveSourceEntryId: "entry_0",
      adaptiveFeedback: "fuzzy",
    });
  });

  it("filters out remedial entries with orphan planId or knowledgeId", () => {
    const data = migrateAppData({
      schemaVersion: 5,
      plans: [
        {
          id: "plan_1",
          name: "English",
          kind: "learning",
          themeId: "sage",
          startDate: "2026-05-01",
          dayCount: 60,
          reviewOffsets: [1, 2, 4, 7, 15, 30],
          createdAt: "2026-05-01T00:00:00.000Z",
        },
      ],
      knowledgeItems: [
        {
          id: "knowledge_1",
          planId: "plan_1",
          title: "word",
          tags: ["English"],
          noteMarkdown: "",
          firstDate: "2026-05-07",
          createdAt: "2026-05-07T00:00:00.000Z",
          updatedAt: "2026-05-07T00:00:00.000Z",
        },
      ],
      scheduleEntries: [
        {
          id: "remedial_orphan_plan",
          planId: "plan_deleted",
          knowledgeId: "knowledge_1",
          date: "2026-05-09",
          kind: "remedial",
          completed: false,
          createdAt: "2026-05-07T08:00:00.000Z",
        },
        {
          id: "remedial_orphan_knowledge",
          planId: "plan_1",
          knowledgeId: "knowledge_deleted",
          date: "2026-05-09",
          kind: "remedial",
          completed: false,
          createdAt: "2026-05-07T08:00:00.000Z",
        },
        {
          id: "remedial_valid",
          planId: "plan_1",
          knowledgeId: "knowledge_1",
          date: "2026-05-09",
          kind: "remedial",
          completed: false,
          createdAt: "2026-05-07T08:00:00.000Z",
        },
      ],
      activePlanId: "plan_1",
    });

    const remedialEntries = data.scheduleEntries.filter((entry) => entry.kind === "remedial");
    expect(remedialEntries).toHaveLength(1);
    expect(remedialEntries[0].id).toBe("remedial_valid");
  });

  it("backfills createdAt for remedial entries missing it", () => {
    const data = migrateAppData({
      schemaVersion: 5,
      plans: [
        {
          id: "plan_1",
          name: "English",
          kind: "learning",
          themeId: "sage",
          startDate: "2026-05-01",
          dayCount: 60,
          reviewOffsets: [1, 2, 4, 7, 15, 30],
          createdAt: "2026-05-01T00:00:00.000Z",
        },
      ],
      knowledgeItems: [
        {
          id: "knowledge_1",
          planId: "plan_1",
          title: "word",
          tags: ["English"],
          noteMarkdown: "",
          firstDate: "2026-05-07",
          createdAt: "2026-05-07T00:00:00.000Z",
          updatedAt: "2026-05-07T00:00:00.000Z",
        },
      ],
      scheduleEntries: [
        {
          id: "remedial_no_created",
          planId: "plan_1",
          knowledgeId: "knowledge_1",
          date: "2026-05-12",
          kind: "remedial",
          completed: false,
        },
      ],
      activePlanId: "plan_1",
    });

    const remedialEntries = data.scheduleEntries.filter((entry) => entry.kind === "remedial");
    expect(remedialEntries).toHaveLength(1);
    expect(remedialEntries[0].createdAt).toBe("2026-05-12T00:00:00.000Z");
  });

  it("generates an id for remedial entries missing one", () => {
    const data = migrateAppData({
      schemaVersion: 5,
      plans: [
        {
          id: "plan_1",
          name: "English",
          kind: "learning",
          themeId: "sage",
          startDate: "2026-05-01",
          dayCount: 60,
          reviewOffsets: [1, 2, 4, 7, 15, 30],
          createdAt: "2026-05-01T00:00:00.000Z",
        },
      ],
      knowledgeItems: [
        {
          id: "knowledge_1",
          planId: "plan_1",
          title: "word",
          tags: ["English"],
          noteMarkdown: "",
          firstDate: "2026-05-07",
          createdAt: "2026-05-07T00:00:00.000Z",
          updatedAt: "2026-05-07T00:00:00.000Z",
        },
      ],
      scheduleEntries: [
        {
          planId: "plan_1",
          knowledgeId: "knowledge_1",
          date: "2026-05-12",
          kind: "remedial",
          completed: false,
          createdAt: "2026-05-07T08:00:00.000Z",
        },
      ],
      activePlanId: "plan_1",
    });

    const remedialEntries = data.scheduleEntries.filter((entry) => entry.kind === "remedial");
    expect(remedialEntries).toHaveLength(1);
    expect(remedialEntries[0].id).toMatch(/^entry_/);
  });

  it("normalizes invalid feedback on remedial entries", () => {
    const data = migrateAppData({
      schemaVersion: 5,
      plans: [
        {
          id: "plan_1",
          name: "English",
          kind: "learning",
          themeId: "sage",
          startDate: "2026-05-01",
          dayCount: 60,
          reviewOffsets: [1, 2, 4, 7, 15, 30],
          createdAt: "2026-05-01T00:00:00.000Z",
        },
      ],
      knowledgeItems: [
        {
          id: "knowledge_1",
          planId: "plan_1",
          title: "word",
          tags: ["English"],
          noteMarkdown: "",
          firstDate: "2026-05-07",
          createdAt: "2026-05-07T00:00:00.000Z",
          updatedAt: "2026-05-07T00:00:00.000Z",
        },
      ],
      scheduleEntries: [
        {
          id: "remedial_bad_feedback",
          planId: "plan_1",
          knowledgeId: "knowledge_1",
          date: "2026-05-10",
          kind: "remedial",
          completed: false,
          adaptiveFeedback: "invalid_value",
          createdAt: "2026-05-07T08:00:00.000Z",
        },
      ],
      activePlanId: "plan_1",
    });

    const remedialEntries = data.scheduleEntries.filter((entry) => entry.kind === "remedial");
    expect(remedialEntries).toHaveLength(1);
    expect(remedialEntries[0].adaptiveFeedback).toBeUndefined();
  });
});
