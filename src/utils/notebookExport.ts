import type { KnowledgeItem, Plan } from "../domain/types";

interface NotebookExportInput {
  items: KnowledgeItem[];
  plans: Plan[];
  title: string;
  exportedAt?: Date;
}

function escapeHeading(text: string) {
  return text.replace(/^#+\s*/g, "").trim() || "未命名";
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "未知";

  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeNote(note: string) {
  const trimmed = note.trim();
  return trimmed || "_暂无笔记_";
}

export function createNotebookExportMarkdown({
  items,
  plans,
  title,
  exportedAt = new Date(),
}: NotebookExportInput) {
  const planById = new Map(plans.map((plan) => [plan.id, plan]));
  const groupedItems = new Map<string, KnowledgeItem[]>();

  for (const item of items) {
    const groupKey = item.planId;
    groupedItems.set(groupKey, [...(groupedItems.get(groupKey) ?? []), item]);
  }

  const lines = [
    `# ${escapeHeading(title)}`,
    "",
    `导出时间：${formatDateTime(exportedAt.toISOString())}`,
    `知识点数量：${items.length}`,
    "",
  ];

  const sortedGroups = Array.from(groupedItems.entries()).sort(([leftPlanId], [rightPlanId]) => {
    const leftName = planById.get(leftPlanId)?.name ?? "未归属计划";
    const rightName = planById.get(rightPlanId)?.name ?? "未归属计划";
    return leftName.localeCompare(rightName, "zh-CN");
  });

  for (const [planId, groupItems] of sortedGroups) {
    const plan = planById.get(planId);
    lines.push(`## ${escapeHeading(plan?.name ?? "未归属计划")}`, "");

    const sortedItems = [...groupItems].sort(
      (a, b) => a.firstDate.localeCompare(b.firstDate) || a.createdAt.localeCompare(b.createdAt),
    );

    for (const item of sortedItems) {
      lines.push(
        `### ${escapeHeading(item.title)}`,
        "",
        `- 所属计划：${plan?.name ?? "未归属计划"}`,
        `- 首次添加日期：${item.firstDate}`,
        `- 创建时间：${formatDateTime(item.createdAt)}`,
        `- 最后修改：${formatDateTime(item.updatedAt)}`,
        `- 标签：${(item.tags ?? []).join("、") || "无"}`,
        "",
        normalizeNote(item.noteMarkdown),
        "",
      );
    }
  }

  return `${lines.join("\n").replace(/\n{4,}/g, "\n\n\n").trim()}\n`;
}

export function createNotebookExportFileName(label: string, exportedAt = new Date()) {
  const datePart = exportedAt.toISOString().slice(0, 10);
  const safeLabel = label
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 40) || "notes";

  return `Mnemo-${safeLabel}-${datePart}.md`;
}
