export interface SessionStats {
  message_count: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost: number;
  total_tokens?: number;
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
  nickname?: string;
  subagent_id?: string;
  input?: unknown;
  output?: unknown;
  approval_status?: "success" | "fail";
  state?: {
    status?: "running" | "completed" | "error";
    input?: unknown;
    arguments?: unknown;
    output?: unknown;
    result?: unknown;
    error?: unknown;
    metadata?: unknown;
    prompt?: unknown;
    [key: string]: unknown;
  };
}

export interface Message {
  role: "user" | "assistant";
  agent?: string | null;
  time_created: string;
  mode?: string;
  model?: string;
  model_name?: string;
  reasoning_effort?: string;
  subagent_id?: string;
  nickname?: string;
  parts: MessagePart[];
  tokens?: MessageTokens;
  cost?: number;
}

export interface SessionInfo {
  id: string;
  slug: string;
  title: string;
  summary?: string;
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
  summary?: string;
  directory: string;
  time_created: string;
  stats: SessionStats;
  messages: Message[];
}

export interface IndexData {
  sessions: SessionInfo[];
}
