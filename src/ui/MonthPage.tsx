import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import {
  enumerateCalendarMonth,
  formatChineseDate,
  formatMonthTitle,
  parseIsoDate,
  todayIso,
  toIsoDate,
} from "../domain/date";
import { getPlanTheme } from "../domain/themes";
import type { KnowledgeItem, Plan, ScheduleEntry } from "../domain/types";

interface MonthPageProps {
  plans: Plan[];
  knowledgeItems: KnowledgeItem[];
  scheduleEntries: ScheduleEntry[];
  onOpenPlan(planId: string, date?: string): void;
  onToggleEntry(entryId: string): void;
}

const weekdayLabels = ["日", "一", "二", "三", "四", "五", "六"];

export function MonthPage({
  plans,
  knowledgeItems,
  scheduleEntries,
  onOpenPlan,
  onToggleEntry,
}: MonthPageProps) {
  const [anchorDate, setAnchorDate] = useState(todayIso());
  const [filter, setFilter] = useState<"all" | "learning" | "task">("all");
  const dates = useMemo(() => enumerateCalendarMonth(anchorDate), [anchorDate]);
  const currentMonth = parseIsoDate(anchorDate).getMonth();
  const today = todayIso();
  const planById = new Map(plans.map((plan) => [plan.id, plan]));
  const itemById = new Map(knowledgeItems.map((item) => [item.id, item]));

  function moveMonth(offset: number) {
    const date = parseIsoDate(anchorDate);
    date.setMonth(date.getMonth() + offset);
    setAnchorDate(toIsoDate(date));
  }

  return (
    <section className="month-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Month</p>
          <h1>月任务</h1>
          <p className="page-subtitle">按日历查看所有计划的新增与复习安排。</p>
        </div>
        <div className="month-heading-actions">
          <div className="month-filter" aria-label="任务类型筛选">
            {(["all", "learning", "task"] as const).map((item) => (
              <button
                type="button"
                className={filter === item ? "active" : ""}
                key={item}
                onClick={() => setFilter(item)}
              >
                {item === "all" ? "全部" : item === "learning" ? "学习" : "事项"}
              </button>
            ))}
          </div>
          <div className="month-controls">
          <button onClick={() => moveMonth(-1)} aria-label="上个月">
            <ChevronLeft size={17} />
          </button>
          <strong>{formatMonthTitle(anchorDate)}</strong>
          <button onClick={() => moveMonth(1)} aria-label="下个月">
            <ChevronRight size={17} />
          </button>
          </div>
        </div>
      </div>

      <div className="month-calendar">
        {weekdayLabels.map((label) => (
          <div className="month-weekday" key={label}>
            {label}
          </div>
        ))}
        {dates.map((date) => {
          const dateEntries = scheduleEntries.filter((entry) => {
            if (entry.date !== date) return false;
            if (filter === "all") return true;
            return planById.get(entry.planId)?.kind === filter;
          });
          const outsideMonth = parseIsoDate(date).getMonth() !== currentMonth;
          const completed = dateEntries.filter((entry) => entry.completed).length;

          return (
            <article
              className={[
                "month-day",
                outsideMonth ? "outside" : "",
                date === today ? "today" : "",
              ].join(" ")}
              key={date}
            >
              <header>
                <span>{parseIsoDate(date).getDate()}</span>
                {dateEntries.length > 0 ? (
                  <small>
                    {completed}/{dateEntries.length}
                  </small>
                ) : null}
              </header>
              <div className="month-day-tasks">
                {dateEntries.map((entry) => {
                  const item = itemById.get(entry.knowledgeId);
                  const plan = planById.get(entry.planId);
                  if (!item || !plan) return null;
                  const theme = getPlanTheme(plan.themeId);

                  return (
                    <div
                      className={entry.completed ? "month-task completed" : "month-task"}
                      key={entry.id}
                      style={
                        {
                          "--task-accent": theme.accent,
                          "--task-soft": theme.accentSoft,
                        } as React.CSSProperties
                      }
                    >
                      <button
                        className="month-task-check"
                        disabled={entry.date !== today}
                        onClick={() => onToggleEntry(entry.id)}
                        aria-label={entry.completed ? "标记未完成" : "标记完成"}
                      >
                        <Check size={12} />
                      </button>
                      <button
                        className="month-task-title"
                        onClick={() => onOpenPlan(plan.id, date)}
                        title={`${formatChineseDate(date)} · ${plan.name} · ${item.title}`}
                      >
                        <span>{entryKindLabel(entry, plan)}</span>
                        {item.title}
                      </button>
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function entryKindLabel(entry: ScheduleEntry, plan: Plan) {
  if (plan.kind === "task") return "事项";
  if (entry.kind === "new") return "新增";
  if (entry.kind === "remedial") return "补救";
  return "复习";
}
