export type ToolOutputLanguage = string;

export interface PlainToolOutputContent {
  kind: "plain";
  text: string;
  language: ToolOutputLanguage;
  isCode: boolean;
}

export interface DiffLineItem {
  type: "context" | "add" | "remove";
  text: string;
}

export interface DiffBlock {
  label: string;
  lines: DiffLineItem[];
}

export interface StructuredDiffToolOutputContent {
  kind: "structured-diff";
  blocks: DiffBlock[];
}

export type ToolOutputContent = PlainToolOutputContent | StructuredDiffToolOutputContent;
