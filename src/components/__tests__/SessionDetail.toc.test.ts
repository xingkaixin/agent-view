import { describe, expect, it } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Message, Session } from "../../types";
import { buildSessionDetailToc, filterSessionMessages } from "../session-detail/toc";
import { SessionDetail } from "../SessionDetail";

function createSession(messages: Message[]): Session {
  return {
    id: "session-1",
    slug: "codex/test-session",
    title: "TOC Test Session",
    directory: "/tmp",
    time_created: "2026-03-01T00:00:00.000Z",
    stats: {
      message_count: messages.length,
      total_input_tokens: 0,
      total_output_tokens: 0,
      total_cost: 0,
    },
    messages,
  };
}

function createMessages(): Message[] {
  return [
    {
      role: "user",
      time_created: "2026-03-01T00:00:00.000Z",
      parts: [{ type: "text", text: "检查 TOC 过滤" }],
    },
    {
      role: "assistant",
      time_created: "2026-03-01T00:01:00.000Z",
      parts: [
        { type: "reasoning", text: "先分析问题" },
        { type: "text", text: "这是正文" },
        {
          type: "tool",
          tool: "exec_command",
          title: "bash",
          state: {
            status: "completed",
            arguments: { cmd: "pwd" },
            output: [{ type: "text", text: "/tmp" }],
          },
        },
        {
          type: "tool",
          tool: "request_user_input",
          state: {
            status: "completed",
            arguments: {
              questions: [{ question: "继续吗？" }],
            },
            output: [{ type: "text", text: "继续" }],
          },
        },
        {
          type: "plan",
          input: "# Plan\n\n实现 TOC",
          approval_status: "success",
        },
      ],
    },
  ];
}

describe("SessionDetail TOC helpers", () => {
  it("只统计会话里实际出现过的分类和工具", () => {
    const toc = buildSessionDetailToc(createMessages());

    expect(toc.counts.user).toBe(1);
    expect(toc.counts.agent_message).toBe(1);
    expect(toc.counts.thinking).toBe(1);
    expect(toc.counts.plan).toBe(1);
    expect(toc.counts.tools_all).toBe(2);
    expect(toc.tools).toEqual([
      {
        id: "tool:exec_command",
        toolKey: "exec_command",
        label: "bash",
        count: 1,
      },
      {
        id: "tool:request_user_input",
        toolKey: "request_user_input",
        label: "request_user_input",
        count: 1,
      },
    ]);
  });

  it("关闭 tools 总开关时只隐藏 tool block，不影响同条消息中的正文", () => {
    const filtered = filterSessionMessages(
      createMessages(),
      new Set(["user", "agent_message", "thinking", "plan"]),
    );

    expect(filtered).toHaveLength(2);
    expect(filtered[1]?.blocks.map((block) => block.type)).toEqual(["reasoning", "text", "plan"]);
  });

  it("单独关闭某个工具时只裁掉该工具 part", () => {
    const filtered = filterSessionMessages(
      createMessages(),
      new Set(["user", "agent_message", "thinking", "plan", "tools_all", "tool:exec_command"]),
    );

    expect(filtered[1]?.blocks.map((block) => block.type)).toEqual([
      "reasoning",
      "text",
      "tool",
      "plan",
    ]);
    expect(filtered[1]?.blocks[2]?.parts).toHaveLength(1);
    expect(filtered[1]?.blocks[2]?.parts[0]?.tool).toBe("exec_command");
  });

  it("过滤后整条消息没有剩余 block 时直接剔除", () => {
    const filtered = filterSessionMessages(
      createMessages(),
      new Set(["tools_all", "tool:exec_command"]),
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.msg.role).toBe("assistant");
    expect(filtered[0]?.blocks).toHaveLength(1);
    expect(filtered[0]?.blocks[0]?.type).toBe("tool");
  });
});

describe("SessionDetail TOC rendering", () => {
  it("静态渲染默认输出 TOC 和当前会话分类", () => {
    const html = renderToStaticMarkup(
      createElement(SessionDetail, { session: createSession(createMessages()) }),
    );

    expect(html).toContain("Session TOC");
    expect(html).toContain("User");
    expect(html).toContain("Agent Responses");
    expect(html).toContain("Thinking");
    expect(html).toContain("Plans");
    expect(html).toContain("Tools");
    expect(html).toContain("bash");
    expect(html).toContain("request_user_input");
  });
});
