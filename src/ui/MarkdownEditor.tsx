import { EditorContent, useEditor } from "@tiptap/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createMarkdownEditorExtensions, normalizeMarkdown } from "./markdownEditorConfig";

interface MarkdownEditorProps {
  value: string;
  onChange(value: string): void;
}

export function MarkdownEditor({ value, onChange }: MarkdownEditorProps) {
  const localValueRef = useRef(value);
  const [draft, setDraft] = useState(value);
  const dirty = draft !== value;

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const extensions = useMemo(() => createMarkdownEditorExtensions(), []);

  const editor = useEditor({
    extensions,
    content: value || "",
    contentType: "markdown",
    editorProps: {
      attributes: {
        class: "markdown-prosemirror",
        spellcheck: "false",
        autocapitalize: "off",
        autocomplete: "off",
        autocorrect: "off",
      },
    },
    onUpdate({ editor: activeEditor }) {
      const nextValue = normalizeMarkdown(activeEditor.getMarkdown());
      localValueRef.current = nextValue;
      setDraft(nextValue);
    },
  });

  useEffect(() => {
    if (!editor || value === localValueRef.current) return;
    localValueRef.current = value;
    setDraft(value);
    editor.commands.setContent(value || "", { contentType: "markdown", emitUpdate: false });
  }, [editor, value]);

  function handleSave() {
    onChange(draft);
  }

  return (
    <div className="markdown-editor">
      <EditorContent editor={editor} className="markdown-surface" />
      <div className="markdown-editor-footer">
        <span className="markdown-dirty-hint">
          {dirty ? "有未保存的更改" : "已保存"}
        </span>
        <button
          type="button"
          className={`markdown-save-button ${dirty ? "dirty" : ""}`}
          onClick={handleSave}
          disabled={!dirty}
        >
          保存笔记
        </button>
      </div>
    </div>
  );
}
