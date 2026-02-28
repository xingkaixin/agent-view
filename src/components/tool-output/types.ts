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

export interface FileSectionItem {
  label: string;
  operation: "write" | "edit";
  language: ToolOutputLanguage;
  isCode: boolean;
  text: string;
}

export interface FileSectionsToolOutputContent {
  kind: "file-sections";
  sections: FileSectionItem[];
}

export type ToolOutputContent =
  | PlainToolOutputContent
  | StructuredDiffToolOutputContent
  | FileSectionsToolOutputContent;
