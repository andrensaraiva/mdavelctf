import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { LeagueDoc, EventDoc, LeaderboardRow } from '@mdavelctf/shared';
import { HudPanel } from '../components/HudPanel';
import { HudTag } from '../components/HudTag';
import { RankTable } from '../components/RankTable';
import { StatCard } from '../components/StatCard';

export default function LeaguePage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const [league, setLeague] = useState<LeagueDoc | null>(null);
  const [events, setEvents] = useState<(EventDoc & { id: string })[]>([]);
  const [standings, setStandings] = useState<LeaderboardRow[]>([]);
  const [teamStandings, setTeamStandings] = useState<LeaderboardRow[]>([]);
  const [mode, setMode] = useState<'individual' | 'teams'>('individual');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!leagueId) return;
    (async () => {
      try {
        // Fetch league doc + both standings in parallel
        const [lSnap, indSnap, teamSnap] = await Promise.all([
          getDoc(doc(db, 'leagues', leagueId)),
          getDoc(doc(db, 'leagues', leagueId, 'standings', 'individual')),
          getDoc(doc(db, 'leagues', leagueId, 'standings', 'teams')),
        ]);

        if (lSnap.exists()) {
          const ld = lSnap.data() as LeagueDoc;
          setLeague(ld);

          // Fetch all event docs in parallel
          const evts = await Promise.all(
            ld.eventIds.map(async (eid) => {
              const eSnap = await getDoc(doc(db, 'events', eid));
              return eSnap.exists() ? { id: eid, ...(eSnap.data() as EventDoc) } : null;
            }),
          );
          setEvents(evts.filter((e): e is EventDoc & { id: string } => e !== null));
        }

        if (indSnap.exists()) setStandings(indSnap.data().rows || []);
        if (teamSnap.exists()) setTeamStandings(teamSnap.data().rows || []);
      } catch {}
      setLoading(false);
    })();
  }, [leagueId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="inline-block w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (!league) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <p className="text-hud-text/50">League not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <HudPanel>
        <h1 className="text-xl font-bold text-accent glow-text">{league.name}</h1>
        <p className="text-xs text-hud-text/50 mt-1">
          {new Date(league.startsAt).toLocaleDateString()} —{' '}
          {new Date(league.endsAt).toLocaleDateString()} · {league.eventIds.length} events
        </p>
      </HudPanel>

      {/* Events */}
      <HudPanel title="Events">
        <div className="space-y-2">
          {events.map((e) => {
            const now = Date.now();
            const s = new Date(e.startsAt).getTime();
            const en = new Date(e.endsAt).getTime();
            const status = now < s ? 'UPCOMING' : now > en ? 'ENDED' : 'LIVE';
            return (
              <Link
                key={e.id}
                to={`/event/${e.id}`}
                className="block p-3 border border-accent/20 hover:border-accent/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm">{e.name}</span>
                  <HudTag
                    color={
                      status === 'LIVE'
                        ? 'var(--success)'
                        : status === 'UPCOMING'
                        ? 'var(--warning)'
                        : 'var(--danger)'
                    }
                  >
                    {status}
                  </HudTag>
                </div>
              </Link>
            );
          })}
        </div>
      </HudPanel>

      {/* Standings */}
      <HudPanel title="League Standings">
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setMode('individual')}
            className={`px-3 py-1 text-xs uppercase tracking-widest border ${
              mode === 'individual'
                ? 'border-accent text-accent bg-accent/10'
                : 'border-accent/20 text-hud-text/50'
            }`}
          >
            Individual
          </button>
          <button
            onClick={() => setMode('teams')}
            className={`px-3 py-1 text-xs uppercase tracking-widest border ${
              mode === 'teams'
                ? 'border-accent text-accent bg-accent/10'
                : 'border-accent/20 text-hud-text/50'
            }`}
          >
            Teams
          </button>
        </div>
        <RankTable
          rows={mode === 'individual' ? standings : teamStandings}
          mode={mode}
        />
      </HudPanel>
    </div>
  );
}
