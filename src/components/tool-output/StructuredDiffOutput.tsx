import { DiffBlock, DiffLineItem } from "./types";

interface StructuredDiffOutputProps {
  blocks: DiffBlock[];
}

function getBlockKey(block: DiffBlock) {
  return `${block.label}:${block.lines.map((line) => `${line.type}:${line.text}`).join("\n")}`;
}

function getLineKey(block: DiffBlock, line: DiffLineItem, occurrence: number) {
  return `${block.label}:${line.type}:${line.text}:${occurrence}`;
}

function getStructuredDiffLineClassName(type: DiffLineItem["type"]) {
  if (type === "add") {
    return "text-[#15803d] bg-[#f0fdf4]";
  }
  if (type === "remove") {
    return "text-[#b91c1c] bg-[#fef2f2]";
  }
  return "text-[var(--console-text)]";
}

export function StructuredDiffOutput({ blocks }: StructuredDiffOutputProps) {
  return (
    <div className="space-y-3">
      {blocks.map((block) => {
        const lineOccurrences = new Map<string, number>();
        return (
          <div
            key={getBlockKey(block)}
            className="overflow-hidden rounded-sm border border-[var(--console-border)] bg-[#fafafa]"
          >
            <div className="border-b border-[var(--console-border)] bg-[var(--console-surface-muted)] px-3 py-1.5">
              <span className="console-mono text-[11px] font-semibold text-[var(--console-muted)]">
                {block.label}
              </span>
            </div>
            <pre className="console-mono max-h-[280px] overflow-auto whitespace-pre p-3 text-xs leading-relaxed">
              {block.lines.map((line) => {
                const lineBaseKey = `${line.type}:${line.text}`;
                const occurrence = lineOccurrences.get(lineBaseKey) ?? 0;
                lineOccurrences.set(lineBaseKey, occurrence + 1);
                return (
                  <span
                    key={getLineKey(block, line, occurrence)}
                    className={`block rounded-[2px] px-1 ${getStructuredDiffLineClassName(line.type)}`}
                  >
                    {line.type === "add" ? "+" : line.type === "remove" ? "-" : " "}
                    {line.text || " "}
                  </span>
                );
              })}
            </pre>
          </div>
        );
      })}
    </div>
  );
}
