import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { EventDoc, ChallengeDoc, EventStatus, SolveDoc } from '@mdavelctf/shared';
import { HudPanel } from '../components/HudPanel';
import { HudTag } from '../components/HudTag';
import { CountdownTimer } from '../components/CountdownTimer';
import { NeonButton } from '../components/NeonButton';
import { useTranslation } from 'react-i18next';

function getStatus(e: EventDoc): EventStatus {
  const now = Date.now();
  if (now < new Date(e.startsAt).getTime()) return 'UPCOMING';
  if (now > new Date(e.endsAt).getTime()) return 'ENDED';
  return 'LIVE';
}

const catColors: Record<string, string> = {
  WEB: '#00f0ff',
  CRYPTO: '#ffbf00',
  FORENSICS: '#ff00ff',
  OSINT: '#39ff14',
  PWN: '#ff003c',
  REV: '#ff6600',
};

export default function EventPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [event, setEvent] = useState<EventDoc | null>(null);
  const [challenges, setChallenges] = useState<(ChallengeDoc & { id: string })[]>([]);
  const [mySolves, setMySolves] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    if (!eventId) return;
    (async () => {
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
    })();
  }, [eventId, user]);

  if (!event || !eventId) return <div className="p-8 text-center text-accent/50">{t('event.loading')}</div>;

  const status = getStatus(event);
  const categories = ['ALL', ...new Set(challenges.map((c) => c.category))];
  const filtered =
    filter === 'ALL' ? challenges : challenges.filter((c) => c.category === filter);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <HudPanel>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-accent glow-text">{event.name}</h1>
            <div className="flex items-center gap-2 mt-2">
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
              <span className="text-xs text-hud-text/50">
                {new Date(event.startsAt).toLocaleString()} —{' '}
                {new Date(event.endsAt).toLocaleString()}
              </span>
            </div>
          </div>
          {status === 'LIVE' && (
            <CountdownTimer targetDate={event.endsAt} label={t('home.endsIn')} />
          )}
          {status === 'UPCOMING' && (
            <CountdownTimer targetDate={event.startsAt} label={t('home.startsIn')} />
          )}
        </div>
      </HudPanel>

      {/* Category Filter */}
      <div className="flex gap-2 flex-wrap">
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
              cat !== 'ALL' && catColors[cat]
                ? { borderColor: filter === cat ? catColors[cat] : undefined }
                : {}
            }
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Challenge Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((chal) => {
          const solved = mySolves.has(chal.id);
          const color = catColors[chal.category] || 'var(--accent)';
          return (
            <Link
              key={chal.id}
              to={`/event/${eventId}/challenge/${chal.id}`}
              className="block"
            >
              <div
                className={`hud-panel p-4 h-full transition-all hover:scale-[1.02] ${
                  solved ? 'opacity-60' : ''
                }`}
                style={{ borderColor: `${color}44` }}
              >
                <div className="flex items-center justify-between mb-2">
                  <HudTag color={color}>{chal.category}</HudTag>
                  <span className="text-lg font-bold" style={{ color }}>
                    {chal.pointsFixed}
                  </span>
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
                        style={{
                          backgroundColor:
                            i < chal.difficulty ? color : `${color}22`,
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-hud-text/40">
                    {t('event.diff')} {chal.difficulty}
                  </span>
                </div>
                {chal.tags.length > 0 && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {chal.tags.map((t) => (
                      <span
                        key={t}
                        className="text-[10px] px-1.5 py-0.5 bg-accent/5 border border-accent/10 uppercase"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-hud-text/30">{t('event.noChallenges')}</div>
      )}
    </div>
  );
}
