import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import {
  analyzeCodexBashOutput,
  buildCodexExecCommandDisplay,
  buildCodexRequestUserInputDisplay,
  buildCodexWriteStdinDisplay,
  detectLanguageFromContent,
  extractReadableFilePathFromCommand,
  stripCodexShellOutputPreamble,
  stripLineNumberPrefixes,
} from "../session-detail/codex-tool";
import { detectLanguageByFilePath } from "../tool-output/language";

interface ToolPart {
  tool?: string;
  state?: {
    arguments?: unknown;
    output?: Array<{ type?: string; text?: string }>;
  };
}

interface SessionFixture {
  messages?: Array<{ parts?: ToolPart[] }>;
}

function readSessionFixture(path: string) {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8")) as SessionFixture;
}

function findToolPart(session: SessionFixture, predicate: (part: ToolPart) => boolean) {
  return session.messages
    ?.flatMap((message) => message.parts || [])
    .find((part) => predicate(part));
}

function getFirstOutputText(part: ToolPart | undefined) {
  return (
    part?.state?.output?.find((item) => item.type === "text" && typeof item.text === "string")
      ?.text || ""
  );
}

describe("codex tool helpers", () => {
  it("共享语言映射覆盖主流常用集", () => {
    expect(detectLanguageByFilePath("tests/test_cli.py")).toBe("python");
    expect(detectLanguageByFilePath("foo.sql")).toBe("sql");
    expect(detectLanguageByFilePath("main.rs")).toBe("rust");
    expect(detectLanguageByFilePath("main.go")).toBe("go");
    expect(detectLanguageByFilePath("Main.java")).toBe("java");
    expect(detectLanguageByFilePath("foo.c")).toBe("c");
    expect(detectLanguageByFilePath("foo.h")).toBe("c");
    expect(detectLanguageByFilePath("foo.cpp")).toBe("cpp");
    expect(detectLanguageByFilePath("foo.cs")).toBe("csharp");
    expect(detectLanguageByFilePath("schema.xml")).toBe("markup");
    expect(detectLanguageByFilePath("icon.svg")).toBe("markup");
    expect(detectLanguageByFilePath("Dockerfile")).toBe("docker");
    expect(detectLanguageByFilePath(".env")).toBe("ini");
    expect(detectLanguageByFilePath(".env.production")).toBe("ini");
    expect(detectLanguageByFilePath("gradle.properties")).toBe("ini");
  });

  it("可从稳定的读文件命令里提取单一文件路径", () => {
    expect(extractReadableFilePathFromCommand("cat package.json")).toBe("package.json");
    expect(extractReadableFilePathFromCommand("sed -n '1,260p' README.md")).toBe("README.md");
    expect(extractReadableFilePathFromCommand('sed -n "1,260p" src/agent_dump/cli.py')).toBe(
      "src/agent_dump/cli.py",
    );
    expect(extractReadableFilePathFromCommand("head -n 20 vite.config.ts")).toBe("vite.config.ts");
    expect(extractReadableFilePathFromCommand("tail -n 10 src/foo.ts")).toBe("src/foo.ts");
    expect(extractReadableFilePathFromCommand("nl -ba src/foo.ts | sed -n '1,20p'")).toBe(
      "src/foo.ts",
    );
  });

  it("复杂或不稳定的 bash 命令不会误提取路径", () => {
    expect(extractReadableFilePathFromCommand("cat foo.ts bar.ts")).toBeNull();
    expect(extractReadableFilePathFromCommand("cat $FILE")).toBeNull();
    expect(extractReadableFilePathFromCommand("cat src/*.ts")).toBeNull();
    expect(extractReadableFilePathFromCommand("cat package.json | jq .")).toBeNull();
  });

  it("真实样本里的 completed bash 输出会去掉 Codex 头部", () => {
    const session = readSessionFixture(
      "../../../data/sessions/codex/019c8daa-9ca7-7d33-acb1-6687a121c898.json",
    );
    const part = findToolPart(
      session,
      (tool) =>
        tool.tool === "exec_command" && getFirstOutputText(tool).includes("Chunk ID: 16b04a"),
    );
    const outputText = getFirstOutputText(part);
    const display = buildCodexExecCommandDisplay(
      part?.state?.arguments,
      outputText,
      detectLanguageByFilePath,
    );

    expect(outputText.startsWith("Chunk ID:")).toBe(true);
    expect(display.outputAnalysis.text.startsWith("🔍 Running code linting...")).toBe(true);
    expect(display.outputAnalysis.text.includes("Chunk ID:")).toBe(false);
    expect(display.outputAnalysis.text.includes("Original token count:")).toBe(false);
    expect(display.outputAnalysis.language).toBe("text");
  });

  it("running 状态的 bash 输出也会去掉头部", () => {
    const session = readSessionFixture(
      "../../../data/sessions/codex/019ca3f3-9fec-7573-a8a4-77ed8ca8a431.json",
    );
    const part = findToolPart(
      session,
      (tool) =>
        tool.tool === "exec_command" &&
        getFirstOutputText(tool).includes("Process running with session ID 20980"),
    );
    const display = buildCodexExecCommandDisplay(
      part?.state?.arguments,
      getFirstOutputText(part),
      detectLanguageByFilePath,
    );

    expect(
      display.outputAnalysis.text.startsWith(
        "$ bun run build:index && vite build && cp -r data dist/data",
      ),
    ).toBe(true);
    expect(display.outputAnalysis.text.includes("Process running with session ID")).toBe(false);
    expect(display.outputAnalysis.language).toBe("text");
  });

  it("真实样本里的 cat/sed 输出会按文件路径高亮", () => {
    const session = readSessionFixture(
      "../../../data/sessions/codex/019ca3f3-9fec-7573-a8a4-77ed8ca8a431.json",
    );
    const packageJsonPart = findToolPart(
      session,
      (tool) =>
        tool.tool === "exec_command" &&
        (tool.state?.arguments as { cmd?: string } | undefined)?.cmd === "cat package.json",
    );
    const tsConfigPart = findToolPart(
      session,
      (tool) =>
        tool.tool === "exec_command" &&
        (tool.state?.arguments as { cmd?: string } | undefined)?.cmd === "cat vite.config.ts",
    );
    const readmePart = findToolPart(
      session,
      (tool) =>
        tool.tool === "exec_command" &&
        (tool.state?.arguments as { cmd?: string } | undefined)?.cmd ===
          "sed -n '1,220p' README.md",
    );

    const packageDisplay = buildCodexExecCommandDisplay(
      packageJsonPart?.state?.arguments,
      getFirstOutputText(packageJsonPart),
      detectLanguageByFilePath,
    );
    const viteDisplay = buildCodexExecCommandDisplay(
      tsConfigPart?.state?.arguments,
      getFirstOutputText(tsConfigPart),
      detectLanguageByFilePath,
    );
    const readmeDisplay = buildCodexExecCommandDisplay(
      readmePart?.state?.arguments,
      getFirstOutputText(readmePart),
      detectLanguageByFilePath,
    );

    expect(packageDisplay.outputAnalysis.language).toBe("json");
    expect(packageDisplay.outputAnalysis.isCode).toBe(true);
    expect(viteDisplay.outputAnalysis.language).toBe("typescript");
    expect(viteDisplay.outputAnalysis.isCode).toBe(true);
    expect(readmeDisplay.outputAnalysis.language).toBe("markdown");
    expect(readmeDisplay.outputAnalysis.isCode).toBe(true);
  });

  it("真实样本里的 python sed 输出会按文件路径高亮", () => {
    const session = readSessionFixture(
      "../../../data/sessions/codex/019c8daa-9ca7-7d33-acb1-6687a121c898.json",
    );
    const part = findToolPart(
      session,
      (tool) =>
        tool.tool === "exec_command" &&
        (tool.state?.arguments as { cmd?: string } | undefined)?.cmd ===
          "sed -n '1,260p' src/agent_dump/cli.py",
    );
    const display = buildCodexExecCommandDisplay(
      part?.state?.arguments,
      getFirstOutputText(part),
      detectLanguageByFilePath,
    );

    expect(display.outputAnalysis.language).toBe("python");
    expect(display.outputAnalysis.isCode).toBe(true);
  });

  it("真实样本里的 nl -ba + sed python 输出会按文件路径高亮", () => {
    const session = readSessionFixture(
      "../../../data/sessions/codex/019c8daa-9ca7-7d33-acb1-6687a121c898.json",
    );
    const part = findToolPart(
      session,
      (tool) =>
        tool.tool === "exec_command" &&
        (tool.state?.arguments as { cmd?: string } | undefined)?.cmd ===
          "nl -ba tests/test_cli.py | sed -n '1,520p'",
    );
    const display = buildCodexExecCommandDisplay(
      part?.state?.arguments,
      getFirstOutputText(part),
      detectLanguageByFilePath,
    );

    expect(display.outputAnalysis.language).toBe("python");
    expect(display.outputAnalysis.isCode).toBe(true);
    expect(display.outputAnalysis.text.startsWith('"""')).toBe(true);
    expect(display.outputAnalysis.text.includes("     1\t")).toBe(false);
  });

  it("非 Codex 头部的 exec 失败文本不会被误清洗", () => {
    const text =
      'exec_command failed: CreateProcess { message: "Rejected(\\"rejected by user\\")" }';

    expect(stripCodexShellOutputPreamble(text)).toBe(text);
  });

  it("exec_command 会生成提权摘要和固定顺序 details", () => {
    const display = buildCodexExecCommandDisplay(
      {
        cmd: "just isok",
        workdir: "/tmp/project",
        sandbox_permissions: "require_escalated",
        justification:
          "要不要允许我在沙箱外运行 `just isok`，以获取真实 lint/测试/覆盖率结果并继续修复？",
      },
      "Chunk ID: 1\nWall time: 0.1 seconds\nProcess exited with code 0\nOriginal token count: 1\nOutput:\nAll good\n",
      detectLanguageByFilePath,
    );

    expect(display.secondaryText).toContain("要不要允许我在沙箱外运行");
    expect(display.secondaryText).toContain("just isok");
    expect(display.details.map((detail) => detail.label)).toEqual([
      "Command",
      "Workdir",
      "Escalation",
      "Justification",
    ]);
    expect(display.outputAnalysis.text).toBe("All good\n");
  });

  it("write_stdin 会显示 session 与 poll，并复用 bash 输出清洗", () => {
    const session = readSessionFixture(
      "../../../data/sessions/codex/019ca3f3-9fec-7573-a8a4-77ed8ca8a431.json",
    );
    const part = findToolPart(session, (tool) => tool.tool === "write_stdin");
    const display = buildCodexWriteStdinDisplay(
      part?.state?.arguments,
      getFirstOutputText(part),
      detectLanguageByFilePath,
    );

    expect(display.secondaryText).toBe("session #20980 · poll");
    expect(display.details).toEqual([
      { label: "Session", value: "20980" },
      { label: "Chars", value: "(empty)" },
    ]);
    expect(display.outputAnalysis.text.startsWith("✓ 2740 modules transformed.")).toBe(true);
    expect(display.outputAnalysis.text.includes("Chunk ID:")).toBe(false);
    expect(display.outputAnalysis.language).toBe("text");
  });

  it("write_stdin 在输出本身高置信可识别时允许按内容高亮", () => {
    const display = buildCodexWriteStdinDisplay(
      { session_id: 1, chars: "" },
      'Chunk ID: 1\nWall time: 0.1 seconds\nProcess exited with code 0\nOriginal token count: 1\nOutput:\n{"name":"agent-view"}\n',
      detectLanguageByFilePath,
    );

    expect(display.outputAnalysis.language).toBe("json");
    expect(display.outputAnalysis.isCode).toBe(true);
  });

  it("request_user_input 会解析问题、推荐项与答案", () => {
    const session = readSessionFixture(
      "../../../data/sessions/codex/019ca3f3-9fec-7573-a8a4-77ed8ca8a431.json",
    );
    const part = findToolPart(session, (tool) => tool.tool === "request_user_input");
    const display = buildCodexRequestUserInputDisplay(
      part?.state?.arguments,
      getFirstOutputText(part),
    );

    expect(display.secondaryText).toBe("2 questions · Tool 归类 · 顺序策略");
    expect(display.outputContent.kind).toBe("question-list");
    if (display.outputContent.kind !== "question-list") {
      return;
    }

    expect(display.outputContent.questions).toHaveLength(2);
    expect(display.outputContent.questions[0]?.answers).toEqual(["单独成组"]);
    expect(display.outputContent.questions[0]?.options[0]).toEqual({
      label: "单独成组",
      description: "新增一种 `thinking + tool` 组型，严格尊重原始 parts 组合。",
      recommended: true,
    });
  });

  it("request_user_input 的答案 JSON 解析失败时仍返回 question-list", () => {
    const display = buildCodexRequestUserInputDisplay(
      {
        questions: [
          {
            header: "展示形态",
            id: "tool_visual_binding",
            question: "如何展示？",
            options: [
              {
                label: "顺序块 (Recommended)",
                description: "保留独立组件。",
              },
            ],
          },
        ],
      },
      "not-json",
    );

    expect(display.outputContent.kind).toBe("question-list");
    if (display.outputContent.kind !== "question-list") {
      return;
    }

    expect(display.outputContent.questions[0]?.answers).toEqual([]);
    expect(display.outputContent.questions[0]?.options[0]?.recommended).toBe(true);
    expect(display.outputContent.questions[0]?.options[0]?.label).toBe("顺序块");
  });

  it("request_user_input 在没有 questions 时回退 plain 输出", () => {
    const display = buildCodexRequestUserInputDisplay({}, '{"answers":{}}');

    expect(display.outputContent).toEqual({
      kind: "plain",
      text: '{"answers":{}}',
      language: "text",
      isCode: false,
    });
  });

  it("会清洗多数带行号的代码输出", () => {
    const text = '     1\timport foo from "bar";\n     2\texport const baz = 1;\n';

    expect(stripLineNumberPrefixes(text)).toBe('import foo from "bar";\nexport const baz = 1;\n');
  });

  it("普通数字前缀文本不会被误删行号", () => {
    const text = "2026-03-01 report ready\nvalue: 1\n";

    expect(stripLineNumberPrefixes(text)).toBe(text);
  });

  it("内容兜底可识别高置信语言并忽略终端日志", () => {
    expect(detectLanguageFromContent('{"name":"agent-view"}')).toBe("json");
    expect(detectLanguageFromContent("# Title\n\n- item\n")).toBe("markdown");
    expect(detectLanguageFromContent("<div>Hello</div>")).toBe("markup");
    expect(detectLanguageFromContent("<svg><path /></svg>")).toBe("markup");
    expect(
      detectLanguageFromContent('import type { Foo } from "./foo";\nexport const a: Foo = {};\n'),
    ).toBe("typescript");
    expect(
      detectLanguageFromContent("Test Files  122 passed (122)\nCoverage report from v8\n"),
    ).toBeNull();
  });

  it("多文件 cat 与复杂命令回退纯文本", () => {
    const multiFileAnalysis = analyzeCodexBashOutput(
      "cat foo.ts bar.ts",
      "console.log('a');\nconsole.log('b');\n",
      detectLanguageByFilePath,
    );
    const complexAnalysis = analyzeCodexBashOutput(
      "cat $FILE",
      'import path from "path";\n',
      detectLanguageByFilePath,
    );

    expect(multiFileAnalysis.language).toBe("text");
    expect(multiFileAnalysis.isCode).toBe(false);
    expect(complexAnalysis.language).toBe("text");
    expect(complexAnalysis.isCode).toBe(false);
  });
});
