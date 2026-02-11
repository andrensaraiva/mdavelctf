import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { EventDoc, LeagueDoc, EventStatus } from '@mdavelctf/shared';
import { HudPanel } from '../components/HudPanel';
import { HudTag } from '../components/HudTag';
import { StatCard } from '../components/StatCard';
import { CountdownTimer } from '../components/CountdownTimer';
import { XPProgressBar } from '../components/XPProgressBar';
import { QuestCard } from '../components/QuestCard';
import { Link } from 'react-router-dom';
import { apiGet } from '../lib/api';
import { useTranslation } from 'react-i18next';

function getStatus(e: EventDoc): EventStatus {
  const now = Date.now();
  if (now < new Date(e.startsAt).getTime()) return 'UPCOMING';
  if (now > new Date(e.endsAt).getTime()) return 'ENDED';
  return 'LIVE';
}

export default function HomePage() {
  const { t } = useTranslation();
  const { userDoc } = useAuth();
  const [leagues, setLeagues] = useState<(LeagueDoc & { id: string })[]>([]);
  const [events, setEvents] = useState<(EventDoc & { id: string })[]>([]);
  const [quests, setQuests] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const lSnap = await getDocs(
        query(collection(db, 'leagues'), where('published', '==', true)),
      );
      setLeagues(lSnap.docs.map((d) => ({ id: d.id, ...(d.data() as LeagueDoc) })));

      const eSnap = await getDocs(
        query(collection(db, 'events'), where('published', '==', true)),
      );
      setEvents(eSnap.docs.map((d) => ({ id: d.id, ...(d.data() as EventDoc) })));

      try {
        const res = await apiGet('/gamification/quests');
        setQuests(res.quests || []);
      } catch {}
    })();
  }, []);

  const liveEvents = events.filter((e) => getStatus(e) === 'LIVE');
  const upcomingEvents = events.filter((e) => getStatus(e) === 'UPCOMING');
  const endedEvents = events.filter((e) => getStatus(e) === 'ENDED');

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Hero Header */}
      <div className="text-center py-6">
        <h1 className="text-4xl md:text-5xl font-extrabold text-accent glow-text tracking-widest">
          MdavelCTF
        </h1>
        <p className="text-base text-hud-text/60 mt-2 font-light">
          {t('home.welcomeBack')} <span className="text-accent font-semibold">{userDoc?.displayName || 'Hacker'}</span>
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label={t('home.liveEvents')} value={liveEvents.length} icon={<span className="live-dot" />} color="var(--success)" />
        <StatCard label={t('home.upcoming')} value={upcomingEvents.length} color="var(--warning)" />
        <StatCard label={t('home.completed')} value={endedEvents.length} color="var(--danger)" />
        <StatCard label={t('home.leagues')} value={leagues.length} color="var(--accent2)" />
      </div>

      {/* XP Progress */}
      {userDoc && (
        <HudPanel>
          <XPProgressBar xp={userDoc.xp || 0} level={userDoc.level || 1} />
        </HudPanel>
      )}

      {/* Team CTA */}
      {userDoc && !userDoc.teamId && (
        <Link to="/profile" className="block">
          <HudPanel>
            <div className="flex items-center gap-4">
              <span className="text-3xl">🛡️</span>
              <div className="flex-1">
                <h3 className="font-bold text-accent text-base">{t('home.joinOrCreateTeam')}</h3>
                <p className="text-sm text-hud-text/50">{t('home.teamUpDescription')}</p>
              </div>
              <span className="text-accent text-xl">→</span>
            </div>
          </HudPanel>
        </Link>
      )}
      {userDoc?.teamId && (
        <Link to={`/team/${userDoc.teamId}`} className="block">
          <HudPanel>
            <div className="flex items-center gap-4">
              <span className="text-3xl">🛡️</span>
              <div className="flex-1">
                <h3 className="font-bold text-accent text-base">{t('home.myTeamHub')}</h3>
                <p className="text-sm text-hud-text/50">{t('home.teamHubDescription')}</p>
              </div>
              <span className="text-accent text-xl">→</span>
            </div>
          </HudPanel>
        </Link>
      )}

      {/* Weekly Quests */}
      {quests.length > 0 && (
        <HudPanel title={t('home.weeklyQuests')}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {quests.map((q: any) => (
              <QuestCard
                key={q.id}
                title={q.title}
                description={q.description}
                xpReward={q.xpReward}
                badgeReward={q.badgeReward}
                progress={q.userProgress?.progress || 0}
                target={q.rules?.target || 1}
                completed={q.userProgress?.completed || false}
              />
            ))}
          </div>
        </HudPanel>
      )}

      {/* ═══ LIVE EVENTS — Big hero cards ═══ */}
      {liveEvents.length > 0 && (
        <div className="space-y-4">
          <h2 className="flex items-center gap-3 text-lg font-bold uppercase tracking-widest">
            <span className="live-dot" />
            <span className="text-success">{t('home.liveNow')}</span>
          </h2>
          {liveEvents.map((e) => (
            <Link
              key={e.id}
              to={`/event/${e.id}`}
              className="block live-pulse rounded-sm"
            >
              <div className="hud-panel p-6 md:p-8 border-success/40 hover:border-success/70 transition-all">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="live-dot" />
                      <h3 className="text-2xl md:text-3xl font-extrabold text-success glow-text">
                        {e.name}
                      </h3>
                    </div>
                    <p className="text-sm text-hud-text/50 font-mono">
                      {t('common.started')} {new Date(e.startsAt).toLocaleDateString()} • {t('home.enterNow')}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <CountdownTimer targetDate={e.endsAt} label={t('home.endsIn')} />
                    <span className="text-xs font-semibold uppercase tracking-widest text-success/70 border border-success/30 px-3 py-1">
                      {t('home.joinCompetition')}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* ═══ LEAGUES ═══ */}
      {leagues.length > 0 && (
        <HudPanel title={t('home.activeLeagues')}>
          <div className="space-y-3">
            {leagues.map((l) => (
              <Link
                key={l.id}
                to={`/league/${l.id}`}
                className="flex items-center justify-between p-4 border border-accent2/20 hover:border-accent2/50 hover:bg-accent2/5 transition-all"
              >
                <div className="space-y-1">
                  <span className="font-bold text-lg text-accent2">{l.name}</span>
                  <p className="text-xs text-hud-text/40 font-mono">
                    {l.eventIds.length} {t('home.events')} • {t('home.seasonRanking')}
                  </p>
                </div>
                <HudTag color="var(--accent2)">{l.eventIds.length} {t('home.events')}</HudTag>
              </Link>
            ))}
          </div>
        </HudPanel>
      )}

      {/* ═══ UPCOMING — Countdown focus ═══ */}
      {upcomingEvents.length > 0 && (
        <HudPanel title={t('home.comingSoon')}>
          <div className="space-y-3">
            {upcomingEvents.map((e) => (
              <Link
                key={e.id}
                to={`/event/${e.id}`}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-warning/20 hover:border-warning/50 hover:bg-warning/5 transition-all gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-warning text-lg">⏳</span>
                    <span className="font-bold text-lg">{e.name}</span>
                  </div>
                  <p className="text-xs text-hud-text/40 font-mono">
                    {new Date(e.startsAt).toLocaleDateString()} at{' '}
                    {new Date(e.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <CountdownTimer targetDate={e.startsAt} label={t('home.startsIn')} />
              </Link>
            ))}
          </div>
        </HudPanel>
      )}

      {/* ═══ ENDED — Compact ═══ */}
      {endedEvents.length > 0 && (
        <HudPanel title={t('home.pastEvents')}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {endedEvents.map((e) => (
              <Link
                key={e.id}
                to={`/event/${e.id}`}
                className="flex items-center justify-between p-3 border border-hud-text/10 hover:border-hud-text/25 transition-all opacity-60 hover:opacity-90"
              >
                <span className="font-medium">{e.name}</span>
                <span className="text-xs font-mono text-hud-text/40">
                  {new Date(e.endsAt).toLocaleDateString()}
                </span>
              </Link>
            ))}
          </div>
        </HudPanel>
      )}
    </div>
  );
}
