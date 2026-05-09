import { describe, expect, it } from "vitest";
import { createNotebookExportFileName, createNotebookExportMarkdown } from "../src/utils/notebookExport";
import type { KnowledgeItem, Plan } from "../src/domain/types";

const plan: Plan = {
  id: "plan-1",
  name: "英语",
  kind: "learning",
  themeId: "sage",
  startDate: "2026-05-07",
  dayCount: 45,
  reviewOffsets: [1, 2, 4, 7, 15, 30],
  createdAt: "2026-05-07T00:00:00.000Z",
};

const item: KnowledgeItem = {
  id: "knowledge-1",
  planId: plan.id,
  title: "# heading-like title",
  tags: ["英语", "语法"],
  noteMarkdown: "## note\n\n**important**",
  firstDate: "2026-05-07",
  createdAt: "2026-05-07T08:00:00.000Z",
  updatedAt: "2026-05-08T09:30:00.000Z",
};

describe("notebook export", () => {
  it("creates a grouped Markdown export with knowledge metadata", () => {
    const markdown = createNotebookExportMarkdown({
      items: [item],
      plans: [plan],
      title: "语法",
      exportedAt: new Date("2026-05-09T10:00:00.000Z"),
    });

    expect(markdown).toContain("# 语法");
    expect(markdown).toContain("## 英语");
    expect(markdown).toContain("### heading-like title");
    expect(markdown).toContain("- 所属计划：英语");
    expect(markdown).toContain("- 首次添加日期：2026-05-07");
    expect(markdown).toContain("- 标签：英语、语法");
    expect(markdown).toContain("## note");
    expect(markdown).toContain("**important**");
  });

  it("sanitizes default file names", () => {
    const fileName = createNotebookExportFileName("a:b/c*tag", new Date("2026-05-09T00:00:00.000Z"));

    expect(fileName).toBe("Mnemo-abctag-2026-05-09.md");
  });
});
