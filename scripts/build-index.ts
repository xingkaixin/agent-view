// Build script to generate session index
import { readdirSync, readFileSync, writeFileSync, statSync } from "fs";
import { join, relative } from "path";

const SESSIONS_DIR = "./data/sessions";
const OUTPUT_FILE = "./data/sessions/index.json";

interface SessionIndexItem {
  id: string;
  slug: string;
  title: string;
  summary?: string;
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
      summary: typeof session.summary === "string" ? session.summary : undefined,
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

  buildSitemap(sessions);
}

const BASE_URL = "https://agent.xingkaixin.me";
const SITEMAP_OUTPUT = "./public/sitemap.xml";

function buildSitemap(sessions: SessionIndexItem[]) {
  const now = new Date().toISOString().split("T")[0];

  const agentKeys = new Set<string>();
  for (const session of sessions) {
    const agentKey = session.slug.split("/")[0];
    if (agentKey) agentKeys.add(agentKey);
  }

  const entries: string[] = [];

  entries.push(urlEntry(`${BASE_URL}/`, now, "daily", "1.0"));

  for (const agentKey of agentKeys) {
    entries.push(urlEntry(`${BASE_URL}/${agentKey}`, now, "daily", "0.8"));
  }

  for (const session of sessions) {
    const lastmod = session.time_updated || session.time_created;
    const lastmodStr = lastmod ? new Date(lastmod).toISOString().split("T")[0] : now;
    entries.push(urlEntry(`${BASE_URL}/${session.slug}`, lastmodStr, "monthly", "0.6"));
  }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>
`;

  writeFileSync(SITEMAP_OUTPUT, sitemap);
  console.log(`Generated sitemap with ${entries.length} URLs`);
}

function urlEntry(loc: string, lastmod: string, changefreq: string, priority: string): string {
  return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

buildIndex();
