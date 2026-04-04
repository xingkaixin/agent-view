import { Message, MessagePart } from "../../types";
import { MessageBlock, buildMessageBlocks } from "./blocks";

export type TocFilterId = "user" | "agent_message" | "thinking" | "plan" | "tools_all";

export interface ToolFilterItem {
  id: `tool:${string}`;
  toolKey: string;
  label: string;
  count: number;
}

export interface SessionDetailToc {
  filterIds: Set<string>;
  counts: Record<TocFilterId, number>;
  tools: ToolFilterItem[];
}

export interface FilteredSessionMessage {
  msg: Message;
  blocks: MessageBlock[];
}

function buildToolLabel(part: MessagePart) {
  if (typeof part.title === "string" && part.title.trim()) {
    return part.title.trim();
  }
  if (typeof part.tool === "string" && part.tool.trim()) {
    return part.tool.trim();
  }
  return "tool";
}

function normalizeToolKey(part: MessagePart) {
  const rawKey =
    typeof part.tool === "string" && part.tool.trim() ? part.tool : buildToolLabel(part);
  return rawKey.trim().toLowerCase();
}

function countToolPart(toolMap: Map<string, ToolFilterItem>, part: MessagePart) {
  const toolKey = normalizeToolKey(part);
  const itemId = `tool:${toolKey}` as const;
  const current = toolMap.get(toolKey);

  if (current) {
    current.count += 1;
    return;
  }

  toolMap.set(toolKey, {
    id: itemId,
    toolKey,
    label: buildToolLabel(part),
    count: 1,
  });
}

export function buildSessionDetailToc(messages: Message[]): SessionDetailToc {
  const counts: Record<TocFilterId, number> = {
    user: 0,
    agent_message: 0,
    thinking: 0,
    plan: 0,
    tools_all: 0,
  };
  const filterIds = new Set<string>();
  const toolMap = new Map<string, ToolFilterItem>();

  for (const msg of messages) {
    const blocks = buildMessageBlocks(msg.parts);
    for (const block of blocks) {
      if (msg.role === "user") {
        counts.user += 1;
        filterIds.add("user");
        continue;
      }

      if (block.type === "text") {
        counts.agent_message += 1;
        filterIds.add("agent_message");
        continue;
      }

      if (block.type === "reasoning") {
        counts.thinking += 1;
        filterIds.add("thinking");
        continue;
      }

      if (block.type === "plan") {
        counts.plan += 1;
        filterIds.add("plan");
        continue;
      }

      counts.tools_all += block.parts.length;
      filterIds.add("tools_all");
      for (const part of block.parts) {
        countToolPart(toolMap, part);
        filterIds.add(`tool:${normalizeToolKey(part)}`);
      }
    }
  }

  return {
    filterIds,
    counts,
    tools: [...toolMap.values()].toSorted((left, right) => left.label.localeCompare(right.label)),
  };
}

function isToolPartVisible(part: MessagePart, selectedFilters: Set<string>) {
  if (!selectedFilters.has("tools_all")) {
    return false;
  }

  return selectedFilters.has(`tool:${normalizeToolKey(part)}`);
}

function isBlockVisible(block: MessageBlock, msg: Message, selectedFilters: Set<string>) {
  if (msg.role === "user") {
    return selectedFilters.has("user");
  }

  if (block.type === "text") {
    return selectedFilters.has("agent_message");
  }

  if (block.type === "reasoning") {
    return selectedFilters.has("thinking");
  }

  if (block.type === "plan") {
    return selectedFilters.has("plan");
  }

  return block.parts.some((part) => isToolPartVisible(part, selectedFilters));
}

function filterToolBlock(block: MessageBlock, selectedFilters: Set<string>): MessageBlock | null {
  const parts = block.parts.filter((part) => isToolPartVisible(part, selectedFilters));
  if (parts.length === 0) {
    return null;
  }

  return {
    ...block,
    parts,
  };
}

export function filterSessionMessages(
  messages: Message[],
  selectedFilters: Set<string>,
): FilteredSessionMessage[] {
  return messages
    .map((msg) => {
      const blocks = buildMessageBlocks(msg.parts)
        .filter((block) => isBlockVisible(block, msg, selectedFilters))
        .map((block) => (block.type === "tool" ? filterToolBlock(block, selectedFilters) : block))
        .filter((block): block is MessageBlock => block != null);

      if (blocks.length === 0) {
        return null;
      }

      return { msg, blocks };
    })
    .filter((item): item is FilteredSessionMessage => item != null);
}
