import { diffLines, type Change } from "diff";
/* eslint-disable react/no-array-index-key */
import {
  BookOpenText,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FilePenLine,
  FileSearch,
  LoaderCircle,
  Lightbulb,
  NotebookPen,
  SquareTerminal,
  UserRound,
  Wrench,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { ModelConfig } from "../config";
import { Session, Message, MessagePart } from "../types";
import { buildMessageBlocks, extractMessageText, hasVisibleContent } from "./session-detail/blocks";
import {
  buildCodexPatchOutputContent,
  getCodexPatchEntries,
  summarizeCodexPatchEntries,
} from "./session-detail/codex-patch";
import { ToolOutputRenderer } from "./tool-output/ToolOutputRenderer";
import {
  DiffBlock,
  DiffLineItem,
  ToolOutputContent,
  ToolOutputLanguage,
} from "./tool-output/types";

interface SessionDetailProps {
  session: Session;
}

type ToolStatus = "running" | "completed" | "error";

interface NormalizedToolState {
  status: ToolStatus;
  inputValue: unknown;
  outputValue: unknown;
  errorValue: unknown;
  metadataValue: unknown;
  inputText: string;
  command: string;
}

interface ToolDisplayStrategy {
  Icon: typeof LoaderCircle;
  title: string;
  secondaryText?: string;
  expandable: boolean;
  showInputPreview: boolean;
  outputContent: ToolOutputContent;
}

const TOOL_STATUS_META: Record<
  ToolStatus,
  { label: string; className: string; icon: typeof LoaderCircle }
> = {
  completed: {
    label: "Success",
    className:
      "border-[var(--console-success-border)] bg-[var(--console-success-bg)] text-[var(--console-success)]",
    icon: CheckCircle2,
  },
  error: {
    label: "Failed",
    className:
      "border-[var(--console-error-border)] bg-[var(--console-error-bg)] text-[var(--console-error)]",
    icon: XCircle,
  },
  running: {
    label: "Running",
    className:
      "border-[var(--console-warning-border)] bg-[var(--console-warning-bg)] text-[var(--console-warning)]",
    icon: LoaderCircle,
  },
};

function toDisplayText(value: unknown) {
  if (value == null) {
    return "";
  }

  if (typeof value === "string") {
    const text = value.trim();
    if (!text) {
      return "";
    }
    try {
      const parsed = JSON.parse(text) as unknown;
      return JSON.stringify(parsed, null, 2);
    } catch {
      return value;
    }
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    if (typeof value === "number" || typeof value === "bigint" || typeof value === "boolean") {
      return `${value}`;
    }
    if (typeof value === "symbol") {
      return value.description ? `Symbol(${value.description})` : "Symbol";
    }
    if (typeof value === "function") {
      return "[Function]";
    }
    return "[Unserializable value]";
  }
}

function parseInputCandidate(inputValue: unknown) {
  if (typeof inputValue !== "string") {
    return inputValue;
  }
  try {
    return JSON.parse(inputValue) as unknown;
  } catch {
    return inputValue;
  }
}

function extractToolTextSegments(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => extractToolTextSegments(item));
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const textValue = record.text;
    if (typeof textValue === "string") {
      return [textValue];
    }
    const contentValue = record.content;
    if (contentValue !== undefined) {
      return extractToolTextSegments(contentValue);
    }
  }

  return [];
}

function stripSystemTag(text: string) {
  return text
    .replace(/^<system>/i, "")
    .replace(/<\/system>$/i, "")
    .trim();
}

function joinToolText(value: unknown, includeSystem = true) {
  const segments = extractToolTextSegments(value)
    .map((segment) => segment.trim())
    .filter((segment) => {
      if (includeSystem) {
        return Boolean(segment);
      }
      return Boolean(segment) && !/^<system>[\s\S]*<\/system>$/i.test(segment);
    });

  if (segments.length === 0) {
    return "";
  }

  return segments
    .map((segment) =>
      includeSystem && /^<system>[\s\S]*<\/system>$/i.test(segment)
        ? stripSystemTag(segment)
        : segment,
    )
    .join("\n");
}

function extractCommand(inputValue: unknown) {
  const parsed = parseInputCandidate(inputValue);
  if (parsed && typeof parsed === "object") {
    const input = parsed as { cmd?: unknown; command?: unknown };
    if (typeof input.cmd === "string") {
      return input.cmd;
    }
    if (typeof input.command === "string") {
      return input.command;
    }
  }
  return "";
}

function normalizeToolState(part: MessagePart): NormalizedToolState {
  const rawState = (part.state || {}) as Record<string, unknown>;
  const rawStatus = rawState.status;
  const status: ToolStatus =
    rawStatus === "running" || rawStatus === "error" || rawStatus === "completed"
      ? rawStatus
      : "completed";

  const outputValue = rawState.output ?? rawState.result ?? "";
  const errorValue = rawState.error ?? "";
  const inputValue = parseInputCandidate(rawState.input ?? rawState.arguments ?? {});
  const metadataValue = rawState.metadata ?? {};
  const command = extractCommand(inputValue);

  return {
    status,
    command,
    inputValue,
    outputValue,
    errorValue,
    metadataValue,
    inputText: toDisplayText(inputValue),
  };
}

function toRecord(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function toPlainText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toStringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizeEscapedNewlines(text: string) {
  return text.replace(/\\n/g, "\n");
}

function formatToolOutput(value: unknown) {
  const structuredText = joinToolText(value);
  const text = structuredText || toDisplayText(value);
  const normalized = normalizeEscapedNewlines(text);
  return normalized || "No output captured.";
}

function getOutputOrErrorText(state: NormalizedToolState) {
  const outputText = formatToolOutput(state.outputValue);
  if (outputText !== "No output captured.") {
    return outputText;
  }

  const errorText = formatToolOutput(state.errorValue);
  if (errorText !== "No output captured.") {
    return errorText;
  }

  return "No output captured.";
}

function getFilePathFromInput(inputValue: unknown) {
  const input = toRecord(inputValue);
  const filePath = toPlainText(input.filePath) || toPlainText(input.path);
  return filePath || "";
}

function detectLanguageByFilePath(filePath: string): ToolOutputLanguage {
  const fileName = filePath.split("/").pop()?.toLowerCase() || "";
  if (fileName === ".bashrc" || fileName === ".zshrc" || fileName === ".profile") {
    return "bash";
  }

  const extension = fileName.includes(".") ? fileName.split(".").pop() : "";
  switch (extension) {
    case "ts":
      return "typescript";
    case "tsx":
      return "tsx";
    case "js":
      return "javascript";
    case "jsx":
      return "jsx";
    case "sh":
    case "bash":
    case "zsh":
      return "bash";
    case "html":
      return "html";
    case "css":
      return "css";
    case "yaml":
    case "yml":
      return "yaml";
    case "json":
      return "json";
    case "md":
      return "markdown";
    case "toml":
      return "toml";
    case "conf":
      return "ini";
    default:
      return "text";
  }
}

function extractReadContent(rawOutput: unknown) {
  const rawText = joinToolText(rawOutput, false) || formatToolOutput(rawOutput);
  if (rawText === "No output captured.") {
    return rawText;
  }

  const withoutWrapper = rawText.replace(/^<file>\s*/i, "").replace(/\s*<\/file>\s*$/i, "");
  const lines = withoutWrapper
    .split("\n")
    .filter((line) => !/^\(End of file - total \d+ lines\)$/.test(line.trim()))
    .map((line) => line.replace(/^\d+\|\s?/, "").replace(/^\s*\d+\t/, ""));
  const cleaned = lines.join("\n").trimEnd();
  return cleaned || "No output captured.";
}

function createDiffBlock(oldValue: string, newValue: string) {
  const oldLines = normalizeEscapedNewlines(oldValue).split("\n");
  const newLines = normalizeEscapedNewlines(newValue).split("\n");
  const diffLines = [
    "@@",
    ...oldLines.map((line) => `- ${line}`),
    ...newLines.map((line) => `+ ${line}`),
  ];
  return diffLines.join("\n");
}

function splitDiffChunkLines(value: string) {
  const normalized = normalizeEscapedNewlines(value);
  const lines = normalized.split("\n");
  if (normalized.endsWith("\n")) {
    lines.pop();
  }
  return lines;
}

function diffPartsToLines(parts: Change[]): DiffLineItem[] {
  return parts.flatMap((part) => {
    const type: DiffLineItem["type"] = part.added ? "add" : part.removed ? "remove" : "context";
    return splitDiffChunkLines(part.value).map((line) => ({
      type,
      text: line,
    }));
  });
}

function getKimiEditEntries(inputValue: unknown) {
  const input = toRecord(inputValue);
  const rawEdit = input.edit;
  if (Array.isArray(rawEdit)) {
    return rawEdit;
  }
  if (rawEdit && typeof rawEdit === "object") {
    return [rawEdit];
  }
  return [];
}

function getDiffBlockLabel(filePath: string) {
  const normalizedPath = filePath.trim();
  if (!normalizedPath) {
    return "edit";
  }

  const fileName = normalizedPath.split("/").pop() || normalizedPath;
  return fileName === normalizedPath ? fileName : `${fileName} · ${normalizedPath}`;
}

function buildKimiEditDiffBlocks(state: NormalizedToolState, filePath: string): DiffBlock[] {
  const edits = getKimiEditEntries(state.inputValue);
  const label = getDiffBlockLabel(filePath);

  return edits
    .map((entry) => {
      const edit = toRecord(entry);
      const oldValue = toStringValue(edit.old);
      const newValue = toStringValue(edit.new);
      if (!oldValue.trim() && !newValue.trim()) {
        return null;
      }

      return {
        label,
        lines: diffPartsToLines(
          diffLines(normalizeEscapedNewlines(oldValue), normalizeEscapedNewlines(newValue)),
        ),
      };
    })
    .filter((block): block is DiffBlock => block != null && block.lines.length > 0);
}

function extractEditDiff(state: NormalizedToolState) {
  const metadata = toRecord(state.metadataValue);
  const diffText = toStringValue(metadata.diff);
  if (diffText.trim()) {
    return normalizeEscapedNewlines(diffText);
  }

  const edits = getKimiEditEntries(state.inputValue);
  const generatedDiff = edits
    .map((entry) => {
      const edit = toRecord(entry);
      const oldValue = toStringValue(edit.old);
      const newValue = toStringValue(edit.new);
      if (!oldValue.trim() && !newValue.trim()) {
        return "";
      }
      return createDiffBlock(oldValue, newValue);
    })
    .filter(Boolean)
    .join("\n\n");
  if (generatedDiff.trim()) {
    return generatedDiff;
  }

  return getOutputOrErrorText(state);
}

function extractWriteContent(state: NormalizedToolState) {
  const input = toRecord(state.inputValue);
  if (state.status === "completed") {
    const contentText = toStringValue(input.content);
    if (contentText.trim()) {
      return normalizeEscapedNewlines(contentText);
    }
  }
  return getOutputOrErrorText(state);
}

function buildKimiToolStrategy(tool: MessagePart, state: NormalizedToolState): ToolDisplayStrategy {
  const defaultStrategy = buildDefaultToolStrategy(tool, state);
  const toolKey = (tool.tool || "").toLowerCase();
  const input = toRecord(state.inputValue);

  if (toolKey === "glob") {
    const pattern = toPlainText(input.pattern);
    return {
      ...defaultStrategy,
      Icon: FileSearch,
      title: tool.title || "glob",
      secondaryText: pattern || undefined,
      showInputPreview: false,
      outputContent: {
        kind: "plain",
        text: getOutputOrErrorText(state),
        language: "text",
        isCode: false,
      },
    };
  }

  if (toolKey === "grep") {
    const path = toPlainText(input.path);
    const pattern = toPlainText(input.pattern);
    const details = [path, pattern].filter(Boolean).join(" · ");
    return {
      ...defaultStrategy,
      Icon: FileSearch,
      title: tool.title || "grep",
      secondaryText: details || undefined,
      showInputPreview: false,
      outputContent: {
        kind: "plain",
        text: getOutputOrErrorText(state),
        language: "text",
        isCode: false,
      },
    };
  }

  if (toolKey === "shell") {
    const command = toPlainText(input.command);
    return {
      ...defaultStrategy,
      Icon: SquareTerminal,
      title: tool.title || "bash",
      secondaryText: command ? `(${command})` : undefined,
      showInputPreview: false,
      outputContent: {
        kind: "plain",
        text: getOutputOrErrorText(state),
        language: "text",
        isCode: false,
      },
    };
  }

  if (toolKey === "readfile") {
    const filePath = getFilePathFromInput(state.inputValue);
    return {
      ...defaultStrategy,
      Icon: BookOpenText,
      title: tool.title || "read",
      secondaryText: filePath || undefined,
      showInputPreview: false,
      outputContent: {
        kind: "plain",
        text: extractReadContent(state.outputValue),
        language: detectLanguageByFilePath(filePath),
        isCode: true,
      },
    };
  }

  if (toolKey === "strreplacefile") {
    const filePath = getFilePathFromInput(state.inputValue);
    const diffBlocks = buildKimiEditDiffBlocks(state, filePath);
    return {
      ...defaultStrategy,
      Icon: FilePenLine,
      title: tool.title || "edit",
      secondaryText: filePath || undefined,
      showInputPreview: false,
      outputContent:
        diffBlocks.length > 0
          ? {
              kind: "structured-diff",
              blocks: diffBlocks,
            }
          : {
              kind: "plain",
              text: extractEditDiff(state),
              language: "diff",
              isCode: true,
            },
    };
  }

  if (toolKey === "writefile") {
    const filePath = getFilePathFromInput(state.inputValue);
    return {
      ...defaultStrategy,
      Icon: NotebookPen,
      title: tool.title || "write",
      secondaryText: filePath || undefined,
      showInputPreview: false,
      outputContent: {
        kind: "plain",
        text: extractWriteContent(state),
        language: detectLanguageByFilePath(filePath),
        isCode: state.status === "completed",
      },
    };
  }

  return defaultStrategy;
}

function buildDefaultToolStrategy(
  tool: MessagePart,
  state: NormalizedToolState,
): ToolDisplayStrategy {
  const preview = state.command || state.inputText || "{}";
  const compactPreview = preview.replace(/\s+/g, " ").trim();
  const previewText =
    compactPreview.length > 72 ? `${compactPreview.slice(0, 72)}...` : compactPreview;

  return {
    Icon: SquareTerminal,
    title: tool.title || tool.tool || "Tool",
    secondaryText: previewText ? `(${previewText})` : undefined,
    expandable: true,
    showInputPreview: true,
    outputContent: {
      kind: "plain",
      text: getOutputOrErrorText(state),
      language: "text",
      isCode: false,
    },
  };
}

function buildCodexToolStrategy(
  tool: MessagePart,
  state: NormalizedToolState,
): ToolDisplayStrategy {
  const defaultStrategy = buildDefaultToolStrategy(tool, state);
  const toolKey = (tool.tool || "").toLowerCase();

  if (toolKey === "patch") {
    const entries = getCodexPatchEntries(state.inputValue);
    const summary = summarizeCodexPatchEntries(entries);
    return {
      ...defaultStrategy,
      Icon: FilePenLine,
      title: tool.title || "patch",
      secondaryText: summary || undefined,
      showInputPreview: false,
      outputContent: buildCodexPatchOutputContent(
        entries,
        getOutputOrErrorText(state),
        detectLanguageByFilePath,
      ),
    };
  }

  return defaultStrategy;
}

function buildOpencodeToolStrategy(
  tool: MessagePart,
  state: NormalizedToolState,
): ToolDisplayStrategy {
  const defaultStrategy = buildDefaultToolStrategy(tool, state);
  const toolKey = (tool.tool || "").toLowerCase();
  const input = toRecord(state.inputValue);

  if (toolKey === "glob") {
    const pattern = toPlainText(input.pattern);
    return {
      ...defaultStrategy,
      Icon: FileSearch,
      title: tool.tool || "glob",
      secondaryText: pattern || undefined,
      showInputPreview: false,
      outputContent: {
        kind: "plain",
        text: getOutputOrErrorText(state),
        language: "text",
        isCode: false,
      },
    };
  }

  if (toolKey === "grep") {
    const path = toPlainText(input.path);
    const pattern = toPlainText(input.pattern);
    const details = [path, pattern].filter(Boolean).join(" · ");
    return {
      ...defaultStrategy,
      Icon: FileSearch,
      title: tool.tool || "grep",
      secondaryText: details || undefined,
      showInputPreview: false,
      outputContent: {
        kind: "plain",
        text: getOutputOrErrorText(state),
        language: "text",
        isCode: false,
      },
    };
  }

  if (toolKey === "bash") {
    const description = toPlainText(input.description);
    const command = toPlainText(input.command);
    const secondaryText = description
      ? `${description}${command ? ` (${command})` : ""}`
      : command
        ? `(${command})`
        : undefined;
    return {
      ...defaultStrategy,
      Icon: SquareTerminal,
      title: tool.tool || "bash",
      secondaryText,
      showInputPreview: false,
      outputContent: {
        kind: "plain",
        text: getOutputOrErrorText(state),
        language: "text",
        isCode: false,
      },
    };
  }

  if (toolKey === "read") {
    const filePath = getFilePathFromInput(state.inputValue);
    return {
      ...defaultStrategy,
      Icon: BookOpenText,
      title: tool.tool || "read",
      secondaryText: filePath || undefined,
      showInputPreview: false,
      outputContent: {
        kind: "plain",
        text: extractReadContent(state.outputValue),
        language: detectLanguageByFilePath(filePath),
        isCode: true,
      },
    };
  }

  if (toolKey === "edit") {
    const filePath = getFilePathFromInput(state.inputValue);
    return {
      ...defaultStrategy,
      Icon: FilePenLine,
      title: tool.tool || "edit",
      secondaryText: filePath || undefined,
      showInputPreview: false,
      outputContent: {
        kind: "plain",
        text: extractEditDiff(state),
        language: "diff",
        isCode: true,
      },
    };
  }

  if (toolKey === "write") {
    const filePath = getFilePathFromInput(state.inputValue);
    const isSuccessfulWrite = state.status === "completed";
    return {
      ...defaultStrategy,
      Icon: NotebookPen,
      title: tool.tool || "write",
      secondaryText: filePath || undefined,
      showInputPreview: false,
      outputContent: {
        kind: "plain",
        text: extractWriteContent(state),
        language: detectLanguageByFilePath(filePath),
        isCode: isSuccessfulWrite,
      },
    };
  }

  if (toolKey === "skill") {
    const name = toPlainText(input.name);
    return {
      ...defaultStrategy,
      Icon: Wrench,
      title: tool.tool || "skill",
      secondaryText: name || undefined,
      expandable: false,
      showInputPreview: false,
    };
  }

  return defaultStrategy;
}

function getToolDisplayStrategy(
  sessionAgentKey: string,
  tool: MessagePart,
  state: NormalizedToolState,
): ToolDisplayStrategy {
  const normalizedAgentKey = sessionAgentKey.toLowerCase();
  if (normalizedAgentKey === "opencode") {
    return buildOpencodeToolStrategy(tool, state);
  }
  if (normalizedAgentKey === "codex") {
    return buildCodexToolStrategy(tool, state);
  }
  if (normalizedAgentKey === "kimi") {
    return buildKimiToolStrategy(tool, state);
  }
  return buildDefaultToolStrategy(tool, state);
}

function formatTokens(n: number) {
  if (n >= 1000000) {
    return `${(n / 1000000).toFixed(1)}M`;
  }
  if (n >= 1000) {
    return `${(n / 1000).toFixed(1)}K`;
  }
  return n.toString();
}

function formatMessageTime(rawTime: unknown) {
  if (typeof rawTime === "number" && rawTime <= 0) {
    return "Unknown time";
  }

  let date: Date | null = null;
  if (typeof rawTime === "number") {
    const normalized = rawTime < 10 ** 12 ? rawTime * 1000 : rawTime;
    date = new Date(normalized);
  } else if (typeof rawTime === "string") {
    if (rawTime.trim()) {
      const timestamp = Number(rawTime);
      if (!Number.isNaN(timestamp) && timestamp > 0) {
        date = new Date(timestamp < 10 ** 12 ? timestamp * 1000 : timestamp);
      } else {
        date = new Date(rawTime);
      }
    }
  }

  if (!date || Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

export function SessionDetail({ session }: SessionDetailProps) {
  const sessionSlug = session._urlSlug || session.slug || "";
  const sessionAgentKey =
    sessionSlug.split("/")[0] || ModelConfig.getDefaultAgentKey() || "opencode";
  const visibleMessages = useMemo(
    () => session.messages.filter((msg) => hasVisibleContent(msg)),
    [session.messages],
  );

  if (visibleMessages.length === 0) {
    return (
      <div className="mx-auto max-w-4xl rounded-sm border border-[var(--console-border)] bg-white p-6 text-sm text-[var(--console-muted)]">
        当前会话暂无可展示的消息内容。
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-2 md:px-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex flex-col gap-8">
        {visibleMessages.map((msg, index) => (
          <MessageItem
            key={index}
            msg={msg}
            formatTokens={formatTokens}
            sessionAgentKey={sessionAgentKey}
          />
        ))}
      </div>
    </div>
  );
}

function MessageItem({
  msg,
  formatTokens,
  sessionAgentKey,
}: {
  msg: Message;
  formatTokens: (n: number) => string;
  sessionAgentKey: string;
}) {
  const role = msg.role;
  const time = formatMessageTime(msg.time_created);
  const isUser = role === "user";
  const blocks = buildMessageBlocks(msg.parts);

  const getAgentAvatar = () => {
    const agentKey = sessionAgentKey.toLowerCase();
    const agentName = ModelConfig.getAgentName(agentKey);
    const agentIcon = ModelConfig.agents[agentKey]?.icon;
    return (
      <>
        {agentIcon ? (
          <img src={agentIcon} alt={agentName} className="size-4 rounded-sm object-cover" />
        ) : (
          <Bot className="size-4 text-[var(--console-muted)]" />
        )}
      </>
    );
  };

  const modeLabel = msg.mode ? msg.mode.toUpperCase() : null;
  const modelLabel = msg.model || null;

  return (
    <article className="w-full border-l-2 border-[var(--console-thread)] pl-4 pr-3 md:pr-5">
      <div className="flex gap-4">
        <div className="shrink-0 pt-1">
          <div className="flex size-8 items-center justify-center rounded-sm border border-[var(--console-border)] bg-[var(--console-surface-muted)]">
            {isUser ? (
              <UserRound className="size-4 text-[var(--console-muted)]" />
            ) : (
              getAgentAvatar()
            )}
          </div>
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-baseline gap-3">
            <span className="console-mono text-sm font-bold tracking-wide text-[var(--console-text)]">
              {isUser ? "USER" : "AGENT"}
            </span>
            <time className="console-mono text-xs text-[var(--console-muted)]">{time}</time>
            {modeLabel && (
              <span className="console-mono rounded-sm border border-[var(--console-border)] bg-[var(--console-surface-muted)] px-1.5 py-0.5 text-[10px] text-[var(--console-muted)]">
                {modeLabel}
              </span>
            )}
            {modelLabel && (
              <span className="console-mono rounded-sm border border-[var(--console-border)] bg-[var(--console-surface-muted)] px-1.5 py-0.5 text-[10px] text-[var(--console-muted)]">
                {modelLabel}
              </span>
            )}
          </div>

          {blocks.map((block, index) => {
            if (block.type === "reasoning") {
              return <ReasoningSection key={index} parts={block.parts} />;
            }

            if (block.type === "tool") {
              return (
                <ToolsSection key={index} parts={block.parts} sessionAgentKey={sessionAgentKey} />
              );
            }

            return (
              <div
                key={index}
                className="rounded-sm border border-[var(--console-border)] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
              >
                <div className="console-markdown text-sm leading-relaxed text-[var(--console-text)]">
                  {block.parts.map((part, partIndex) => (
                    <ReactMarkdown key={partIndex}>{extractMessageText(part.text)}</ReactMarkdown>
                  ))}
                </div>
              </div>
            );
          })}

          {!isUser && (msg.tokens || msg.cost) && (
            <div className="flex flex-wrap gap-2">
              {msg.tokens?.input ? (
                <span className="console-mono rounded-sm border border-[var(--console-border)] bg-[var(--console-surface-muted)] px-2 py-1 text-[11px] text-[var(--console-muted)]">
                  INPUT {formatTokens(msg.tokens.input)}
                </span>
              ) : null}
              {msg.tokens?.output ? (
                <span className="console-mono rounded-sm border border-[var(--console-border)] bg-[var(--console-surface-muted)] px-2 py-1 text-[11px] text-[var(--console-muted)]">
                  OUTPUT {formatTokens(msg.tokens.output)}
                </span>
              ) : null}
              {msg.tokens?.reasoning ? (
                <span className="console-mono rounded-sm border border-[var(--console-border)] bg-[var(--console-surface-muted)] px-2 py-1 text-[11px] text-[var(--console-muted)]">
                  REASONING {formatTokens(msg.tokens.reasoning)}
                </span>
              ) : null}
              {msg.cost ? (
                <span className="console-mono rounded-sm border border-[var(--console-border)] bg-[var(--console-surface-muted)] px-2 py-1 text-[11px] text-[var(--console-muted)]">
                  COST ${msg.cost.toFixed(4)}
                </span>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function ReasoningSection({ parts }: { parts: MessagePart[] }) {
  const [expanded, setExpanded] = useState(false);
  const fullText = parts
    .map((p) => extractMessageText(p.text))
    .filter(Boolean)
    .join("\n\n");

  return (
    <div className="overflow-hidden rounded-sm border border-[var(--console-thinking-border)] bg-[var(--console-thinking-bg)]">
      <div
        className="flex cursor-pointer items-center justify-between bg-[var(--console-surface-muted)] px-3 py-2"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="console-mono flex items-center gap-2 text-xs font-medium text-[var(--console-muted)]">
          <Lightbulb className="size-3.5" />
          Thinking
        </span>
        <span className="text-[var(--console-muted)]">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </div>
      {expanded && (
        <div className="border-t border-dashed border-[var(--console-thinking-border)] px-4 py-3">
          <div className="console-mono whitespace-pre-wrap text-xs leading-relaxed text-[var(--console-muted)]">
            {fullText}
          </div>
        </div>
      )}
    </div>
  );
}

function ToolsSection({
  parts,
  sessionAgentKey,
}: {
  parts: MessagePart[];
  sessionAgentKey: string;
}) {
  return (
    <div className="space-y-2">
      <div className="space-y-2">
        {parts.map((tool, i) => (
          <ToolItem key={i} tool={tool} sessionAgentKey={sessionAgentKey} />
        ))}
      </div>
    </div>
  );
}

function ToolItem({ tool, sessionAgentKey }: { tool: MessagePart; sessionAgentKey: string }) {
  const [expanded, setExpanded] = useState(false);
  const state = normalizeToolState(tool);
  const strategy = getToolDisplayStrategy(sessionAgentKey, tool, state);
  const statusMeta = TOOL_STATUS_META[state.status];
  const StatusIcon = statusMeta.icon;
  const ToolIcon = strategy.Icon;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-start gap-2">
        <div
          className={`w-full md:w-[560px] rounded-sm border border-[var(--console-border-strong)] bg-white px-3 py-2 text-left shadow-[2px_2px_0_0_rgba(15,23,42,0.05)] ${
            strategy.expandable ? "transition-colors hover:bg-[var(--console-surface-muted)]" : ""
          }`}
        >
          {strategy.expandable ? (
            <button
              type="button"
              className="flex w-full items-start gap-2 text-left"
              onClick={() => setExpanded(!expanded)}
            >
              <ToolIcon className="mt-0.5 size-3.5 shrink-0 text-[var(--console-accent)]" />
              <span className="min-w-0 flex-1">
                <span className="console-mono block text-xs font-semibold text-[var(--console-text)]">
                  {strategy.title}
                </span>
                {strategy.secondaryText ? (
                  <span className="console-mono mt-0.5 block whitespace-pre-wrap break-words text-xs leading-relaxed text-[var(--console-muted)]">
                    {strategy.secondaryText}
                  </span>
                ) : null}
              </span>
              <span className="mt-0.5 shrink-0 text-[var(--console-muted)]">
                {expanded ? (
                  <ChevronUp className="size-3.5" />
                ) : (
                  <ChevronDown className="size-3.5" />
                )}
              </span>
            </button>
          ) : (
            <div className="flex items-start gap-2">
              <ToolIcon className="mt-0.5 size-3.5 shrink-0 text-[var(--console-accent)]" />
              <span className="min-w-0 flex-1">
                <span className="console-mono block text-xs font-semibold text-[var(--console-text)]">
                  {strategy.title}
                </span>
                {strategy.secondaryText ? (
                  <span className="console-mono mt-0.5 block whitespace-pre-wrap break-words text-xs leading-relaxed text-[var(--console-muted)]">
                    {strategy.secondaryText}
                  </span>
                ) : null}
              </span>
            </div>
          )}
        </div>
        <span
          className={`console-mono inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusMeta.className}`}
        >
          <StatusIcon className={`size-3 ${state.status === "running" ? "animate-spin" : ""}`} />
          {statusMeta.label}
        </span>
      </div>

      {strategy.expandable && expanded ? (
        <div className="overflow-hidden rounded-sm border border-[var(--console-border)] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="border-b border-[var(--console-border)] bg-[var(--console-surface-muted)] px-3 py-1.5">
            <span className="console-mono text-xs text-[var(--console-muted)]">Output</span>
          </div>
          <div className="p-3">
            <ToolOutputRenderer outputContent={strategy.outputContent} />
          </div>
          {strategy.showInputPreview ? (
            <div className="border-t border-[var(--console-border)] bg-[#fafafa] px-3 py-2">
              <span className="console-mono text-[11px] text-[var(--console-muted)]">
                Input Preview
              </span>
              <pre className="console-mono mt-1 max-h-[200px] overflow-x-auto whitespace-pre-wrap break-all text-xs leading-relaxed text-[var(--console-muted)]">
                {state.inputText || "{}"}
              </pre>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
