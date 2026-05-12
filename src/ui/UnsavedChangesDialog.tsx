import { X } from "lucide-react";

export type UnsavedChoice = "save" | "discard" | "cancel";

interface UnsavedChangesDialogProps {
  open: boolean;
  label: string;
  allowSave?: boolean;
  onChoose(choice: UnsavedChoice): void;
}

export function UnsavedChangesDialog({ open, label, allowSave = true, onChoose }: UnsavedChangesDialogProps) {
  if (!open) return null;

  return (
    <div
      className="theme-modal-backdrop"
      role="presentation"
      onMouseDown={() => onChoose("cancel")}
    >
      <section
        className="theme-modal confirm-modal"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="unsaved-changes-title"
      >
        <header>
          <div>
            <p className="eyebrow">Note</p>
            <h2 id="unsaved-changes-title">有未保存的更改</h2>
            <p>
              {label ? `“${label}” ` : ""}里有尚未保存的笔记。你想如何处理？
            </p>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={() => onChoose("cancel")}
            aria-label="关闭"
          >
            <X size={16} />
          </button>
        </header>

        <footer>
          {allowSave ? (
            <button
              type="button"
              className="appearance-create-button"
              onClick={() => onChoose("save")}
              autoFocus
            >
              保存并继续
            </button>
          ) : (
            <button
              type="button"
              className="appearance-create-button"
              onClick={() => onChoose("cancel")}
              autoFocus
            >
              继续编辑
            </button>
          )}
          <button type="button" className="danger-button" onClick={() => onChoose("discard")}>
            放弃更改
          </button>
          {allowSave ? (
            <button type="button" className="quiet-button" onClick={() => onChoose("cancel")}>
              取消
            </button>
          ) : null}
        </footer>
      </section>
    </div>
  );
}
