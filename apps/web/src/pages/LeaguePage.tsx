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

  useEffect(() => {
    if (!leagueId) return;
    (async () => {
      const lSnap = await getDoc(doc(db, 'leagues', leagueId));
      if (lSnap.exists()) {
        const ld = lSnap.data() as LeagueDoc;
        setLeague(ld);

        // Load events
        const evts: (EventDoc & { id: string })[] = [];
        for (const eid of ld.eventIds) {
          const eSnap = await getDoc(doc(db, 'events', eid));
          if (eSnap.exists()) evts.push({ id: eid, ...(eSnap.data() as EventDoc) });
        }
        setEvents(evts);
      }

      // Standings
      const indSnap = await getDoc(doc(db, 'leagues', leagueId, 'standings', 'individual'));
      if (indSnap.exists()) setStandings(indSnap.data().rows || []);

      const teamSnap = await getDoc(doc(db, 'leagues', leagueId, 'standings', 'teams'));
      if (teamSnap.exists()) setTeamStandings(teamSnap.data().rows || []);
    })();
  }, [leagueId]);

  if (!league) return <div className="p-8 text-center text-accent/50">Loading...</div>;

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
