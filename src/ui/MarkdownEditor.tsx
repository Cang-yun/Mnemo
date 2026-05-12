import { EditorContent, useEditor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import type { Editor } from "@tiptap/react";
import {
  Bold,
  Code,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  ListTodo,
  Minus,
  Quote,
  Strikethrough,
  Table as TableIcon,
  Unlink,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  registerEditor,
  unregisterEditor,
  updateEditor,
} from "../storage/unsavedGuard";
import { createMarkdownEditorExtensions, normalizeMarkdown } from "./markdownEditorConfig";

interface MarkdownEditorProps {
  value: string;
  onChange(value: string): void;
  editorId: string;
  label?: string;
}

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

const HEADING_LEVELS: HeadingLevel[] = [1, 2, 3, 4, 5, 6];

export function MarkdownEditor({ value, onChange, editorId, label = "笔记" }: MarkdownEditorProps) {
  const localValueRef = useRef(value);
  const [draft, setDraft] = useState(value);
  const dirty = draft !== value;
  const [linkDialog, setLinkDialog] = useState<null | { href: string; text: string; isNew: boolean }>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const extensions = useMemo(() => createMarkdownEditorExtensions(), []);

  const uploadImage = useCallback(async (file: File): Promise<string | null> => {
    const api = window.ebbinghausDesktop;
    if (api?.saveImage) {
      try {
        const data = await file.arrayBuffer();
        const result = await api.saveImage({
          data,
          mimeType: file.type,
          suggestedName: file.name,
        });
        if ("url" in result) return result.url;
        console.warn("saveImage returned error:", result.error);
        return null;
      } catch (error) {
        console.warn("Failed to save image via IPC:", error);
        return null;
      }
    }
    // Browser fallback: inline as base64 data URL.
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }, []);

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
      handlePaste(view, event) {
        const items = Array.from(event.clipboardData?.items ?? []);
        const imageItem = items.find((item) => item.type.startsWith("image/"));
        if (!imageItem) return false;
        const file = imageItem.getAsFile();
        if (!file) return false;

        event.preventDefault();
        void uploadImage(file).then((url) => {
          if (!url) {
            console.warn("Image paste: upload returned no URL");
            return;
          }
          const { state } = view;
          const imageType = state.schema.nodes.image;
          if (!imageType) return;
          const tr = state.tr.replaceSelectionWith(imageType.create({ src: url }));
          view.dispatch(tr);
          view.focus();
        });
        return true;
      },
      handleDrop(view, event, _slice, moved) {
        if (moved) return false;
        const files = Array.from(event.dataTransfer?.files ?? []).filter((file) =>
          file.type.startsWith("image/"),
        );
        if (files.length === 0) return false;

        event.preventDefault();
        const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
        if (!coords) return false;
        const basePos = coords.pos;

        void (async () => {
          const imageType = view.state.schema.nodes.image;
          if (!imageType) return;
          let insertPos = basePos;
          for (const file of files) {
            const url = await uploadImage(file);
            if (!url) continue;
            const node = imageType.create({ src: url });
            const tr = view.state.tr.insert(insertPos, node);
            view.dispatch(tr);
            insertPos += node.nodeSize;
          }
          view.focus();
        })();
        return true;
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

  const handleSave = useCallback(() => {
    onChange(draft);
  }, [draft, onChange]);

  const openLinkDialog = useCallback(() => {
    if (!editor) return;
    const attrs = editor.getAttributes("link") as { href?: string };
    const existingHref = attrs.href ?? "";
    const { from, to, empty } = editor.state.selection;
    let selectedText = "";
    if (!empty) selectedText = editor.state.doc.textBetween(from, to, " ");
    setLinkDialog({
      href: existingHref,
      text: selectedText,
      isNew: !existingHref,
    });
  }, [editor]);

  const applyLink = useCallback(
    (href: string, text: string) => {
      if (!editor) return;
      const trimmed = href.trim();
      if (!trimmed) {
        setLinkDialog(null);
        return;
      }
      const chain = editor.chain().focus();
      const { from, to, empty } = editor.state.selection;
      const nextText = text.trim();
      if (empty && nextText) {
        chain.insertContent({
          type: "text",
          text: nextText,
          marks: [{ type: "link", attrs: { href: trimmed } }],
        });
      } else if (!empty && nextText && nextText !== editor.state.doc.textBetween(from, to, " ")) {
        chain
          .deleteRange({ from, to })
          .insertContent({
            type: "text",
            text: nextText,
            marks: [{ type: "link", attrs: { href: trimmed } }],
          });
      } else {
        chain.extendMarkRange("link").setLink({ href: trimmed });
      }
      chain.run();
      setLinkDialog(null);
    },
    [editor],
  );

  const unsetLink = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setLinkDialog(null);
  }, [editor]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleImageButton = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onFilesSelected = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      event.target.value = "";
      if (!editor) return;
      for (const file of files) {
        const url = await uploadImage(file);
        if (!url) continue;
        editor.chain().focus().setImage({ src: url }).run();
      }
    },
    [editor, uploadImage],
  );

  // Keyboard shortcuts inside the editor: Mod-K opens link dialog, Mod-S saves.
  const draftRef = useRef(draft);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const editorRef = useRef<Editor | null>(null);
  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // Register with the unsaved-guard so the shell can flush/discard before
  // navigating away. The identity stays stable per editorId; dirty/label/flush
  // get patched via updateEditor on each relevant change.
  useEffect(() => {
    const flush = () => {
      onChangeRef.current(draftRef.current);
    };
    const discard = () => {
      const nextValue = valueRef.current;
      localValueRef.current = nextValue;
      setDraft(nextValue);
      editorRef.current?.commands.setContent(nextValue || "", {
        contentType: "markdown",
        emitUpdate: false,
      });
    };
    registerEditor(editorId, { dirty: false, label, flush, discard });
    return () => {
      unregisterEditor(editorId);
    };
  }, [editorId, label]);

  useEffect(() => {
    updateEditor(editorId, { dirty, label });
  }, [dirty, editorId, label]);

  useEffect(() => {
    if (!editor) return;
    const element = editor.view.dom;
    function handler(event: KeyboardEvent) {
      const mod = event.ctrlKey || event.metaKey;
      if (!mod) return;
      const key = event.key.toLowerCase();
      if (key === "k") {
        event.preventDefault();
        openLinkDialog();
      } else if (key === "s") {
        event.preventDefault();
        onChangeRef.current(draftRef.current);
      }
    }
    element.addEventListener("keydown", handler);
    return () => element.removeEventListener("keydown", handler);
  }, [editor, openLinkDialog]);

  if (!editor) {
    return <div className="markdown-editor markdown-editor-loading" />;
  }

  return (
    <div className="markdown-editor">
      <Toolbar
        editor={editor}
        onOpenLink={openLinkDialog}
        onInsertImage={handleImageButton}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={onFilesSelected}
        style={{ display: "none" }}
      />

      <BubbleMenu editor={editor} options={{ placement: "top" }}>
        <div className="markdown-bubble-menu">
          <BubbleButton
            label="加粗 (Ctrl+B)"
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold size={14} />
          </BubbleButton>
          <BubbleButton
            label="斜体 (Ctrl+I)"
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic size={14} />
          </BubbleButton>
          <BubbleButton
            label="删除线"
            active={editor.isActive("strike")}
            onClick={() => editor.chain().focus().toggleStrike().run()}
          >
            <Strikethrough size={14} />
          </BubbleButton>
          <BubbleButton
            label="行内代码"
            active={editor.isActive("code")}
            onClick={() => editor.chain().focus().toggleCode().run()}
          >
            <Code size={14} />
          </BubbleButton>
          <BubbleButton
            label={editor.isActive("link") ? "编辑链接 (Ctrl+K)" : "插入链接 (Ctrl+K)"}
            active={editor.isActive("link")}
            onClick={openLinkDialog}
          >
            <LinkIcon size={14} />
          </BubbleButton>
          {editor.isActive("link") ? (
            <BubbleButton label="取消链接" onClick={unsetLink}>
              <Unlink size={14} />
            </BubbleButton>
          ) : null}
        </div>
      </BubbleMenu>

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

      {linkDialog ? (
        <LinkDialog
          initialHref={linkDialog.href}
          initialText={linkDialog.text}
          showUnset={!linkDialog.isNew}
          onCancel={() => setLinkDialog(null)}
          onConfirm={applyLink}
          onUnset={unsetLink}
        />
      ) : null}
    </div>
  );
}

interface ToolbarProps {
  editor: Editor;
  onOpenLink(): void;
  onInsertImage(): void;
}

function Toolbar({ editor, onOpenLink, onInsertImage }: ToolbarProps) {
  const activeHeadingLevel = HEADING_LEVELS.find((level) => editor.isActive("heading", { level })) ?? 0;
  const inTable = editor.isActive("table");

  return (
    <div className="markdown-toolbar" role="toolbar" aria-label="编辑工具">
      <div className="markdown-toolbar-group" role="group" aria-label="标题">
        <select
          className="markdown-heading-select"
          value={activeHeadingLevel}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (next === 0) editor.chain().focus().setParagraph().run();
            else editor.chain().focus().setHeading({ level: next as HeadingLevel }).run();
          }}
          aria-label="标题级别"
        >
          <option value={0}>正文</option>
          <option value={1}>标题 1</option>
          <option value={2}>标题 2</option>
          <option value={3}>标题 3</option>
          <option value={4}>标题 4</option>
          <option value={5}>标题 5</option>
          <option value={6}>标题 6</option>
        </select>
      </div>

      <div className="markdown-toolbar-divider" aria-hidden="true" />

      <div className="markdown-toolbar-group" role="group" aria-label="文本格式">
        <ToolbarButton
          label="加粗 (Ctrl+B)"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold size={14} />
        </ToolbarButton>
        <ToolbarButton
          label="斜体 (Ctrl+I)"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic size={14} />
        </ToolbarButton>
        <ToolbarButton
          label="删除线"
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough size={14} />
        </ToolbarButton>
        <ToolbarButton
          label="行内代码"
          active={editor.isActive("code")}
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          <Code size={14} />
        </ToolbarButton>
      </div>

      <div className="markdown-toolbar-divider" aria-hidden="true" />

      <div className="markdown-toolbar-group" role="group" aria-label="列表">
        <ToolbarButton
          label="无序列表"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List size={14} />
        </ToolbarButton>
        <ToolbarButton
          label="有序列表"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered size={14} />
        </ToolbarButton>
        <ToolbarButton
          label="任务列表"
          active={editor.isActive("taskList")}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
        >
          <ListTodo size={14} />
        </ToolbarButton>
      </div>

      <div className="markdown-toolbar-divider" aria-hidden="true" />

      <div className="markdown-toolbar-group" role="group" aria-label="块元素">
        <ToolbarButton
          label="引用"
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote size={14} />
        </ToolbarButton>
        <ToolbarButton
          label="代码块"
          active={editor.isActive("codeBlock")}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        >
          <Code size={14} />
        </ToolbarButton>
        <ToolbarButton
          label="分割线"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        >
          <Minus size={14} />
        </ToolbarButton>
      </div>

      <div className="markdown-toolbar-divider" aria-hidden="true" />

      <div className="markdown-toolbar-group" role="group" aria-label="插入">
        <ToolbarButton label="插入链接 (Ctrl+K)" onClick={onOpenLink}>
          <LinkIcon size={14} />
        </ToolbarButton>
        <ToolbarButton label="插入图片" onClick={onInsertImage}>
          <ImageIcon size={14} />
        </ToolbarButton>
        <ToolbarButton
          label="插入表格"
          onClick={() =>
            editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
          }
        >
          <TableIcon size={14} />
        </ToolbarButton>
      </div>

      {inTable ? (
        <>
          <div className="markdown-toolbar-divider" aria-hidden="true" />
          <div className="markdown-toolbar-group" role="group" aria-label="表格操作">
            <TableTextButton onClick={() => editor.chain().focus().addRowBefore().run()}>↑行</TableTextButton>
            <TableTextButton onClick={() => editor.chain().focus().addRowAfter().run()}>↓行</TableTextButton>
            <TableTextButton onClick={() => editor.chain().focus().deleteRow().run()}>删行</TableTextButton>
            <TableTextButton onClick={() => editor.chain().focus().addColumnBefore().run()}>←列</TableTextButton>
            <TableTextButton onClick={() => editor.chain().focus().addColumnAfter().run()}>→列</TableTextButton>
            <TableTextButton onClick={() => editor.chain().focus().deleteColumn().run()}>删列</TableTextButton>
            <TableTextButton onClick={() => editor.chain().focus().deleteTable().run()}>删表</TableTextButton>
          </div>
        </>
      ) : null}
    </div>
  );
}

interface ToolbarButtonProps {
  label: string;
  active?: boolean;
  onClick(): void;
  children: React.ReactNode;
}

function ToolbarButton({ label, active, onClick, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      className={active ? "markdown-toolbar-button active" : "markdown-toolbar-button"}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

function BubbleButton({ label, active, onClick, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      className={active ? "markdown-bubble-button active" : "markdown-bubble-button"}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

interface TableTextButtonProps {
  onClick(): void;
  children: React.ReactNode;
}

function TableTextButton({ onClick, children }: TableTextButtonProps) {
  return (
    <button
      type="button"
      className="markdown-toolbar-button markdown-toolbar-text-button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

interface LinkDialogProps {
  initialHref: string;
  initialText: string;
  showUnset: boolean;
  onCancel(): void;
  onConfirm(href: string, text: string): void;
  onUnset(): void;
}

function LinkDialog({ initialHref, initialText, showUnset, onCancel, onConfirm, onUnset }: LinkDialogProps) {
  const [href, setHref] = useState(initialHref);
  const [text, setText] = useState(initialText);

  useEffect(() => {
    setHref(initialHref);
    setText(initialText);
  }, [initialHref, initialText]);

  function confirm() {
    onConfirm(href, text);
  }

  return (
    <div className="markdown-link-dialog" role="dialog" aria-modal="true" aria-label="编辑链接">
      <div className="markdown-link-dialog-inner" onMouseDown={(event) => event.stopPropagation()}>
        <label>
          <span>显示文本</span>
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="可选，留空使用链接地址"
            autoFocus={!initialText}
          />
        </label>
        <label>
          <span>链接地址</span>
          <input
            value={href}
            onChange={(event) => setHref(event.target.value)}
            placeholder="https://example.com"
            autoFocus={Boolean(initialText)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                confirm();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                onCancel();
              }
            }}
          />
        </label>
        <div className="markdown-link-dialog-actions">
          {showUnset ? (
            <button type="button" className="quiet-button" onClick={onUnset}>
              取消链接
            </button>
          ) : (
            <span />
          )}
          <div>
            <button type="button" className="quiet-button" onClick={onCancel}>
              取消
            </button>
            <button type="button" className="appearance-create-button" onClick={confirm}>
              确定
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
