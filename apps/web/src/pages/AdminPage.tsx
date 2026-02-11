import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { HudPanel } from '../components/HudPanel';
import { NeonButton } from '../components/NeonButton';
import { HudTag } from '../components/HudTag';
import { StatCard } from '../components/StatCard';
import { CountdownTimer } from '../components/CountdownTimer';
import { apiPost, apiPut, apiGet } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { EventDoc, LeagueDoc, EventAnalyticsSummary, LeagueAnalyticsSummary, BadgeDoc, DEFAULT_BADGES } from '@mdavelctf/shared';
import { useTranslation } from 'react-i18next';

type Tab = 'overview' | 'events' | 'leagues' | 'challenges' | 'users' | 'logs' | 'badges' | 'quests' | 'seed' | 'docs';

function getEventStatus(e: EventDoc) {
  const now = Date.now();
  if (now < new Date(e.startsAt).getTime()) return 'UPCOMING';
  if (now > new Date(e.endsAt).getTime()) return 'ENDED';
  return 'LIVE';
}

export default function AdminPage() {
  const { t } = useTranslation();
  const { userDoc } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');

  if (userDoc?.role !== 'admin') {
    return (
      <div className="p-8 text-center text-danger text-lg font-semibold">
        {t('admin.accessDenied')}
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'overview', label: t('admin.dashboard'), icon: '📊' },
    { key: 'events', label: t('admin.events'), icon: '🏁' },
    { key: 'leagues', label: t('admin.leagues'), icon: '🏆' },
    { key: 'challenges', label: t('admin.challenges'), icon: '🧩' },
    { key: 'users', label: t('admin.users'), icon: '👤' },
    { key: 'badges', label: t('admin.badges'), icon: '🎖️' },
    { key: 'quests', label: t('admin.quests'), icon: '📜' },
    { key: 'logs', label: t('admin.logs'), icon: '📋' },
    { key: 'seed', label: 'Seed', icon: '🌱' },
    { key: 'docs', label: t('admin.guide'), icon: '📖' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-warning text-2xl">⚡</span>
        <h1 className="text-2xl font-extrabold text-accent glow-text tracking-wider">
          {t('admin.title')}
        </h1>
      </div>

      {/* Tabs — scrollable on mobile */}
      <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold uppercase tracking-widest border transition-all whitespace-nowrap flex-shrink-0 ${
              tab === t.key
                ? 'border-accent text-accent bg-accent/10'
                : 'border-accent/20 text-hud-text/50 hover:text-accent hover:border-accent/40'
            }`}
          >
            <span>{t.icon}</span>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {tab === 'overview' && <AdminOverview />}
      {tab === 'events' && <AdminEvents />}
      {tab === 'leagues' && <AdminLeagues />}
      {tab === 'challenges' && <AdminChallenges />}
      {tab === 'users' && <AdminUsers />}
      {tab === 'badges' && <AdminBadges />}
      {tab === 'quests' && <AdminQuests />}
      {tab === 'logs' && <AdminLogs />}
      {tab === 'seed' && <AdminSeedManager />}
      {tab === 'docs' && <AdminDocs />}
    </div>
  );
}

/* ─── Overview Dashboard ─── */
function AdminOverview() {
  const [summary, setSummary] = useState<any>(null);
  const [events, setEvents] = useState<(EventDoc & { id: string })[]>([]);
  const [leagues, setLeagues] = useState<(LeagueDoc & { id: string })[]>([]);
  const [analytics, setAnalytics] = useState<Record<string, EventAnalyticsSummary>>({});
  const [leagueAnalytics, setLeagueAnalytics] = useState<Record<string, LeagueAnalyticsSummary>>({});

  // Activity feed state
  const [feedMode, setFeedMode] = useState<'submissions' | 'solves'>('submissions');
  const [feedData, setFeedData] = useState<any[]>([]);
  const [feedCursor, setFeedCursor] = useState<string | null>(null);
  const [feedLoading, setFeedLoading] = useState(false);
  const [correctOnly, setCorrectOnly] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const s = await apiGet('/admin/dashboard/summary');
        setSummary(s);
      } catch {}

      const eSnap = await getDocs(collection(db, 'events'));
      const evts = eSnap.docs.map((d) => ({ id: d.id, ...(d.data() as EventDoc) }));
      setEvents(evts);

      const lSnap = await getDocs(collection(db, 'leagues'));
      const lgs = lSnap.docs.map((d) => ({ id: d.id, ...(d.data() as LeagueDoc) }));
      setLeagues(lgs);

      const aMap: Record<string, EventAnalyticsSummary> = {};
      for (const evt of evts) {
        try {
          const snap = await getDoc(doc(db, 'events', evt.id, 'analytics', 'summary'));
          if (snap.exists()) aMap[evt.id] = snap.data() as EventAnalyticsSummary;
        } catch {}
      }
      setAnalytics(aMap);

      const laMap: Record<string, LeagueAnalyticsSummary> = {};
      for (const lg of lgs) {
        try {
          const snap = await getDoc(doc(db, 'leagues', lg.id, 'analytics', 'summary'));
          if (snap.exists()) laMap[lg.id] = snap.data() as LeagueAnalyticsSummary;
        } catch {}
      }
      setLeagueAnalytics(laMap);
    })();
  }, []);

  // Load activity feed
  const loadFeed = async (mode: string, cursor?: string | null, append = false) => {
    if (events.length === 0) return;
    setFeedLoading(true);
    try {
      const endpoint = mode === 'solves' ? '/admin/logs/solves' : '/admin/logs/submissions';
      // Aggregate feed from all events
      let allItems: any[] = [];
      for (const evt of events) {
        let url = `${endpoint}?eventId=${evt.id}&limit=10`;
        if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
        if (mode === 'submissions' && correctOnly) url += '&correctOnly=true';
        try {
          const res = await apiGet(url);
          const items = (res.submissions || res.solves || []).map((i: any) => ({ ...i, eventName: evt.name }));
          allItems = [...allItems, ...items];
        } catch {}
      }
      // Sort by time descending
      allItems.sort((a, b) => {
        const ta = new Date(a.submittedAt || a.solvedAt || 0).getTime();
        const tb = new Date(b.submittedAt || b.solvedAt || 0).getTime();
        return tb - ta;
      });
      allItems = allItems.slice(0, 20);
      setFeedData(append ? (prev: any[]) => [...prev, ...allItems] : allItems);
      setFeedCursor(null); // Disable cursor-based pagination for aggregated view
    } catch {}
    setFeedLoading(false);
  };

  useEffect(() => { if (events.length > 0) loadFeed(feedMode); }, [feedMode, correctOnly, events.length]);

  const liveCount = events.filter((e) => getEventStatus(e) === 'LIVE').length;
  const totalSubs = summary?.totalSubmissions ?? Object.values(analytics).reduce((s, a) => s + (a.submissionsTotal || 0), 0);
  const totalSolves = summary?.totalSolves ?? Object.values(analytics).reduce((s, a) => s + (a.solvesTotal || 0), 0);
  const solveRate = summary?.solveRate ?? (totalSubs > 0 ? Math.round((totalSolves / totalSubs) * 100) : 0);
  const totalUsers = summary?.totalUsers ?? 0;
  const totalEvts = summary?.totalEvents ?? events.length;

  return (
    <div className="space-y-6">
      {/* Live event banner */}
      {summary?.liveEventName && (
        <div className="p-4 border border-success/40 bg-success/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="live-dot" />
            <div>
              <span className="text-success font-bold text-lg">{summary.liveEventName}</span>
              <span className="text-hud-text/50 text-sm ml-3">LIVE NOW</span>
            </div>
          </div>
          {summary.liveEventEndsAt && (
            <CountdownTimer targetDate={summary.liveEventEndsAt} label="Ends in" />
          )}
        </div>
      )}

      {/* Top stats HUD row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        <StatCard label="Events" value={totalEvts} color="var(--accent)" />
        <StatCard label="Live Now" value={liveCount} icon={liveCount > 0 ? <span className="live-dot" /> : undefined} color="var(--success)" />
        <StatCard label="Users" value={totalUsers} color="var(--accent2)" />
        <StatCard label="Submissions" value={totalSubs} color="var(--hud-text)" />
        <StatCard label="Solves" value={totalSolves} color="var(--success)" />
        <StatCard label="Solve Rate" value={`${solveRate}%`} color="var(--warning)" />
      </div>

      {/* Two-column layout for main panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Feed — 2/3 width on desktop */}
        <div className="lg:col-span-2 space-y-4">
          <HudPanel title="Activity Feed" noPad>
            <div className="px-4 pt-3 pb-2 flex flex-wrap items-center gap-2 border-b border-accent/10">
              <button
                onClick={() => { setFeedMode('submissions'); setFeedCursor(null); }}
                className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-widest border transition-all ${feedMode === 'submissions' ? 'border-accent text-accent bg-accent/10' : 'border-accent/20 text-hud-text/40 hover:text-accent'}`}
              >
                Submissions
              </button>
              <button
                onClick={() => { setFeedMode('solves'); setFeedCursor(null); }}
                className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-widest border transition-all ${feedMode === 'solves' ? 'border-success text-success bg-success/10' : 'border-accent/20 text-hud-text/40 hover:text-success'}`}
              >
                Solves Only
              </button>
              {feedMode === 'submissions' && (
                <label className="flex items-center gap-1.5 text-xs text-hud-text/50 ml-auto cursor-pointer">
                  <input type="checkbox" checked={correctOnly} onChange={(e) => { setCorrectOnly(e.target.checked); setFeedCursor(null); }} className="accent-success" />
                  Correct only
                </label>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {feedData.map((s: any, i: number) => (
                <div key={`${s.id || i}`} className="flex items-center gap-3 px-4 py-2.5 border-b border-accent/5 hover:bg-accent/5 transition-colors">
                  <div className="flex-shrink-0">
                    {s.isCorrect !== undefined ? (
                      s.isCorrect
                        ? <span className="text-success text-lg">✓</span>
                        : <span className="text-danger text-lg">✗</span>
                    ) : (
                      <span className="text-success text-lg">✓</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm truncate">{s.displayName || s.uid?.slice(0, 8)}</span>
                      {s.attemptNumber > 1 && (
                        <span className="text-xs text-hud-text/30">#{s.attemptNumber}</span>
                      )}
                    </div>
                    <div className="text-xs text-hud-text/40 truncate">
                      {s.challengeTitle || s.challengeId?.slice(0, 12)}
                    </div>
                  </div>
                  <div className="text-xs text-hud-text/30 whitespace-nowrap">
                    {s.submittedAt ? new Date(s.submittedAt).toLocaleTimeString() : s.solvedAt ? new Date(s.solvedAt).toLocaleTimeString() : ''}
                  </div>
                </div>
              ))}
              {feedData.length === 0 && !feedLoading && (
                <p className="text-center text-hud-text/30 py-8 text-sm">No activity yet.</p>
              )}
            </div>
            {feedCursor && (
              <div className="px-4 py-3 border-t border-accent/10">
                <button
                  onClick={() => loadFeed(feedMode, feedCursor, true)}
                  disabled={feedLoading}
                  className="text-xs text-accent hover:text-accent/80 font-semibold uppercase tracking-widest"
                >
                  {feedLoading ? 'Loading…' : '↓ Load more'}
                </button>
              </div>
            )}
          </HudPanel>
        </div>

        {/* Right sidebar — 1/3 width */}
        <div className="space-y-4">
          {/* Top Active Users */}
          {summary?.topActiveUsers && summary.topActiveUsers.length > 0 && (
            <HudPanel title="Top Active (60m)">
              <div className="space-y-2">
                {summary.topActiveUsers.map((u: any, i: number) => (
                  <div key={u.uid} className="flex items-center gap-3 p-2">
                    <span className="text-xs font-bold text-accent/50 w-5">#{i + 1}</span>
                    <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center text-xs font-bold text-accent">
                      {(u.displayName || '?')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-sm truncate block">{u.displayName || u.uid.slice(0, 8)}</span>
                    </div>
                    <span className="text-xs font-bold text-accent">{u.submissionCount} subs</span>
                  </div>
                ))}
              </div>
            </HudPanel>
          )}

          {/* Hard Challenges */}
          {summary?.topHardChallenges && summary.topHardChallenges.length > 0 && (
            <HudPanel title="Hardest Challenges">
              <div className="space-y-2">
                {summary.topHardChallenges.map((c: any) => {
                  const total = (c.correctCount || 0) + (c.wrongCount || 0);
                  const failRate = total > 0 ? Math.round(((c.wrongCount || 0) / total) * 100) : 0;
                  return (
                    <div key={c.challengeId} className="p-3 border border-danger/15 hover:border-danger/30 transition-all">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm truncate flex-1">{c.title || c.challengeId?.slice(0, 12)}</span>
                        {c.difficulty && <HudTag color="var(--warning)">{c.difficulty}</HudTag>}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-hud-text/50">
                        {c.category && <span>{c.category}</span>}
                        {c.points && <span>{c.points}pts</span>}
                        <span className="text-danger font-semibold">{failRate}% fail rate</span>
                        <span>{c.wrongCount} wrong</span>
                      </div>
                      {/* Mini fail bar */}
                      <div className="mt-2 h-1.5 bg-accent/10 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${failRate}%`,
                            background: 'linear-gradient(90deg, var(--warning), var(--danger))',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </HudPanel>
          )}
        </div>
      </div>

      {/* Event status cards */}
      <HudPanel title="Events Overview">
        <div className="space-y-3">
          {events.map((e) => {
            const status = getEventStatus(e);
            const a = analytics[e.id];
            const statusColor = status === 'LIVE' ? 'var(--success)' : status === 'UPCOMING' ? 'var(--warning)' : 'var(--hud-text)';
            const subs = a?.submissionsTotal || 0;
            const solves = a?.solvesTotal || 0;
            const rate = subs > 0 ? Math.round((solves / subs) * 100) : 0;

            return (
              <div key={e.id} className="p-4 border border-accent/15 hover:border-accent/30 transition-all">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {status === 'LIVE' && <span className="live-dot" />}
                    <div>
                      <span className="font-bold text-base">{e.name}</span>
                      <HudTag className="ml-2" color={statusColor}>{status}</HudTag>
                    </div>
                  </div>
                  <div className="flex gap-4 text-sm">
                    <span className="text-hud-text/50">{subs} subs</span>
                    <span className="text-success font-semibold">{solves} solves</span>
                    <span className="text-warning font-semibold">{rate}% rate</span>
                  </div>
                </div>
                {a && Object.keys(a.solvesByChallenge || {}).length > 0 && (
                  <div className="mt-3 flex gap-1 items-end h-8">
                    {Object.entries(a.solvesByChallenge).map(([cid, count]) => {
                      const maxSolve = Math.max(...Object.values(a.solvesByChallenge), 1);
                      const h = Math.max((count / maxSolve) * 100, 8);
                      return (
                        <div
                          key={cid}
                          className="flex-1 rounded-t-sm transition-all hover:opacity-100 opacity-70"
                          style={{
                            height: `${h}%`,
                            background: `linear-gradient(to top, var(--accent2), var(--accent))`,
                          }}
                          title={`${cid}: ${count} solves`}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </HudPanel>

      {/* League season overview */}
      {leagues.length > 0 && (
        <HudPanel title="Season Analytics">
          {leagues.map((lg) => {
            const la = leagueAnalytics[lg.id];
            return (
              <div key={lg.id} className="p-4 border border-accent2/15 mb-3">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bold text-accent2 text-base">{lg.name}</span>
                  {la && (
                    <div className="flex gap-4 text-sm">
                      <span>{la.participantsTotal} players</span>
                      <span className="text-success">{la.retentionBuckets?.threePlus || 0} regulars</span>
                    </div>
                  )}
                </div>
                {la && Object.keys(la.participationByEvent || {}).length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-widest text-hud-text/40">Participation by Event</span>
                    <div className="space-y-1.5">
                      {Object.entries(la.participationByEvent).map(([eid, count]) => {
                        const maxP = Math.max(...Object.values(la.participationByEvent), 1);
                        const pct = (count / maxP) * 100;
                        const evtName = events.find((ev) => ev.id === eid)?.name || eid.slice(0, 12);
                        return (
                          <div key={eid} className="flex items-center gap-3">
                            <span className="text-xs font-mono w-28 truncate text-hud-text/60">{evtName}</span>
                            <div className="flex-1 bg-accent2/10 h-5 rounded-sm overflow-hidden">
                              <div
                                className="h-full bar-chart-bar rounded-sm flex items-center pl-2"
                                style={{
                                  width: `${pct}%`,
                                  background: `linear-gradient(90deg, var(--accent2), var(--accent))`,
                                }}
                              >
                                <span className="text-xs font-bold text-bg">{count}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {la && (
                  <div className="flex gap-4 mt-3 text-xs">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-danger/60" />
                      <span>{la.retentionBuckets?.one || 0} one-time</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-warning/60" />
                      <span>{la.retentionBuckets?.two || 0} two events</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-success/60" />
                      <span>{la.retentionBuckets?.threePlus || 0} regulars (3+)</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </HudPanel>
      )}
    </div>
  );
}

/* ─── Events Tab ─── */
function AdminEvents() {
  const [events, setEvents] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [leagueId, setLeagueId] = useState('');
  const [msg, setMsg] = useState('');

  const load = async () => {
    const snap = await getDocs(collection(db, 'events'));
    setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    try {
      await apiPost('/admin/event', {
        name,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        published: true,
        leagueId: leagueId || null,
      });
      setMsg('Event created');
      setName(''); setStartsAt(''); setEndsAt('');
      load();
    } catch (e: any) { setMsg(e.message); }
  };

  return (
    <HudPanel title="Events Management">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Event Name" className="terminal-input px-3 py-2 text-sm" />
        <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="terminal-input px-3 py-2 text-sm" />
        <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="terminal-input px-3 py-2 text-sm" />
        <input value={leagueId} onChange={(e) => setLeagueId(e.target.value)} placeholder="League ID (optional)" className="terminal-input px-3 py-2 text-sm" />
      </div>
      <NeonButton size="sm" variant="solid" onClick={handleCreate}>Create Event</NeonButton>
      {msg && <p className="text-accent text-xs mt-2">{msg}</p>}

      <div className="mt-6 space-y-2">
        {events.map((e) => {
          const status = getEventStatus(e);
          const statusColor = status === 'LIVE' ? 'var(--success)' : status === 'UPCOMING' ? 'var(--warning)' : 'var(--hud-text)';
          return (
            <div key={e.id} className="flex items-center justify-between p-3 border border-accent/20 hover:border-accent/40 transition-colors">
              <div className="flex items-center gap-2">
                {status === 'LIVE' && <span className="live-dot" />}
                <span className="font-bold text-sm">{e.name}</span>
                <HudTag color={statusColor}>{status}</HudTag>
              </div>
              <span className="text-xs text-hud-text/40 font-mono">{e.id.slice(0, 12)}</span>
            </div>
          );
        })}
      </div>
    </HudPanel>
  );
}

/* ─── Leagues Tab ─── */
function AdminLeagues() {
  const [leagues, setLeagues] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [eventIds, setEventIds] = useState('');
  const [msg, setMsg] = useState('');

  const load = async () => {
    const snap = await getDocs(collection(db, 'leagues'));
    setLeagues(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    try {
      await apiPost('/admin/league', {
        name,
        published: true,
        eventIds: eventIds.split(',').map((s) => s.trim()).filter(Boolean),
      });
      setMsg('League created');
      setName(''); setEventIds('');
      load();
    } catch (e: any) { setMsg(e.message); }
  };

  return (
    <HudPanel title="Leagues Management">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="League Name" className="terminal-input px-3 py-2 text-sm" />
        <input value={eventIds} onChange={(e) => setEventIds(e.target.value)} placeholder="Event IDs (comma-separated)" className="terminal-input px-3 py-2 text-sm" />
      </div>
      <NeonButton size="sm" variant="solid" onClick={handleCreate}>Create League</NeonButton>
      {msg && <p className="text-accent text-xs mt-2">{msg}</p>}

      <div className="mt-6 space-y-2">
        {leagues.map((l) => (
          <div key={l.id} className="flex items-center justify-between p-3 border border-accent/20">
            <div>
              <span className="font-bold text-sm">{l.name}</span>
              <span className="text-xs text-hud-text/40 ml-2">{l.eventIds?.length || 0} events</span>
            </div>
            <span className="text-xs text-accent/50 font-mono">{l.id.slice(0, 12)}</span>
          </div>
        ))}
      </div>
    </HudPanel>
  );
}

/* ─── Challenges Tab ─── */
function AdminChallenges() {
  const [events, setEvents] = useState<any[]>([]);
  const [eventId, setEventId] = useState('');
  const [challenges, setChallenges] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('WEB');
  const [difficulty, setDifficulty] = useState('1');
  const [points, setPoints] = useState('100');
  const [desc, setDesc] = useState('');
  const [flagText, setFlagText] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, 'events'));
      setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    })();
  }, []);

  const loadChallenges = async (eid: string) => {
    if (!eid) return;
    const snap = await getDocs(collection(db, 'events', eid, 'challenges'));
    setChallenges(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  const handleCreate = async () => {
    try {
      const res = await apiPost('/admin/challenge', {
        eventId, title, category,
        difficulty: Number(difficulty),
        pointsFixed: Number(points),
        descriptionMd: desc,
        tags: [],
        published: true,
      });
      if (flagText) {
        await apiPost(`/admin/challenge/${res.id}/set-flag`, {
          eventId, flagText, caseSensitive: false,
        });
      }
      setMsg('Challenge created');
      setTitle(''); setDesc(''); setFlagText('');
      loadChallenges(eventId);
    } catch (e: any) { setMsg(e.message); }
  };

  return (
    <HudPanel title="Challenges Management">
      <div className="space-y-3 mb-4">
        {/* Event selector dropdown */}
        <select
          value={eventId}
          onChange={(e) => { setEventId(e.target.value); loadChallenges(e.target.value); }}
          className="terminal-input px-3 py-2 text-sm w-full"
        >
          <option value="">Select Event...</option>
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>{ev.name} ({ev.id.slice(0, 8)})</option>
          ))}
        </select>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="terminal-input px-3 py-2 text-sm" />
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="terminal-input px-3 py-2 text-sm">
            {['WEB', 'CRYPTO', 'FORENSICS', 'OSINT', 'PWN', 'REV'].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <input value={difficulty} onChange={(e) => setDifficulty(e.target.value)} placeholder="Difficulty 1-5" className="terminal-input px-3 py-2 text-sm" type="number" min="1" max="5" />
          <input value={points} onChange={(e) => setPoints(e.target.value)} placeholder="Points" className="terminal-input px-3 py-2 text-sm" type="number" />
        </div>
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description (Markdown)" className="terminal-input px-3 py-2 text-sm w-full h-20" />
        <input value={flagText} onChange={(e) => setFlagText(e.target.value)} placeholder="Flag (e.g. CTF{...})" className="terminal-input px-3 py-2 text-sm w-full" />
      </div>
      <NeonButton size="sm" variant="solid" onClick={handleCreate}>Create Challenge</NeonButton>
      {msg && <p className="text-accent text-xs mt-2">{msg}</p>}

      <div className="mt-6 space-y-2">
        {challenges.map((c) => (
          <div key={c.id} className="flex items-center justify-between p-4 border border-accent/20 hover:border-accent/40 transition-colors">
            <div className="flex items-center gap-3">
              <HudTag>{c.category}</HudTag>
              <div>
                <span className="font-bold text-sm">{c.title}</span>
                <div className="flex gap-2 mt-0.5">
                  {Array.from({ length: c.difficulty || 1 }).map((_, i) => (
                    <span key={i} className="text-warning text-xs">★</span>
                  ))}
                </div>
              </div>
            </div>
            <span className="text-accent font-extrabold text-lg">{c.pointsFixed} pts</span>
          </div>
        ))}
      </div>
    </HudPanel>
  );
}

/* ─── Users Tab ─── */
function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, 'users'));
      setUsers(snap.docs.map((d) => ({ uid: d.id, ...d.data() })));
    })();
  }, []);

  const toggleDisable = async (uid: string, disabled: boolean) => {
    try {
      await apiPost(`/admin/user/${uid}/${disabled ? 'enable' : 'disable'}`, {});
      setUsers((prev) =>
        prev.map((u) => (u.uid === uid ? { ...u, disabled: !disabled } : u)),
      );
    } catch {}
  };

  return (
    <HudPanel title="Users">
      <div className="space-y-2">
        {users.map((u) => (
          <div key={u.uid} className="flex items-center justify-between p-3 border border-accent/20 hover:border-accent/40 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center text-sm font-bold text-accent">
                {(u.displayName || '?')[0].toUpperCase()}
              </div>
              <div>
                <span className="font-bold text-sm">{u.displayName}</span>
                <HudTag className="ml-2" color={u.role === 'admin' ? 'var(--warning)' : 'var(--accent)'}>{u.role}</HudTag>
                {u.disabled && <HudTag className="ml-1" color="var(--danger)">DISABLED</HudTag>}
              </div>
            </div>
            <NeonButton
              size="sm"
              variant={u.disabled ? 'outline' : 'danger'}
              onClick={() => toggleDisable(u.uid, u.disabled)}
            >
              {u.disabled ? 'Enable' : 'Disable'}
            </NeonButton>
          </div>
        ))}
      </div>
    </HudPanel>
  );
}

/* ─── Badges Tab ─── */
function AdminBadges() {
  const [badges, setBadges] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const loadBadges = async () => {
    try {
      const res = await apiGet('/gamification/badges');
      setBadges(res.badges || []);
    } catch {}
  };

  useEffect(() => { loadBadges(); }, []);

  const handleSeedBadges = async () => {
    setLoading(true);
    try {
      const res = await apiPost('/admin/badges/seed-default', {});
      setMsg(`Seeded ${res.count} badges`);
      await loadBadges();
    } catch (e: any) { setMsg(e.message); }
    setLoading(false);
    setTimeout(() => setMsg(''), 3000);
  };

  return (
    <HudPanel title="Badge Catalog">
      <div className="flex gap-2 mb-4">
        <NeonButton size="sm" variant="solid" onClick={handleSeedBadges} disabled={loading}>
          {loading ? 'Seeding...' : 'Seed Default Badges'}
        </NeonButton>
      </div>
      {msg && <p className="text-accent text-xs mb-3">{msg}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {badges.map((b: any) => {
          const rarity = b.rarity || 'common';
          const rarityColors: Record<string, string> = {
            common: '#aaaaaa', rare: '#00aaff', epic: '#aa00ff', legendary: '#ffaa00',
          };
          const color = rarityColors[rarity] || '#aaaaaa';
          return (
            <div key={b.id} className="p-3 border border-accent/15 flex items-center gap-3">
              <span className="text-2xl">{b.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm" style={{ color }}>{b.name}</span>
                  <span className="text-[10px] uppercase tracking-widest px-1 py-0.5 font-bold" style={{ color, border: `1px solid ${color}44` }}>
                    {rarity}
                  </span>
                </div>
                <p className="text-xs text-hud-text/50 truncate">{b.description}</p>
                <span className="text-[10px] text-warning">+{b.xpReward} XP</span>
              </div>
            </div>
          );
        })}
      </div>
      {badges.length === 0 && (
        <p className="text-center text-hud-text/30 text-sm py-6">No badges seeded yet. Click the button above.</p>
      )}
    </HudPanel>
  );
}

/* ─── Quests Tab ─── */
function AdminQuests() {
  const [quests, setQuests] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const loadQuests = async () => {
    try {
      const snap = await getDocs(collection(db, 'quests'));
      setQuests(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch {}
  };

  useEffect(() => { loadQuests(); }, []);

  const handleSeedQuests = async () => {
    setLoading(true);
    try {
      const res = await apiPost('/admin/quests/seed-default', {});
      setMsg(`Seeded ${res.count} quests`);
      await loadQuests();
    } catch (e: any) { setMsg(e.message); }
    setLoading(false);
    setTimeout(() => setMsg(''), 3000);
  };

  return (
    <HudPanel title="Quests Management">
      <div className="flex gap-2 mb-4">
        <NeonButton size="sm" variant="solid" onClick={handleSeedQuests} disabled={loading}>
          {loading ? 'Seeding...' : 'Seed Default Quests'}
        </NeonButton>
      </div>
      {msg && <p className="text-accent text-xs mb-3">{msg}</p>}

      <div className="space-y-2">
        {quests.map((q: any) => {
          const now = new Date();
          const from = new Date(q.activeFrom);
          const to = new Date(q.activeTo);
          const active = now >= from && now <= to;
          return (
            <div key={q.id} className={`p-4 border transition-all ${active ? 'border-success/30' : 'border-accent/10 opacity-50'}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">{q.title}</span>
                    {active && <HudTag color="var(--success)">ACTIVE</HudTag>}
                    {!active && now > to && <HudTag color="var(--danger)">EXPIRED</HudTag>}
                  </div>
                  <p className="text-xs text-hud-text/50 mt-0.5">{q.description}</p>
                  <div className="text-[10px] text-hud-text/30 mt-1 font-mono">
                    {from.toLocaleDateString()} — {to.toLocaleDateString()}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="text-warning font-bold text-xs">+{q.xpReward} XP</span>
                  <div className="text-[10px] text-hud-text/40 mt-0.5">
                    {q.rules?.type}: {q.rules?.target}
                    {q.rules?.category && ` (${q.rules.category})`}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {quests.length === 0 && (
        <p className="text-center text-hud-text/30 text-sm py-6">No quests created yet. Click the button above.</p>
      )}
    </HudPanel>
  );
}

/* ─── Logs Tab ─── */
function AdminLogs() {
  const [mode, setMode] = useState<'submissions' | 'solves'>('submissions');
  const [items, setItems] = useState<any[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [correctOnly, setCorrectOnly] = useState(false);

  const loadItems = async (reset = true) => {
    setLoading(true);
    try {
      const endpoint = mode === 'solves' ? '/admin/logs/solves' : '/admin/logs/submissions';
      let url = `${endpoint}?limit=30`;
      if (!reset && cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
      if (mode === 'submissions' && correctOnly) url += '&correctOnly=true';
      const res = await apiGet(url);
      const data = res.submissions || res.solves || [];
      setItems(reset ? data : [...items, ...data]);
      setCursor(res.nextCursor || null);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadItems(true); }, [mode, correctOnly]);

  return (
    <HudPanel title="Submission Logs" noPad>
      <div className="px-4 pt-3 pb-2 flex flex-wrap items-center gap-2 border-b border-accent/10">
        <button
          onClick={() => { setMode('submissions'); setCursor(null); }}
          className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-widest border transition-all ${mode === 'submissions' ? 'border-accent text-accent bg-accent/10' : 'border-accent/20 text-hud-text/40 hover:text-accent'}`}
        >
          All Submissions
        </button>
        <button
          onClick={() => { setMode('solves'); setCursor(null); }}
          className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-widest border transition-all ${mode === 'solves' ? 'border-success text-success bg-success/10' : 'border-accent/20 text-hud-text/40 hover:text-success'}`}
        >
          Solves
        </button>
        {mode === 'submissions' && (
          <label className="flex items-center gap-1.5 text-xs text-hud-text/50 ml-auto cursor-pointer">
            <input type="checkbox" checked={correctOnly} onChange={(e) => { setCorrectOnly(e.target.checked); setCursor(null); }} className="accent-success" />
            Correct only
          </label>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs responsive-table">
          <thead>
            <tr className="border-b border-accent/30 text-accent uppercase tracking-widest">
              <th className="py-2.5 px-4 text-left">User</th>
              <th className="py-2.5 px-4 text-left">Challenge</th>
              {mode === 'submissions' && <th className="py-2.5 px-4 text-center">Result</th>}
              {mode === 'submissions' && <th className="py-2.5 px-4 text-center">Attempt</th>}
              <th className="py-2.5 px-4 text-right">Time</th>
            </tr>
          </thead>
          <tbody>
            {items.map((s: any, i: number) => (
              <tr key={`${s.id || i}`} className="rank-row border-b border-accent/5 hover:bg-accent/5 transition-colors">
                <td className="py-2.5 px-4 font-semibold" data-label="User">
                  {s.displayName || s.uid?.slice(0, 8)}
                </td>
                <td className="py-2.5 px-4" data-label="Challenge">
                  {s.challengeTitle || s.challengeId?.slice(0, 12)}
                </td>
                {mode === 'submissions' && (
                  <td className="py-2.5 px-4 text-center" data-label="Result">
                    {s.isCorrect
                      ? <span className="text-success font-bold">✓ Correct</span>
                      : <span className="text-danger">✗ Wrong</span>
                    }
                  </td>
                )}
                {mode === 'submissions' && (
                  <td className="py-2.5 px-4 text-center font-bold" data-label="Attempt">
                    #{s.attemptNumber}
                  </td>
                )}
                <td className="py-2.5 px-4 text-right text-hud-text/50" data-label="Time">
                  {new Date(s.submittedAt || s.solvedAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && !loading && (
          <p className="text-center text-hud-text/30 py-8 text-sm">No logs yet.</p>
        )}
      </div>

      {cursor && (
        <div className="px-4 py-3 border-t border-accent/10 text-center">
          <button
            onClick={() => loadItems(false)}
            disabled={loading}
            className="text-xs text-accent hover:text-accent/80 font-semibold uppercase tracking-widest"
          >
            {loading ? 'Loading…' : '↓ Load more'}
          </button>
        </div>
      )}
    </HudPanel>
  );
}

/* ─── Seed Manager ─── */
function AdminSeedManager() {
  const [clearing, setClearing] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedMode, setSeedMode] = useState<'minimal' | 'full'>('full');
  const [log, setLog] = useState<{ type: 'clear' | 'seed' | 'error'; lines: string[]; time: string }[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const cfg = await apiGet('/admin/config');
        setAllowed(cfg.allowSeedUI ?? false);
      } catch {
        setAllowed(false);
      }
    })();
  }, []);

  const addLog = (type: 'clear' | 'seed' | 'error', lines: string[]) => {
    setLog((prev) => [{ type, lines, time: new Date().toLocaleTimeString() }, ...prev]);
  };

  if (allowed === null) {
    return (
      <HudPanel>
        <p className="text-center text-hud-text/50 py-8 text-sm">Loading seed config...</p>
      </HudPanel>
    );
  }

  if (!allowed) {
    return (
      <HudPanel>
        <div className="text-center py-8 space-y-3">
          <span className="text-3xl">🔒</span>
          <h3 className="text-lg font-bold text-hud-text/60">Seed Operations Disabled</h3>
          <p className="text-sm text-hud-text/40 max-w-md mx-auto">
            Seed operations are not available. To enable, set the <code className="px-1 py-0.5 bg-accent/10 border border-accent/20 text-accent text-xs font-mono">ALLOW_SEED=true</code> environment variable on the API server and restart.
          </p>
        </div>
      </HudPanel>
    );
  }

  const handleClear = async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    setConfirmClear(false);
    setClearing(true);
    try {
      const res = await apiPost('/admin/seed/clear', {});
      addLog('clear', [
        `✅ Seed data cleared successfully!`,
        `Deleted ${res.deleted?.length || 0} items:`,
        ...(res.deleted || []).map((d: string) => `  → ${d}`),
      ]);
    } catch (err: any) {
      addLog('error', [`❌ Failed to clear: ${err.message || 'Unknown error'}`]);
    } finally {
      setClearing(false);
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const res = await apiPost('/admin/seed/run', { mode: seedMode });
      addLog('seed', [
        `✅ Seed completed successfully! (mode: ${res.mode || seedMode})`,
        ...(res.summary || []).map((s: string) => `  → ${s}`),
      ]);
    } catch (err: any) {
      addLog('error', [`❌ Failed to seed: ${err.message || 'Unknown error'}`]);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-4">
      <HudPanel>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">🌱</span>
          <div>
            <h2 className="text-lg font-extrabold text-accent glow-text">Seed Manager</h2>
            <p className="text-xs text-hud-text/50 mt-1">
              Gerencie os dados de demonstração. Limpe tudo para testar do zero ou recarregue o seed completo.
            </p>
          </div>
        </div>
      </HudPanel>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Clear Card */}
        <HudPanel>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🗑️</span>
              <div>
                <h3 className="font-bold text-danger text-sm">Limpar Dados / Clear Data</h3>
                <p className="text-xs text-hud-text/50 mt-1">
                  Remove todos os dados de seed (usuários, equipes, eventos, ligas, badges, quests, turmas).
                  <strong className="text-warning"> Mantém apenas a conta admin.</strong>
                </p>
              </div>
            </div>

            <div className="p-3 border border-danger/20 bg-danger/5 text-xs text-hud-text/60 space-y-1">
              <div className="font-semibold text-danger">⚠️ Esta ação remove:</div>
              <ul className="list-disc list-inside space-y-0.5 ml-1">
                <li>Todos os usuários (exceto admin)</li>
                <li>Equipes públicas e de evento</li>
                <li>Eventos, desafios e flags</li>
                <li>Submissões, solves e leaderboards</li>
                <li>Ligas e analytics</li>
                <li>Badges e quests</li>
                <li>Turmas e membros</li>
                <li>Mensagens de chat</li>
                <li>Logs de auditoria</li>
              </ul>
            </div>

            {confirmClear ? (
              <div className="flex gap-2">
                <NeonButton variant="danger" size="sm" onClick={handleClear} disabled={clearing}>
                  {clearing ? '⏳ Limpando…' : '⚠️ CONFIRMAR LIMPEZA'}
                </NeonButton>
                <NeonButton variant="outline" size="sm" onClick={() => setConfirmClear(false)}>
                  Cancelar
                </NeonButton>
              </div>
            ) : (
              <NeonButton variant="danger" size="sm" onClick={handleClear} disabled={clearing}>
                🗑️ Limpar Seed Data
              </NeonButton>
            )}
          </div>
        </HudPanel>

        {/* Seed Card */}
        <HudPanel>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🚀</span>
              <div>
                <h3 className="font-bold text-success text-sm">Recarregar Seed / Re-Seed Data</h3>
                <p className="text-xs text-hud-text/50 mt-1">
                  Popula o ambiente com todos os dados de demonstração para testes completos.
                </p>
              </div>
            </div>

            <div className="p-3 border border-success/20 bg-success/5 text-xs text-hud-text/60 space-y-1">
              <div className="font-semibold text-success">📦 Dados criados:</div>
              <ul className="list-disc list-inside space-y-0.5 ml-1">
                <li>6 usuários (admin, instructor, 4 participants)</li>
                <li>2 equipes públicas (SYNAPSE, NULLPULSE)</li>
                <li>1 liga com 3 eventos públicos + 12 desafios</li>
                <li>1 evento privado com 1 desafio + 2 equipes de evento</li>
                <li>Submissões, solves e leaderboards simulados</li>
                <li>12 badges + 3 quests com progresso</li>
                <li>1 turma (Cybersecurity 101) com 3 alunos</li>
                <li>8 mensagens de chat de equipe</li>
              </ul>
            </div>

            <NeonButton variant="solid" size="sm" onClick={handleSeed} disabled={seeding}>
              {seeding ? '⏳ Populando…' : '🚀 Executar Seed'}
            </NeonButton>

            {/* Mode selector */}
            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-accent/10">
              <span className="text-xs text-hud-text/50 font-semibold">Mode:</span>
              <button
                onClick={() => setSeedMode('minimal')}
                className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-widest border transition-all ${
                  seedMode === 'minimal'
                    ? 'border-accent text-accent bg-accent/10'
                    : 'border-accent/20 text-hud-text/40 hover:text-accent hover:border-accent/40'
                }`}
              >
                Minimal
              </button>
              <button
                onClick={() => setSeedMode('full')}
                className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-widest border transition-all ${
                  seedMode === 'full'
                    ? 'border-accent text-accent bg-accent/10'
                    : 'border-accent/20 text-hud-text/40 hover:text-accent hover:border-accent/40'
                }`}
              >
                Full
              </button>
            </div>
            <p className="text-[10px] text-hud-text/30 mt-1">
              {seedMode === 'minimal'
                ? 'Minimal: 2 teams, 4 users, 1 league, 3 events, 12 challenges (no gameplay data)'
                : 'Full: all data including gameplay, chat, badges, quests, classes, analytics'}
            </p>
          </div>
        </HudPanel>
      </div>

      {/* Quick Actions */}
      <HudPanel title="⚡ Ações Rápidas / Quick Actions">
        <div className="flex flex-wrap gap-2">
          <NeonButton
            variant="danger"
            size="sm"
            onClick={async () => {
              setClearing(true);
              try {
                await apiPost('/admin/seed/clear', {});
                const res = await apiPost('/admin/seed/run', { mode: seedMode });
                addLog('seed', [
                  `✅ Reset completo! Dados limpos e re-populados (mode: ${res.mode || seedMode}).`,
                  ...(res.summary || []).map((s: string) => `  → ${s}`),
                ]);
              } catch (err: any) {
                addLog('error', [`❌ Reset failed: ${err.message}`]);
              } finally {
                setClearing(false);
              }
            }}
            disabled={clearing || seeding}
          >
            {clearing ? '⏳ Resetando…' : '🔄 Reset Completo (Limpar + Seed)'}
          </NeonButton>
        </div>
      </HudPanel>

      {/* Log */}
      {log.length > 0 && (
        <HudPanel title="📋 Log de Operações">
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {log.map((entry, i) => (
              <div
                key={i}
                className={`p-3 border text-xs font-mono ${
                  entry.type === 'error'
                    ? 'border-danger/30 bg-danger/5'
                    : entry.type === 'clear'
                    ? 'border-warning/30 bg-warning/5'
                    : 'border-success/30 bg-success/5'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold uppercase text-xs tracking-wider">
                    {entry.type === 'clear' ? '🗑️ CLEAR' : entry.type === 'seed' ? '🌱 SEED' : '❌ ERROR'}
                  </span>
                  <span className="text-hud-text/30">{entry.time}</span>
                </div>
                {entry.lines.map((line, j) => (
                  <div key={j} className="text-hud-text/60">{line}</div>
                ))}
              </div>
            ))}
          </div>
          <button
            onClick={() => setLog([])}
            className="mt-2 text-xs text-hud-text/30 hover:text-accent transition-colors"
          >
            Limpar log
          </button>
        </HudPanel>
      )}
    </div>
  );
}

/* ─── Documentation / Guide ─── */
function AdminDocs() {
  const [openSection, setOpenSection] = useState<string | null>('getting-started');

  const toggle = (key: string) => setOpenSection(openSection === key ? null : key);

  const Section = ({ id, icon, title, children }: { id: string; icon: string; title: string; children: React.ReactNode }) => {
    const isOpen = openSection === id;
    return (
      <div className="border border-accent/15 hover:border-accent/30 transition-all">
        <button
          onClick={() => toggle(id)}
          className="w-full flex items-center gap-3 p-4 text-left hover:bg-accent/5 transition-colors"
        >
          <span className="text-xl flex-shrink-0">{icon}</span>
          <span className="font-bold text-sm flex-1 text-accent">{title}</span>
          <span className={`text-accent/50 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>▼</span>
        </button>
        {isOpen && (
          <div className="px-4 pb-4 pt-0 border-t border-accent/10">
            <div className="prose prose-sm prose-invert max-w-none space-y-3 text-hud-text/80 text-sm leading-relaxed">
              {children}
            </div>
          </div>
        )}
      </div>
    );
  };

  const Code = ({ children }: { children: React.ReactNode }) => (
    <code className="px-1.5 py-0.5 bg-accent/10 border border-accent/20 text-accent text-xs font-mono">{children}</code>
  );

  const Step = ({ n, children }: { n: number; children: React.ReactNode }) => (
    <div className="flex gap-3 items-start">
      <span className="flex-shrink-0 w-6 h-6 bg-accent/20 border border-accent/30 flex items-center justify-center text-accent font-bold text-xs">{n}</span>
      <div className="flex-1">{children}</div>
    </div>
  );

  const Tip = ({ children }: { children: React.ReactNode }) => (
    <div className="flex gap-2 p-3 bg-warning/5 border border-warning/20 text-sm">
      <span className="text-warning flex-shrink-0">💡</span>
      <div className="text-hud-text/70">{children}</div>
    </div>
  );

  return (
    <div className="space-y-4">
      <HudPanel>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">📖</span>
          <div>
            <h2 className="text-lg font-extrabold text-accent glow-text">MdavelCTF — Guia Completo</h2>
            <p className="text-xs text-hud-text/50 mt-1">
              Documentação completa para administradores, instrutores e participantes.
            </p>
          </div>
        </div>
      </HudPanel>

      {/* ─── Table of Contents ─── */}
      <HudPanel title="📋 Índice / Table of Contents">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
          {[
            { id: 'getting-started', icon: '🚀', label: 'Primeiros Passos / Getting Started' },
            { id: 'roles', icon: '🎭', label: 'Papéis e Permissões / Roles & Permissions' },
            { id: 'classes', icon: '📚', label: 'Turmas / Classes' },
            { id: 'events', icon: '🏁', label: 'Eventos / Events' },
            { id: 'challenges', icon: '🧩', label: 'Desafios / Challenges' },
            { id: 'teams', icon: '🛡️', label: 'Equipes / Teams' },
            { id: 'event-teams', icon: '⚔️', label: 'Equipes de Evento / Event Teams' },
            { id: 'leagues', icon: '🏆', label: 'Ligas / Leagues' },
            { id: 'scoreboard', icon: '📊', label: 'Placar / Scoreboard' },
            { id: 'gamification', icon: '🎮', label: 'Gamificação / Gamification' },
            { id: 'i18n', icon: '🌐', label: 'Idiomas / Languages' },
            { id: 'instructor-guide', icon: '🎓', label: 'Guia do Instrutor / Instructor Guide' },
            { id: 'student-guide', icon: '🧑‍💻', label: 'Guia do Aluno / Student Guide' },
            { id: 'credentials', icon: '🔑', label: 'Credenciais de Teste / Test Credentials' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setOpenSection(item.id)}
              className={`flex items-center gap-2 px-3 py-2 text-xs text-left border transition-all ${
                openSection === item.id
                  ? 'border-accent/40 bg-accent/10 text-accent'
                  : 'border-transparent text-hud-text/50 hover:text-accent hover:border-accent/20'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </HudPanel>

      {/* ─── Sections ─── */}
      <div className="space-y-2">
        <Section id="getting-started" icon="🚀" title="Primeiros Passos / Getting Started">
          <p>
            <strong>MdavelCTF</strong> é uma plataforma Capture The Flag (CTF) no estilo Jeopardy, projetada para ambientes educacionais.
            Ela permite criar competições, gerenciar turmas, e acompanhar o progresso dos alunos.
          </p>
          <p>
            <strong>MdavelCTF</strong> is a Jeopardy-style CTF platform designed for educational environments.
            It lets you create competitions, manage classes, and track student progress.
          </p>
          <h4 className="font-bold text-accent mt-4">Arquitetura / Architecture</h4>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Frontend:</strong> React + TypeScript + Vite + Tailwind CSS</li>
            <li><strong>Backend:</strong> Node.js + Express + TypeScript</li>
            <li><strong>Database:</strong> Firebase Firestore (emuladores locais)</li>
            <li><strong>Auth:</strong> Firebase Authentication</li>
            <li><strong>Monorepo:</strong> npm workspaces — <Code>shared/</Code>, <Code>apps/api/</Code>, <Code>apps/web/</Code></li>
          </ul>
          <h4 className="font-bold text-accent mt-4">Como iniciar / How to start</h4>
          <div className="space-y-2">
            <Step n={1}><span>Inicie os emuladores Firebase: <Code>npm run emu</Code></span></Step>
            <Step n={2}><span>Compile os tipos compartilhados: <Code>cd shared && npx tsc</Code></span></Step>
            <Step n={3}><span>Compile e inicie a API: <Code>cd apps/api && npx tsc && node dist/index.js</Code></span></Step>
            <Step n={4}><span>Inicie o frontend: <Code>cd apps/web && npx vite --port 3000</Code></span></Step>
            <Step n={5}><span>Popule os dados de teste: <Code>npx tsx scripts/seed.ts</Code></span></Step>
          </div>
        </Section>

        <Section id="roles" icon="🎭" title="Papéis e Permissões / Roles & Permissions">
          <p>O sistema possui 3 papéis (roles) com diferentes níveis de acesso:</p>
          <div className="space-y-3 mt-3">
            <div className="p-3 border border-warning/30 bg-warning/5">
              <div className="flex items-center gap-2 mb-1">
                <HudTag color="var(--warning)">admin</HudTag>
                <span className="font-bold text-sm">Administrador</span>
              </div>
              <ul className="list-disc list-inside text-xs space-y-0.5 text-hud-text/60">
                <li>Acesso total a todas as funcionalidades</li>
                <li>Criar/editar eventos, ligas, desafios</li>
                <li>Gerenciar usuários (ativar/desativar)</li>
                <li>Semear badges e quests</li>
                <li>Visualizar logs de submissões</li>
                <li>Criar turmas e eventos (como instrutor)</li>
              </ul>
            </div>
            <div className="p-3 border border-accent2/30 bg-accent2/5">
              <div className="flex items-center gap-2 mb-1">
                <HudTag color="var(--accent2)">instructor</HudTag>
                <span className="font-bold text-sm">Instrutor / Professor</span>
              </div>
              <ul className="list-disc list-inside text-xs space-y-0.5 text-hud-text/60">
                <li>Criar e gerenciar turmas (classes)</li>
                <li>Gerar código de convite para alunos</li>
                <li>Criar eventos públicos ou privados (vinculados a turmas)</li>
                <li>Remover membros de suas turmas</li>
                <li>Acesso ao painel do instrutor (<Code>/instructor</Code>)</li>
              </ul>
            </div>
            <div className="p-3 border border-accent/30 bg-accent/5">
              <div className="flex items-center gap-2 mb-1">
                <HudTag color="var(--accent)">participant</HudTag>
                <span className="font-bold text-sm">Participante / Aluno</span>
              </div>
              <ul className="list-disc list-inside text-xs space-y-0.5 text-hud-text/60">
                <li>Participar de eventos e resolver desafios</li>
                <li>Entrar em turmas via código de convite</li>
                <li>Criar/entrar em equipes (públicas ou de evento)</li>
                <li>Visualizar placar, perfil, XP, badges</li>
                <li>Chat da equipe e atividade</li>
              </ul>
            </div>
          </div>
        </Section>

        <Section id="classes" icon="📚" title="Turmas / Classes">
          <p>
            Turmas (<strong>Classes</strong>) permitem agrupar alunos e vincular eventos privados a um grupo específico.
          </p>
          <h4 className="font-bold text-accent mt-3">Para o Instrutor:</h4>
          <div className="space-y-2">
            <Step n={1}><span>Acesse <Code>/classes</Code> ou <Code>/instructor</Code></span></Step>
            <Step n={2}><span>Clique em <strong>"Criar uma Turma"</strong> e preencha o nome e descrição</span></Step>
            <Step n={3}><span>Compartilhe o <strong>código de convite</strong> (6 caracteres) com seus alunos</span></Step>
            <Step n={4}><span>Gerencie os membros na aba <strong>"Roster"</strong> (pode remover alunos)</span></Step>
            <Step n={5}><span>Use <strong>"Rotate Code"</strong> para gerar um novo código se o antigo vazar</span></Step>
          </div>
          <h4 className="font-bold text-accent mt-3">Para o Aluno:</h4>
          <div className="space-y-2">
            <Step n={1}><span>Acesse <Code>/classes</Code></span></Step>
            <Step n={2}><span>Digite o código de convite fornecido pelo instrutor</span></Step>
            <Step n={3}><span>Clique em <strong>"Entrar"</strong></span></Step>
            <Step n={4}><span>Agora você verá a turma listada e seus eventos vinculados</span></Step>
          </div>
          <Tip>
            Os instrutores podem criar eventos <strong>privados</strong> visíveis apenas para membros da turma.
          </Tip>
        </Section>

        <Section id="events" icon="🏁" title="Eventos / Events">
          <p>
            Eventos são as competições CTF propriamente ditas. Cada evento tem data de início/fim, desafios e um placar.
          </p>
          <h4 className="font-bold text-accent mt-3">Tipos de Visibilidade:</h4>
          <div className="space-y-2 mt-2">
            <div className="p-2 border border-success/20">
              <span className="font-bold text-success text-xs">🌐 PUBLIC</span>
              <span className="text-xs text-hud-text/50 ml-2">Qualquer usuário pode ver e participar</span>
            </div>
            <div className="p-2 border border-danger/20">
              <span className="font-bold text-danger text-xs">🔒 PRIVATE</span>
              <span className="text-xs text-hud-text/50 ml-2">Apenas membros da turma vinculada podem acessar</span>
            </div>
          </div>
          <h4 className="font-bold text-accent mt-3">Modos de Equipe:</h4>
          <div className="space-y-2 mt-2">
            <div className="p-2 border border-accent/20">
              <span className="font-bold text-accent text-xs">publicTeams</span>
              <span className="text-xs text-hud-text/50 ml-2">Usa as equipes públicas (permanentes) dos jogadores</span>
            </div>
            <div className="p-2 border border-accent2/20">
              <span className="font-bold text-accent2 text-xs">eventTeams</span>
              <span className="text-xs text-hud-text/50 ml-2">Equipes específicas do evento (criadas dentro do próprio evento)</span>
            </div>
          </div>
          <h4 className="font-bold text-accent mt-3">Como criar um evento (Admin):</h4>
          <div className="space-y-2">
            <Step n={1}><span>Vá para a aba <strong>"Events"</strong> neste painel admin</span></Step>
            <Step n={2}><span>Preencha nome, data de início e fim</span></Step>
            <Step n={3}><span>Clique em <strong>"Create Event"</strong></span></Step>
            <Step n={4}><span>Anote o <strong>Event ID</strong> para uso na criação de desafios</span></Step>
          </div>
          <h4 className="font-bold text-accent mt-3">Como criar via Instrutor:</h4>
          <div className="space-y-2">
            <Step n={1}><span>Acesse <Code>/instructor</Code></span></Step>
            <Step n={2}><span>Aba <strong>"Criar Evento"</strong> — configure visibilidade, modo de equipe e turma vinculada</span></Step>
            <Step n={3}><span>Eventos privados com <Code>requireClassMembership</Code> só permitem membros da turma</span></Step>
          </div>
          <h4 className="font-bold text-accent mt-3">Ciclo de vida:</h4>
          <div className="flex gap-2 flex-wrap mt-1">
            <HudTag color="var(--warning)">UPCOMING</HudTag>
            <span className="text-hud-text/30">→</span>
            <HudTag color="var(--success)">LIVE</HudTag>
            <span className="text-hud-text/30">→</span>
            <HudTag color="var(--danger)">ENDED</HudTag>
          </div>
          <p className="text-xs text-hud-text/50 mt-1">
            O status é calculado automaticamente com base em <Code>startsAt</Code> e <Code>endsAt</Code>.
          </p>
        </Section>

        <Section id="challenges" icon="🧩" title="Desafios / Challenges">
          <p>
            Desafios são os problemas de CTF que os participantes devem resolver submetendo uma flag.
          </p>
          <h4 className="font-bold text-accent mt-3">Categorias disponíveis:</h4>
          <div className="flex gap-2 flex-wrap mt-1">
            {['WEB', 'CRYPTO', 'FORENSICS', 'OSINT', 'PWN', 'REV'].map((cat) => (
              <HudTag key={cat}>{cat}</HudTag>
            ))}
          </div>
          <h4 className="font-bold text-accent mt-3">Como criar (Admin):</h4>
          <div className="space-y-2">
            <Step n={1}><span>Aba <strong>"Challenges"</strong> neste painel</span></Step>
            <Step n={2}><span>Selecione o <strong>evento</strong> no dropdown</span></Step>
            <Step n={3}><span>Preencha: título, categoria, dificuldade (1-5), pontos, descrição (Markdown)</span></Step>
            <Step n={4}><span>Defina a <strong>flag</strong> (ex: <Code>CTF&#123;minha_flag&#125;</Code>)</span></Step>
            <Step n={5}><span>Clique em <strong>"Create Challenge"</strong></span></Step>
          </div>
          <Tip>
            A flag é hasheada com HMAC-SHA256 + PEPPER. Ninguém (nem admins) pode ver a flag original depois de definida.
            A comparação é case-insensitive por padrão.
          </Tip>
          <h4 className="font-bold text-accent mt-3">Campos do desafio:</h4>
          <ul className="list-disc list-inside text-xs space-y-0.5 text-hud-text/60">
            <li><strong>title:</strong> Nome do desafio</li>
            <li><strong>category:</strong> WEB, CRYPTO, FORENSICS, OSINT, PWN, REV</li>
            <li><strong>difficulty:</strong> 1 (fácil) a 5 (muito difícil)</li>
            <li><strong>pointsFixed:</strong> Pontos concedidos ao resolver</li>
            <li><strong>descriptionMd:</strong> Descrição em Markdown (suporta código, links, imagens)</li>
            <li><strong>tags:</strong> Tags para filtragem (ex: sqli, xss, buffer-overflow)</li>
            <li><strong>attachments:</strong> Arquivos anexos (nome, URL, tamanho)</li>
          </ul>
        </Section>

        <Section id="teams" icon="🛡️" title="Equipes Públicas / Public Teams">
          <p>
            Equipes públicas são <strong>permanentes</strong> e usadas em todos os eventos com modo <Code>publicTeams</Code>.
          </p>
          <h4 className="font-bold text-accent mt-3">Criar uma equipe:</h4>
          <div className="space-y-2">
            <Step n={1}><span>Acesse <Code>/profile</Code></span></Step>
            <Step n={2}><span>Na seção <strong>"Team"</strong>, digite o nome e clique <strong>"Create"</strong></span></Step>
            <Step n={3}><span>Compartilhe o <strong>código de acesso</strong> com seus colegas</span></Step>
          </div>
          <h4 className="font-bold text-accent mt-3">Entrar numa equipe:</h4>
          <div className="space-y-2">
            <Step n={1}><span>Na seção <strong>"Team"</strong> do perfil, insira o código de acesso</span></Step>
            <Step n={2}><span>Clique <strong>"Join"</strong></span></Step>
          </div>
          <h4 className="font-bold text-accent mt-3">Team Hub (<Code>/team/:teamId</Code>):</h4>
          <ul className="list-disc list-inside text-xs space-y-0.5 text-hud-text/60">
            <li>Nome, tagline, descrição, avatar da equipe</li>
            <li>Estatísticas (score, solves)</li>
            <li>Lista de membros com XP e nível</li>
            <li>Atividade recente (flags resolvidas)</li>
            <li>Chat em tempo real entre membros</li>
            <li>Controles do capitão (editar equipe, rotacionar código)</li>
          </ul>
        </Section>

        <Section id="event-teams" icon="⚔️" title="Equipes de Evento / Event Teams">
          <p>
            Quando um evento usa o modo <Code>eventTeams</Code>, os participantes formam equipes
            <strong> específicas para aquele evento</strong>, independentes das equipes públicas.
          </p>
          <h4 className="font-bold text-accent mt-3">Endpoints da API:</h4>
          <ul className="list-disc list-inside text-xs space-y-0.5 text-hud-text/60">
            <li><Code>POST /api/event-teams/create</Code> — Criar equipe de evento (name, eventId)</li>
            <li><Code>POST /api/event-teams/join</Code> — Entrar com joinCode + eventId</li>
            <li><Code>POST /api/event-teams/leave</Code> — Sair da equipe de evento</li>
            <li><Code>GET /api/event-teams/me?eventId=</Code> — Ver minha equipe no evento</li>
          </ul>
          <Tip>
            Cada participante só pode estar em <strong>uma equipe por evento</strong>.
            O capitão não pode sair sem transferir a liderança.
          </Tip>
        </Section>

        <Section id="leagues" icon="🏆" title="Ligas / Leagues">
          <p>
            Ligas agrupam múltiplos eventos em uma <strong>temporada</strong>, acumulando pontuação.
          </p>
          <h4 className="font-bold text-accent mt-3">Como criar:</h4>
          <div className="space-y-2">
            <Step n={1}><span>Aba <strong>"Leagues"</strong> neste painel</span></Step>
            <Step n={2}><span>Nome da liga + IDs dos eventos (separados por vírgula)</span></Step>
            <Step n={3}><span>Clique <strong>"Create League"</strong></span></Step>
          </div>
          <Tip>
            Ligas possuem analytics automáticos de retenção: jogadores one-time, two events e regulars (3+).
          </Tip>
        </Section>

        <Section id="scoreboard" icon="📊" title="Placar / Scoreboard">
          <p>Acesse via <Code>/scoreboard</Code>. O placar suporta:</p>
          <ul className="list-disc list-inside text-xs space-y-0.5 text-hud-text/60 mt-2">
            <li>Visualização por <strong>Evento</strong> ou <strong>Liga/Temporada</strong></li>
            <li>Modo <strong>Individual</strong> ou <strong>Equipes</strong></li>
            <li>Gráficos de participação por evento</li>
            <li>Análises de retenção da temporada</li>
            <li>Estatísticas: submissões, solves, taxa de acerto</li>
          </ul>
          <Tip>
            O placar é atualizado automaticamente quando um participante resolve um desafio.
            Os dados são armazenados em <Code>events/&#123;id&#125;/leaderboards/individual</Code> e <Code>teams</Code>.
          </Tip>
        </Section>

        <Section id="gamification" icon="🎮" title="Gamificação / Gamification">
          <p>O sistema inclui elementos de gamificação para motivar os participantes:</p>

          <h4 className="font-bold text-accent mt-3">🏅 XP e Níveis</h4>
          <ul className="list-disc list-inside text-xs space-y-0.5 text-hud-text/60">
            <li>XP é concedido ao resolver desafios</li>
            <li>Níveis aumentam progressivamente</li>
            <li>Barra de progresso visível em <Code>/home</Code> e <Code>/profile</Code></li>
          </ul>

          <h4 className="font-bold text-accent mt-3">🎖️ Badges</h4>
          <ul className="list-disc list-inside text-xs space-y-0.5 text-hud-text/60">
            <li>Medalhas conquistadas automaticamente por ações específicas</li>
            <li>Raridades: <strong>common</strong>, <strong>rare</strong>, <strong>epic</strong>, <strong>legendary</strong></li>
            <li>Admin: use <strong>"Seed Default Badges"</strong> na aba Badges para popular o catálogo</li>
          </ul>

          <h4 className="font-bold text-accent mt-3">📜 Quests / Missões</h4>
          <ul className="list-disc list-inside text-xs space-y-0.5 text-hud-text/60">
            <li>Missões semanais com metas (ex: "Resolva 3 desafios")</li>
            <li>Recompensa em XP e opcionalmente badges</li>
            <li>Admin: use <strong>"Seed Default Quests"</strong> na aba Quests</li>
            <li>Tipos: <Code>solve_total</Code>, <Code>solve_category</Code></li>
          </ul>
        </Section>

        <Section id="i18n" icon="🌐" title="Idiomas / Languages">
          <p>A plataforma suporta <strong>Português (BR)</strong> e <strong>English</strong>.</p>
          <h4 className="font-bold text-accent mt-3">Como trocar o idioma:</h4>
          <div className="space-y-2">
            <Step n={1}><span>Na barra de navegação, clique no botão <strong>"PT"</strong> ou <strong>"EN"</strong></span></Step>
            <Step n={2}><span>O idioma é salvo automaticamente no navegador</span></Step>
          </div>
          <Tip>
            O idioma preferido é armazenado em <Code>localStorage</Code> sob a chave <Code>mdavelctf-lang</Code>.
            Também pode ser salvo no perfil do usuário (<Code>locale</Code>).
          </Tip>
        </Section>

        <Section id="instructor-guide" icon="🎓" title="Guia do Instrutor / Instructor Guide">
          <p className="font-semibold text-accent">Passo a passo completo para usar o MdavelCTF como instrutor:</p>

          <h4 className="font-bold text-accent mt-3">1. Configuração Inicial</h4>
          <div className="space-y-2">
            <Step n={1}><span>Faça login com sua conta de instrutor</span></Step>
            <Step n={2}><span>Acesse <Code>/classes</Code> e crie sua primeira turma</span></Step>
            <Step n={3}><span>Anote o <strong>código de convite</strong> (6 caracteres, ex: <Code>A3F2B1</Code>)</span></Step>
            <Step n={4}><span>Compartilhe o código com seus alunos (quadro, e-mail, chat)</span></Step>
          </div>

          <h4 className="font-bold text-accent mt-3">2. Criando uma Competição</h4>
          <div className="space-y-2">
            <Step n={1}><span>Acesse <Code>/instructor</Code> → aba <strong>"Criar Evento"</strong></span></Step>
            <Step n={2}><span>Configure: nome, datas, visibilidade (<strong>Private</strong> para turma), modo de equipe</span></Step>
            <Step n={3}><span>Vincule à turma no dropdown <strong>"Linked Class"</strong></span></Step>
            <Step n={4}><span>Clique <strong>"Criar Evento"</strong></span></Step>
          </div>

          <h4 className="font-bold text-accent mt-3">3. Adicionando Desafios</h4>
          <div className="space-y-2">
            <Step n={1}><span>Peça a um admin para criar desafios (ou use sua conta admin)</span></Step>
            <Step n={2}><span>Na aba <strong>"Challenges"</strong> do admin, selecione o evento</span></Step>
            <Step n={3}><span>Crie desafios com descrição em Markdown, dificuldade e flags</span></Step>
          </div>

          <h4 className="font-bold text-accent mt-3">4. Acompanhamento</h4>
          <ul className="list-disc list-inside text-xs space-y-0.5 text-hud-text/60">
            <li>Veja o progresso na aba <strong>"Details"</strong> da turma</li>
            <li>Acompanhe o placar em <Code>/scoreboard</Code></li>
            <li>Verifique submissões na aba <strong>"Logs"</strong> (admin)</li>
          </ul>

          <h4 className="font-bold text-accent mt-3">5. Boas Práticas</h4>
          <ul className="list-disc list-inside text-xs space-y-0.5 text-hud-text/60">
            <li>Comece com desafios de dificuldade 1-2 para novatos</li>
            <li>Misture categorias (WEB + CRYPTO + FORENSICS) para variedade</li>
            <li>Use o modo <Code>eventTeams</Code> para promover colaboração</li>
            <li>Ative as quests semanais para manter o engajamento</li>
            <li>Rotacione o código de convite periodicamente</li>
            <li>Use descrições em Markdown com dicas e links de referência</li>
          </ul>
        </Section>

        <Section id="student-guide" icon="🧑‍💻" title="Guia do Aluno / Student Guide">
          <p className="font-semibold text-accent">Como aproveitar ao máximo a plataforma:</p>

          <h4 className="font-bold text-accent mt-3">1. Começando</h4>
          <div className="space-y-2">
            <Step n={1}><span>Crie sua conta em <Code>/register</Code> ou use o login rápido (dev)</span></Step>
            <Step n={2}><span>Acesse <Code>/classes</Code> e entre na turma com o código do instrutor</span></Step>
            <Step n={3}><span>Personalize seu perfil em <Code>/profile</Code> (nome, bio, avatar, tema)</span></Step>
          </div>

          <h4 className="font-bold text-accent mt-3">2. Participando de Eventos</h4>
          <div className="space-y-2">
            <Step n={1}><span>Em <Code>/home</Code>, veja os eventos <strong>LIVE</strong> (ao vivo)</span></Step>
            <Step n={2}><span>Clique no evento para ver os desafios</span></Step>
            <Step n={3}><span>Filtre por categoria (WEB, CRYPTO, etc.)</span></Step>
            <Step n={4}><span>Leia a descrição, analise o problema e encontre a flag</span></Step>
            <Step n={5}><span>Submeta a flag no formato <Code>CTF&#123;...&#125;</Code></span></Step>
          </div>

          <h4 className="font-bold text-accent mt-3">3. Equipes</h4>
          <ul className="list-disc list-inside text-xs space-y-0.5 text-hud-text/60">
            <li>Crie ou entre em uma equipe pública em <Code>/profile</Code></li>
            <li>Em eventos com <Code>eventTeams</Code>, forme uma equipe específica para o evento</li>
            <li>Use o <strong>Team Chat</strong> para coordenar com seus colegas</li>
            <li>O capitão pode editar o nome, descrição e avatar da equipe</li>
          </ul>

          <h4 className="font-bold text-accent mt-3">4. Progresso</h4>
          <ul className="list-disc list-inside text-xs space-y-0.5 text-hud-text/60">
            <li>Ganhe <strong>XP</strong> ao resolver desafios e completar quests</li>
            <li>Suba de <strong>nível</strong> e colecione <strong>badges</strong></li>
            <li>Complete as <strong>missões semanais</strong> para bônus de XP</li>
            <li>Confira o <strong>placar</strong> para ver sua posição</li>
          </ul>

          <h4 className="font-bold text-accent mt-3">5. Dicas de CTF</h4>
          <ul className="list-disc list-inside text-xs space-y-0.5 text-hud-text/60">
            <li><strong>WEB:</strong> Inspecione o código-fonte, teste entradas, verifique cookies</li>
            <li><strong>CRYPTO:</strong> Identifique o algoritmo, procure chaves fracas</li>
            <li><strong>FORENSICS:</strong> Use ferramentas como <Code>strings</Code>, <Code>binwalk</Code>, <Code>exiftool</Code></li>
            <li><strong>OSINT:</strong> Pesquise em fontes públicas, use busca reversa de imagens</li>
            <li><strong>PWN:</strong> Analise o binário, identifique buffers e vulnerabilidades</li>
            <li><strong>REV:</strong> Use Ghidra, IDA ou radare2 para engenharia reversa</li>
          </ul>
        </Section>

        <Section id="credentials" icon="🔑" title="Credenciais de Teste / Test Credentials">
          <p>Credenciais disponíveis no ambiente de desenvolvimento (após <Code>npx tsx scripts/seed.ts</Code>):</p>
          <div className="mt-3 space-y-2">
            <div className="p-3 border border-warning/30">
              <div className="flex items-center gap-2 mb-2">
                <HudTag color="var(--warning)">ADMIN</HudTag>
              </div>
              <div className="font-mono text-xs space-y-0.5">
                <div>📧 <Code>admin@mdavelctf.local</Code></div>
                <div>🔑 <Code>Admin#12345</Code></div>
              </div>
            </div>
            <div className="p-3 border border-accent2/30">
              <div className="flex items-center gap-2 mb-2">
                <HudTag color="var(--accent2)">INSTRUCTOR</HudTag>
              </div>
              <div className="font-mono text-xs space-y-0.5">
                <div>📧 <Code>instructor@mdavelctf.local</Code></div>
                <div>🔑 <Code>Instructor#12345</Code></div>
              </div>
            </div>
            <div className="p-3 border border-accent/30">
              <div className="flex items-center gap-2 mb-2">
                <HudTag color="var(--accent)">PARTICIPANTS</HudTag>
              </div>
              <div className="font-mono text-xs space-y-0.5">
                <div>📧 <Code>user1@mdavelctf.local</Code> — NeoByte (Team SYNAPSE)</div>
                <div>📧 <Code>user2@mdavelctf.local</Code> — CipherCat (Team SYNAPSE)</div>
                <div>📧 <Code>user3@mdavelctf.local</Code> — RootRaven (Team NULLPULSE)</div>
                <div>📧 <Code>user4@mdavelctf.local</Code> — PacketPixie (Team NULLPULSE)</div>
                <div>🔑 Senha para todos: <Code>User#12345</Code></div>
              </div>
            </div>
          </div>

          <h4 className="font-bold text-accent mt-4">Dados populados pelo seed:</h4>
          <ul className="list-disc list-inside text-xs space-y-0.5 text-hud-text/60 mt-2">
            <li>5 usuários (1 admin, 1 instrutor, 4 participantes)</li>
            <li>2 equipes públicas (SYNAPSE, NULLPULSE)</li>
            <li>1 liga (Season 01) com 3 eventos</li>
            <li>3 eventos públicos: Warmup CTF (ended), Weekly #1 (live), Weekly #2 (upcoming)</li>
            <li>1 evento privado: Class Lab #1 (live, vinculado à turma)</li>
            <li>12 desafios com flags definidas</li>
            <li>1 turma: Cybersecurity 101 (3 alunos + instrutor)</li>
            <li>2 equipes de evento (Team Alpha, Team Bravo)</li>
            <li>Submissões e solves simulados no evento ao vivo</li>
            <li>Leaderboards e analytics pré-computados</li>
            <li>Mensagens de chat de equipe</li>
          </ul>

          <h4 className="font-bold text-accent mt-4">URLs úteis:</h4>
          <div className="font-mono text-xs space-y-0.5 mt-2 text-hud-text/60">
            <div>🌐 Frontend: <Code>http://localhost:3000</Code></div>
            <div>⚡ API: <Code>http://localhost:4000</Code></div>
            <div>🔥 Firebase UI: <Code>http://localhost:4040</Code></div>
            <div>📦 Firestore: <Code>http://localhost:8080</Code></div>
            <div>🔐 Auth: <Code>http://localhost:9099</Code></div>
          </div>
        </Section>
      </div>
    </div>
  );
}
