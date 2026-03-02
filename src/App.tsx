import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import packageJson from "../package.json";
import {
  DetailLanding,
  type LandingAgentItem,
  type LandingSession,
} from "./components/DetailLanding";
import { SessionDetail } from "./components/SessionDetail";
import { SessionDetailSkeleton } from "./components/SessionDetailSkeleton";
import { ModelConfig } from "./config";
import { IndexData, Session, SessionInfo } from "./types";

type ViewState =
  | { mode: "root"; activeAgentKey: null; activeSessionSlug: null }
  | { mode: "agent"; activeAgentKey: string; activeSessionSlug: null }
  | { mode: "session"; activeAgentKey: string; activeSessionSlug: string }
  | {
      mode: "missingAgent";
      activeAgentKey: null;
      activeSessionSlug: null;
      attemptedAgentKey: string;
      attemptedSessionSlug: string | null;
    }
  | { mode: "invalidRoute"; activeAgentKey: null; activeSessionSlug: null };

function safeDecodeSegment(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
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

export function parseViewState(pathname: string, validAgentKeys: Set<string>): ViewState {
  const trimmed = pathname.replace(/^\/+|\/+$/g, "");
  const segments = trimmed
    ? trimmed
        .split("/")
        .map((item) => safeDecodeSegment(item.trim()))
        .filter(Boolean)
    : [];

  if (segments.length === 0) {
    return { mode: "root", activeAgentKey: null, activeSessionSlug: null };
  }

  if (segments.length === 1) {
    const agentKey = segments[0].toLowerCase();
    if (validAgentKeys.has(agentKey)) {
      return { mode: "agent", activeAgentKey: agentKey, activeSessionSlug: null };
    }
    return {
      mode: "missingAgent",
      activeAgentKey: null,
      activeSessionSlug: null,
      attemptedAgentKey: agentKey,
      attemptedSessionSlug: null,
    };
  }

  if (segments.length === 2) {
    const agentKey = segments[0].toLowerCase();
    const sessionSlug = segments[1];
    if (validAgentKeys.has(agentKey) && sessionSlug) {
      return { mode: "session", activeAgentKey: agentKey, activeSessionSlug: sessionSlug };
    }
    return {
      mode: "missingAgent",
      activeAgentKey: null,
      activeSessionSlug: null,
      attemptedAgentKey: agentKey,
      attemptedSessionSlug: sessionSlug || null,
    };
  }

  return { mode: "invalidRoute", activeAgentKey: null, activeSessionSlug: null };
}

function normalizeSession(session: SessionInfo): LandingSession | null {
  const sourceSlug = (session.slug || session.id || "").replace(/^\/+|\/+$/g, "");
  const parts = sourceSlug.split("/").filter(Boolean);
  if (parts.length !== 2) {
    return null;
  }

  const agentKey = parts[0].toLowerCase();
  const sessionSlug = parts[1];
  if (!ModelConfig.agents[agentKey] || !sessionSlug) {
    return null;
  }

  const fullPath = `${agentKey}/${sessionSlug}`;

  return {
    ...session,
    slug: fullPath,
    agentKey,
    sessionSlug,
    fullPath,
  };
}

interface ResolvedHeader {
  title: string;
  subtitle: string;
}

interface RenderContentParams {
  loading: boolean;
  error: string | null;
  viewState: ViewState;
  normalizedSessions: LandingSession[];
  agentItems: LandingAgentItem[];
  activeAgentKey: string | null;
  sidebarSessions: LandingSession[];
  sessionLoading: boolean;
  sessionError: string | null;
  session: Session | null;
}

export function resolveHeaderContent({
  viewState,
  activeAgentKey,
  sidebarSessions,
  currentSessionInfo,
  activeSessionPath,
  sessionError,
}: {
  viewState: ViewState;
  activeAgentKey: string | null;
  sidebarSessions: LandingSession[];
  currentSessionInfo: LandingSession | null;
  activeSessionPath: string | null;
  sessionError: string | null;
}): ResolvedHeader {
  let title = "Welcome";
  let subtitle = "Select an agent to continue";

  if (viewState.mode === "agent" && activeAgentKey) {
    const name = ModelConfig.getAgentName(activeAgentKey);
    title = name;
    subtitle = `${sidebarSessions.length} sessions`;
  }

  if (viewState.mode === "session") {
    if (sessionError) {
      title = "Session Not Found";
      subtitle = activeSessionPath ? `Requested /${activeSessionPath}` : "Requested session path";
    } else {
      const displaySessionId = (currentSessionInfo?.id || activeSessionPath || "")
        .replace(/[^a-zA-Z0-9]/g, "")
        .slice(0, 8);
      const updatedTime = currentSessionInfo?.time_updated || currentSessionInfo?.time_created;
      title = currentSessionInfo?.title || "Conversation";
      subtitle = `ID: #${displaySessionId || "UNKNOWN"} · Last updated ${formatRelativeTime(updatedTime)}`;
    }
  }

  if (viewState.mode === "missingAgent") {
    title = "Agent Not Found";
    subtitle = `Requested /${viewState.attemptedAgentKey}${viewState.attemptedSessionSlug ? `/${viewState.attemptedSessionSlug}` : ""}`;
  }

  if (viewState.mode === "invalidRoute") {
    title = "Invalid Route";
    subtitle = "路径结构无效，请从左侧选择 Agent。";
  }

  return {
    title,
    subtitle,
  };
}

export function renderMainContent({
  loading,
  error,
  viewState,
  normalizedSessions,
  agentItems,
  activeAgentKey,
  sidebarSessions,
  sessionLoading,
  sessionError,
  session,
}: RenderContentParams): ReactNode {
  if (loading) {
    return (
      <div className="mx-auto max-w-4xl rounded-sm border border-[var(--console-border)] bg-white p-6 text-sm text-[var(--console-muted)]">
        加载会话索引中...
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl rounded-sm border border-[var(--console-error-border)] bg-[var(--console-error-bg)] p-6 text-sm text-[var(--console-error)]">
        {error}
      </div>
    );
  }

  if (viewState.mode === "root") {
    return <DetailLanding type="global" sessions={normalizedSessions} agentItems={agentItems} />;
  }

  if (viewState.mode === "agent" && activeAgentKey) {
    return (
      <DetailLanding
        type="agent"
        activeAgentKey={activeAgentKey}
        sessions={sidebarSessions}
        agentItems={agentItems}
      />
    );
  }

  if (viewState.mode === "session") {
    if (sessionLoading) {
      return <SessionDetailSkeleton />;
    }

    if (sessionError || !session) {
      return (
        <DetailLanding
          type="missing-session"
          activeAgentKey={activeAgentKey ?? undefined}
          attemptedSessionSlug={viewState.activeSessionSlug}
          sessions={sidebarSessions}
          agentItems={agentItems}
        />
      );
    }

    return <SessionDetail session={session} />;
  }

  if (viewState.mode === "missingAgent") {
    return (
      <DetailLanding
        type="missing-agent"
        sessions={normalizedSessions}
        agentItems={agentItems}
        attemptedAgentKey={viewState.attemptedAgentKey}
        attemptedSessionSlug={viewState.attemptedSessionSlug}
      />
    );
  }

  return (
    <div className="mx-auto max-w-4xl rounded-sm border border-[var(--console-error-border)] bg-[var(--console-error-bg)] p-6 text-sm text-[var(--console-error)]">
      路径无效。请从左侧选择 Agent。
    </div>
  );
}

export default function App() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

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
  const validAgentKeys = useMemo(() => new Set(Object.keys(ModelConfig.agents)), []);

  const normalizedSessions = useMemo(
    () =>
      sessions
        .map((item) => normalizeSession(item))
        .filter((item): item is LandingSession => item != null),
    [sessions],
  );

  const sessionsByAgent = useMemo(() => {
    const grouped: Record<string, LandingSession[]> = {};
    for (const key of Object.keys(ModelConfig.agents)) {
      grouped[key] = [];
    }

    for (const item of normalizedSessions) {
      grouped[item.agentKey]?.push(item);
    }

    for (const key of Object.keys(grouped)) {
      grouped[key] = grouped[key].toSorted(
        (a, b) => (b.time_updated || b.time_created || 0) - (a.time_updated || a.time_created || 0),
      );
    }

    return grouped;
  }, [normalizedSessions]);

  const sessionByPath = useMemo(() => {
    const map = new Map<string, LandingSession>();
    for (const item of normalizedSessions) {
      map.set(item.fullPath, item);
    }
    return map;
  }, [normalizedSessions]);

  const agentItems = useMemo<LandingAgentItem[]>(
    () =>
      Object.entries(ModelConfig.agents).map(([key, value]) => ({
        key,
        name: value.name,
        icon: value.icon,
        count: sessionsByAgent[key]?.length || 0,
      })),
    [sessionsByAgent],
  );

  const viewState = useMemo(
    () => parseViewState(location.pathname, validAgentKeys),
    [location.pathname, validAgentKeys],
  );

  const activeAgentKey = viewState.activeAgentKey;
  const activeSessionPath =
    viewState.mode === "session"
      ? `${viewState.activeAgentKey}/${viewState.activeSessionSlug}`
      : null;

  const currentSessionInfo = activeSessionPath
    ? sessionByPath.get(activeSessionPath) || null
    : null;
  const sidebarSessions = activeAgentKey ? sessionsByAgent[activeAgentKey] || [] : [];

  useEffect(() => {
    const abortController = new AbortController();

    async function loadSession() {
      if (!activeSessionPath) {
        setSession(null);
        setSessionError(null);
        setSessionLoading(false);
        return;
      }

      setSessionLoading(true);
      setSessionError(null);

      try {
        const response = await fetch(`/data/sessions/${activeSessionPath}.json`, {
          signal: abortController.signal,
        });
        if (!response.ok) {
          throw new Error("Session not found");
        }
        const data: Session = await response.json();
        data._urlSlug = activeSessionPath;
        setSession(data);
      } catch (e: unknown) {
        if (e instanceof Error && e.name === "AbortError") {
          return;
        }
        console.error("Failed to load session:", e);
        setSessionError("Session not found");
        setSession(null);
      } finally {
        setSessionLoading(false);
      }
    }

    void loadSession();

    return () => {
      abortController.abort();
    };
  }, [activeSessionPath]);

  const { title, subtitle } = resolveHeaderContent({
    viewState,
    activeAgentKey,
    sidebarSessions,
    currentSessionInfo,
    activeSessionPath,
    sessionError,
  });
  const content = renderMainContent({
    loading,
    error,
    viewState,
    normalizedSessions,
    agentItems,
    activeAgentKey,
    sidebarSessions,
    sessionLoading,
    sessionError,
    session,
  });

  return (
    <div className="console-ui h-screen overflow-hidden bg-[var(--console-bg)] text-[var(--console-text)]">
      <header className="h-14 shrink-0 border-b border-[var(--console-border)] bg-white/85 backdrop-blur-sm">
        <div className="flex h-full items-center justify-between px-4">
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
          <span className="console-mono rounded-sm border border-[var(--console-border)] bg-[var(--console-surface-muted)] px-2 py-1 text-xs text-[var(--console-muted)]">
            v{packageJson.version}
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
                  const isSelected = agent.key === activeAgentKey;
                  return (
                    <li key={agent.key}>
                      <Link
                        to={`/${agent.key}`}
                        className={`flex items-center gap-2 rounded-sm border px-3 py-1.5 text-left transition-colors ${
                          isSelected
                            ? "border-[var(--console-border-strong)] bg-white text-[var(--console-text)]"
                            : "border-transparent text-[var(--console-muted)] hover:border-[var(--console-border)] hover:bg-[var(--console-surface-muted)]"
                        }`}
                      >
                        <img
                          src={agent.icon}
                          alt={agent.name}
                          className="size-3.5 object-contain"
                        />
                        <span className="console-mono line-clamp-1 flex-1 text-xs">
                          {agent.name}
                        </span>
                        <span className="console-mono text-[11px] text-[var(--console-muted)]">
                          {agent.count}
                        </span>
                      </Link>
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
                {!activeAgentKey ? (
                  <li>
                    <span className="console-mono block rounded-sm px-3 py-1.5 text-xs text-[var(--console-muted)]">
                      Select an agent
                    </span>
                  </li>
                ) : sidebarSessions.length === 0 ? (
                  <li>
                    <span className="console-mono block rounded-sm px-3 py-1.5 text-xs text-[var(--console-muted)]">
                      No sessions yet
                    </span>
                  </li>
                ) : (
                  sidebarSessions.map((item) => {
                    const isActive = item.fullPath === activeSessionPath;
                    return (
                      <li key={item.id}>
                        <Link
                          to={`/${item.fullPath}`}
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
                  })
                )}
              </ul>
            </section>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <section className="shrink-0 border-b border-[var(--console-border)] bg-white/70 px-4 py-4 backdrop-blur-sm md:px-8">
            <div>
              <div className="flex items-center gap-2">
                <span className="console-mono rounded-sm border border-[var(--console-border)] bg-[var(--console-surface-muted)] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[var(--console-muted)]">
                  {viewState.mode === "session" ? "Session" : "Landing"}
                </span>
                <h1 className="console-mono text-xl font-semibold tracking-tight text-[var(--console-text)]">
                  {title}
                </h1>
              </div>
              <p className="console-mono mt-1 text-xs text-[var(--console-muted)]">{subtitle}</p>
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
