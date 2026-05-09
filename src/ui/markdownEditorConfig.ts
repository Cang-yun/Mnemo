import { Extension, InputRule, type AnyExtension } from "@tiptap/core";
import { Markdown, MarkdownManager } from "@tiptap/markdown";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { TableKit } from "@tiptap/extension-table";
import StarterKit from "@tiptap/starter-kit";

const MarkdownLinkShortcut = Extension.create({
  name: "markdownLinkShortcut",

  addInputRules() {
    return [
      new InputRule({
        find: /\[([^\]]+)\]\(([^)\s]+)\)$/,
        handler({ state, range, match }) {
          const [, label, href] = match;
          const linkMark = state.schema.marks.link;

          if (!label || !href || !linkMark) return;

          state.tr.replaceWith(range.from, range.to, state.schema.text(label, [linkMark.create({ href })]));
        },
      }),
    ];
  },
});

export function normalizeMarkdown(markdown: string) {
  return markdown.replace(/\r\n/g, "\n").replace(/\n{4,}/g, "\n\n\n").trim();
}

export function createMarkdownEditorExtensions(): AnyExtension[] {
  return [
    StarterKit.configure({
      heading: {
        levels: [1, 2, 3, 4, 5, 6],
      },
      link: {
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          rel: "noopener noreferrer",
          target: "_blank",
        },
      },
    }),
    TaskList,
    TaskItem.configure({
      nested: true,
    }),
    TableKit.configure({
      table: {
        resizable: false,
      },
    }),
    MarkdownLinkShortcut,
    Placeholder.configure({
      placeholder: "写 Markdown 笔记...",
    }),
    Markdown.configure({
      markedOptions: {
        gfm: true,
        breaks: false,
      },
      indentation: {
        style: "space",
        size: 2,
      },
    }),
  ];
}

export function createMarkdownManager() {
  return new MarkdownManager({
    extensions: createMarkdownEditorExtensions(),
    markedOptions: {
      gfm: true,
      breaks: false,
    },
    indentation: {
      style: "space",
      size: 2,
    },
  });
}
