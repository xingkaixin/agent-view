import { describe, expect, it } from "bun:test";
import type { Message, MessagePart } from "../../types";
import { buildMessageBlocks, hasVisibleContent } from "../session-detail/blocks";

function createMessage(parts: MessagePart[]): Message {
  return {
    role: "assistant",
    time_created: "2026-02-28T00:00:00.000Z",
    parts,
  };
}

describe("buildMessageBlocks", () => {
  it("处理 thinking", () => {
    const blocks = buildMessageBlocks([{ type: "reasoning", text: "分析中" }]);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.type).toBe("reasoning");
  });

  it("按原始顺序保留 thinking + text + tool，并合并连续 tool", () => {
    const blocks = buildMessageBlocks([
      { type: "reasoning", text: "分析中" },
      { type: "text", text: "准备执行" },
      { type: "tool", tool: "exec_command" },
      { type: "tool", tool: "exec_command" },
    ]);

    expect(blocks.map((block) => block.type)).toEqual(["reasoning", "text", "tool"]);
    expect(blocks[2]?.parts).toHaveLength(2);
  });

  it("处理 text + tool", () => {
    const blocks = buildMessageBlocks([
      { type: "text", text: "准备执行" },
      { type: "tool", tool: "exec_command" },
    ]);

    expect(blocks.map((block) => block.type)).toEqual(["text", "tool"]);
  });

  it("处理纯 text", () => {
    const blocks = buildMessageBlocks([{ type: "text", text: "最终答复" }]);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.type).toBe("text");
  });

  it("处理 thinking + tool", () => {
    const blocks = buildMessageBlocks([
      { type: "reasoning", text: "分析中" },
      { type: "tool", tool: "ReadFile" },
    ]);

    expect(blocks.map((block) => block.type)).toEqual(["reasoning", "tool"]);
  });

  it("合并连续 text", () => {
    const blocks = buildMessageBlocks([
      { type: "text", text: "第一段" },
      { type: "text", text: "第二段" },
      { type: "tool", tool: "exec_command" },
    ]);

    expect(blocks).toHaveLength(2);
    expect(blocks[0]?.type).toBe("text");
    expect(blocks[0]?.parts).toHaveLength(2);
  });

  it("合并连续 reasoning", () => {
    const blocks = buildMessageBlocks([
      { type: "reasoning", text: "第一段分析" },
      { type: "reasoning", text: "第二段分析" },
      { type: "text", text: "结论" },
    ]);

    expect(blocks).toHaveLength(2);
    expect(blocks[0]?.type).toBe("reasoning");
    expect(blocks[0]?.parts).toHaveLength(2);
  });

  it("过滤空 text 和空 reasoning", () => {
    const blocks = buildMessageBlocks([
      { type: "text", text: "   " },
      { type: "reasoning", text: "" },
      { type: "tool", tool: "exec_command" },
    ]);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.type).toBe("tool");
  });

  it("顺序回归：非连续同类型不合并", () => {
    const blocks = buildMessageBlocks([
      { type: "reasoning", text: "分析中" },
      { type: "text", text: "准备执行" },
      { type: "tool", tool: "exec_command" },
      { type: "text", text: "执行完成" },
    ]);

    expect(blocks.map((block) => block.type)).toEqual(["reasoning", "text", "tool", "text"]);
  });

  it("plan 会被识别为可见 block", () => {
    const blocks = buildMessageBlocks([{ type: "plan" }]);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.type).toBe("plan");
  });

  it("plan 不会与相邻 plan 合并", () => {
    const blocks = buildMessageBlocks([{ type: "plan" }, { type: "plan" }]);

    expect(blocks).toHaveLength(2);
    expect(blocks.map((block) => block.type)).toEqual(["plan", "plan"]);
    expect(blocks[0]?.parts).toHaveLength(1);
    expect(blocks[1]?.parts).toHaveLength(1);
  });

  it("按原始顺序保留 reasoning -> plan -> text -> tool", () => {
    const blocks = buildMessageBlocks([
      { type: "reasoning", text: "分析中" },
      { type: "plan", input: "# 计划" },
      { type: "text", text: "准备执行" },
      { type: "tool", tool: "exec_command" },
    ]);

    expect(blocks.map((block) => block.type)).toEqual(["reasoning", "plan", "text", "tool"]);
  });
});

describe("hasVisibleContent", () => {
  it("全空文本且无 tool 时返回 false", () => {
    const msg = createMessage([
      { type: "reasoning", text: "" },
      { type: "text", text: "   " },
    ]);

    expect(hasVisibleContent(msg)).toBe(false);
  });

  it("存在 tool 时返回 true", () => {
    const msg = createMessage([
      { type: "reasoning", text: "" },
      { type: "tool", tool: "ReadFile" },
    ]);

    expect(hasVisibleContent(msg)).toBe(true);
  });

  it("仅有空 plan 时返回 true", () => {
    const msg = createMessage([{ type: "plan" }]);

    expect(hasVisibleContent(msg)).toBe(true);
  });
});
