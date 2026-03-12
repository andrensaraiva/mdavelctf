import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { EventDoc, ChallengeDoc, EventStatus, SolveDoc, getTagColor } from '@mdavelctf/shared';
import { HudPanel } from '../components/HudPanel';
import { HudTag } from '../components/HudTag';
import { CountdownTimer } from '../components/CountdownTimer';
import { TabBar, TabPanel } from '../components/TabBar';
import { EmptyState } from '../components/EmptyState';
import { RankTable } from '../components/RankTable';
import { useTranslation } from 'react-i18next';

function getStatus(e: EventDoc): EventStatus {
  const now = Date.now();
  if (now < new Date(e.startsAt).getTime()) return 'UPCOMING';
  if (now > new Date(e.endsAt).getTime()) return 'ENDED';
  return 'LIVE';
}

export default function EventPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { t } = useTranslation();
  const { user, userDoc } = useAuth();
  const [event, setEvent] = useState<EventDoc | null>(null);
  const [challenges, setChallenges] = useState<(ChallengeDoc & { id: string })[]>([]);
  const [mySolves, setMySolves] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('ALL');
  const [tab, setTab] = useState('challenges');
  const [ranks, setRanks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId) return;
    (async () => {
      try {
        const eSnap = await getDoc(doc(db, 'events', eventId));
        if (eSnap.exists()) setEvent(eSnap.data() as EventDoc);

        const cSnap = await getDocs(
          query(
            collection(db, 'events', eventId, 'challenges'),
            where('published', '==', true),
          ),
        );
        setChallenges(
          cSnap.docs.map((d) => ({ id: d.id, ...(d.data() as ChallengeDoc) })),
        );

        if (user) {
          const sSnap = await getDocs(collection(db, 'events', eventId, 'solves'));
          const solved = new Set<string>();
          sSnap.docs.forEach((d) => {
            const s = d.data() as SolveDoc;
            if (s.uid === user.uid) solved.add(s.challengeId);
          });
          setMySolves(solved);
        }

        // Fetch event ranking
        const rSnap = await getDocs(
          query(collection(db, 'events', eventId, 'solves')),
        );
        const scoreMap: Record<string, { uid: string; displayName: string; score: number }> = {};
        rSnap.docs.forEach((d) => {
          const s = d.data() as SolveDoc;
          if (!scoreMap[s.uid]) scoreMap[s.uid] = { uid: s.uid, displayName: s.displayName || s.uid, score: 0 };
          scoreMap[s.uid].score += s.points || 0;
        });
        setRanks(Object.values(scoreMap).sort((a, b) => b.score - a.score));
      } catch {}
      setLoading(false);
    })();
  }, [eventId, user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="inline-block w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (!event || !eventId) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <p className="text-hud-text/50">{t('event.notFound', 'Event not found')}</p>
      </div>
    );
  }

  const status = getStatus(event);
  const categories = ['ALL', ...new Set(challenges.map((c) => c.category))];
  const filtered =
    filter === 'ALL' ? challenges : challenges.filter((c) => c.category === filter);
  const solvedCount = challenges.filter((c) => mySolves.has(c.id)).length;
  const totalPoints = challenges.filter((c) => mySolves.has(c.id)).reduce((s, c) => s + (c.pointsFixed || 0), 0);

  const statusColor = status === 'LIVE' ? 'var(--success)' : status === 'UPCOMING' ? 'var(--warning)' : 'var(--danger)';

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
      {/* ── Compact Header ── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold text-accent">{event.name}</h1>
            <HudTag color={statusColor}>{status}</HudTag>
            {event.classType && <HudTag color="var(--accent2)">🏷️ {event.classType}</HudTag>}
          </div>
          <p className="text-xs text-hud-text/40">
            {new Date(event.startsAt).toLocaleString()} — {new Date(event.endsAt).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {user && (
            <div className="text-right text-xs text-hud-text/50">
              <span className="text-accent font-bold text-sm">{solvedCount}/{challenges.length}</span> {t('event.solved')}
              {totalPoints > 0 && <div className="text-accent/70">{totalPoints} pts</div>}
            </div>
          )}
          {status === 'LIVE' && <CountdownTimer targetDate={event.endsAt} label={t('home.endsIn')} />}
          {status === 'UPCOMING' && <CountdownTimer targetDate={event.startsAt} label={t('home.startsIn')} />}
        </div>
      </div>

      {/* ── Tabs ── */}
      <TabBar
        tabs={[
          { key: 'challenges', label: t('admin.challenges'), icon: '🎯', badge: challenges.length || undefined },
          { key: 'ranking', label: t('scoreboard.title'), icon: '🏆' },
          { key: 'info', label: t('common.info'), icon: 'ℹ️' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {/* ── Challenges Tab ── */}
      <TabPanel active={tab} tab="challenges">
        {/* Category Filter */}
        <div className="flex gap-2 flex-wrap mb-4">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-3 py-1 text-xs uppercase tracking-widest border transition-colors ${
                filter === cat
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-accent/20 text-hud-text/50 hover:border-accent/50'
              }`}
              style={
                cat !== 'ALL' && getTagColor(cat) !== 'var(--accent)'
                  ? { borderColor: filter === cat ? getTagColor(cat) : undefined }
                  : {}
              }
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Challenge Grid */}
        {filtered.length === 0 ? (
          <EmptyState icon="🎯" title={t('event.noChallenges')} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((chal) => {
              const solved = mySolves.has(chal.id);
              const color = getTagColor(chal.category);
              return (
                <Link key={chal.id} to={`/event/${eventId}/challenge/${chal.id}`} className="block">
                  <div
                    className={`hud-panel p-4 h-full transition-all hover:scale-[1.02] ${
                      solved ? 'opacity-60' : ''
                    } ${chal.flagMode === 'unique' && chal.lockedBy ? 'opacity-40 pointer-events-none' : ''}`}
                    style={{ borderColor: `${color}44` }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <HudTag color={color}>{chal.category}</HudTag>
                        {chal.flagMode === 'unique' && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-warning/10 border border-warning/30 text-warning uppercase tracking-wider" title={t('event.firstSolverOnly')}>
                            🏆 {t('event.firstSolver')}
                          </span>
                        )}
                        {chal.flagMode === 'decay' && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-accent/10 border border-accent/30 text-accent uppercase tracking-wider" title={t('event.dynamicScoreDesc')}>
                            📉 {t('event.dynamicScore')}
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold" style={{ color }}>{chal.pointsFixed}</span>
                        {chal.flagMode === 'decay' && chal.solveCount ? (
                          <div className="text-[10px] text-hud-text/40">{chal.solveCount} {t('event.solves')}</div>
                        ) : null}
                      </div>
                    </div>
                    <h3 className="font-bold text-sm mb-2">
                      {solved && <span className="text-success mr-1">✓</span>}
                      {chal.title}
                    </h3>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <div
                            key={i}
                            className="w-2 h-2"
                            style={{ backgroundColor: i < chal.difficulty ? color : `${color}22` }}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-hud-text/40">{t('event.diff')} {chal.difficulty}</span>
                    </div>
                    {chal.tags.length > 0 && (
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {chal.tags.map((tag) => (
                          <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-accent/5 border border-accent/10 uppercase">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </TabPanel>

      {/* ── Ranking Tab ── */}
      <TabPanel active={tab} tab="ranking">
        {ranks.length === 0 ? (
          <EmptyState icon="🏆" title={t('scoreboard.noData')} description={t('event.noSolvesYet')} />
        ) : (
          <RankTable
            rows={ranks.map((r) => ({
              uid: r.uid,
              displayName: r.displayName,
              score: r.score,
              lastSolveAt: '',
            }))}
            mode="individual"
          />
        )}
      </TabPanel>

      {/* ── Info Tab ── */}
      <TabPanel active={tab} tab="info">
        <HudPanel>
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-3 border border-accent/10">
                <div className="text-lg font-bold text-accent">{challenges.length}</div>
                <div className="text-xs text-hud-text/40">{t('admin.challenges')}</div>
              </div>
              <div className="p-3 border border-accent/10">
                <div className="text-lg font-bold" style={{ color: statusColor }}>{status}</div>
                <div className="text-xs text-hud-text/40">{t('common.status')}</div>
              </div>
              <div className="p-3 border border-accent/10">
                <div className="text-lg font-bold text-accent">{new Set(challenges.map(c => c.category)).size}</div>
                <div className="text-xs text-hud-text/40">{t('event.categories')}</div>
              </div>
              <div className="p-3 border border-accent/10">
                <div className="text-lg font-bold text-accent">{ranks.length}</div>
                <div className="text-xs text-hud-text/40">{t('event.participants')}</div>
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-accent">{t('event.schedule')}</h3>
              <p className="text-xs text-hud-text/60">
                <span className="text-hud-text/40">{t('common.start')}:</span> {new Date(event.startsAt).toLocaleString()}
              </p>
              <p className="text-xs text-hud-text/60">
                <span className="text-hud-text/40">{t('common.end')}:</span> {new Date(event.endsAt).toLocaleString()}
              </p>
              {event.classType && (
                <p className="text-xs text-hud-text/60">
                  <span className="text-hud-text/40">{t('event.classType')}:</span> {event.classType}
                </p>
              )}
            </div>
            {event.description && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-accent">{t('common.description')}</h3>
                <p className="text-sm text-hud-text/60 whitespace-pre-line">{event.description}</p>
              </div>
            )}
          </div>
        </HudPanel>
      </TabPanel>
    </div>
  );
}
