import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { renderMainContent, resolveHeaderContent } from "../../App";
import type { LandingAgentItem, LandingSession } from "../DetailLanding";

const agentItems: LandingAgentItem[] = [
  {
    key: "codex",
    name: "Codex",
    icon: "/icon/provider/openai.svg",
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
});
