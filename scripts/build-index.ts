// Build script to generate session index
import { readdirSync, readFileSync, writeFileSync, statSync } from "fs";
import { join, relative } from "path";

const SESSIONS_DIR = "./data/sessions";
const OUTPUT_FILE = "./data/sessions/index.json";

interface SessionIndexItem {
  id: string;
  slug: string;
  title: string;
  directory: string;
  time_created: number;
  time_updated?: number;
  stats: unknown;
}

interface SessionStats {
  message_count: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost: number;
  total_tokens?: number;
}

function findJsonFiles(dir: string, files: string[] = []): string[] {
  const items = readdirSync(dir);

  for (const item of items) {
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      findJsonFiles(fullPath, files);
    } else if (item.endsWith(".json") && item !== "index.json") {
      files.push(fullPath);
    }
  }

  return files;
}

function normalizeStats(stats: unknown): SessionStats {
  const source = typeof stats === "object" && stats !== null ? stats : {};
  const normalized = source as Partial<SessionStats>;
  const totalInputTokens = normalized.total_input_tokens ?? 0;
  const totalOutputTokens = normalized.total_output_tokens ?? 0;

  return {
    message_count: normalized.message_count ?? 0,
    total_input_tokens: totalInputTokens,
    total_output_tokens: totalOutputTokens,
    total_cost: normalized.total_cost ?? 0,
    total_tokens: normalized.total_tokens ?? totalInputTokens + totalOutputTokens,
  };
}

function buildIndex() {
  const files = findJsonFiles(SESSIONS_DIR);

  const sessions: SessionIndexItem[] = [];

  for (const file of files) {
    const content = readFileSync(file, "utf-8");
    const session = JSON.parse(content);

    // 计算相对于 SESSIONS_DIR 的 slug（包含子目录）
    const relativePath = relative(SESSIONS_DIR, file);
    const slug = relativePath.replace(".json", "").replace(/\\/g, "/");

    sessions.push({
      id: session.id,
      slug: slug,
      title: session.title,
      directory: session.directory,
      time_created: session.time_created,
      time_updated: session.time_updated,
      stats: normalizeStats(session.stats),
    });
  }

  // Sort by time_created desc
  sessions.sort((a, b) => b.time_created - a.time_created);

  const index = {
    sessions,
    generated_at: new Date().toISOString(),
  };

  writeFileSync(OUTPUT_FILE, JSON.stringify(index, null, 2));
  console.log(`Generated index with ${sessions.length} sessions`);
}

buildIndex();
