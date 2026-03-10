import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SessionSummarySection } from "../SessionDetail";

describe("SessionSummarySection", () => {
  it("默认折叠时只渲染标题，不渲染 markdown 正文", () => {
    const html = renderToStaticMarkup(
      <SessionSummarySection summary={"## Summary\n\n[OpenAI](https://openai.com)"} />,
    );

    expect(html).toContain("Session Summary");
    expect(html).toContain('type="button"');
    expect(html).not.toContain("<h2>Summary</h2>");
    expect(html).not.toContain("OpenAI");
    expect(html).not.toMatch(/<a(?=[\\s>])/);
  });

  it("展开时按既有 markdown 策略渲染摘要，链接不可点击", () => {
    const html = renderToStaticMarkup(
      <SessionSummarySection
        summary={"## Summary\n\n[OpenAI](https://openai.com)\n\n- item"}
        defaultExpanded
      />,
    );

    expect(html).toContain("<h2>Summary</h2>");
    expect(html).toContain("<li>item</li>");
    expect(html).toContain('class="console-markdown-link"');
    expect(html).not.toMatch(/<a(?=[\\s>])/);
    expect(html).not.toContain('href="https://openai.com"');
  });

  it("缺少 summary 时不渲染任何容器", () => {
    const html = renderToStaticMarkup(<SessionSummarySection summary={undefined} />);

    expect(html).toBe("");
  });
});
