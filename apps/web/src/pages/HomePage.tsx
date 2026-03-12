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
import { PageHeader } from '../components/PageHeader';
import { TabBar, TabPanel } from '../components/TabBar';
import { EmptyState } from '../components/EmptyState';
import { NeonButton } from '../components/NeonButton';
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
  const [eventsTab, setEventsTab] = useState('live');

  const role = userDoc?.role || 'participant';
  const isInstructor = role === 'instructor' || role === 'admin' || role === 'superadmin';
  const isAdmin = role === 'admin' || role === 'superadmin';

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

  // Determine the primary CTA
  const primaryEvent = liveEvents[0] || upcomingEvents[0];
  const greeting = t('home.welcomeBack');
  const displayName = userDoc?.displayName || 'Hacker';

  // Auto-select events tab based on what's available
  useEffect(() => {
    if (liveEvents.length > 0) setEventsTab('live');
    else if (upcomingEvents.length > 0) setEventsTab('upcoming');
    else setEventsTab('past');
  }, [events.length]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* ── Hero Greeting + Primary CTA ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-sm text-hud-text/50">{greeting}</p>
          <h1 className="text-2xl md:text-3xl font-bold text-accent tracking-wide">
            {displayName}
          </h1>
        </div>
        {primaryEvent && (
          <Link to={`/event/${primaryEvent.id}`}>
            <NeonButton variant="solid" size="md">
              {getStatus(primaryEvent) === 'LIVE'
                ? `▶ ${t('home.enterNow')} — ${primaryEvent.name}`
                : `⏳ ${primaryEvent.name}`}
            </NeonButton>
          </Link>
        )}
      </div>

      {/* ── Progress Strip ── */}
      {userDoc && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <HudPanel>
              <XPProgressBar xp={userDoc.xp || 0} level={userDoc.level || 1} />
            </HudPanel>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label={t('profile.totalSolves')} value={userDoc.stats?.solvesTotal || 0} color="var(--success)" />
            <StatCard label={t('profile.badgesEarned')} value={(userDoc.badges || []).length} color="var(--warning)" />
          </div>
        </div>
      )}

      {/* ── Quick Access Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {userDoc?.teamId ? (
          <Link to={`/team/${userDoc.teamId}`} className="block">
            <div className="hud-panel p-4 h-full hover:border-accent/30 transition-all">
              <span className="text-xl mb-2 block">🛡️</span>
              <h3 className="font-semibold text-sm text-accent">{t('home.myTeamHub')}</h3>
              <p className="text-xs text-hud-text/40 mt-1">{t('home.teamHubDescription')}</p>
            </div>
          </Link>
        ) : (
          <Link to="/profile" className="block">
            <div className="hud-panel p-4 h-full hover:border-accent/30 transition-all">
              <span className="text-xl mb-2 block">🛡️</span>
              <h3 className="font-semibold text-sm text-accent">{t('home.joinOrCreateTeam')}</h3>
              <p className="text-xs text-hud-text/40 mt-1">{t('home.teamUpDescription')}</p>
            </div>
          </Link>
        )}
        <Link to="/scoreboard" className="block">
          <div className="hud-panel p-4 h-full hover:border-accent/30 transition-all">
            <span className="text-xl mb-2 block">🏆</span>
            <h3 className="font-semibold text-sm text-accent">{t('nav.scores')}</h3>
            <p className="text-xs text-hud-text/40 mt-1">{t('home.seasonRanking')}</p>
          </div>
        </Link>
        <Link to="/classes" className="block">
          <div className="hud-panel p-4 h-full hover:border-accent/30 transition-all">
            <span className="text-xl mb-2 block">📚</span>
            <h3 className="font-semibold text-sm text-accent">{t('nav.classes')}</h3>
            <p className="text-xs text-hud-text/40 mt-1">{t('classes.joinClass')}</p>
          </div>
        </Link>
        <Link to="/guide" className="block">
          <div className="hud-panel p-4 h-full hover:border-accent/30 transition-all">
            <span className="text-xl mb-2 block">📖</span>
            <h3 className="font-semibold text-sm text-accent">{t('nav.guide')}</h3>
            <p className="text-xs text-hud-text/40 mt-1">{t('home.getStarted')}</p>
          </div>
        </Link>
      </div>

      {/* ── Active Event Highlight (only if LIVE) ── */}
      {liveEvents.length > 0 && (
        <Link to={`/event/${liveEvents[0].id}`} className="block">
          <div className="hud-panel p-5 md:p-6 border-success/30 hover:border-success/50 transition-all">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="live-dot" />
                  <h3 className="text-lg md:text-xl font-bold text-success">
                    {liveEvents[0].name}
                  </h3>
                  <HudTag color="var(--success)">LIVE</HudTag>
                </div>
                <p className="text-xs text-hud-text/40">
                  {t('common.started')} {new Date(liveEvents[0].startsAt).toLocaleDateString()}
                </p>
              </div>
              <CountdownTimer targetDate={liveEvents[0].endsAt} label={t('home.endsIn')} />
            </div>
          </div>
        </Link>
      )}

      {/* ── Weekly Quests (collapsible) ── */}
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

      {/* ── Events Section (tabbed) ── */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-hud-text/50">
          {t('admin.events')}
        </h2>
        <TabBar
          tabs={[
            { key: 'live', label: t('home.liveNow'), icon: '🟢', badge: liveEvents.length || undefined },
            { key: 'upcoming', label: t('home.comingSoon'), icon: '⏳', badge: upcomingEvents.length || undefined },
            { key: 'past', label: t('home.pastEvents'), icon: '📁' },
          ]}
          active={eventsTab}
          onChange={setEventsTab}
          size="sm"
        />

        <TabPanel active={eventsTab} tab="live">
          {liveEvents.length === 0 ? (
            <EmptyState icon="🏁" title={t('home.noLiveEvents')} description={t('home.checkBackSoon')} />
          ) : (
            <div className="space-y-3">
              {liveEvents.map((e) => (
                <Link key={e.id} to={`/event/${e.id}`} className="block">
                  <div className="hud-panel p-4 border-success/20 hover:border-success/40 transition-all">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="live-dot" />
                        <span className="font-bold text-success">{e.name}</span>
                        {e.classType && <HudTag color="var(--accent2)">🏷️ {e.classType}</HudTag>}
                      </div>
                      <CountdownTimer targetDate={e.endsAt} label={t('home.endsIn')} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </TabPanel>

        <TabPanel active={eventsTab} tab="upcoming">
          {upcomingEvents.length === 0 ? (
            <EmptyState icon="⏳" title={t('home.noUpcomingEvents')} />
          ) : (
            <div className="space-y-2">
              {upcomingEvents.map((e) => (
                <Link key={e.id} to={`/event/${e.id}`} className="block">
                  <div className="hud-panel p-4 hover:border-warning/30 transition-all">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-warning">⏳</span>
                        <span className="font-bold">{e.name}</span>
                        {e.classType && <HudTag color="var(--accent2)">🏷️ {e.classType}</HudTag>}
                      </div>
                      <CountdownTimer targetDate={e.startsAt} label={t('home.startsIn')} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </TabPanel>

        <TabPanel active={eventsTab} tab="past">
          {endedEvents.length === 0 ? (
            <EmptyState icon="📁" title={t('home.noPastEvents')} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {endedEvents.map((e) => (
                <Link key={e.id} to={`/event/${e.id}`} className="block">
                  <div className="hud-panel p-3 opacity-60 hover:opacity-90 transition-all">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{e.name}</span>
                      <span className="text-xs font-mono text-hud-text/40">
                        {new Date(e.endsAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </TabPanel>
      </div>

      {/* ── Leagues ── */}
      {leagues.length > 0 && (
        <HudPanel title={t('home.activeLeagues')}>
          <div className="space-y-2">
            {leagues.map((l) => (
              <Link
                key={l.id}
                to={`/league/${l.id}`}
                className="flex items-center justify-between p-3 border border-accent2/15 hover:border-accent2/30 hover:bg-accent2/5 transition-all"
              >
                <div>
                  <span className="font-bold text-accent2">{l.name}</span>
                  <p className="text-xs text-hud-text/40 mt-0.5">
                    {l.eventIds.length} {t('home.events')}
                  </p>
                </div>
                <HudTag color="var(--accent2)">{l.eventIds.length} {t('home.events')}</HudTag>
              </Link>
            ))}
          </div>
        </HudPanel>
      )}

      {/* ── Instructor Quick Access ── */}
      {isInstructor && (
        <HudPanel title={t('nav.instructor')}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link to="/instructor" className="block">
              <div className="p-3 border border-accent/15 hover:border-accent/30 transition-all">
                <div className="flex items-center gap-2">
                  <span>🎓</span>
                  <span className="font-semibold text-sm text-accent">{t('instructor.title')}</span>
                </div>
                <p className="text-xs text-hud-text/40 mt-1">{t('home.manageClassesEvents')}</p>
              </div>
            </Link>
            <Link to="/classes" className="block">
              <div className="p-3 border border-accent/15 hover:border-accent/30 transition-all">
                <div className="flex items-center gap-2">
                  <span>📚</span>
                  <span className="font-semibold text-sm text-accent">{t('nav.classes')}</span>
                </div>
                <p className="text-xs text-hud-text/40 mt-1">{t('home.viewYourClasses')}</p>
              </div>
            </Link>
          </div>
        </HudPanel>
      )}
    </div>
  );
}
