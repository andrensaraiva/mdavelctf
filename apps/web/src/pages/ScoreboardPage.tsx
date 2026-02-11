import React, { useEffect, useState } from 'react';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import {
  LeaderboardRow,
  EventDoc,
  LeagueDoc,
  LeagueAnalyticsSummary,
  EventAnalyticsSummary,
} from '@mdavelctf/shared';
import { HudPanel } from '../components/HudPanel';
import { StatCard } from '../components/StatCard';
import { RankTable } from '../components/RankTable';
import { useTranslation } from 'react-i18next';

export default function ScoreboardPage() {
  const { t } = useTranslation();
  const [events, setEvents] = useState<(EventDoc & { id: string })[]>([]);
  const [leagues, setLeagues] = useState<(LeagueDoc & { id: string })[]>([]);
  const [scope, setScope] = useState<'event' | 'league'>('event');
  const [selectedId, setSelectedId] = useState('');
  const [mode, setMode] = useState<'individual' | 'teams'>('individual');
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [leagueAnalytics, setLeagueAnalytics] = useState<LeagueAnalyticsSummary | null>(null);
  const [eventAnalytics, setEventAnalytics] = useState<EventAnalyticsSummary | null>(null);

  useEffect(() => {
    (async () => {
      const eSnap = await getDocs(
        query(collection(db, 'events'), where('published', '==', true)),
      );
      const evts = eSnap.docs.map((d) => ({ id: d.id, ...(d.data() as EventDoc) }));
      setEvents(evts);

      const lSnap = await getDocs(
        query(collection(db, 'leagues'), where('published', '==', true)),
      );
      const lgs = lSnap.docs.map((d) => ({ id: d.id, ...(d.data() as LeagueDoc) }));
      setLeagues(lgs);

      if (evts.length > 0) setSelectedId(evts[0].id);
    })();
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    (async () => {
      // Load leaderboard
      const path =
        scope === 'event'
          ? `events/${selectedId}/leaderboards/${mode}`
          : `leagues/${selectedId}/standings/${mode}`;
      const snap = await getDoc(doc(db, path));
      setRows(snap.exists() ? snap.data().rows || [] : []);

      // Load analytics
      if (scope === 'league') {
        try {
          const aSnap = await getDoc(doc(db, 'leagues', selectedId, 'analytics', 'summary'));
          setLeagueAnalytics(aSnap.exists() ? (aSnap.data() as LeagueAnalyticsSummary) : null);
        } catch { setLeagueAnalytics(null); }
        setEventAnalytics(null);
      } else {
        try {
          const aSnap = await getDoc(doc(db, 'events', selectedId, 'analytics', 'summary'));
          setEventAnalytics(aSnap.exists() ? (aSnap.data() as EventAnalyticsSummary) : null);
        } catch { setEventAnalytics(null); }
        setLeagueAnalytics(null);
      }
    })();
  }, [selectedId, scope, mode]);

  const items = scope === 'event' ? events : leagues;
  const selectedName = items.find((i) => i.id === selectedId)?.name || '';

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="text-center space-y-1">
        <h1 className="text-3xl md:text-4xl font-extrabold text-accent glow-text tracking-wider">
          {t('scoreboard.title')}
        </h1>
        {selectedName && (
          <p className="text-hud-text/60 text-sm">{selectedName}</p>
        )}
      </div>

      {/* Controls */}
      <HudPanel>
        <div className="flex flex-wrap gap-3 items-center">
          {/* Scope toggle */}
          <div className="flex gap-1">
            <button
              onClick={() => {
                setScope('event');
                if (events.length) setSelectedId(events[0].id);
              }}
              className={`px-4 py-2 text-xs font-semibold uppercase tracking-widest border transition-all ${
                scope === 'event'
                  ? 'border-accent text-accent bg-accent/10'
                  : 'border-accent/20 text-hud-text/50 hover:text-accent hover:border-accent/40'
              }`}
            >
              🏁 {t('scoreboard.event')}
            </button>
            <button
              onClick={() => {
                setScope('league');
                if (leagues.length) setSelectedId(leagues[0].id);
              }}
              className={`px-4 py-2 text-xs font-semibold uppercase tracking-widest border transition-all ${
                scope === 'league'
                  ? 'border-accent text-accent bg-accent/10'
                  : 'border-accent/20 text-hud-text/50 hover:text-accent hover:border-accent/40'
              }`}
            >
              🏆 {t('scoreboard.season')}
            </button>
          </div>

          {/* Mode toggle */}
          <div className="flex gap-1">
            <button
              onClick={() => setMode('individual')}
              className={`px-4 py-2 text-xs font-semibold uppercase tracking-widest border transition-all ${
                mode === 'individual'
                  ? 'border-accent2 text-accent2 bg-accent2/10'
                  : 'border-accent/20 text-hud-text/50 hover:text-accent2 hover:border-accent2/40'
              }`}
            >
              👤 {t('scoreboard.individual')}
            </button>
            <button
              onClick={() => setMode('teams')}
              className={`px-4 py-2 text-xs font-semibold uppercase tracking-widest border transition-all ${
                mode === 'teams'
                  ? 'border-accent2 text-accent2 bg-accent2/10'
                  : 'border-accent/20 text-hud-text/50 hover:text-accent2 hover:border-accent2/40'
              }`}
            >
              👥 {t('scoreboard.teams')}
            </button>
          </div>

          {/* Selector */}
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="terminal-input px-3 py-2 text-sm flex-1 min-w-[160px]"
          >
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
      </HudPanel>

      {/* Season Graph - when league is selected */}
      {scope === 'league' && leagueAnalytics && (
        <SeasonGraph
          analytics={leagueAnalytics}
          events={events}
          leagueName={selectedName}
          t={t}
        />
      )}

      {/* Event Analytics - when event is selected */}
      {scope === 'event' && eventAnalytics && (
        <EventStats analytics={eventAnalytics} />
      )}

      {/* Rank table */}
      <HudPanel>
        <RankTable rows={rows} mode={mode} />
        {rows.length === 0 && (
          <p className="text-center text-hud-text/30 py-8 text-sm">
            {t('scoreboard.noScores')}
          </p>
        )}
      </HudPanel>
    </div>
  );
}

/* ─── Season graph component ─── */
function SeasonGraph({
  analytics,
  events,
  leagueName,
  t,
}: {
  analytics: LeagueAnalyticsSummary;
  events: (EventDoc & { id: string })[];
  leagueName: string;
  t: (key: string) => string;
}) {
  const participation = analytics.participationByEvent || {};
  const entries = Object.entries(participation);
  const maxP = Math.max(...Object.values(participation), 1);

  return (
    <HudPanel>
      <div className="space-y-4">
        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label={t('scoreboard.totalPlayers')} value={analytics.participantsTotal} color="var(--accent)" />
          <StatCard label={t('scoreboard.events')} value={entries.length} color="var(--accent2)" />
          <StatCard label={t('scoreboard.regulars')} value={analytics.retentionBuckets?.threePlus || 0} color="var(--success)" />
          <StatCard
            label={t('scoreboard.avgParticipation')}
            value={entries.length > 0 ? Math.round(Object.values(participation).reduce((a, b) => a + b, 0) / entries.length) : 0}
            color="var(--warning)"
          />
        </div>

        {/* Season bar chart */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-accent/60 mb-4">
            📊 {t('scoreboard.seasonParticipation')} — {leagueName}
          </h3>
          <div className="space-y-3">
            {entries.map(([eid, count], i) => {
              const pct = (count / maxP) * 100;
              const evtName = events.find((e) => e.id === eid)?.name || `Event ${i + 1}`;
              const colors = [
                'var(--accent)', 'var(--accent2)', 'var(--success)',
                'var(--warning)', 'var(--danger)',
              ];
              const color = colors[i % colors.length];

              return (
                <div key={eid} className="group">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold truncate max-w-[200px]">{evtName}</span>
                    <span className="text-sm font-bold" style={{ color }}>{count} {t('common.players')}</span>
                  </div>
                  <div className="bg-accent/5 h-8 rounded-sm overflow-hidden">
                    <div
                      className="h-full bar-chart-bar rounded-sm flex items-center px-3 group-hover:opacity-100 opacity-80 transition-opacity"
                      style={{
                        width: `${Math.max(pct, 5)}%`,
                        background: `linear-gradient(90deg, ${color}, ${color}88)`,
                      }}
                    >
                      <span className="text-xs font-extrabold text-bg">{Math.round(pct)}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Retention donut-style breakdown */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-accent/60 mb-3">
            🔄 {t('scoreboard.playerRetention')}
          </h3>
          <div className="flex gap-4 flex-wrap">
            <RetentionBucket
              label={t('scoreboard.oneTime')}
              count={analytics.retentionBuckets?.one || 0}
              total={analytics.participantsTotal}
              color="var(--danger)"
            />
            <RetentionBucket
              label={t('scoreboard.twoEvents')}
              count={analytics.retentionBuckets?.two || 0}
              total={analytics.participantsTotal}
              color="var(--warning)"
            />
            <RetentionBucket
              label={t('scoreboard.regulars')}
              count={analytics.retentionBuckets?.threePlus || 0}
              total={analytics.participantsTotal}
              color="var(--success)"
            />
          </div>
        </div>
      </div>
    </HudPanel>
  );
}

function RetentionBucket({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex-1 min-w-[120px] p-3 border border-accent/10 text-center">
      <div className="text-2xl font-extrabold mb-1" style={{ color }}>{count}</div>
      <div className="text-xs text-hud-text/60 mb-2 font-semibold">{label}</div>
      <div className="h-2 bg-accent/5 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bar-chart-bar"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <div className="text-xs mt-1 font-bold" style={{ color }}>{pct}%</div>
    </div>
  );
}

/* ─── Event stats mini-panel ─── */
function EventStats({ analytics }: { analytics: EventAnalyticsSummary }) {
  const { t } = useTranslation();
  const solves = analytics.solvesByChallenge || {};
  const entries = Object.entries(solves);
  const maxSolve = Math.max(...Object.values(solves), 1);

  return (
    <HudPanel>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <StatCard label={t('scoreboard.submissions')} value={analytics.submissionsTotal} color="var(--accent)" />
          <StatCard label={t('scoreboard.solves')} value={analytics.solvesTotal} color="var(--success)" />
          <StatCard
            label={t('scoreboard.solveRate')}
            value={analytics.submissionsTotal > 0
              ? `${Math.round((analytics.solvesTotal / analytics.submissionsTotal) * 100)}%`
              : '0%'
            }
            color="var(--warning)"
          />
        </div>

        {entries.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-accent/60 mb-3">
              🧩 {t('scoreboard.solvesByChallenge')}
            </h3>
            <div className="flex gap-2 items-end h-24">
              {entries.map(([cid, count]) => {
                const h = Math.max((count / maxSolve) * 100, 8);
                return (
                  <div key={cid} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs font-bold text-success">{count}</span>
                    <div
                      className="w-full rounded-t-sm bar-chart-bar hover:opacity-100 opacity-70 transition-opacity"
                      style={{
                        height: `${h}%`,
                        background: `linear-gradient(to top, var(--accent2), var(--accent))`,
                      }}
                      title={`${cid}: ${count} solves`}
                    />
                    <span className="text-[9px] text-hud-text/30 font-mono truncate w-full text-center">
                      {cid.slice(0, 6)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </HudPanel>
  );
}
