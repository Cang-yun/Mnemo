import { Download, HelpCircle, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { KnowledgeItem, Plan, ScheduleEntry } from "../domain/types";
import {
  createNotebookExportFileName,
  createNotebookExportMarkdown,
} from "../utils/notebookExport";
import { KnowledgePanel } from "./KnowledgePanel";

interface NotebookPageProps {
  plans: Plan[];
  knowledgeItems: KnowledgeItem[];
  scheduleEntries: ScheduleEntry[];
  onOpenPlan(planId: string): void;
  onUpdateNote(knowledgeId: string, noteMarkdown: string): void;
  onUpdateTitle(knowledgeId: string, title: string): void;
  onUpdateTags(knowledgeId: string, tags: string[]): void;
  onDeleteKnowledge(knowledgeId: string): void;
}

interface NotebookGroup {
  plan: Plan | null;
  items: KnowledgeItem[];
  total: number;
}

export function NotebookPage({
  plans,
  knowledgeItems,
  scheduleEntries,
  onOpenPlan,
  onUpdateNote,
  onUpdateTitle,
  onUpdateTags,
  onDeleteKnowledge,
}: NotebookPageProps) {
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const searchMode = normalizedQuery.length > 0;

  const tagSummaries = useMemo(() => {
    const tagCounts = new Map<string, number>();

    for (const item of knowledgeItems) {
      for (const tag of item.tags ?? []) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
    }

    return Array.from(tagCounts, ([tag, count]) => ({ tag, count })).sort(
      (a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "zh-CN"),
    );
  }, [knowledgeItems]);

  const visibleItems = useMemo(() => {
    if (searchMode) {
      return knowledgeItems.filter((item) =>
        `${item.title} ${item.noteMarkdown} ${(item.tags ?? []).join(" ")}`
          .toLowerCase()
          .includes(normalizedQuery),
      );
    }

    if (activeTag) {
      return knowledgeItems.filter((item) => (item.tags ?? []).includes(activeTag));
    }

    return knowledgeItems;
  }, [activeTag, knowledgeItems, normalizedQuery, searchMode]);

  const groupedPlans = useMemo<NotebookGroup[]>(() => {
    const visibleIds = new Set(visibleItems.map((item) => item.id));
    const groups = plans.map((plan) => {
      const planItems = knowledgeItems.filter((item) => item.planId === plan.id);
      const items = planItems.filter((item) => visibleIds.has(item.id));

      return {
        plan,
        items,
        total: planItems.length,
      };
    });

    const knownPlanIds = new Set(plans.map((plan) => plan.id));
    const orphanItems = knowledgeItems.filter((item) => !knownPlanIds.has(item.planId));
    const visibleOrphanItems = orphanItems.filter((item) => visibleIds.has(item.id));

    return [
      ...groups.filter((group) => group.items.length > 0),
      ...(visibleOrphanItems.length > 0
        ? [
            {
              plan: null,
              items: visibleOrphanItems,
              total: orphanItems.length,
            },
          ]
        : []),
    ];
  }, [knowledgeItems, plans, visibleItems]);

  const resultText = searchMode
    ? `搜索到 ${visibleItems.length} 条知识点/事项`
    : activeTag
      ? `标签「${activeTag}」下有 ${visibleItems.length} 条知识点/事项`
      : `当前共有 ${knowledgeItems.length} 条知识点/事项，来自 ${plans.length} 个计划。`;
  const exportItems = searchMode
    ? visibleItems
    : activeTag
      ? knowledgeItems.filter((item) => (item.tags ?? []).includes(activeTag))
      : knowledgeItems;
  const exportLabel = searchMode ? `搜索结果` : (activeTag ?? "全部笔记");

  async function exportCurrentNotes() {
    if (exportItems.length === 0) {
      setExportMessage("当前范围没有可导出的知识点/事项。");
      return;
    }

    const content = createNotebookExportMarkdown({
      items: exportItems,
      plans,
      title: `${exportLabel} - Mnemo 笔记`,
    });
    const defaultFileName = createNotebookExportFileName(exportLabel);

    if (!window.ebbinghausDesktop?.exportMarkdown) {
      const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = defaultFileName;
      link.click();
      URL.revokeObjectURL(url);
      setExportMessage(`已准备导出 ${exportItems.length} 条知识点/事项。`);
      return;
    }

    try {
      const result = await window.ebbinghausDesktop.exportMarkdown({ defaultFileName, content });
      if (result.canceled) {
        setExportMessage("已取消导出。");
        return;
      }

      setExportMessage(`已导出 ${exportItems.length} 条知识点/事项。`);
    } catch {
      setExportMessage("导出失败，请检查目标路径权限后重试。");
    }
  }

  return (
    <section className="notebook-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Notebook</p>
          <h1>笔记</h1>
          <p className="page-subtitle">按标签筛选知识点/事项；搜索时会显示所有符合的内容。</p>
        </div>
        <div className="markdown-help">
          <button className="markdown-help-trigger" type="button" aria-label="Markdown 语法说明">
            <HelpCircle size={16} />
            <span>语法说明</span>
          </button>
          <div className="markdown-help-popover" role="tooltip">
            <p className="eyebrow">Markdown editor</p>
            <h2>当前编辑逻辑</h2>
            <p>在同一个编辑区直接输入 Markdown 触发样式，内容会保存为 Markdown 文本。</p>
            <dl>
              <div>
                <dt># 到 ######</dt>
                <dd>标题层级，输入空格后转成标题。</dd>
              </div>
              <div>
                <dt>**粗体** / *斜体* / ~~删除~~</dt>
                <dd>行内标记会实时变成对应样式。</dd>
              </div>
              <div>
                <dt>-、1.、- [ ]</dt>
                <dd>无序、有序和任务列表；回车延续列表，空项回车退出。</dd>
              </div>
              <div>
                <dt>&gt;、```、---</dt>
                <dd>引用、代码块和分割线。</dd>
              </div>
              <div>
                <dt>[文字](链接)</dt>
                <dd>输入后自动变成可编辑链接；不会打开跳转。</dd>
              </div>
              <div>
                <dt>| 表格 |</dt>
                <dd>支持 GFM 表格的导入、编辑和保存。</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      <div className="notebook-layout grouped">
        <section className="notebook-groups">
          <label className="search-box notebook-search">
            <Search size={16} />
            <input
              placeholder="搜索所有标题、标签或笔记"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>

          <div className="notebook-group-list">
            {groupedPlans.map((group) => {
              const groupId = group.plan?.id ?? "orphan";
              const plan = group.plan;

              return (
                <section className="notebook-plan-group" key={groupId}>
                  <div className="notebook-plan-heading">
                    <div>
                      <p className="eyebrow">{plan ? "Plan" : "Unassigned"}</p>
                      <h2>{plan?.name ?? "未归属知识点/事项"}</h2>
                    </div>
                    {plan ? (
                      <button onClick={() => onOpenPlan(plan.id)}>进入计划</button>
                    ) : null}
                  </div>

                  <KnowledgePanel
                    className="grouped-knowledge-panel"
                    title={`${group.items.length}/${group.total} ${plan?.kind === "task" ? "个事项" : "个知识点"}`}
                    planKind={plan?.kind ?? "learning"}
                    showSearch={false}
                    emptyText={`这个计划还没有${plan?.kind === "task" ? "事项" : "知识点"}。`}
                    knowledgeItems={group.items}
                    scheduleEntries={scheduleEntries}
                    onUpdateNote={onUpdateNote}
                    onUpdateTitle={onUpdateTitle}
                    onUpdateTags={onUpdateTags}
                    onDeleteKnowledge={onDeleteKnowledge}
                  />
                </section>
              );
            })}

            {groupedPlans.length === 0 ? (
              <p className="quiet-line">暂无匹配的知识点/事项。进入计划后添加内容即可开始。</p>
            ) : null}
          </div>
        </section>

        <aside className="notebook-tag-index">
          <p className="eyebrow">Tags</p>
          <button
            className={!activeTag && !searchMode ? "active" : ""}
            onClick={() => setActiveTag(null)}
          >
            <span>全部</span>
            <small>{knowledgeItems.length}</small>
          </button>
          {tagSummaries.map(({ tag, count }) => (
            <button
              key={tag}
              className={!searchMode && activeTag === tag ? "active" : ""}
              onClick={() => setActiveTag(tag)}
            >
              <span>{tag}</span>
              <small>{count}</small>
            </button>
          ))}
          <button
            className="notebook-export-button"
            type="button"
            onClick={exportCurrentNotes}
          >
            <span>
              <Download size={14} />
              导出当前范围
            </span>
            <small>{exportItems.length}</small>
          </button>
          <p className="quiet-line">{resultText}</p>
          {exportMessage ? <p className="quiet-line export-message">{exportMessage}</p> : null}
        </aside>
      </div>
    </section>
  );
}
