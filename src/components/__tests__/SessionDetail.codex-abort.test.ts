import { describe, expect, it } from "bun:test";
import type { Message } from "../../types";
import { CODEX_TURN_ABORTED_TEXT, isCodexTurnAbortedMessage } from "../session-detail/codex-abort";

function createMessage(overrides: Partial<Message> = {}): Message {
  return {
    role: "user",
    time_created: "2026-03-01T00:00:00.000Z",
    parts: [{ type: "text", text: CODEX_TURN_ABORTED_TEXT }],
    ...overrides,
  };
}

describe("isCodexTurnAbortedMessage", () => {
  it("识别 codex 用户固定中断文案", () => {
    expect(isCodexTurnAbortedMessage(createMessage(), "codex")).toBe(true);
  });

  it("assistant 角色不识别为中断消息", () => {
    expect(isCodexTurnAbortedMessage(createMessage({ role: "assistant" }), "codex")).toBe(false);
  });

  it("非 codex agent 不识别为中断消息", () => {
    expect(isCodexTurnAbortedMessage(createMessage(), "opencode")).toBe(false);
    expect(isCodexTurnAbortedMessage(createMessage(), "kimi")).toBe(false);
  });

  it("自定义 turn_aborted 文案不识别", () => {
    expect(
      isCodexTurnAbortedMessage(
        createMessage({
          parts: [{ type: "text", text: "<turn_aborted>\ncustom\n</turn_aborted>" }],
        }),
        "codex",
      ),
    ).toBe(false);
  });

  it("带额外文本 part 的消息不识别", () => {
    expect(
      isCodexTurnAbortedMessage(
        createMessage({
          parts: [
            { type: "text", text: CODEX_TURN_ABORTED_TEXT },
            { type: "text", text: "继续" },
          ],
        }),
        "codex",
      ),
    ).toBe(false);
  });
});
