import type { AppData, CloudSyncDiff, KnowledgeItem, Plan } from "./types";

export function computeCloudDiff(local: AppData, remote: AppData): CloudSyncDiff {
  const localPlanById = new Map(local.plans.map((p) => [p.id, p]));
  const remotePlanById = new Map(remote.plans.map((p) => [p.id, p]));
  const localKnowledgeById = new Map(local.knowledgeItems.map((k) => [k.id, k]));
  const remoteKnowledgeById = new Map(remote.knowledgeItems.map((k) => [k.id, k]));

  const newPlans: string[] = [];
  const deletedPlans: string[] = [];
  const modifiedPlans: string[] = [];

  for (const [id, plan] of localPlanById) {
    const remotePlan = remotePlanById.get(id);
    if (!remotePlan) {
      newPlans.push(plan.name);
    } else if (planChanged(plan, remotePlan)) {
      modifiedPlans.push(plan.name);
    }
  }
  for (const [id, plan] of remotePlanById) {
    if (!localPlanById.has(id)) {
      deletedPlans.push(plan.name);
    }
  }

  const newKnowledge: string[] = [];
  const deletedKnowledge: string[] = [];
  const modifiedKnowledge: string[] = [];
  const modifiedNotes: string[] = [];

  for (const [id, item] of localKnowledgeById) {
    const remoteItem = remoteKnowledgeById.get(id);
    if (!remoteItem) {
      newKnowledge.push(item.title);
    } else {
      if (item.title !== remoteItem.title) {
        modifiedKnowledge.push(`${remoteItem.title} → ${item.title}`);
      }
      if (item.noteMarkdown !== remoteItem.noteMarkdown) {
        modifiedNotes.push(item.title);
      }
    }
  }
  for (const [id, item] of remoteKnowledgeById) {
    if (!localKnowledgeById.has(id)) {
      deletedKnowledge.push(item.title);
    }
  }

  return { newPlans, deletedPlans, modifiedPlans, newKnowledge, deletedKnowledge, modifiedKnowledge, modifiedNotes };
}

function planChanged(a: Plan, b: Plan): boolean {
  return (
    a.name !== b.name ||
    a.kind !== b.kind ||
    a.themeId !== b.themeId ||
    a.startDate !== b.startDate ||
    a.dayCount !== b.dayCount ||
    JSON.stringify(a.reviewOffsets) !== JSON.stringify(b.reviewOffsets)
  );
}

export function getDiffSummary(diff: CloudSyncDiff) {
  const parts: string[] = [];
  const add = (n: number, label: string) => { if (n > 0) parts.push(`+${n} ${label}`); };
  const del = (n: number, label: string) => { if (n > 0) parts.push(`-${n} ${label}`); };
  const mod = (n: number, label: string) => { if (n > 0) parts.push(`*${n} ${label}`); };

  add(diff.newPlans.length, "计划");
  del(diff.deletedPlans.length, "计划");
  mod(diff.modifiedPlans.length, "计划");
  add(diff.newKnowledge.length, "知识点");
  del(diff.deletedKnowledge.length, "知识点");
  mod(diff.modifiedKnowledge.length, "知识点");
  mod(diff.modifiedNotes.length, "笔记");

  return parts.join(" / ") || "无变化";
}

export function hasDiffChanges(diff: CloudSyncDiff): boolean {
  return (
    diff.newPlans.length > 0 ||
    diff.deletedPlans.length > 0 ||
    diff.modifiedPlans.length > 0 ||
    diff.newKnowledge.length > 0 ||
    diff.deletedKnowledge.length > 0 ||
    diff.modifiedKnowledge.length > 0 ||
    diff.modifiedNotes.length > 0
  );
}
