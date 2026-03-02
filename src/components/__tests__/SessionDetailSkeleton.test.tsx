import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SessionDetailSkeleton } from "../SessionDetailSkeleton";

describe("SessionDetailSkeleton", () => {
  it("渲染一屏会话骨架结构", () => {
    const html = renderToStaticMarkup(<SessionDetailSkeleton />);

    expect(html).toContain('data-testid="session-detail-skeleton"');
    expect(html).toContain("min-h-full");
    expect(html).toContain("max-w-5xl");
    expect(html).toContain("animate-pulse");
    expect(html.match(/data-testid="session-skeleton-message"/g)?.length).toBe(5);
  });
});
