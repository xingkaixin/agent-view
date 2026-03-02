export interface SessionStats {
  message_count: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost: number;
}

export interface MessageTokens {
  input?: number;
  output?: number;
  reasoning?: number;
}

export interface MessagePart {
  type: "text" | "tool" | "reasoning" | "plan";
  text?: unknown;
  tool?: string;
  title?: string;
  input?: unknown;
  output?: unknown;
  approval_status?: "success" | "fail";
  state?: {
    status?: "running" | "completed" | "error";
    input?: unknown;
    output?: unknown;
  };
}

export interface Message {
  role: "user" | "assistant";
  time_created: string;
  mode?: string;
  model?: string;
  parts: MessagePart[];
  tokens?: MessageTokens;
  cost?: number;
}

export interface SessionInfo {
  id: string;
  slug: string;
  title: string;
  directory: string;
  time_created: number;
  time_updated?: number;
  stats: SessionStats;
}

export interface Session {
  id: string;
  slug: string;
  _urlSlug?: string;
  title: string;
  directory: string;
  time_created: string;
  stats: SessionStats;
  messages: Message[];
}

export interface IndexData {
  sessions: SessionInfo[];
}
