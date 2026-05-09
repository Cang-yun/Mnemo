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
});
