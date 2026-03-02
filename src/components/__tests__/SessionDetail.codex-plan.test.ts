import { describe, expect, it } from "bun:test";
import { buildCodexPlanDisplay } from "../session-detail/codex-plan";

describe("buildCodexPlanDisplay", () => {
  it("success + input 时可展开，正文取 input", () => {
    const display = buildCodexPlanDisplay({
      type: "plan",
      input: "# Plan\n\n执行步骤",
      approval_status: "success",
    });

    expect(display.title).toBe("plan");
    expect(display.secondaryText).toBeUndefined();
    expect(display.approvalStatus).toBe("success");
    expect(display.expandable).toBe(true);
    expect(display.contentLabel).toBe("Plan");
    expect(display.contentMarkdown).toBe("# Plan\n\n执行步骤");
  });

  it("fail + output 时可展开，正文按 markdown 内容取 output", () => {
    const display = buildCodexPlanDisplay({
      type: "plan",
      input: "# 原计划",
      output: "## Rejected\n\n- 需要完整命令",
      approval_status: "fail",
    });

    expect(display.approvalStatus).toBe("fail");
    expect(display.expandable).toBe(true);
    expect(display.contentLabel).toBe("Rejected");
    expect(display.contentMarkdown).toBe("## Rejected\n\n- 需要完整命令");
  });

  it("success + null output 不影响展开，仍取 input", () => {
    const display = buildCodexPlanDisplay({
      type: "plan",
      input: "继续实施",
      output: null,
      approval_status: "success",
    });

    expect(display.expandable).toBe(true);
    expect(display.contentMarkdown).toBe("继续实施");
  });

  it("fail + 空 output 时不可展开", () => {
    const display = buildCodexPlanDisplay({
      type: "plan",
      output: "   ",
      approval_status: "fail",
    });

    expect(display.expandable).toBe(false);
    expect(display.contentMarkdown).toBe("");
  });

  it("fail 时即使 input 有值，只要 output 为空也不可展开", () => {
    const display = buildCodexPlanDisplay({
      type: "plan",
      input: "# 原计划",
      output: "",
      approval_status: "fail",
    });

    expect(display.expandable).toBe(false);
    expect(display.contentMarkdown).toBe("");
  });

  it("input/output 都空时不可展开", () => {
    const display = buildCodexPlanDisplay({
      type: "plan",
      approval_status: "success",
    });

    expect(display.expandable).toBe(false);
    expect(display.contentMarkdown).toBe("");
  });

  it("缺省 approval_status 时按 success 处理", () => {
    const display = buildCodexPlanDisplay({
      type: "plan",
      input: "默认通过",
    });

    expect(display.approvalStatus).toBe("success");
    expect(display.contentLabel).toBe("Plan");
  });
});
