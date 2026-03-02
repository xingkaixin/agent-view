import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { parseViewState, renderMainContent, resolveHeaderContent } from "../../App";
import type { LandingAgentItem, LandingSession } from "../DetailLanding";

const agentItems: LandingAgentItem[] = [
  {
    key: "codex",
    name: "Codex",
    icon: "/icon/agent/codex.svg",
    count: 1,
  },
];

const sessions: LandingSession[] = [
  {
    id: "session-1",
    slug: "codex/test-session",
    fullPath: "codex/test-session",
    agentKey: "codex",
    sessionSlug: "test-session",
    title: "Test Session",
    directory: "/tmp/project",
    time_created: Date.parse("2026-03-01T00:00:00.000Z"),
    time_updated: Date.parse("2026-03-02T00:00:00.000Z"),
    stats: {
      message_count: 3,
      total_input_tokens: 10,
      total_output_tokens: 12,
      total_cost: 0.01,
    },
  },
];

describe("App loading states", () => {
  it("未知 agent 路径会解析为 missingAgent", () => {
    expect(parseViewState("/df", new Set(["codex"]))).toEqual({
      mode: "missingAgent",
      activeAgentKey: null,
      activeSessionSlug: null,
      attemptedAgentKey: "df",
      attemptedSessionSlug: null,
    });
  });

  it("未知 agent 带 session 的路径仍解析为 missingAgent", () => {
    expect(parseViewState("/df/123", new Set(["codex"]))).toEqual({
      mode: "missingAgent",
      activeAgentKey: null,
      activeSessionSlug: null,
      attemptedAgentKey: "df",
      attemptedSessionSlug: "123",
    });
  });

  it("已知 agent 带 session 的路径保持 session 语义", () => {
    expect(parseViewState("/codex/123", new Set(["codex"]))).toEqual({
      mode: "session",
      activeAgentKey: "codex",
      activeSessionSlug: "123",
    });
  });

  it("会话详情加载中返回 skeleton 内容分支", () => {
    const html = renderToStaticMarkup(
      <>
        {renderMainContent({
          loading: false,
          error: null,
          viewState: {
            mode: "session",
            activeAgentKey: "codex",
            activeSessionSlug: "test-session",
          },
          normalizedSessions: sessions,
          agentItems,
          activeAgentKey: "codex",
          sidebarSessions: sessions,
          sessionLoading: true,
          sessionError: null,
          session: null,
        })}
      </>,
    );

    expect(html).toContain('data-testid="session-detail-skeleton"');
    expect(html.match(/data-testid="session-skeleton-message"/g)?.length).toBe(5);
    expect(html).not.toContain("加载会话内容中...");
  });

  it("会话详情加载中仍沿用已有标题栏信息", () => {
    const header = resolveHeaderContent({
      viewState: {
        mode: "session",
        activeAgentKey: "codex",
        activeSessionSlug: "test-session",
      },
      activeAgentKey: "codex",
      sidebarSessions: sessions,
      currentSessionInfo: sessions[0] ?? null,
      activeSessionPath: "codex/test-session",
      sessionError: null,
    });

    expect(header.title).toBe("Test Session");
    expect(header.subtitle).toContain("ID: #session1");
    expect(header.subtitle).toContain("Last updated");
  });

  it("索引加载态仍保持原有文案，不误显示 skeleton", () => {
    const html = renderToStaticMarkup(
      <>
        {renderMainContent({
          loading: true,
          error: null,
          viewState: {
            mode: "root",
            activeAgentKey: null,
            activeSessionSlug: null,
          },
          normalizedSessions: sessions,
          agentItems,
          activeAgentKey: null,
          sidebarSessions: [],
          sessionLoading: false,
          sessionError: null,
          session: null,
        })}
      </>,
    );

    expect(html).toContain("加载会话索引中...");
    expect(html).not.toContain('data-testid="session-detail-skeleton"');
  });

  it("agent landing 优先使用 total_tokens 展示 kimi token 统计", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        {renderMainContent({
          loading: false,
          error: null,
          viewState: {
            mode: "agent",
            activeAgentKey: "kimi",
            activeSessionSlug: null,
          },
          normalizedSessions: [
            {
              ...sessions[0],
              slug: "kimi/test-session",
              fullPath: "kimi/test-session",
              agentKey: "kimi",
              stats: {
                message_count: 3,
                total_input_tokens: 0,
                total_output_tokens: 0,
                total_tokens: 61389,
                total_cost: 0,
              },
            },
          ],
          agentItems: [
            ...agentItems,
            {
              key: "kimi",
              name: "Kimi",
              icon: "/icon/agent/kimi.svg",
              count: 1,
            },
          ],
          activeAgentKey: "kimi",
          sidebarSessions: [
            {
              ...sessions[0],
              slug: "kimi/test-session",
              fullPath: "kimi/test-session",
              agentKey: "kimi",
              stats: {
                message_count: 3,
                total_input_tokens: 0,
                total_output_tokens: 0,
                total_tokens: 61389,
                total_cost: 0,
              },
            },
          ],
          sessionLoading: false,
          sessionError: null,
          session: null,
        })}
      </MemoryRouter>,
    );

    expect(html).toContain("Tokens");
    expect(html).toContain("61,389");
  });

  it("agent landing 在缺少 total_tokens 时回退到 input 加 output", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        {renderMainContent({
          loading: false,
          error: null,
          viewState: {
            mode: "agent",
            activeAgentKey: "codex",
            activeSessionSlug: null,
          },
          normalizedSessions: sessions,
          agentItems,
          activeAgentKey: "codex",
          sidebarSessions: sessions,
          sessionLoading: false,
          sessionError: null,
          session: null,
        })}
      </MemoryRouter>,
    );

    expect(html).toContain("Tokens");
    expect(html).toContain("22");
  });

  it("missingAgent 内容分支渲染 agent 404 landing", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        {renderMainContent({
          loading: false,
          error: null,
          viewState: {
            mode: "missingAgent",
            activeAgentKey: null,
            activeSessionSlug: null,
            attemptedAgentKey: "df",
            attemptedSessionSlug: "123",
          },
          normalizedSessions: sessions,
          agentItems,
          activeAgentKey: null,
          sidebarSessions: [],
          sessionLoading: false,
          sessionError: null,
          session: null,
        })}
      </MemoryRouter>,
    );

    expect(html).toContain("404 / AGENT");
    expect(html).toContain("This agent isn&#x27;t on the roster.");
    expect(html).toContain("Requested Agent");
    expect(html).toContain("Known Agents");
    expect(html).not.toContain("路径无效。请从左侧选择 Agent。");
  });

  it("缺失 session 时渲染 session 404 landing", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        {renderMainContent({
          loading: false,
          error: null,
          viewState: {
            mode: "session",
            activeAgentKey: "codex",
            activeSessionSlug: "missing-session",
          },
          normalizedSessions: sessions,
          agentItems,
          activeAgentKey: "codex",
          sidebarSessions: sessions,
          sessionLoading: false,
          sessionError: "Session not found",
          session: null,
        })}
      </MemoryRouter>,
    );

    expect(html).toContain("404 / SESSION");
    expect(html).toContain("This session isn&#x27;t in the index.");
    expect(html).toContain("Recent Sessions");
    expect(html).not.toContain("会话不存在</div>");
  });

  it("missingAgent header 使用请求路径信息", () => {
    const header = resolveHeaderContent({
      viewState: {
        mode: "missingAgent",
        activeAgentKey: null,
        activeSessionSlug: null,
        attemptedAgentKey: "df",
        attemptedSessionSlug: "123",
      },
      activeAgentKey: null,
      sidebarSessions: [],
      currentSessionInfo: null,
      activeSessionPath: null,
      sessionError: null,
    });

    expect(header.title).toBe("Agent Not Found");
    expect(header.subtitle).toBe("Requested /df/123");
  });

  it("缺失 session 的 header 使用 Session Not Found 语义", () => {
    const header = resolveHeaderContent({
      viewState: {
        mode: "session",
        activeAgentKey: "codex",
        activeSessionSlug: "missing-session",
      },
      activeAgentKey: "codex",
      sidebarSessions: sessions,
      currentSessionInfo: null,
      activeSessionPath: "codex/missing-session",
      sessionError: "Session not found",
    });

    expect(header.title).toBe("Session Not Found");
    expect(header.subtitle).toBe("Requested /codex/missing-session");
  });

  it("agent landing 显示英文引导文案", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        {renderMainContent({
          loading: false,
          error: null,
          viewState: {
            mode: "agent",
            activeAgentKey: "codex",
            activeSessionSlug: null,
          },
          normalizedSessions: sessions,
          agentItems,
          activeAgentKey: "codex",
          sidebarSessions: sessions,
          sessionLoading: false,
          sessionError: null,
          session: null,
        })}
      </MemoryRouter>,
    );

    expect(html).toContain("Select a session from the left to view details");
  });

  it("agent landing 空会话列表显示英文空态", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        {renderMainContent({
          loading: false,
          error: null,
          viewState: {
            mode: "agent",
            activeAgentKey: "codex",
            activeSessionSlug: null,
          },
          normalizedSessions: [],
          agentItems,
          activeAgentKey: "codex",
          sidebarSessions: [],
          sessionLoading: false,
          sessionError: null,
          session: null,
        })}
      </MemoryRouter>,
    );

    expect(html).toContain("No sessions yet");
  });
});
