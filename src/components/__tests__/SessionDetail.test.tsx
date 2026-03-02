import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { Session } from "../../types";
import { SessionDetail } from "../SessionDetail";

function renderSessionDetail(messages: Session["messages"]) {
  return renderToStaticMarkup(
    <SessionDetail
      session={{
        id: "session-1",
        slug: "codex/test-session",
        title: "Test Session",
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
});
