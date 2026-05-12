import { Check, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { enumeratePlanDates, formatChineseDate, todayIso } from "../domain/date";
import type { KnowledgeItem, Plan, ScheduleEntry } from "../domain/types";

interface DateWorkspaceProps {
  plan: Plan;
  focusDate?: string;
  knowledgeItems: KnowledgeItem[];
  scheduleEntries: ScheduleEntry[];
  onAddKnowledge(planId: string, date: string, title: string): void;
  onToggleEntry(entryId: string): void;
}

export function DateWorkspace({
  plan,
  focusDate,
  knowledgeItems,
  scheduleEntries,
  onAddKnowledge,
  onToggleEntry,
}: DateWorkspaceProps) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const itemLabel = plan.kind === "task" ? "事项" : "知识点";
  const dates = useMemo(() => enumeratePlanDates(plan.startDate, plan.dayCount), [plan]);
  const rowRefs = useRef<Record<string, HTMLElement | null>>({});
  const today = todayIso();
  const targetDate = focusDate ?? today;
  const itemById = useMemo(
    () => new Map(knowledgeItems.map((item) => [item.id, item])),
    [knowledgeItems],
  );

  // Drafts are keyed by date, but dates are shared across plans. When the
  // active plan changes we must clear any leftover drafts so typing in plan A
  // doesn't reappear in plan B on the same date.
  useEffect(() => {
    setDrafts({});
  }, [plan.id]);

  useEffect(() => {
    const targetRow = rowRefs.current[targetDate];
    if (!targetRow) return;
    window.requestAnimationFrame(() => {
      targetRow.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }, [plan.id, targetDate]);

  function submitKnowledge(event: React.FormEvent<HTMLFormElement>, date: string) {
    event.preventDefault();
    const title = drafts[date]?.trim();
    if (!title) return;

    onAddKnowledge(plan.id, date, title);
    setDrafts((current) => ({ ...current, [date]: "" }));
  }

  return (
    <section className="date-workspace" aria-label="日期工作区">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Calendar</p>
          <h2>{plan.name}</h2>
        </div>
        <p>
          {plan.startDate} 起，共 {plan.dayCount} 天
        </p>
      </div>

      <div className="date-list">
        {dates.map((date, index) => {
          const entries = scheduleEntries
            .filter((entry) => entry.date === date)
            .sort((a, b) => Number(a.kind === "review") - Number(b.kind === "review"));
          const done = entries.filter((entry) => entry.completed).length;

          return (
            <article
              className={[
                "date-row",
                date === today ? "today" : "",
                date === targetDate && date !== today ? "focused" : "",
              ].join(" ")}
              key={date}
              ref={(element) => {
                rowRefs.current[date] = element;
              }}
            >
              <div className="date-marker">
                <span>Day {index + 1}</span>
                <strong>{formatChineseDate(date)}</strong>
                {date === today ? <em>今天</em> : null}
                <small>
                  {done}/{entries.length} 完成
                </small>
              </div>

              <div className="entry-column">
                {entries.length > 0 ? (
                  entries.map((entry) => {
                    const item = itemById.get(entry.knowledgeId);
                    if (!item) return null;

                    return (
                      <button
                        type="button"
                        key={entry.id}
                        className={entry.completed ? "schedule-entry completed" : "schedule-entry"}
                        disabled={entry.date !== today}
                        onClick={() => onToggleEntry(entry.id)}
                      >
                        <span className={`entry-kind ${entry.kind}`}>
                          {entryKindLabel(entry, plan)}
                        </span>
                        <span className="entry-title">{item.title}</span>
                        <span className="entry-check" aria-hidden="true">
                          <Check size={16} />
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <p className="quiet-line">这一天还没有安排。</p>
                )}

                <form className="inline-add" onSubmit={(event) => submitKnowledge(event, date)}>
                  <input
                    aria-label={`${date} 添加${itemLabel}`}
                    placeholder={`在这一天写入${itemLabel}`}
                    value={drafts[date] ?? ""}
                    onChange={(event) =>
                      setDrafts((current) => ({ ...current, [date]: event.target.value }))
                    }
                  />
                  <button type="submit" title={`添加${itemLabel}`}>
                    <Plus size={16} />
                  </button>
                </form>
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
