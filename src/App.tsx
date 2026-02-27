import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { ModelConfig } from "./config";
import { SessionDetail } from "./components/SessionDetail";
import { SessionList } from "./components/SessionList";
import { IndexData, Session, SessionInfo } from "./types";

interface SessionDetailRouteProps {
  slug: string;
  sessions: SessionInfo[];
  currentSession: SessionInfo | null;
}

function formatRelativeTime(timestamp?: number) {
  if (!timestamp) {
    return "unknown";
  }

  const diff = Date.now() - timestamp;
  if (Number.isNaN(diff) || diff < 0) {
    return "just now";
  }

  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) {
    return "just now";
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getSessionSlug(session: SessionInfo) {
  return session.slug || session.id;
}

function getSessionAgent(session: SessionInfo) {
  const slug = getSessionSlug(session);
  const [candidate] = slug.split("/");
  const normalized = candidate?.toLowerCase();
  if (normalized && ModelConfig.agents[normalized]) {
    return normalized;
  }
  return ModelConfig.getDefaultAgentKey() || "opencode";
}

function SessionDetailRoute({ slug, sessions, currentSession }: SessionDetailRouteProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const currentAgent = currentSession ? getSessionAgent(currentSession) : ModelConfig.getDefaultAgentKey() || "opencode";
  const [selectedAgent, setSelectedAgent] = useState(currentAgent);

  useEffect(() => {
    const abortController = new AbortController();

    async function loadSession() {
      if (!slug) {
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/data/sessions/${slug}.json`, {
          signal: abortController.signal,
        });
        if (!response.ok) {
          throw new Error("Session not found");
        }
        const data: Session = await response.json();
        data._urlSlug = slug;
        setSession(data);
      } catch (e: unknown) {
        if (e instanceof Error && e.name === "AbortError") {
          return;
        }
        console.error("Failed to load session:", e);
        setError("获取会话数据失败");
      } finally {
        setLoading(false);
      }
    }
    void loadSession();

    return () => {
      abortController.abort();
    };
  }, [slug]);

  useEffect(() => {
    setSelectedAgent(currentAgent);
  }, [currentAgent]);

  const agentItems = useMemo(
    () =>
      Object.entries(ModelConfig.agents).map(([key, value]) => ({
        key,
        name: value.name,
        icon: value.icon,
        count: sessions.filter((item) => getSessionAgent(item) === key).length,
      })),
    [sessions],
  );

  const sidebarSessions = useMemo(
    () =>
      sessions
        .filter((item) => getSessionAgent(item) === selectedAgent)
        .toSorted(
          (a, b) =>
            (b.time_updated || b.time_created || 0) - (a.time_updated || a.time_created || 0),
        ),
    [selectedAgent, sessions],
  );

  const displaySessionId = (currentSession?.id || slug).replace(/[^a-zA-Z0-9]/g, "").slice(0, 8);
  const updatedTime = currentSession?.time_updated || currentSession?.time_created;

  let content: ReactNode;
  if (loading) {
    content = (
      <div className="mx-auto max-w-4xl p-10 text-center text-[var(--console-muted)]">
        加载会话内容中...
      </div>
    );
  } else if (error || !session) {
    content = (
      <div className="mx-auto max-w-4xl p-10 text-center text-[var(--console-text)]">
        {error || "会话不存在"}
      </div>
    );
  } else {
    content = <SessionDetail session={session} />;
  }

  return (
    <div className="console-ui h-screen overflow-hidden bg-[var(--console-bg)] text-[var(--console-text)]">
      <header className="h-14 shrink-0 border-b border-[var(--console-border)] bg-white/85 backdrop-blur-sm">
        <div className="flex h-full items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <Link to="/" className="flex items-center gap-2 text-[var(--console-text)]">
              <img
                src="/logo.svg"
                alt="Agent View Logo"
                className="h-6 w-6 rounded-sm border border-[var(--console-border)] bg-white p-0.5"
              />
              <span className="console-mono text-sm font-semibold uppercase tracking-[0.05em]">
                Agent View
              </span>
            </Link>
          </div>
          <span className="console-mono rounded-sm border border-[var(--console-border)] bg-[var(--console-surface-muted)] px-2 py-1 text-xs text-[var(--console-muted)]">
            v0.2.0
          </span>
        </div>
      </header>

      <div className="flex h-[calc(100vh-56px)] min-h-0">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-[var(--console-border)] bg-[var(--console-sidebar-bg)] lg:flex">
          <div className="console-scrollbar flex-1 space-y-8 overflow-y-auto px-4 py-6">
            <section>
              <h3 className="console-mono mb-3 text-xs font-bold uppercase text-[var(--console-text)]">
                AGENT
              </h3>
              <ul className="space-y-1">
                {agentItems.map((agent) => {
                  const isSelected = agent.key === selectedAgent;
                  return (
                    <li key={agent.key}>
                      <button
                        type="button"
                        onClick={() => setSelectedAgent(agent.key)}
                        className={`flex w-full items-center gap-2 rounded-sm border px-3 py-1.5 text-left transition-colors ${
                          isSelected
                            ? "border-[var(--console-border-strong)] bg-white text-[var(--console-text)]"
                            : "border-transparent text-[var(--console-muted)] hover:border-[var(--console-border)] hover:bg-[var(--console-surface-muted)]"
                        }`}
                      >
                        <img src={agent.icon} alt={agent.name} className="size-3.5 object-contain" />
                        <span className="console-mono line-clamp-1 flex-1 text-xs">{agent.name}</span>
                        <span className="console-mono text-[11px] text-[var(--console-muted)]">
                          {agent.count}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section>
              <h3 className="console-mono mb-3 text-xs font-bold uppercase text-[var(--console-text)]">
                SESSIONS
              </h3>
              <ul className="space-y-1">
                {sidebarSessions.map((item) => {
                  const sessionSlug = getSessionSlug(item);
                  const isActive = sessionSlug === slug;
                  return (
                    <li key={item.id}>
                      <Link
                        to={`/${sessionSlug}`}
                        className={`console-mono relative block rounded-sm border px-3 py-1.5 text-xs transition-colors ${
                          isActive
                            ? "border-[var(--console-border-strong)] bg-white text-[var(--console-text)] before:absolute before:bottom-0 before:left-0 before:top-0 before:w-0.5 before:bg-[var(--console-accent)]"
                            : "border-transparent text-[var(--console-muted)] hover:border-[var(--console-border)] hover:bg-[var(--console-surface-muted)]"
                        }`}
                        title={item.title}
                      >
                        <span className="line-clamp-1">{item.title}</span>
                      </Link>
                    </li>
                  );
                })}
                {sidebarSessions.length === 0 ? (
                  <li>
                    <span className="console-mono block rounded-sm px-3 py-1.5 text-xs text-[var(--console-muted)]">
                      暂无会话
                    </span>
                  </li>
                ) : null}
              </ul>
            </section>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <section className="shrink-0 border-b border-[var(--console-border)] bg-white/70 px-4 py-4 backdrop-blur-sm md:px-8">
            <div>
              <div className="flex items-center gap-2">
                <span className="console-mono rounded-sm border border-[var(--console-border)] bg-[var(--console-surface-muted)] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[var(--console-muted)]">
                  Session
                </span>
                <h1 className="console-mono text-xl font-semibold tracking-tight text-[var(--console-text)]">
                  {currentSession?.title || "Conversation"}
                </h1>
              </div>
              <p className="console-mono mt-1 text-xs text-[var(--console-muted)]">
                ID: #{displaySessionId || "UNKNOWN"} · Last updated {formatRelativeTime(updatedTime)}
              </p>
            </div>
          </section>

          <section className="console-scrollbar bg-grid min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-8">
            {content}
          </section>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const abortController = new AbortController();

    async function loadData() {
      try {
        const indexResponse = await fetch(`/data/sessions/index.json?t=${Date.now()}`, {
          signal: abortController.signal,
        });
        if (!indexResponse.ok) {
          throw new Error("Failed to load index");
        }
        const index: IndexData = await indexResponse.json();

        setSessions(index.sessions);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        console.error("Failed to load data:", err);
        setError("加载数据失败，请确保已运行 build 生成索引");
      } finally {
        setLoading(false);
      }
    }

    void loadData();

    return () => {
      abortController.abort();
    };
  }, []);

  const location = useLocation();
  const pathSlug = location.pathname.replace(/^\//, "");
  const currentSession = pathSlug ? sessions.find((s) => getSessionSlug(s) === pathSlug) : null;
  const isDetailRoute = pathSlug.length > 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#f4f9f7] via-[#e5f1ec] to-[#ecf4fb] text-[#102124] font-sans">
        <main className="mx-auto max-w-[900px] px-5 pb-[40px] pt-[80px]">
          <div className="py-[60px] text-center text-[#7a8b8f]">
            <div className="mb-4 text-[48px]">📊</div>
            <p>加载会话数据中...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return <div className="p-10 text-center">{error}</div>;
  }

  if (isDetailRoute) {
    return <SessionDetailRoute slug={pathSlug} sessions={sessions} currentSession={currentSession} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f4f9f7] via-[#e5f1ec] to-[#ecf4fb] text-[#102124] font-sans">
      <header className="fixed left-0 right-0 top-0 z-50 flex h-[60px] items-center justify-between border-b border-[#c9d8d5] bg-[#fdfdfb] px-6 shadow-sm">
        <div className="flex items-center gap-4">
          <img src="/logo.png" alt="Agent View Logo" className="h-8 w-8 object-contain" />
          <h1 className="text-lg font-semibold">Agent View</h1>
        </div>
        <div className="flex gap-3 text-sm">
          <span className="rounded-full border border-[#c9d8d5] bg-[#f4f9f7] px-3 py-1.5">
            📊 {sessions.length} 会话
          </span>
        </div>
      </header>

      <main className="max-w-[900px] mx-auto pt-[80px] pb-[40px] px-5">
        <SessionList sessions={sessions} />
      </main>
    </div>
  );
}
