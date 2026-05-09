import { describe, expect, it } from "vitest";
import {
  getKnowledgeFeedbackStats,
  syncWeakKnowledgeTags,
  WEAK_KNOWLEDGE_TAG,
} from "../src/domain/feedbackStats";
import type { KnowledgeItem, ScheduleEntry } from "../src/domain/types";

const knowledge: KnowledgeItem = {
  id: "knowledge_1",
  planId: "plan_1",
  title: "word",
  tags: ["English"],
  noteMarkdown: "",
  firstDate: "2026-05-07",
  createdAt: "2026-05-07T00:00:00.000Z",
  updatedAt: "2026-05-07T00:00:00.000Z",
};

function entry(id: string, feedback: ScheduleEntry["feedback"], completed = true): ScheduleEntry {
  return {
    id,
    planId: "plan_1",
    knowledgeId: "knowledge_1",
    stepIndex: 0,
    date: "2026-05-07",
    kind: "review",
    completed,
    feedback,
    createdAt: "2026-05-07T00:00:00.000Z",
  };
}

describe("feedback stats", () => {
  it("counts completed review feedback by knowledge item", () => {
    const stats = getKnowledgeFeedbackStats("knowledge_1", [
      entry("entry_1", "remembered"),
      entry("entry_2", "forgotten"),
      entry("entry_3", "fuzzy"),
      entry("entry_4", "skipped"),
      entry("entry_5", "forgotten", false),
    ]);

    expect(stats).toMatchObject({
      remembered: 1,
      forgotten: 1,
      fuzzy: 1,
      skipped: 1,
      weak: true,
      total: 4,
    });
  });

  it("adds and removes the weak tag from forgotten or fuzzy feedback", () => {
    const withWeakTag = syncWeakKnowledgeTags([knowledge], [entry("entry_1", "forgotten")]);
    expect(withWeakTag[0].tags).toContain(WEAK_KNOWLEDGE_TAG);

    const withoutWeakTag = syncWeakKnowledgeTags(withWeakTag, [entry("entry_1", "remembered")]);
    expect(withoutWeakTag[0].tags).not.toContain(WEAK_KNOWLEDGE_TAG);
    expect(withoutWeakTag[0].tags).toContain("English");
  });
});
