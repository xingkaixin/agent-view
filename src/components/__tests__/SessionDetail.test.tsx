import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { Session } from "../../types";
import { CODEX_TURN_ABORTED_TEXT } from "../session-detail/codex-abort";
import {
  getAssistantDisplayLabel,
  getSubagentPrompt,
  getSubagentToolTitle,
  SessionDetail,
} from "../SessionDetail";

function renderSessionDetail(
  messages: Session["messages"],
  slug = "codex/test-session",
  summary?: string,
) {
  return renderToStaticMarkup(
    <SessionDetail
      session={{
        id: "session-1",
        slug,
        title: "Test Session",
        summary,
        directory: "/tmp",
        time_created: "2026-03-01T00:00:00.000Z",
        stats: {
          message_count: messages.length,
          total_input_tokens: 0,
          total_output_tokens: 0,
          total_cost: 0,
        },
        messages,
      }}
    />,
  );
}

describe("SessionDetail markdown rendering", () => {
  it("codex subagent tool 标题按 agent type、nickname、model 与 reasoning_effort 组合", () => {
    expect(
      getSubagentToolTitle({
        type: "tool",
        tool: "subagent",
        nickname: "Carver",
        state: {
          arguments: {
            agent_type: "explorer",
            model: "gpt-5.4-mini",
            reasoning_effort: "medium",
          },
        },
      } as Session["messages"][number]["parts"][number]),
    ).toBe("explorer - Carver gpt-5.4-mini-medium");
  });

  it("codex subagent tool 标题缺字段时会自然收缩", () => {
    expect(
      getSubagentToolTitle({
        type: "tool",
        tool: "subagent",
        nickname: "Carver",
        state: {
          arguments: {
            agent_type: "explorer",
            model: "gpt-5.4-mini",
          },
        },
      } as Session["messages"][number]["parts"][number]),
    ).toBe("explorer - Carver gpt-5.4-mini");
  });

  it("codex subagent prompt 优先使用 state.prompt", () => {
    expect(
      getSubagentPrompt({
        type: "tool",
        tool: "subagent",
        state: {
          prompt: "检查 Zustand 迁移完成度",
          arguments: {
            message: "备用 message",
          },
        },
      } as Session["messages"][number]["parts"][number]),
    ).toBe("检查 Zustand 迁移完成度");
  });

  it("assistant 消息带 nickname 时显示 AGENT (nickname)", () => {
    expect(
      getAssistantDisplayLabel({
        role: "assistant",
        nickname: "Carver",
        time_created: "2026-03-01T00:00:00.000Z",
        parts: [],
      }),
    ).toBe("AGENT (Carver)");
  });

  it("将显式 markdown 链接渲染为不可点击的纯文本", () => {
    const html = renderSessionDetail([
      {
        role: "assistant",
        time_created: "2026-03-01T00:00:00.000Z",
        parts: [{ type: "text", text: "[OpenAI](https://openai.com)" }],
      },
    ]);

    expect(html).toContain("OpenAI");
    expect(html).toContain('class="console-markdown-link"');
    expect(html).not.toMatch(/<a(?=[\s>])/);
    expect(html).not.toContain('href="https://openai.com"');
  });

  it("用户和助手消息中的链接都不可点击", () => {
    const html = renderSessionDetail([
      {
        role: "user",
        time_created: "2026-03-01T00:00:00.000Z",
        parts: [{ type: "text", text: "[用户链接](https://example.com/user)" }],
      },
      {
        role: "assistant",
        time_created: "2026-03-01T00:01:00.000Z",
        parts: [{ type: "text", text: "[助手链接](https://example.com/assistant)" }],
      },
    ]);

    expect(html).toContain("用户链接");
    expect(html).toContain("助手链接");
    expect(html).not.toMatch(/<a(?=[\s>])/);
    expect(html).not.toContain("example.com/user");
    expect(html).not.toContain("example.com/assistant");
  });

  it("普通 markdown 元素渲染保持不变", () => {
    const html = renderSessionDetail([
      {
        role: "assistant",
        time_created: "2026-03-01T00:00:00.000Z",
        parts: [{ type: "text", text: "段落\n\n- 列表项\n\n`const answer = 42;`" }],
      },
    ]);

    expect(html).toContain("<p>段落</p>");
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>列表项</li>");
    expect(html).toContain("<code>const answer = 42;</code>");
  });

  it("同一消息的多个 text part 都按不可点击策略渲染", () => {
    const html = renderSessionDetail([
      {
        role: "assistant",
        time_created: "2026-03-01T00:00:00.000Z",
        parts: [
          { type: "text", text: "[第一段](https://example.com/one)" },
          { type: "text", text: "[第二段](https://example.com/two)" },
        ],
      },
    ]);

    expect(html).toContain("第一段");
    expect(html).toContain("第二段");
    expect(html).not.toMatch(/<a(?=[\s>])/);
    expect(html).not.toContain("example.com/one");
    expect(html).not.toContain("example.com/two");
  });

  it("codex skill 显示技能名，不显示原始 JSON 输入", () => {
    const html = renderSessionDetail([
      {
        role: "assistant",
        time_created: "2026-03-01T00:00:00.000Z",
        parts: [
          {
            type: "tool",
            tool: "skill",
            title: "skill",
            state: {
              status: "completed",
              input: {
                name: "frontend-design",
              },
            },
          },
        ],
      },
    ]);

    expect(html).toContain("skill");
    expect(html).toContain("frontend-design");
    expect(html).not.toContain('"name"');
    expect(html).not.toContain('{"name"');
  });

  it("codex subagent tool 显示格式化标题，不显示 spawn 返回 JSON", () => {
    const html = renderSessionDetail([
      {
        role: "assistant",
        time_created: "2026-03-01T00:00:00.000Z",
        parts: [
          {
            type: "tool",
            tool: "subagent",
            title: "subagent",
            nickname: "Carver",
            state: {
              status: "completed",
              arguments: {
                agent_type: "explorer",
                model: "gpt-5.4-mini",
                reasoning_effort: "medium",
                message: "检查 Zustand 迁移完成度",
              },
              output: [{ type: "text", text: '{"agent_id":"a1","nickname":"Carver"}' }],
            },
          },
        ],
      },
    ]);

    expect(html).toContain("explorer - Carver gpt-5.4-mini-medium");
    expect(html).not.toContain("&quot;agent_id&quot;");
    expect(html).not.toContain(
      "{&quot;agent_id&quot;:&quot;a1&quot;,&quot;nickname&quot;:&quot;Carver&quot;}",
    );
  });

  it("subagent assistant message 头部显示 nickname", () => {
    const html = renderSessionDetail([
      {
        role: "assistant",
        nickname: "Carver",
        time_created: "2026-03-01T00:00:00.000Z",
        parts: [{ type: "text", text: "这是 subagent 的结果" }],
      },
    ]);

    expect(html).toContain("AGENT (Carver)");
    expect(html).toContain("这是 subagent 的结果");
  });

  it("plan block 会出现在静态渲染结果中", () => {
    const html = renderSessionDetail([
      {
        role: "assistant",
        time_created: "2026-03-01T00:00:00.000Z",
        parts: [
          {
            type: "plan",
            input: "# 实施方案\n\n这里是计划正文",
            approval_status: "success",
          },
        ],
      },
    ]);

    expect(html).toContain("plan");
    expect(html).toContain("Success");
    expect(html).toContain('type="button"');
    expect(html).not.toContain("这里是计划正文");
  });

  it("无内容 plan 仍显示标题，但不包含展开区域正文", () => {
    const html = renderSessionDetail([
      {
        role: "assistant",
        time_created: "2026-03-01T00:00:00.000Z",
        parts: [
          {
            type: "plan",
            approval_status: "success",
          },
        ],
      },
    ]);

    expect(html).toContain("plan");
    expect(html).toContain("Success");
    expect(html).not.toContain('type="button"');
    expect(html).not.toContain(">Plan<");
    expect(html).not.toContain(">Rejected<");
  });

  it("失败态 plan 的 output 会按 markdown 语义渲染", () => {
    const html = renderSessionDetail([
      {
        role: "assistant",
        time_created: "2026-03-01T00:00:00.000Z",
        parts: [
          {
            type: "plan",
            output: "## 拒绝说明\n\n- 需要完整命令\n- 补充相关参数",
            approval_status: "fail",
          },
        ],
      },
    ]);

    expect(html).toContain("plan");
    expect(html).toContain("Failed");
    expect(html).toContain('type="button"');
    expect(html).not.toContain("<pre");
  });

  it("codex 中断消息显示为 abort 工具条，不展示原始文本", () => {
    const html = renderSessionDetail([
      {
        role: "user",
        time_created: "2026-03-01T00:00:00.000Z",
        parts: [{ type: "text", text: CODEX_TURN_ABORTED_TEXT }],
      },
    ]);

    expect(html).toContain("abort");
    expect(html).not.toContain("The user interrupted the previous turn on purpose.");
    expect(html).not.toContain("&lt;turn_aborted&gt;");
    expect(html).not.toContain('type="button"');
  });

  it("普通 codex 用户文本仍按原样渲染", () => {
    const html = renderSessionDetail([
      {
        role: "user",
        time_created: "2026-03-01T00:00:00.000Z",
        parts: [{ type: "text", text: "继续" }],
      },
    ]);

    expect(html).toContain("继续");
    expect(html).not.toContain("abort");
  });

  it("非 codex session 的同样文本仍按普通文本渲染", () => {
    const html = renderSessionDetail(
      [
        {
          role: "user",
          time_created: "2026-03-01T00:00:00.000Z",
          parts: [{ type: "text", text: CODEX_TURN_ABORTED_TEXT }],
        },
      ],
      "opencode/test-session",
    );

    expect(html).toContain("The user interrupted the previous turn on purpose.");
    expect(html).toContain("&lt;turn_aborted&gt;");
    expect(html).not.toContain(">abort<");
  });

  it("会话存在 summary 时在详情顶部显示摘要入口，但默认不展开正文", () => {
    const html = renderSessionDetail(
      [
        {
          role: "assistant",
          time_created: "2026-03-01T00:00:00.000Z",
          parts: [{ type: "text", text: "普通消息" }],
        },
      ],
      "codex/test-session",
      "## Summary\n\n- item one",
    );

    expect(html).toContain("Session Summary");
    expect(html).toContain("普通消息");
    expect(html).not.toContain("<h2>Summary</h2>");
  });
});
