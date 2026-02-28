import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import {
  buildCodexPatchOutputContent,
  getCodexPatchEntries,
  summarizeCodexPatchEntries,
} from "../session-detail/codex-patch";
import { detectLanguageByFilePath } from "../tool-output/language";

function buildInput(content: unknown[]) {
  return { kind: "apply_patch", content };
}

describe("codex patch helpers", () => {
  it("write_file 会生成带语法高亮的 file-sections", () => {
    const entries = getCodexPatchEntries(
      buildInput([
        {
          type: "write_file",
          path: "src/foo.ts",
          old_path: null,
          input: { content: "export const foo = 1;\n" },
        },
      ]),
    );
    const output = buildCodexPatchOutputContent(entries, "fallback", detectLanguageByFilePath);

    expect(output.kind).toBe("file-sections");
    if (output.kind !== "file-sections") {
      return;
    }

    expect(output.sections).toHaveLength(1);
    expect(output.sections[0]).toEqual({
      label: "src/foo.ts",
      operation: "write",
      language: "typescript",
      isCode: true,
      text: "export const foo = 1;\n",
    });
  });

  it("edit_file 会生成 diff section", () => {
    const diffText = "Index: src/foo.ts\n--- src/foo.ts\n+++ src/foo.ts\n@@\n-old\n+new\n";
    const entries = getCodexPatchEntries(
      buildInput([
        {
          type: "edit_file",
          path: "src/foo.ts",
          old_path: null,
          input: { content: diffText },
        },
      ]),
    );
    const output = buildCodexPatchOutputContent(entries, "fallback", detectLanguageByFilePath);

    expect(output.kind).toBe("file-sections");
    if (output.kind !== "file-sections") {
      return;
    }

    expect(output.sections).toHaveLength(1);
    expect(output.sections[0]).toEqual({
      label: "src/foo.ts",
      operation: "edit",
      language: "diff",
      isCode: true,
      text: diffText,
    });
  });

  it("混合 write/edit 时保留原始顺序并正确汇总", () => {
    const entries = getCodexPatchEntries(
      buildInput([
        {
          type: "write_file",
          path: "README.md",
          old_path: null,
          input: { content: "# Title\n" },
        },
        {
          type: "edit_file",
          path: "src/foo.ts",
          old_path: null,
          input: { content: "@@\n-old\n+new\n" },
        },
        {
          type: "write_file",
          path: "config",
          old_path: null,
          input: { content: "plain-text" },
        },
      ]),
    );
    const output = buildCodexPatchOutputContent(entries, "fallback", detectLanguageByFilePath);

    expect(summarizeCodexPatchEntries(entries)).toBe("2 writes · 1 edit");
    expect(output.kind).toBe("file-sections");
    if (output.kind !== "file-sections") {
      return;
    }

    expect(output.sections.map((section) => section.label)).toEqual([
      "README.md",
      "src/foo.ts",
      "config",
    ]);
    expect(output.sections.map((section) => section.language)).toEqual([
      "markdown",
      "diff",
      "text",
    ]);
    expect(output.sections.map((section) => section.operation)).toEqual(["write", "edit", "write"]);
  });

  it("content 为空数组时回退 plain 输出", () => {
    const entries = getCodexPatchEntries(buildInput([]));
    const output = buildCodexPatchOutputContent(entries, "fallback", detectLanguageByFilePath);

    expect(entries).toEqual([]);
    expect(output).toEqual({
      kind: "plain",
      text: "fallback",
      language: "text",
      isCode: false,
    });
  });

  it("未知类型会被忽略，若全未知则回退 plain 输出", () => {
    const entries = getCodexPatchEntries(
      buildInput([
        {
          type: "rename_file",
          path: "src/foo.ts",
          old_path: "src/bar.ts",
          input: { content: "ignored" },
        },
      ]),
    );
    const output = buildCodexPatchOutputContent(entries, "fallback", detectLanguageByFilePath);

    expect(summarizeCodexPatchEntries(entries)).toBe("");
    expect(output).toEqual({
      kind: "plain",
      text: "fallback",
      language: "text",
      isCode: false,
    });
  });

  it("Dockerfile 会映射到 docker", () => {
    const entries = getCodexPatchEntries(
      buildInput([
        {
          type: "write_file",
          path: "Dockerfile",
          old_path: null,
          input: { content: "FROM node:20\n" },
        },
      ]),
    );
    const output = buildCodexPatchOutputContent(entries, "fallback", detectLanguageByFilePath);

    expect(output.kind).toBe("file-sections");
    if (output.kind !== "file-sections") {
      return;
    }

    expect(output.sections[0]?.language).toBe("docker");
  });

  it("真实样本会渲染为 3 个 section", () => {
    const sessionPath = new URL(
      "../../../data/sessions/codex/019ca3f3-9fec-7573-a8a4-77ed8ca8a431.json",
      import.meta.url,
    );
    const session = JSON.parse(readFileSync(sessionPath, "utf8")) as {
      messages?: Array<{ parts?: Array<{ tool?: string; state?: { arguments?: unknown } }> }>;
    };

    const patchPart = session.messages
      ?.flatMap((message) => message.parts || [])
      .find((part) => part.tool === "patch");
    const entries = getCodexPatchEntries(patchPart?.state?.arguments);
    const output = buildCodexPatchOutputContent(entries, "fallback", detectLanguageByFilePath);

    expect(summarizeCodexPatchEntries(entries)).toBe("2 writes · 1 edit");
    expect(output.kind).toBe("file-sections");
    if (output.kind !== "file-sections") {
      return;
    }

    expect(output.sections).toHaveLength(3);
    expect(output.sections.map((section) => section.language)).toEqual([
      "typescript",
      "typescript",
      "diff",
    ]);
  });
});
