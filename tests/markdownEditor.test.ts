import { describe, expect, it } from "vitest";
import { createMarkdownManager, normalizeMarkdown } from "../src/ui/markdownEditorConfig";

describe("markdown editor document model", () => {
  it("round-trips common Markdown blocks and marks", () => {
    const manager = createMarkdownManager();
    const markdown = [
      "# 一级标题",
      "",
      "## 二级标题",
      "",
      "正文 **加粗** *斜体* ~~删除~~ `代码` [链接](https://example.com)",
      "",
      "- 无序一",
      "- 无序二",
      "",
      "1. 有序一",
      "2. 有序二",
      "",
      "> 引用内容",
      "",
      "- [x] 已完成",
      "- [ ] 未完成",
      "",
      "| A | B |",
      "| --- | --- |",
      "| 1 | 2 |",
    ].join("\n");

    const result = normalizeMarkdown(manager.serialize(manager.parse(markdown)));

    expect(result).toContain("# 一级标题");
    expect(result).toContain("## 二级标题");
    expect(result).toContain("**加粗**");
    expect(result).toContain("*斜体*");
    expect(result).toContain("~~删除~~");
    expect(result).toContain("`代码`");
    expect(result).toContain("[链接](https://example.com)");
    expect(result).toContain("- 无序一");
    expect(result).toContain("1. 有序一");
    expect(result).toContain("> 引用内容");
    expect(result).toContain("- [x] 已完成");
    expect(result).toContain("- [ ] 未完成");
    expect(result).toContain("| A");
    expect(result).toContain("| 1");
  });

  it("keeps fenced code blocks as literal Markdown text", () => {
    const manager = createMarkdownManager();
    const markdown = ["```ts", "# not a heading", "- not a list", "```"].join("\n");

    const result = normalizeMarkdown(manager.serialize(manager.parse(markdown)));

    expect(result).toContain("```");
    expect(result).toContain("# not a heading");
    expect(result).toContain("- not a list");
  });
});
