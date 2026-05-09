import { Check, ChevronRight } from "lucide-react";
import { useState } from "react";
import { formatChineseDate } from "../domain/date";
import { getPlanTheme } from "../domain/themes";
import type { KnowledgeItem, Plan, ReviewFeedback, ScheduleEntry } from "../domain/types";

interface TodayOverviewProps {
  plans: Plan[];
  knowledgeItems: KnowledgeItem[];
  scheduleEntries: ScheduleEntry[];
  today: string;
  onOpenPlan(planId: string, date?: string): void;
  onToggleEntry(entryId: string): void;
  onCompleteEntry(entryId: string, feedback: ReviewFeedback): void;
  onPostponeEntry(entryId: string, days?: number): void;
  onSkipEntry(entryId: string): void;
}

interface TodayTaskGroup {
  title: string;
  entries: ScheduleEntry[];
  tone?: "overdue" | "done";
}

type TodayFilter = "all" | "learning" | "task";

export function TodayOverview({
  plans,
  knowledgeItems,
  scheduleEntries,
  today,
  onOpenPlan,
  onToggleEntry,
  onCompleteEntry,
  onPostponeEntry,
  onSkipEntry,
}: TodayOverviewProps) {
  const [filter, setFilter] = useState<TodayFilter>("all");
  const planById = new Map(plans.map((plan) => [plan.id, plan]));
  const itemById = new Map(knowledgeItems.map((item) => [item.id, item]));
  const dueOpenEntries = getActionableDueEntries(scheduleEntries, today);
  const overdueEntries = dueOpenEntries
    .filter((entry) => (entry.originalDate ?? entry.date) < today)
    .sort((a, b) => (a.originalDate ?? a.date).localeCompare(b.originalDate ?? b.date));
  const todayOpenEntries = dueOpenEntries.filter((entry) => (entry.originalDate ?? entry.date) >= today);
  const completedTodayEntries = scheduleEntries.filter(
    (entry) =>
      entry.completed &&
      (entry.date === today || entry.completedAt?.slice(0, 10) === today),
  );

  const filterEntries = (entries: ScheduleEntry[]) =>
    entries.filter((entry) => {
      if (filter === "all") return true;
      return planById.get(entry.planId)?.kind === filter;
    });
  const visibleOverdueEntries = filterEntries(overdueEntries);
  const visibleTodayOpenEntries = filterEntries(todayOpenEntries);
  const visibleCompletedTodayEntries = filterEntries(completedTodayEntries);
  const visibleEntries = [
    ...visibleOverdueEntries,
    ...visibleTodayOpenEntries,
    ...visibleCompletedTodayEntries,
  ];
  const completedCount = visibleCompletedTodayEntries.length;
  const knowledgeCount = knowledgeItems.filter(
    (item) => planById.get(item.planId)?.kind !== "task",
  ).length;
  const taskCount = knowledgeItems.filter(
    (item) => planById.get(item.planId)?.kind === "task",
  ).length;

  const allGroups: TodayTaskGroup[] = [
    { title: "逾期任务", entries: visibleOverdueEntries, tone: "overdue" },
    { title: "今天安排", entries: visibleTodayOpenEntries },
    { title: "已完成", entries: visibleCompletedTodayEntries, tone: "done" },
  ];
  const groups = allGroups.filter((group) => group.entries.length > 0);

  function stopTaskClick(event: React.MouseEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
  }

  function renderTask(entry: ScheduleEntry, tone?: TodayTaskGroup["tone"]) {
    const item = itemById.get(entry.knowledgeId);
    const plan = planById.get(entry.planId);
    if (!item || !plan) return null;

    const theme = getPlanTheme(plan.themeId);
    const isOverdue = tone === "overdue";

    return (
      <article
        key={entry.id}
        className={[
          "today-task",
          entry.completed ? "completed" : "",
          isOverdue ? "overdue" : "",
        ].join(" ")}
        style={
          {
            "--task-accent": theme.accent,
            "--task-strong": theme.accentStrong,
            "--task-soft": theme.accentSoft,
          } as React.CSSProperties
        }
      >
        <button
          type="button"
          className="task-check"
          onClick={(event) => {
            stopTaskClick(event);
            onToggleEntry(entry.id);
          }}
          aria-label={entry.completed ? "标记未完成" : "标记完成"}
        >
          <Check size={16} />
        </button>
        <div className="task-body" onClick={() => onOpenPlan(plan.id, entry.date)}>
          <span className={`entry-kind ${entry.kind}`}>
            {entryKindLabel(entry, plan)}
          </span>
          <strong>{item.title}</strong>
          <small>
            {plan.name}
            {isOverdue ? ` · ${formatChineseDate(entry.originalDate ?? entry.date)}` : ""}
            {entry.feedback ? ` · ${feedbackLabel(entry.feedback)}` : ""}
          </small>
        </div>
        {!entry.completed && plan.kind === "learning" ? (
          <div className="task-actions" aria-label="复习反馈">
            <button type="button" onClick={(event) => {
              stopTaskClick(event);
              onCompleteEntry(entry.id, "remembered");
            }}>
              记住
            </button>
            <button type="button" onClick={(event) => {
              stopTaskClick(event);
              onCompleteEntry(entry.id, "fuzzy");
            }}>
              模糊
            </button>
            <button type="button" onClick={(event) => {
              stopTaskClick(event);
              onCompleteEntry(entry.id, "forgotten");
            }}>
              没记住
            </button>
            <button type="button" onClick={(event) => {
              stopTaskClick(event);
              onPostponeEntry(entry.id, 1);
            }}>
              明天
            </button>
            <button type="button" onClick={(event) => {
              stopTaskClick(event);
              onSkipEntry(entry.id);
            }}>
              跳过
            </button>
          </div>
        ) : null}
        {!entry.completed && plan.kind === "task" ? (
          <div className="task-actions" aria-label="事项操作">
            <button type="button" onClick={(event) => {
              stopTaskClick(event);
              onCompleteEntry(entry.id, "remembered");
            }}>
              完成
            </button>
          </div>
        ) : null}
        <button
          type="button"
          className="task-open"
          onClick={(event) => {
            stopTaskClick(event);
            onOpenPlan(plan.id, entry.date);
          }}
          aria-label="进入计划"
        >
          <ChevronRight size={17} />
        </button>
      </article>
    );
  }

  return (
    <section className="home-page">
      <div className="hero-row">
        <div>
          <p className="eyebrow">Today</p>
          <h1>今日任务</h1>
          <p className="page-subtitle">
            {formatChineseDate(today)} · {completedCount}/{visibleEntries.length} 完成
          </p>
        </div>
        <div className="ink-wash" aria-hidden="true" />
      </div>

      <div className="today-layout">
        <section className="today-main">
          <div className="today-section-title">
            <h2>等待处理的内容</h2>
            <div className="today-filter" aria-label="今日任务筛选">
              {(["all", "learning", "task"] as const).map((item) => (
                <button
                  type="button"
                  className={filter === item ? "active" : ""}
                  key={item}
                  onClick={() => setFilter(item)}
                >
                  {item === "all" ? "全部" : item === "learning" ? "知识点" : "事项"}
                </button>
              ))}
            </div>
          </div>
          <div className="today-task-list">
            {visibleEntries.length === 0 ? (
              <div className="blank-panel">
                <h3>今天没有任务</h3>
                <p>可以去计划页新建计划，或进入某个计划添加今天的知识点/事项。</p>
              </div>
            ) : (
              groups.map((group) => (
                <section className={`today-group ${group.tone ?? ""}`.trim()} key={group.title}>
                  <header>
                    <span>{group.title}</span>
                    <small>{group.entries.length}</small>
                  </header>
                  {group.entries.map((entry) => renderTask(entry, group.tone))}
                </section>
              ))
            )}
          </div>
        </section>

        <aside className="today-summary">
          <p className="eyebrow">Overview</p>
          <strong>{plans.length}</strong>
          <span>个计划</span>
          <strong>{knowledgeCount}</strong>
          <span>个知识点</span>
          <strong>{taskCount}</strong>
          <span>个事项</span>
        </aside>
      </div>
    </section>
  );
}

function feedbackLabel(feedback: ReviewFeedback) {
  if (feedback === "remembered") return "记住了";
  if (feedback === "fuzzy") return "模糊";
  if (feedback === "forgotten") return "没记住";
  return "已跳过";
}

function entryKindLabel(entry: ScheduleEntry, plan: Plan) {
  if (plan.kind === "task") return "事项";
  if (entry.kind === "new") return "新增";
  if (entry.kind === "remedial") return "补救";
  return "复习";
}

function getActionableDueEntries(entries: ScheduleEntry[], today: string) {
  const earliestByKnowledge = new Map<string, ScheduleEntry>();

  for (const entry of entries) {
    if (entry.completed || entry.date > today) continue;

    const key = `${entry.planId}:${entry.knowledgeId}`;
    const existing = earliestByKnowledge.get(key);
    if (!existing || entry.date < existing.date) {
      earliestByKnowledge.set(key, entry);
    }
  }

  return Array.from(earliestByKnowledge.values()).sort((a, b) =>
    a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
  );
}
