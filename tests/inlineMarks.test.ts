// @vitest-environment jsdom
import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";
import { createMarkdownEditorExtensions } from "../src/ui/markdownEditorConfig";

const editors: Editor[] = [];

function makeEditor(initialHtml = "<p></p>") {
  const editor = new Editor({
    extensions: createMarkdownEditorExtensions(),
    content: initialHtml,
  });
  editors.push(editor);
  return editor;
}

afterEach(() => {
  while (editors.length) {
    const editor = editors.pop();
    editor?.destroy();
  }
});

function type(editor: Editor, text: string) {
  const view = editor.view;
  for (const ch of text) {
    const { from, to } = view.state.selection;
    const handled = (view.someProp as (
      name: string,
      fn: (handler: (view: unknown, from: number, to: number, text: string) => boolean) => boolean | undefined,
    ) => boolean | undefined)(
      "handleTextInput",
      (fn) => fn(view, from, to, ch),
    );
    if (!handled) {
      const tr = view.state.tr.insertText(ch, from, to);
      view.dispatch(tr);
    }
  }
}

describe("relaxed inline marks", () => {
  it("bolds **A** at line start", () => {
    const editor = makeEditor("<p></p>");
    editor.commands.setTextSelection(1);
    type(editor, "**A**");
    expect(editor.getHTML()).toBe("<p><strong>A</strong></p>");
  });

  it("bolds **A** at the end of existing text without eating the prefix char", () => {
    const editor = makeEditor("<p>abc</p>");
    editor.commands.focus("end");
    type(editor, "**A**");
    expect(editor.getHTML()).toBe("<p>abc<strong>A</strong></p>");
  });

  it("does not carry bold mark into following typed character", () => {
    const editor = makeEditor("<p>abc</p>");
    editor.commands.focus("end");
    type(editor, "**A**Z");
    expect(editor.getHTML()).toBe("<p>abc<strong>A</strong>Z</p>");
  });

  it("applies italic with single asterisks without eating the prefix", () => {
    const editor = makeEditor("<p>abc</p>");
    editor.commands.focus("end");
    type(editor, "*i*");
    expect(editor.getHTML()).toBe("<p>abc<em>i</em></p>");
  });

  it("applies italic with underscores", () => {
    const editor = makeEditor("<p>abc</p>");
    editor.commands.focus("end");
    type(editor, "_i_");
    expect(editor.getHTML()).toBe("<p>abc<em>i</em></p>");
  });

  it("applies strike-through without eating the prefix", () => {
    const editor = makeEditor("<p>abc</p>");
    editor.commands.focus("end");
    type(editor, "~~s~~");
    expect(editor.getHTML()).toBe("<p>abc<s>s</s></p>");
  });

  it("applies inline code without eating the prefix", () => {
    const editor = makeEditor("<p>abc</p>");
    editor.commands.focus("end");
    type(editor, "`x`");
    expect(editor.getHTML()).toBe("<p>abc<code>x</code></p>");
  });

  it("handles multi-character content for bold", () => {
    const editor = makeEditor("<p></p>");
    editor.commands.setTextSelection(1);
    type(editor, "**hello world**");
    expect(editor.getHTML()).toBe("<p><strong>hello world</strong></p>");
  });

  it("does not apply bold when there is a space after the opening delimiter", () => {
    const editor = makeEditor("<p></p>");
    editor.commands.setTextSelection(1);
    type(editor, "** A**");
    // Should remain literal markdown text because of the space after **
    expect(editor.getHTML()).toContain("**");
  });
});
