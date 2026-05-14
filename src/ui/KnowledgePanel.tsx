import { ChevronDown, ExternalLink, Pencil, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getKnowledgeFeedbackStats } from "../domain/feedbackStats";
import { getKnowledgeProgress } from "../domain/schedule";
import type { KnowledgeItem, PlanKind, ScheduleEntry } from "../domain/types";
import { MarkdownEditor } from "./MarkdownEditor";
import { useUnsavedGuard } from "./useUnsavedGuard";

interface KnowledgePanelProps {
  knowledgeItems: KnowledgeItem[];
  scheduleEntries: ScheduleEntry[];
  title?: string;
  planKind?: PlanKind;
  showSearch?: boolean;
  emptyText?: string;
  className?: string;
  focusKnowledgeId?: string | null;
  onFocusKnowledgeConsumed?(knowledgeId: string): void;
  onUpdateNote(knowledgeId: string, noteMarkdown: string): void;
  onUpdateTitle(knowledgeId: string, title: string): void;
  onUpdateTags(knowledgeId: string, tags: string[]): void;
  onDeleteKnowledge(knowledgeId: string): void;
  onOpenNote?(knowledgeId: string): void;
}

function formatKnowledgeDateTime(value: string) {
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

interface KnowledgeTagsEditorProps {
  item: KnowledgeItem;
  defaultEditing?: boolean;
  showToggle?: boolean;
  onUpdateTags(knowledgeId: string, tags: string[]): void;
}

function splitTags(value: string) {
  return value
    .split(/[,，]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function KnowledgeTagsEditor({
  item,
  defaultEditing = false,
  showToggle = true,
  onUpdateTags,
}: KnowledgeTagsEditorProps) {
  const [draftTag, setDraftTag] = useState("");
  const [editing, setEditing] = useState(defaultEditing);
  const tags = item.tags ?? [];
  const defaultTag = tags[0];

  useEffect(() => {
    setDraftTag("");
    setEditing(defaultEditing);
  }, [defaultEditing, item.id]);

  function addTags(value = draftTag) {
    const nextTags = splitTags(value);
    if (nextTags.length === 0) return;

    onUpdateTags(item.id, [...tags, ...nextTags]);
    setDraftTag("");
  }

  function removeTag(tagToRemove: string) {
    onUpdateTags(
      item.id,
      tags.filter((tag) => tag !== tagToRemove),
    );
  }

  return (
    <div className="tag-editor">
      {showToggle ? (
        <button
        type="button"
        className="tag-editor-toggle"
        onClick={() => setEditing((current) => !current)}
      >
        {editing ? "收起标签" : "编辑标签"}
        </button>
      ) : null}
      <div className="tag-editor-body">
        <div className="tag-chip-list">
          {tags.map((tag) => {
            const locked = tag === defaultTag;
            return (
              <span className={locked ? "tag-chip locked" : "tag-chip"} key={tag}>
                {tag}
                {locked ? null : (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      removeTag(tag);
                    }}
                    aria-label={`删除标签 ${tag}`}
                  >
                    ×
                  </button>
                )}
              </span>
            );
          })}
        </div>
        {editing ? (
        <div className="tag-add-row">
          <input
            value={draftTag}
            onChange={(event) => setDraftTag(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.stopPropagation();
                addTags();
              }
              if (event.key === "Escape") {
                setDraftTag("");
                event.currentTarget.blur();
              }
            }}
            placeholder="添加标签，多个用逗号分隔"
          />
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              addTags();
            }}
          >
            添加
          </button>
        </div>
        ) : null}
      </div>
    </div>
  );
}

interface KnowledgeMetadataDialogProps {
  item: KnowledgeItem;
  itemLabel: string;
  onClose(): void;
  onUpdateTitle(knowledgeId: string, title: string): void;
  onUpdateTags(knowledgeId: string, tags: string[]): void;
}

function KnowledgeMetadataDialog({
  item,
  itemLabel,
  onClose,
  onUpdateTitle,
  onUpdateTags,
}: KnowledgeMetadataDialogProps) {
  const [draftTitle, setDraftTitle] = useState(item.title);

  useEffect(() => {
    setDraftTitle(item.title);
  }, [item.id, item.title]);

  function saveTitle() {
    const nextTitle = draftTitle.trim();
    if (nextTitle && nextTitle !== item.title) {
      onUpdateTitle(item.id, nextTitle);
    }
    onClose();
  }

  return (
    <div className="theme-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="theme-modal knowledge-meta-modal"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-knowledge-meta-title"
      >
        <header>
          <div>
            <p className="eyebrow">{itemLabel}</p>
            <h2 id="edit-knowledge-meta-title">编辑标题和标签</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="关闭">
            <X size={16} />
          </button>
        </header>

        <div className="knowledge-meta-modal-body">
          <label className="knowledge-meta-field">
            <span>标题</span>
            <input
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") saveTitle();
                if (event.key === "Escape") onClose();
              }}
              autoFocus
            />
          </label>
          <div className="knowledge-meta-field">
            <span>标签</span>
            <KnowledgeTagsEditor
              item={item}
              defaultEditing
              showToggle={false}
              onUpdateTags={onUpdateTags}
            />
          </div>
        </div>

        <footer>
          <button className="appearance-create-button" type="button" onClick={saveTitle}>
            保存
          </button>
          <button type="button" className="quiet-button" onClick={onClose}>
            取消
          </button>
        </footer>
      </section>
    </div>
  );
}

export function KnowledgePanel({
  knowledgeItems,
  scheduleEntries,
  title = "已有知识点",
  planKind = "learning",
  showSearch = true,
  emptyText = "没有匹配的知识点。",
  className = "",
  focusKnowledgeId = null,
  onFocusKnowledgeConsumed,
  onUpdateNote,
  onUpdateTitle,
  onUpdateTags,
  onDeleteKnowledge,
  onOpenNote,
}: KnowledgePanelProps) {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [deletingItem, setDeletingItem] = useState<KnowledgeItem | null>(null);
  const [editingMetadataItem, setEditingMetadataItem] = useState<KnowledgeItem | null>(null);
  const itemLabel = planKind === "task" ? "事项" : "知识点";
  const rowRefs = useRef<Map<string, HTMLElement>>(new Map());
  const guard = useUnsavedGuard();

  useEffect(() => {
    if (!focusKnowledgeId) return;
    if (!knowledgeItems.some((item) => item.id === focusKnowledgeId)) return;
    let cancelled = false;
    const scrollFocusedItem = () => {
      const element = rowRefs.current.get(focusKnowledgeId);
      if (!element) return;
      window.requestAnimationFrame(() => {
        element.scrollIntoView({ block: "center", behavior: "smooth" });
      });
    };

    if (openId === focusKnowledgeId) {
      scrollFocusedItem();
      onFocusKnowledgeConsumed?.(focusKnowledgeId);
      return undefined;
    }

    void guard.runGuarded(() => {
      setOpenId(focusKnowledgeId);
    }).then((ok) => {
      if (!ok || cancelled) return;
      scrollFocusedItem();
      onFocusKnowledgeConsumed?.(focusKnowledgeId);
    });

    return () => {
      cancelled = true;
    };
  }, [focusKnowledgeId, knowledgeItems, guard, openId, onFocusKnowledgeConsumed]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return knowledgeItems;

    return knowledgeItems.filter((item) =>
      `${item.title} ${item.noteMarkdown} ${(item.tags ?? []).join(" ")}`
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [knowledgeItems, query]);

  function toggleOpen(itemId: string) {
    void guard.runGuarded(() => {
      setOpenId((current) => (current === itemId ? null : itemId));
    });
  }

  function deleteItem(item: KnowledgeItem) {
    void guard.runGuarded(() => {
      setDeletingItem(item);
    });
  }

  function editMetadata(item: KnowledgeItem) {
    void guard.runGuarded(() => {
      setEditingMetadataItem(item);
    });
  }

  function confirmDeleteItem() {
    if (!deletingItem) return;

    onDeleteKnowledge(deletingItem.id);
    setOpenId((current) => (current === deletingItem.id ? null : current));
    setDeletingItem(null);
  }

  return (
    <aside className={`knowledge-panel ${className}`.trim()} aria-label={itemLabel}>
      <div className="section-heading compact">
        <div>
          <p className="eyebrow">{planKind === "task" ? "Tasks" : "Knowledge"}</p>
          <h2>{title}</h2>
        </div>
        <span>{knowledgeItems.length}</span>
      </div>

      {showSearch ? (
        <label className="search-box">
          <Search size={16} />
          <input
            placeholder="搜索标题、标签或笔记"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      ) : null}

      <div className="knowledge-list">
        {filteredItems.map((item) => {
          const open = openId === item.id;
          const progress = getKnowledgeProgress(item.id, scheduleEntries);
          const feedbackStats = getKnowledgeFeedbackStats(item.id, scheduleEntries);
          return (
            <article
              className={open ? "knowledge-item open" : "knowledge-item"}
              key={item.id}
              ref={(node) => {
                if (node) rowRefs.current.set(item.id, node);
                else rowRefs.current.delete(item.id);
              }}
            >
              <div className="knowledge-summary-row">
                <button className="knowledge-summary" onClick={() => toggleOpen(item.id)}>
                  <span>
                    <strong>{item.title}</strong>
                    <small>
                      {item.firstDate} · {progress.completed}/{progress.total} 完成
                    </small>
                    <small>
                      创建 {formatKnowledgeDateTime(item.createdAt)} · 修改 {formatKnowledgeDateTime(item.updatedAt)}
                    </small>
                    {planKind === "learning" ? (
                      <span className="knowledge-feedback-stats">
                        <em>记住 {feedbackStats.remembered}</em>
                        <em>遗忘 {feedbackStats.forgotten}</em>
                        <em>模糊 {feedbackStats.fuzzy}</em>
                        <em>跳过 {feedbackStats.skipped}</em>
                      </span>
                    ) : null}
                    <span className="knowledge-tags">
                      {(item.tags ?? []).slice(0, 4).map((tag) => (
                        <em key={tag}>{tag}</em>
                      ))}
                    </span>
                  </span>
                  <ChevronDown size={16} />
                </button>
                <button
                  className="knowledge-meta-edit"
                  onClick={() => editMetadata(item)}
                  aria-label="编辑标题和标签"
                  title="编辑标题和标签"
                >
                  <Pencil size={15} />
                </button>
                {onOpenNote ? (
                  <button
                    className="knowledge-open"
                    onClick={() => onOpenNote(item.id)}
                    aria-label={`打开${itemLabel}详情`}
                    title={`打开${itemLabel}详情`}
                  >
                    <ExternalLink size={15} />
                  </button>
                ) : null}
                <button
                  className="knowledge-delete"
                  onClick={() => deleteItem(item)}
                  aria-label={`删除${itemLabel}`}
                  title={`删除${itemLabel}`}
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <div className="progress-track">
                <span style={{ width: `${Math.round(progress.ratio * 100)}%` }} />
              </div>

              <div className={open ? "knowledge-detail-shell open" : "knowledge-detail-shell"} aria-hidden={!open}>
                <div className="knowledge-detail">
                  {open ? (
                    <MarkdownEditor
                      editorId={`note:${item.id}`}
                      label={item.title}
                      value={item.noteMarkdown}
                      onChange={(value) => onUpdateNote(item.id, value)}
                    />
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}

        {filteredItems.length === 0 ? <p className="quiet-line">{emptyText}</p> : null}
      </div>

      {editingMetadataItem ? (
        <KnowledgeMetadataDialog
          item={editingMetadataItem}
          itemLabel={itemLabel}
          onClose={() => setEditingMetadataItem(null)}
          onUpdateTitle={onUpdateTitle}
          onUpdateTags={onUpdateTags}
        />
      ) : null}

      {deletingItem ? (
        <div className="theme-modal-backdrop" role="presentation" onMouseDown={() => setDeletingItem(null)}>
          <section
            className="theme-modal confirm-modal"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-knowledge-title"
          >
            <header>
              <div>
                <p className="eyebrow">{planKind === "task" ? "Task" : "Knowledge"}</p>
                <h2 id="delete-knowledge-title">删除{itemLabel}</h2>
                <p>关联的安排也会一起删除。</p>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setDeletingItem(null)}
                aria-label="关闭"
              >
                <X size={16} />
              </button>
            </header>

            <div className="confirm-modal-body knowledge-confirm-body">
              <span className="knowledge-confirm-mark">
                <Trash2 size={20} />
              </span>
              <div>
                <strong>{deletingItem.title}</strong>
                <small>
                  {deletingItem.firstDate} · {(deletingItem.tags ?? []).slice(0, 3).join(" · ") || "无标签"}
                </small>
              </div>
            </div>

            <footer>
              <button className="danger-button" type="button" onClick={confirmDeleteItem}>
                <Trash2 size={14} />
                删除
              </button>
              <button type="button" className="quiet-button" onClick={() => setDeletingItem(null)}>
                取消
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </aside>
  );
}
