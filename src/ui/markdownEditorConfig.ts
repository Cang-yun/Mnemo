import { Extension, InputRule, markPasteRule, type AnyExtension } from "@tiptap/core";
import { Markdown, MarkdownManager } from "@tiptap/markdown";
import Bold from "@tiptap/extension-bold";
import Code from "@tiptap/extension-code";
import Image from "@tiptap/extension-image";
import Italic from "@tiptap/extension-italic";
import Placeholder from "@tiptap/extension-placeholder";
import Strike from "@tiptap/extension-strike";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { TableKit } from "@tiptap/extension-table";
import StarterKit from "@tiptap/starter-kit";

// StarterKit ships inline marks with input rules that either (a) refuse to
// activate when a delimiter is inserted around existing text (bold/italic/strike
// require whitespace or line start before the opening delimiter), or (b) eat the
// preceding character when they do activate (the built-in Code rule).
//
// We disable each mark's built-in rules by re-declaring the marks with empty
// input/paste rules, and install the fixed rules in RelaxedInlineMarks.
const BoldQuiet = Bold.extend({
  addInputRules() { return []; },
  addPasteRules() { return []; },
});
const ItalicQuiet = Italic.extend({
  addInputRules() { return []; },
  addPasteRules() { return []; },
});
const StrikeQuiet = Strike.extend({
  addInputRules() { return []; },
  addPasteRules() { return []; },
});
const CodeQuiet = Code.extend({
  addInputRules() { return []; },
  addPasteRules() { return []; },
});

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

// Relaxed input/paste rules: the built-in Bold/Italic/Strike rules in StarterKit
// only match when the opening delimiter is preceded by whitespace or line start.
// Typora-style editing wraps delimiters around mid-word text as well.
//
// We also cannot use the built-in `markInputRule` for this because it deletes
// everything from `range.from` up to the content, which would also remove the
// character immediately before the opening delimiter whenever we broaden the
// prefix from `(?:^|\s)` to `(?:^|[^X])`. Instead we write a custom handler
// that precisely deletes the delimiters and applies the mark to the content.
//
// This also fixes the built-in Code rule, whose prefix `(^|[^`])` is a capturing
// group and causes the character before the opening backtick to be eaten.
function createInlineMarkRule(options: {
  find: RegExp;
  delim: string;
  markType: ReturnType<typeof schemaMarkLookup>;
}) {
  const delimLength = options.delim.length;
  const delimFirst = options.delim[0];

  return new InputRule({
    find: options.find,
    handler({ state, range, match }) {
      const markType = options.markType;
      if (!markType) return;

      const content = match[1];
      if (!content) return;

      // match[0] is "[prefix]<delim>content<delim>" where [prefix] is 0 or 1
      // characters consumed by the `(?:^|[^X])` alternation. IMPORTANT: the
      // final character of the closing delimiter is the character that
      // triggered this input rule — it has NOT been inserted into the doc yet.
      // So in the current doc, the matched text is actually match[0] minus its
      // last character, and range.to is the position just after that truncated
      // text (i.e. where the new char is about to be inserted).
      const hasPrefix = match[0][0] !== delimFirst;
      const prefixLength = hasPrefix ? 1 : 0;

      const expectedLength = prefixLength + delimLength + content.length + delimLength;
      if (match[0].length !== expectedLength) return;

      // The opening delimiter starts just past the prefix (if any).
      const openFrom = range.from + prefixLength;
      // Everything in the doc from openFrom to range.to is:
      //   <delim>content<delim minus its last char>
      // We replace all of that (and rely on returning true so the new char
      // is not inserted by the default handler) with the content wearing
      // the mark.
      const markedText = state.schema.text(content, [markType.create()]);
      const tr = state.tr.replaceWith(openFrom, range.to, markedText);
      tr.setStoredMarks([]);
    },
  });
}

// Helper used only to keep the type definition concise — returns the mark type
// or undefined if the schema does not declare it.
function schemaMarkLookup(mark: unknown) {
  return mark as import("@tiptap/pm/model").MarkType | undefined;
}

const RelaxedInlineMarks = Extension.create({
  name: "relaxedInlineMarks",

  addInputRules() {
    const { schema } = this.editor;
    const rules: InputRule[] = [];

    if (schema.marks.bold) {
      rules.push(
        createInlineMarkRule({
          find: /(?:^|[^*])\*\*(?!\s)([^*\s]|[^*\s][^*]*?[^*\s])\*\*$/,
          delim: "**",
          markType: schemaMarkLookup(schema.marks.bold),
        }),
        createInlineMarkRule({
          find: /(?:^|[^_])__(?!\s)([^_\s]|[^_\s][^_]*?[^_\s])__$/,
          delim: "__",
          markType: schemaMarkLookup(schema.marks.bold),
        }),
      );
    }

    if (schema.marks.italic) {
      rules.push(
        createInlineMarkRule({
          find: /(?:^|[^*])\*(?!\s|\*)([^*\s]|[^*\s][^*]*?[^*\s])\*$/,
          delim: "*",
          markType: schemaMarkLookup(schema.marks.italic),
        }),
        createInlineMarkRule({
          find: /(?:^|[^_])_(?!\s|_)([^_\s]|[^_\s][^_]*?[^_\s])_$/,
          delim: "_",
          markType: schemaMarkLookup(schema.marks.italic),
        }),
      );
    }

    if (schema.marks.strike) {
      rules.push(
        createInlineMarkRule({
          find: /(?:^|[^~])~~(?!\s)([^~\s]|[^~\s][^~]*?[^~\s])~~$/,
          delim: "~~",
          markType: schemaMarkLookup(schema.marks.strike),
        }),
      );
    }

    if (schema.marks.code) {
      rules.push(
        createInlineMarkRule({
          find: /(?:^|[^`])`(?!\s|`)([^`\s]|[^`\s][^`]*?[^`\s])`(?!`)$/,
          delim: "`",
          markType: schemaMarkLookup(schema.marks.code),
        }),
      );
    }

    return rules;
  },

  addPasteRules() {
    const { schema } = this.editor;
    const rules = [];

    if (schema.marks.bold) {
      rules.push(
        markPasteRule({
          find: /(?:^|[^*])(\*\*(?!\s)([^*\s]|[^*\s][^*]*?[^*\s])\*\*)/g,
          type: schema.marks.bold,
        }),
        markPasteRule({
          find: /(?:^|[^_])(__(?!\s)([^_\s]|[^_\s][^_]*?[^_\s])__)/g,
          type: schema.marks.bold,
        }),
      );
    }

    if (schema.marks.italic) {
      rules.push(
        markPasteRule({
          find: /(?:^|[^*])(\*(?!\s|\*)([^*\s]|[^*\s][^*]*?[^*\s])\*)/g,
          type: schema.marks.italic,
        }),
      );
    }

    if (schema.marks.strike) {
      rules.push(
        markPasteRule({
          find: /(?:^|[^~])(~~(?!\s)([^~\s]|[^~\s][^~]*?[^~\s])~~)/g,
          type: schema.marks.strike,
        }),
      );
    }

    if (schema.marks.code) {
      rules.push(
        markPasteRule({
          find: /(?:^|[^`])(`(?!\s|`)([^`\s]|[^`\s][^`]*?[^`\s])`)(?!`)/g,
          type: schema.marks.code,
        }),
      );
    }

    return rules;
  },
});

// Extra editor keybindings that StarterKit does not provide by default.
const EditorShortcuts = Extension.create({
  name: "editorShortcuts",

  addKeyboardShortcuts() {
    return {
      "Mod-Shift-1": () => this.editor.chain().focus().toggleHeading({ level: 1 }).run(),
      "Mod-Shift-2": () => this.editor.chain().focus().toggleHeading({ level: 2 }).run(),
      "Mod-Shift-3": () => this.editor.chain().focus().toggleHeading({ level: 3 }).run(),
      "Mod-Shift-4": () => this.editor.chain().focus().toggleHeading({ level: 4 }).run(),
      "Mod-Shift-5": () => this.editor.chain().focus().toggleHeading({ level: 5 }).run(),
      "Mod-Shift-6": () => this.editor.chain().focus().toggleHeading({ level: 6 }).run(),
      "Mod-Shift-0": () => this.editor.chain().focus().setParagraph().run(),
    };
  },
});

export function normalizeMarkdown(markdown: string) {
  return markdown
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function createMarkdownEditorExtensions(): AnyExtension[] {
  return [
    StarterKit.configure({
      heading: {
        levels: [1, 2, 3, 4, 5, 6],
      },
      // We replace the inline marks below so we can fix their input rules.
      bold: false,
      italic: false,
      strike: false,
      code: false,
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
    BoldQuiet,
    ItalicQuiet,
    StrikeQuiet,
    CodeQuiet,
    TaskList,
    TaskItem.configure({
      nested: true,
    }),
    TableKit.configure({
      table: {
        resizable: false,
      },
    }),
    Image.configure({
      inline: false,
      allowBase64: true,
      HTMLAttributes: {
        class: "markdown-image",
      },
    }),
    MarkdownLinkShortcut,
    RelaxedInlineMarks,
    EditorShortcuts,
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
