import { Check, ChevronDown, ExternalLink, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { Select } from "./Select";
import { todayIso } from "../domain/date";
import {
  DEFAULT_REVIEW_OFFSETS,
  REVIEW_OFFSET_TEMPLATES,
  parseReviewOffsets,
  stringifyReviewOffsets,
} from "../domain/planInput";
import { getPlanTheme, planThemes } from "../domain/themes";
import type {
  CreatePlanInput,
  KnowledgeItem,
  Plan,
  PlanKind,
  PlanThemeId,
  ScheduleEntry,
  UpdatePlanInput,
} from "../domain/types";

interface PlansPageProps {
  plans: Plan[];
  knowledgeItems: KnowledgeItem[];
  scheduleEntries: ScheduleEntry[];
  onCreatePlan(input: CreatePlanInput): void;
  onUpdatePlan(planId: string, input: UpdatePlanInput): void;
  onDeletePlan(planId: string): void;
  onOpenPlan(planId: string): void;
}

interface PlanEditState {
  name: string;
  kind: PlanKind;
  themeId: PlanThemeId;
  startDate: string;
  dayCount: number;
  reviewTemplateId: ReviewTemplateId;
  reviewOffsetsText: string;
}

type ReviewTemplateId = "custom" | (typeof REVIEW_OFFSET_TEMPLATES)[number]["id"];

function getTemplateIdForText(value: string): ReviewTemplateId {
  const normalizedText = stringifyReviewOffsets(parseReviewOffsets(value));
  return (
    REVIEW_OFFSET_TEMPLATES.find(
      (template) => stringifyReviewOffsets([...template.offsets]) === normalizedText,
    )?.id ?? "custom"
  );
}

function getTemplateOffsetsText(templateId: string) {
  const template = REVIEW_OFFSET_TEMPLATES.find((candidate) => candidate.id === templateId);
  return template ? stringifyReviewOffsets([...template.offsets]) : null;
}

function formatReviewOffsetsForSummary(offsets: number[]) {
  return stringifyReviewOffsets(offsets);
}

/* ---------- Review template picker ---------- */

interface ReviewTemplatePickerProps {
  value: ReviewTemplateId;
  onChange(value: ReviewTemplateId): void;
}

function ReviewTemplatePicker({ value, onChange }: ReviewTemplatePickerProps) {
  const [open, setOpen] = useState(false);
  const activeTemplate = REVIEW_OFFSET_TEMPLATES.find((template) => template.id === value);
  const label = activeTemplate ? activeTemplate.name : "自定义";

  return (
    <div
      className="review-template-picker"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        type="button"
        className="review-template-button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        <span>{label}</span>
        <ChevronDown size={15} />
      </button>
      {open ? (
        <div className="review-template-menu" role="listbox">
          <button
            type="button"
            className={value === "custom" ? "active" : ""}
            onClick={() => {
              onChange("custom");
              setOpen(false);
            }}
          >
            <strong>自定义</strong>
            <small>使用右侧间隔</small>
          </button>
          {REVIEW_OFFSET_TEMPLATES.map((template) => (
            <button
              type="button"
              key={template.id}
              className={value === template.id ? "active" : ""}
              onClick={() => {
                onChange(template.id);
                setOpen(false);
              }}
            >
              <strong>{template.name}</strong>
              <small>{template.description}</small>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ---------- Main Page ---------- */

export function PlansPage({
  plans,
  knowledgeItems,
  scheduleEntries,
  onCreatePlan,
  onUpdatePlan,
  onDeletePlan,
  onOpenPlan,
}: PlansPageProps) {
  const [planName, setPlanName] = useState("");
  const [planKind, setPlanKind] = useState<PlanKind>("learning");
  const [themeId, setThemeId] = useState<PlanThemeId>("sage");
  const [startDate, setStartDate] = useState(todayIso());
  const [dayCount, setDayCount] = useState(45);
  const [reviewTemplateId, setReviewTemplateId] = useState<ReviewTemplateId>("classic");
  const [reviewOffsetsText, setReviewOffsetsText] = useState(DEFAULT_REVIEW_OFFSETS.join(", "));

  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [editState, setEditState] = useState<PlanEditState | null>(null);
  const [deletingPlan, setDeletingPlan] = useState<Plan | null>(null);

  function submitPlan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onCreatePlan({
      name: planName,
      kind: planKind,
      themeId,
      startDate,
      dayCount,
      reviewOffsets: parseReviewOffsets(reviewOffsetsText),
    });
    setPlanName("");
    setPlanKind("learning");
    setThemeId("sage");
    setStartDate(todayIso());
    setDayCount(45);
    setReviewTemplateId("classic");
    setReviewOffsetsText(DEFAULT_REVIEW_OFFSETS.join(", "));
  }

  function beginEdit(plan: Plan) {
    setEditingPlan(plan);
    setEditState({
      name: plan.name,
      kind: plan.kind,
      themeId: plan.themeId,
      startDate: plan.startDate,
      dayCount: plan.dayCount,
      reviewTemplateId: getTemplateIdForText(stringifyReviewOffsets(plan.reviewOffsets)),
      reviewOffsetsText: stringifyReviewOffsets(plan.reviewOffsets),
    });
  }

  function cancelEdit() {
    setEditingPlan(null);
    setEditState(null);
  }

  function saveEdit() {
    if (!editingPlan || !editState) return;
    onUpdatePlan(editingPlan.id, {
      name: editState.name,
      kind: editState.kind,
      themeId: editState.themeId,
      startDate: editState.startDate,
      dayCount: editState.dayCount,
      reviewOffsets: parseReviewOffsets(editState.reviewOffsetsText),
    });
    cancelEdit();
  }

  function confirmDeletePlan() {
    if (!deletingPlan) return;
    onDeletePlan(deletingPlan.id);
    setDeletingPlan(null);
  }

  return (
    <section className="plans-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Plans</p>
          <h1>计划</h1>
          <p className="page-subtitle">创建学习周期，并进入计划添加每日知识点。</p>
        </div>
      </div>

      <form className="new-plan-panel" onSubmit={submitPlan}>
        <input
          aria-label="计划名称"
          placeholder="计划名称"
          value={planName}
          onChange={(event) => setPlanName(event.target.value)}
        />
        <Select<PlanKind>
          value={planKind}
          options={[{ value: "learning", label: "学习" }, { value: "task", label: "事项" }]}
          onChange={setPlanKind}
          ariaLabel="计划类型"
        />
        <input
          aria-label="起始日期"
          type="date"
          value={startDate}
          onChange={(event) => setStartDate(event.target.value)}
        />
        <input
          aria-label="天数"
          type="number"
          min={1}
          max={365}
          value={dayCount}
          onChange={(event) => setDayCount(Number(event.target.value))}
        />
        <Select<PlanThemeId>
          value={themeId}
          options={planThemes.map((t) => ({ value: t.id, label: t.name, swatch: t.accent }))}
          onChange={setThemeId}
          ariaLabel="计划配色"
        />
        <div className="review-rule-row">
          <ReviewTemplatePicker
            value={reviewTemplateId}
            onChange={(nextTemplateId) => {
              setReviewTemplateId(nextTemplateId);
              const nextText = getTemplateOffsetsText(nextTemplateId);
              if (nextText !== null) setReviewOffsetsText(nextText);
              const template = REVIEW_OFFSET_TEMPLATES.find((candidate) => candidate.id === nextTemplateId);
              if (template) setPlanKind(template.kind);
            }}
          />
          <input
            className="review-offset-input"
            aria-label="复习间隔"
            placeholder="复习间隔：1, 2, 4, 7, 15, 30"
            value={reviewOffsetsText}
            onChange={(event) => {
              setReviewOffsetsText(event.target.value);
              setReviewTemplateId(getTemplateIdForText(event.target.value));
            }}
          />
        </div>
        <button className="primary-cta" type="submit">
          <Plus size={17} />
          新建计划
        </button>
      </form>

      <div className="plan-list">
        {plans.map((plan) => {
          const theme = getPlanTheme(plan.themeId);
          const planItems = knowledgeItems.filter((item) => item.planId === plan.id);
          const planEntries = scheduleEntries.filter((entry) => entry.planId === plan.id);
          const completed = planEntries.filter((entry) => entry.completed).length;
          const progress =
            planEntries.length === 0 ? 0 : Math.round((completed / planEntries.length) * 100);

          return (
            <article
              key={plan.id}
              className="plan-row"
              style={
                {
                  "--plan-accent": theme.accent,
                  "--plan-soft": theme.accentSoft,
                } as React.CSSProperties
              }
            >
              <span className="swatch" />
              <button className="plan-open-area" onClick={() => onOpenPlan(plan.id)}>
                <strong>{plan.name}</strong>
                <small>
                  {plan.startDate} · {plan.dayCount} 天 · {planItems.length} 个知识点 · 间隔：{formatReviewOffsetsForSummary(plan.reviewOffsets)}
                </small>
              </button>
              <div className="plan-actions">
                <span className="plan-progress">{progress}%</span>
                <button aria-label="编辑计划" onClick={() => beginEdit(plan)}>
                  <Pencil size={15} />
                </button>
                <button aria-label="进入计划" onClick={() => onOpenPlan(plan.id)}>
                  <ExternalLink size={15} />
                </button>
                <button
                  className="plan-delete"
                  aria-label="删除计划"
                  onClick={() => setDeletingPlan(plan)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </article>
          );
        })}
        {plans.length === 0 ? <p className="quiet-line">还没有计划。</p> : null}
      </div>

      {/* ---------- Edit modal ---------- */}
      {editingPlan && editState ? (
        <div className="theme-modal-backdrop" role="presentation" onMouseDown={cancelEdit}>
          <section
            className="theme-modal"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-plan-title"
          >
            <header>
              <div>
                <p className="eyebrow">Plan</p>
                <h2 id="edit-plan-title">编辑计划</h2>
                <p>修改名称、类型、日期、间隔或配色。</p>
              </div>
              <button type="button" className="icon-button" onClick={cancelEdit} aria-label="关闭">
                <X size={16} />
              </button>
            </header>

            <div className="theme-modal-body plan-edit-modal-body">
              <input
                aria-label="编辑计划名称"
                value={editState.name}
                onChange={(event) => setEditState({ ...editState, name: event.target.value })}
                placeholder="计划名称"
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <Select<PlanKind>
                  value={editState.kind}
                  options={[{ value: "learning", label: "学习" }, { value: "task", label: "事项" }]}
                  onChange={(kind) => setEditState({ ...editState, kind })}
                  ariaLabel="编辑计划类型"
                />
                <Select<PlanThemeId>
                  value={editState.themeId}
                  options={planThemes.map((t) => ({ value: t.id, label: t.name, swatch: t.accent }))}
                  onChange={(themeId) => setEditState({ ...editState, themeId })}
                  ariaLabel="编辑计划配色"
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <input
                  aria-label="编辑起始日期"
                  type="date"
                  value={editState.startDate}
                  onChange={(event) => setEditState({ ...editState, startDate: event.target.value })}
                />
                <input
                  aria-label="编辑天数"
                  type="number"
                  min={1}
                  max={365}
                  value={editState.dayCount}
                  onChange={(event) => setEditState({ ...editState, dayCount: Number(event.target.value) })}
                />
              </div>
              <div className="review-rule-row">
                <ReviewTemplatePicker
                  value={editState.reviewTemplateId}
                  onChange={(nextTemplateId) => {
                    const nextText = getTemplateOffsetsText(nextTemplateId);
                    setEditState({
                      ...editState,
                      kind: REVIEW_OFFSET_TEMPLATES.find((c) => c.id === nextTemplateId)?.kind ?? editState.kind,
                      reviewTemplateId: nextTemplateId,
                      reviewOffsetsText: nextText ?? editState.reviewOffsetsText,
                    });
                  }}
                />
                <input
                  className="review-offset-input"
                  aria-label="编辑复习间隔"
                  value={editState.reviewOffsetsText}
                  onChange={(event) =>
                    setEditState({
                      ...editState,
                      reviewTemplateId: getTemplateIdForText(event.target.value),
                      reviewOffsetsText: event.target.value,
                    })
                  }
                />
              </div>
            </div>

            <footer>
              <button type="button" className="quiet-button" onClick={cancelEdit}>
                取消
              </button>
              <button className="appearance-create-button" type="button" onClick={saveEdit}>
                <Check size={14} />
                保存修改
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      {/* ---------- Delete confirmation ---------- */}
      {deletingPlan ? (
        <div className="theme-modal-backdrop" role="presentation" onMouseDown={() => setDeletingPlan(null)}>
          <section
            className="theme-modal confirm-modal"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-plan-title"
          >
            <header>
              <div>
                <p className="eyebrow">Plan</p>
                <h2 id="delete-plan-title">删除计划</h2>
                <p>计划下的所有知识点、事项和笔记也会一起删除。</p>
              </div>
              <button type="button" className="icon-button" onClick={() => setDeletingPlan(null)} aria-label="关闭">
                <X size={16} />
              </button>
            </header>

            <div className="confirm-modal-body knowledge-confirm-body">
              <span className="knowledge-confirm-mark">
                <Trash2 size={20} />
              </span>
              <div>
                <strong>{deletingPlan.name}</strong>
                <small>
                  {deletingPlan.startDate} · {deletingPlan.dayCount} 天 · {deletingPlan.kind === "task" ? "事项" : "学习"}
                </small>
              </div>
            </div>

            <footer>
              <button type="button" className="quiet-button" onClick={() => setDeletingPlan(null)}>
                取消
              </button>
              <button className="danger-button" type="button" onClick={confirmDeletePlan}>
                <Trash2 size={14} />
                删除
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </section>
  );
}
