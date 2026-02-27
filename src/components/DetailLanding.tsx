import { Link } from "react-router-dom";
import { ModelConfig } from "../config";
import { SessionInfo } from "../types";

export interface LandingSession extends SessionInfo {
  agentKey: string;
  sessionSlug: string;
  fullPath: string;
}

export interface LandingAgentItem {
  key: string;
  name: string;
  icon: string;
  count: number;
}

interface DetailLandingProps {
  type: "global" | "agent";
  sessions: LandingSession[];
  agentItems: LandingAgentItem[];
  activeAgentKey?: string;
}

function formatNumber(value: number) {
  return value.toLocaleString("en-US");
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
  return `${Math.floor(hours / 24)}d ago`;
}

function LandingCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-sm border border-[var(--console-border)] bg-white p-4">
      <p className="console-mono text-[11px] uppercase tracking-wider text-[var(--console-muted)]">
        {label}
      </p>
      <p className="console-mono mt-2 text-xl font-semibold text-[var(--console-text)]">{value}</p>
      {hint ? <p className="mt-1 text-xs text-[var(--console-muted)]">{hint}</p> : null}
    </div>
  );
}

function RecentSessions({ sessions }: { sessions: LandingSession[] }) {
  if (sessions.length === 0) {
    return (
      <div className="rounded-sm border border-[var(--console-border)] bg-white p-4 text-sm text-[var(--console-muted)]">
        暂无会话
      </div>
    );
  }

  return (
    <div className="rounded-sm border border-[var(--console-border)] bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="console-mono text-xs font-bold uppercase text-[var(--console-text)]">
          Recent Sessions
        </h3>
        <span className="console-mono text-[11px] text-[var(--console-muted)]">
          {sessions.length} items
        </span>
      </div>
      <ul className="space-y-2">
        {sessions.map((session) => (
          <li key={session.id}>
            <Link
              to={`/${session.fullPath}`}
              className="block rounded-sm border border-transparent px-2 py-1.5 transition-colors hover:border-[var(--console-border)] hover:bg-[var(--console-surface-muted)]"
            >
              <p className="line-clamp-1 text-sm text-[var(--console-text)]">{session.title}</p>
              <p className="console-mono mt-0.5 text-[11px] text-[var(--console-muted)]">
                /{session.fullPath} · {formatRelativeTime(session.time_updated || session.time_created)}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DetailLanding({ type, sessions, agentItems, activeAgentKey }: DetailLandingProps) {
  const sortedSessions = sessions.toSorted(
    (a, b) => (b.time_updated || b.time_created || 0) - (a.time_updated || a.time_created || 0),
  );
  const recentSessions = sortedSessions.slice(0, 5);

  const totalMessages = sessions.reduce((sum, item) => sum + item.stats.message_count, 0);
  const totalTokens = sessions.reduce(
    (sum, item) => sum + item.stats.total_input_tokens + item.stats.total_output_tokens,
    0,
  );
  const latestUpdatedAt = sortedSessions[0]?.time_updated || sortedSessions[0]?.time_created;

  if (type === "global") {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <LandingCard label="Total Sessions" value={formatNumber(sessions.length)} />
          <LandingCard label="Total Messages" value={formatNumber(totalMessages)} />
          <LandingCard
            label="Latest Activity"
            value={formatRelativeTime(latestUpdatedAt)}
            hint={latestUpdatedAt ? new Date(latestUpdatedAt).toLocaleString("zh-CN") : undefined}
          />
        </div>

        <div className="rounded-sm border border-[var(--console-border)] bg-white p-4">
          <h3 className="console-mono mb-3 text-xs font-bold uppercase text-[var(--console-text)]">
            Agents
          </h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {agentItems.map((agent) => (
              <li key={agent.key}>
                <Link
                  to={`/${agent.key}`}
                  className="flex items-center gap-2 rounded-sm border border-transparent px-2 py-1.5 transition-colors hover:border-[var(--console-border)] hover:bg-[var(--console-surface-muted)]"
                >
                  <img src={agent.icon} alt={agent.name} className="size-4 object-contain" />
                  <span className="console-mono flex-1 text-xs text-[var(--console-text)]">
                    {agent.name}
                  </span>
                  <span className="console-mono text-[11px] text-[var(--console-muted)]">
                    {agent.count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <RecentSessions sessions={recentSessions} />
      </div>
    );
  }

  const activeAgent = activeAgentKey ? ModelConfig.agents[activeAgentKey] : null;
  const displayName = activeAgent ? activeAgent.name : "Unknown Agent";

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="rounded-sm border border-[var(--console-border)] bg-white p-4">
        <div className="flex items-center gap-3">
          {activeAgent ? (
            <img src={activeAgent.icon} alt={displayName} className="size-6 object-contain" />
          ) : null}
          <div>
            <h3 className="console-mono text-sm font-semibold text-[var(--console-text)]">
              {displayName}
            </h3>
            <p className="console-mono text-xs text-[var(--console-muted)]">
              请选择左侧会话进入详情
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <LandingCard label="Sessions" value={formatNumber(sessions.length)} />
        <LandingCard label="Messages" value={formatNumber(totalMessages)} />
        <LandingCard label="Tokens" value={formatNumber(totalTokens)} />
      </div>

      <RecentSessions sessions={recentSessions} />
    </div>
  );
}
