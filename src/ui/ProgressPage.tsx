import { getKnowledgeFeedbackStats } from "../domain/feedbackStats";
import { getPlanTheme } from "../domain/themes";
import type { KnowledgeItem, Plan, ScheduleEntry } from "../domain/types";

interface ProgressPageProps {
  plans: Plan[];
  knowledgeItems: KnowledgeItem[];
  scheduleEntries: ScheduleEntry[];
  onOpenPlan(planId: string): void;
}

export function ProgressPage({ plans, knowledgeItems, scheduleEntries, onOpenPlan }: ProgressPageProps) {
  const totalEntries = scheduleEntries.length;
  const completedEntries = scheduleEntries.filter((entry) => entry.completed).length;
  const totalProgress = totalEntries === 0 ? 0 : Math.round((completedEntries / totalEntries) * 100);
  const learningPlans = plans.filter((plan) => plan.kind === "learning");
  const taskPlans = plans.filter((plan) => plan.kind === "task");
  const planById = new Map(plans.map((plan) => [plan.id, plan]));
  const overdueTaskEntries = scheduleEntries.filter((entry) => {
    const plan = planById.get(entry.planId);
    return plan?.kind === "task" && !entry.completed && Boolean(entry.originalDate);
  }).length;
  const weakItems = knowledgeItems
    .map((item) => ({
      item,
      plan: planById.get(item.planId),
      stats: getKnowledgeFeedbackStats(item.id, scheduleEntries),
    }))
    .filter(({ plan, stats }) => plan?.kind === "learning" && stats.weak)
    .sort(
      (a, b) =>
        b.stats.forgotten - a.stats.forgotten ||
        b.stats.fuzzy - a.stats.fuzzy ||
        a.item.title.localeCompare(b.item.title, "zh-CN"),
    )
    .slice(0, 5);

  return (
    <section className="progress-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Progress</p>
          <h1>进度</h1>
          <p className="page-subtitle">
            总体完成度 {totalProgress}% · {completedEntries}/{totalEntries} 个任务已完成 · 学习 {learningPlans.length} · 事项 {taskPlans.length}
          </p>
        </div>
      </div>

      <div className="progress-list">
        {weakItems.length > 0 ? (
          <section className="weak-progress-section">
            <div className="section-heading compact">
              <div>
                <p className="eyebrow">Review focus</p>
                <h2>薄弱知识点</h2>
              </div>
              <span>{weakItems.length}</span>
            </div>
            <div className="weak-progress-list">
              {weakItems.map(({ item, plan, stats }) => (
                <button
                  type="button"
                  className="weak-progress-row"
                  key={item.id}
                  onClick={() => plan && onOpenPlan(plan.id)}
                >
                  <span>
                    <strong>{item.title}</strong>
                    <small>{plan?.name ?? "未归属计划"}</small>
                  </span>
                  <em>遗忘 {stats.forgotten}</em>
                  <em>模糊 {stats.fuzzy}</em>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {taskPlans.length > 0 ? <p className="quiet-line">事项逾期：{overdueTaskEntries} 个</p> : null}

        {plans.map((plan) => {
          const theme = getPlanTheme(plan.themeId);
          const planItems = knowledgeItems.filter((item) => item.planId === plan.id);
          const planEntries = scheduleEntries.filter((entry) => entry.planId === plan.id);
          const completed = planEntries.filter((entry) => entry.completed).length;
          const progress =
            planEntries.length === 0 ? 0 : Math.round((completed / planEntries.length) * 100);

          return (
            <button
              key={plan.id}
              className="progress-row"
              onClick={() => onOpenPlan(plan.id)}
              style={
                {
                  "--plan-accent": theme.accent,
                  "--plan-soft": theme.accentSoft,
                } as React.CSSProperties
              }
            >
              <span>
                <strong>{plan.name}</strong>
                <small>
                  {planItems.length} {plan.kind === "task" ? "个事项" : "个知识点"} · {completed}/{planEntries.length} 个任务
                </small>
              </span>
              <span className="progress-meter">
                <i style={{ width: `${progress}%` }} />
              </span>
              <em>{progress}%</em>
            </button>
          );
        })}
        {plans.length === 0 ? <p className="quiet-line">还没有可统计的计划。</p> : null}
      </div>
    </section>
  );
}
