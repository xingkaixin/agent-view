import { Message, MessagePart } from "../../types";

export type MessageBlockType = "reasoning" | "text" | "tool";

export interface MessageBlock {
  type: MessageBlockType;
  parts: MessagePart[];
}

function extractMessageText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }
        if (item && typeof item === "object") {
          const record = item as Record<string, unknown>;
          const text = extractMessageText(record.text);
          if (text.trim()) {
            return text;
          }
          const content = extractMessageText(record.content);
          if (content.trim()) {
            return content;
          }
        }
        return "";
      })
      .filter(Boolean)
      .join("\n\n");
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const text = extractMessageText(record.text);
    if (text.trim()) {
      return text;
    }
    const content = extractMessageText(record.content);
    if (content.trim()) {
      return content;
    }
  }

  return "";
}

function isVisiblePart(part: MessagePart) {
  if (part.type === "tool") {
    return true;
  }

  if (part.type === "text" || part.type === "reasoning") {
    return Boolean(extractMessageText(part.text).trim());
  }

  return false;
}

export function buildMessageBlocks(parts: MessagePart[]): MessageBlock[] {
  return parts.reduce<MessageBlock[]>((blocks, part) => {
    if (!isVisiblePart(part)) {
      return blocks;
    }

    const previousBlock = blocks.at(-1);
    if (previousBlock?.type === part.type) {
      previousBlock.parts.push(part);
      return blocks;
    }

    blocks.push({
      type: part.type,
      parts: [part],
    });
    return blocks;
  }, []);
}

export function hasVisibleContent(msg: Message) {
  return buildMessageBlocks(msg.parts).length > 0;
}

export { extractMessageText };
