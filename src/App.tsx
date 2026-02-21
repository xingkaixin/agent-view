import { SessionList } from './components/SessionList';
import { SessionDetail } from './components/SessionDetail';
import { IndexData, Session } from './types';
import { useEffect, useState } from 'react';
import { Routes, Route, useParams, Link, useLocation } from 'react-router-dom';

function SessionDetailRoute({ sessionsBySlug }: { sessionsBySlug: Map<string, Session> }) {
  const params = useParams();
  const slug = params["*"];
  const session = slug ? sessionsBySlug.get(slug) : null;
  if (!session) return <div className="p-10 text-center">会话不存在</div>;
  return <SessionDetail session={session} />;
}

export default function App() {
  const [sessions, setSessions] = useState<Map<string, Session>>(new Map());
  const [sessionsBySlug, setSessionsBySlug] = useState<Map<string, Session>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const indexResponse = await fetch('/data/sessions/index.json');
        if (!indexResponse.ok) {
          throw new Error('Failed to load index');
        }
        const index: IndexData = await indexResponse.json();

        const sessionPromises = index.sessions.map(async (sessionInfo) => {
          try {
            const response = await fetch(`/data/sessions/${sessionInfo.slug}.json`);
            if (!response.ok) return null;
            const session: Session = await response.json();
            session._urlSlug = sessionInfo.slug;
            return session;
          } catch (e) {
            console.warn(`Failed to load session ${sessionInfo.slug}:`, e);
            return null;
          }
        });

        const loadedSessions = (await Promise.all(sessionPromises)).filter((s): s is Session => s !== null);

        const newSessions = new Map();
        const newSessionsBySlug = new Map();

        loadedSessions.forEach(session => {
          newSessions.set(session.id, session);
          if (session._urlSlug) {
            newSessionsBySlug.set(session._urlSlug, session);
          }
        });

        setSessions(newSessions);
        setSessionsBySlug(newSessionsBySlug);
      } catch (err) {
        console.error('Failed to load data:', err);
        setError('加载数据失败，请确保已运行 build 生成索引');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const location = useLocation();
  const pathSlug = location.pathname.replace(/^\//, '');
  const currentSession = pathSlug ? sessionsBySlug.get(pathSlug) : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f4f9f7] via-[#e5f1ec] to-[#ecf4fb] text-[#102124] font-sans">
      <header className="fixed top-0 left-0 right-0 h-[60px] bg-[#fdfdfb] border-b border-[#c9d8d5] shadow-sm flex items-center justify-between px-6 z-50">
        <div className="flex items-center gap-4">
          {!currentSession ? (
            <>
              <img src="/logo.png" alt="Agent View Logo" className="w-8 h-8 object-contain" />
              <h1 className="text-lg font-semibold">Agent View</h1>
            </>
          ) : (
            <Link to="/" className="text-[#0b7285] text-sm flex items-center gap-1 hover:underline">
              ← 返回列表
            </Link>
          )}
        </div>
        <div className="flex gap-3 text-sm">
          {!currentSession ? (
            <span className="bg-[#f4f9f7] px-3 py-1.5 rounded-full border border-[#c9d8d5]">
              📊 {sessions.size} 会话
            </span>
          ) : (
            <>
              <span className="bg-[#f4f9f7] px-3 py-1.5 rounded-full border border-[#c9d8d5]">
                💬 {currentSession.stats.message_count} 消息
              </span>
              <span className="bg-[#f4f9f7] px-3 py-1.5 rounded-full border border-[#c9d8d5]">
                💰 ${currentSession.stats.total_cost.toFixed(4)}
              </span>
            </>
          )}
        </div>
      </header>

      <main className="max-w-[900px] mx-auto pt-[80px] pb-[40px] px-5">
        {loading ? (
          <div className="text-center py-[60px] text-[#7a8b8f]">
            <div className="text-[48px] mb-4">📊</div>
            <p>加载会话数据中...</p>
          </div>
        ) : error ? (
          <div className="p-10 text-center">{error}</div>
        ) : (
          <Routes>
            <Route path="/" element={<SessionList sessions={Array.from(sessions.values())} />} />
            <Route path="/*" element={<SessionDetailRoute sessionsBySlug={sessionsBySlug} />} />
          </Routes>
        )}
      </main>
    </div>
  );
}
