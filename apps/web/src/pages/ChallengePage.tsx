import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { ChallengeDoc, EventDoc, SolveDoc, getTagColor } from '@mdavelctf/shared';
import { HudPanel } from '../components/HudPanel';
import { HudTag } from '../components/HudTag';
import { NeonButton } from '../components/NeonButton';
import { TabBar, TabPanel } from '../components/TabBar';
import { TerminalSubmitModal } from '../components/TerminalSubmitModal';
import { apiGet, apiPost } from '../lib/api';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';

interface HintView {
  index: number;
  title: string;
  cost: number;
  unlocked: boolean;
  content: string | null;
}

export default function ChallengePage() {
  const { eventId, challengeId } = useParams<{
    eventId: string;
    challengeId: string;
  }>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [challenge, setChallenge] = useState<ChallengeDoc | null>(null);
  const [event, setEvent] = useState<EventDoc | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [hints, setHints] = useState<HintView[]>([]);
  const [unlocking, setUnlocking] = useState<number | null>(null);
  const [hintMsg, setHintMsg] = useState('');
  const [contentTab, setContentTab] = useState('description');
  const [loading, setLoading] = useState(true);
  const [solved, setSolved] = useState(false);
  const [solvePoints, setSolvePoints] = useState<number | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const loadData = useCallback(async () => {
    if (!eventId || !challengeId) return;
    setLoading(true);
    try {
      const [eSnap, cSnap] = await Promise.all([
        getDoc(doc(db, 'events', eventId)),
        getDoc(doc(db, 'events', eventId, 'challenges', challengeId)),
      ]);
      if (eSnap.exists()) setEvent(eSnap.data() as EventDoc);
      if (cSnap.exists()) setChallenge(cSnap.data() as ChallengeDoc);

      // Check if user already solved
      if (user) {
        const solvesSnap = await getDocs(collection(db, 'events', eventId, 'solves'));
        const mySolve = solvesSnap.docs.find((d) => {
          const s = d.data() as SolveDoc;
          return s.uid === user.uid && s.challengeId === challengeId;
        });
        if (mySolve) {
          setSolved(true);
          setSolvePoints((mySolve.data() as SolveDoc).pointsAwarded);
        }
      }

      // Load hints
      try {
        const res = await apiGet(`/challenges/${challengeId}/hints?eventId=${encodeURIComponent(eventId)}`);
        setHints(res.hints || []);
      } catch {}
    } catch {}
    setLoading(false);
  }, [eventId, challengeId, user]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleUnlockHint = async (hintIndex: number) => {
    if (!eventId || !challengeId) return;
    setUnlocking(hintIndex);
    try {
      const res = await apiPost(`/challenges/${challengeId}/hints/${hintIndex}/unlock`, { eventId });
      if (res.unlocked || res.alreadyUnlocked) {
        setHints((prev) =>
          prev.map((h) => h.index === hintIndex ? { ...h, unlocked: true, content: res.content } : h),
        );
      }
    } catch (e: any) {
      setHintMsg(e.message);
      setTimeout(() => setHintMsg(''), 3000);
    }
    setUnlocking(null);
  };

  const handleSolve = (scoreAwarded: number) => {
    setShowModal(false);
    setShowSuccess(true);
    setSolvePoints(scoreAwarded);
    // After animation, update state
    setTimeout(() => {
      setShowSuccess(false);
      setSolved(true);
    }, 2800);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="inline-block w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin mb-3" />
        <p className="text-sm text-hud-text/40">{t('common.loading')}</p>
      </div>
    );
  }

  if (!challenge || !eventId || !challengeId) {
    return <div className="p-8 text-center text-accent/50">{t('event.loading')}</div>;
  }

  const color = getTagColor(challenge.category);
  const hasAttachments = challenge.attachments.length > 0;
  const hasHints = hints.length > 0;

  // Calculate effective points after hint penalties
  const hintPenalty = hints.filter((h) => h.unlocked).reduce((sum, h) => sum + h.cost, 0);
  const effectivePoints = challenge.pointsFixed - hintPenalty;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
      {/* ── Success Animation Overlay ── */}
      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm animate-fadeIn">
          <div className="text-center animate-scaleIn">
            <div className="text-6xl mb-4 animate-bounce">✅</div>
            <h2 className="text-2xl font-bold text-success mb-2">{t('challenge.solved')}</h2>
            <p className="text-lg text-accent font-mono">+{solvePoints} {t('common.points')}</p>
          </div>
        </div>
      )}

      {/* ── Breadcrumb ── */}
      <nav className="flex items-center gap-2 text-xs text-hud-text/40">
        <Link to={`/event/${eventId}`} className="hover:text-accent transition-colors">
          {event?.name || t('event.backToEvent')}
        </Link>
        <span>/</span>
        <span className="text-hud-text/60">{challenge.title}</span>
      </nav>

      {/* ── Solved Banner ── */}
      {solved && (
        <div className="flex items-center gap-3 p-4 border border-success/30 bg-success/5">
          <span className="text-2xl">✅</span>
          <div>
            <div className="font-bold text-success text-sm">{t('challenge.alreadySolved')}</div>
            {solvePoints !== null && (
              <div className="text-xs text-hud-text/50">
                {t('challenge.scoreEarned')}: <span className="font-bold text-success">+{solvePoints} {t('common.points')}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Header Block ── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-xl md:text-2xl font-bold">{challenge.title}</h1>
          <div className="flex items-center gap-2 flex-wrap">
            <HudTag color={color}>{challenge.category}</HudTag>
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="w-2 h-2"
                  style={{ backgroundColor: i < challenge.difficulty ? color : `${color}22` }}
                />
              ))}
            </div>
            <span className="text-xs text-hud-text/40">{t('event.diff')} {challenge.difficulty}</span>
            {challenge.flagMode === 'unique' && (
              <HudTag color="var(--warning)">🏆 {t('event.firstSolver')}</HudTag>
            )}
            {challenge.flagMode === 'decay' && (
              <HudTag color="var(--accent)">📉 {t('event.dynamicScore')}</HudTag>
            )}
          </div>
          {challenge.tags.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {challenge.tags.map((tag) => (
                <HudTag key={tag}>{tag}</HudTag>
              ))}
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="text-3xl font-bold" style={{ color: solved ? 'var(--success)' : color }}>
            {solved ? solvePoints : effectivePoints}
          </div>
          <div className="text-xs uppercase tracking-widest text-hud-text/50">{t('common.points')}</div>
          {!solved && hintPenalty > 0 && (
            <div className="text-[10px] text-warning">
              <span className="line-through text-hud-text/30 mr-1">{challenge.pointsFixed}</span>
              -{hintPenalty} {t('challenge.hintPenalty')}
            </div>
          )}
          {challenge.flagMode === 'decay' && challenge.solveCount ? (
            <div className="text-[10px] text-hud-text/40">{challenge.solveCount} {t('event.solves')}</div>
          ) : null}
        </div>
      </div>

      {/* ── Content Tabs ── */}
      <TabBar
        tabs={[
          { key: 'description', label: t('common.description'), icon: '📝' },
          ...(hasAttachments ? [{ key: 'files', label: t('challenge.files'), icon: '📎', badge: challenge.attachments.length }] : []),
          ...(hasHints ? [{ key: 'hints', label: t('hints.title'), icon: '💡', badge: `${hints.filter(h => h.unlocked).length}/${hints.length}` }] : []),
        ]}
        active={contentTab}
        onChange={setContentTab}
        size="sm"
      />

      {/* Description Tab */}
      <TabPanel active={contentTab} tab="description">
        <HudPanel>
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown>{challenge.descriptionMd}</ReactMarkdown>
          </div>
        </HudPanel>
      </TabPanel>

      {/* Files Tab */}
      {hasAttachments && (
        <TabPanel active={contentTab} tab="files">
          <HudPanel>
            <div className="space-y-2">
              {challenge.attachments.map((a, i) => (
                <a
                  key={i}
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 border border-accent/15 hover:border-accent/30 transition-all"
                >
                  <div className="flex items-center gap-2">
                    <span>📎</span>
                    <span className="text-sm font-medium text-accent">{a.name}</span>
                  </div>
                  <span className="text-xs text-hud-text/40">{(a.size / 1024).toFixed(1)} KB</span>
                </a>
              ))}
            </div>
          </HudPanel>
        </TabPanel>
      )}

      {/* Hints Tab */}
      {hasHints && (
        <TabPanel active={contentTab} tab="hints">
          <HudPanel>
            {hintMsg && <p className="text-xs text-danger mb-3">{hintMsg}</p>}
            <div className="space-y-2">
              {hints.map((hint) => (
                <div
                  key={hint.index}
                  className={`p-3 border transition-all ${
                    hint.unlocked ? 'border-success/30 bg-success/5' : 'border-accent/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">
                      {hint.unlocked ? '🔓' : '🔒'} {hint.title}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-warning font-semibold">-{hint.cost} pts</span>
                      {!hint.unlocked && (
                        <NeonButton
                          size="sm"
                          variant="solid"
                          onClick={() => handleUnlockHint(hint.index)}
                          disabled={unlocking === hint.index}
                        >
                          {unlocking === hint.index ? '...' : t('hints.buy')}
                        </NeonButton>
                      )}
                    </div>
                  </div>
                  {hint.unlocked && hint.content && (
                    <div className="mt-2 pt-2 border-t border-success/20 text-sm text-hud-text/80">
                      <ReactMarkdown>{hint.content}</ReactMarkdown>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </HudPanel>
        </TabPanel>
      )}

      {/* ── Fixed Submit Area ── */}
      {!solved && (
        <div className="sticky bottom-4 z-10">
          <div className="hud-panel p-4 flex items-center justify-between border-accent/25">
            <div className="text-sm text-hud-text/60">
              {t('challenge.readyToSubmit')}
              {hintPenalty > 0 && (
                <span className="ml-2 text-xs text-warning">({t('challenge.worthNow')}: {effectivePoints} pts)</span>
              )}
            </div>
            <NeonButton variant="solid" onClick={() => setShowModal(true)}>
              {t('challenge.submitFlag')}
            </NeonButton>
          </div>
        </div>
      )}

      <TerminalSubmitModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        eventId={eventId}
        challengeId={challengeId}
        challengeTitle={challenge.title}
        onSolve={handleSolve}
      />
    </div>
  );
}
