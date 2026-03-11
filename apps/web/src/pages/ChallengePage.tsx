import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { ChallengeDoc, EventDoc, COURSE_THEME_PRESETS } from '@mdavelctf/shared';
import { HudPanel } from '../components/HudPanel';
import { HudTag } from '../components/HudTag';
import { NeonButton } from '../components/NeonButton';
import { TerminalSubmitModal } from '../components/TerminalSubmitModal';
import { apiGet, apiPost } from '../lib/api';
import { useTheme } from '../context/ThemeContext';
import ReactMarkdown from 'react-markdown';

interface HintView {
  id: string;
  title?: string;
  order: number;
  cost: number;
  unlocked: boolean;
  content: string | null;
}

export default function ChallengePage() {
  const { eventId, challengeId } = useParams<{
    eventId: string;
    challengeId: string;
  }>();
  const [challenge, setChallenge] = useState<ChallengeDoc | null>(null);
  const [event, setEvent] = useState<EventDoc | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [hints, setHints] = useState<HintView[]>([]);
  const [unlocking, setUnlocking] = useState<string | null>(null);
  const [hintMsg, setHintMsg] = useState('');
  const { setCourseThemeId, themeSource } = useTheme();

  useEffect(() => {
    if (!eventId || !challengeId) return;
    (async () => {
      const eSnap = await getDoc(doc(db, 'events', eventId));
      if (eSnap.exists()) {
        const eventData = eSnap.data() as EventDoc;
        setEvent(eventData);
        // Apply course theme if applicable
        if (eventData.courseId && themeSource === 'course') {
          const courseSnap = await getDoc(doc(db, 'courses', eventData.courseId));
          if (courseSnap.exists()) {
            setCourseThemeId(courseSnap.data()?.themeId || null);
          }
        }
      }

      const cSnap = await getDoc(
        doc(db, 'events', eventId, 'challenges', challengeId),
      );
      if (cSnap.exists()) setChallenge(cSnap.data() as ChallengeDoc);

      // Load hints
      try {
        const res = await apiGet(`/challenges/${challengeId}/hints?eventId=${eventId}`);
        setHints(res.hints || []);
      } catch {}
    })();
  }, [eventId, challengeId]);

  const handleUnlockHint = async (hintId: string) => {
    if (!eventId || !challengeId) return;
    setUnlocking(hintId);
    try {
      const res = await apiPost(`/challenges/${challengeId}/hints/${hintId}/unlock`, { eventId });
      if (res.unlocked || res.alreadyUnlocked) {
        setHints((prev) =>
          prev.map((h) => h.id === hintId ? { ...h, unlocked: true, content: res.content } : h),
        );
      }
    } catch (e: any) {
      setHintMsg(e.message);
      setTimeout(() => setHintMsg(''), 3000);
    }
    setUnlocking(null);
  };

  if (!challenge || !eventId || !challengeId) {
    return <div className="p-8 text-center text-accent/50">Loading...</div>;
  }

  const catColors: Record<string, string> = {
    WEB: '#00f0ff',
    CRYPTO: '#ffbf00',
    FORENSICS: '#ff00ff',
    OSINT: '#39ff14',
    PWN: '#ff003c',
    REV: '#ff6600',
  };
  const color = catColors[challenge.category] || 'var(--accent)';

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <HudPanel>
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <HudTag color={color}>{challenge.category}</HudTag>
              <div className="flex gap-0.5 ml-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-2 h-2"
                    style={{
                      backgroundColor:
                        i < challenge.difficulty ? color : `${color}22`,
                    }}
                  />
                ))}
              </div>
            </div>
            <h1 className="text-xl font-bold">{challenge.title}</h1>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold glow-text" style={{ color }}>
              {challenge.pointsFixed}
            </div>
            <div className="text-xs uppercase tracking-widest text-hud-text/50">
              points
            </div>
          </div>
        </div>

        {challenge.tags.length > 0 && (
          <div className="flex gap-1 mb-4 flex-wrap">
            {challenge.tags.map((t) => (
              <HudTag key={t}>{t}</HudTag>
            ))}
          </div>
        )}

        {/* Markdown Description */}
        <div className="prose prose-invert prose-sm max-w-none border-t border-accent/10 pt-4">
          <ReactMarkdown>{challenge.descriptionMd}</ReactMarkdown>
        </div>

        {/* Attachments */}
        {challenge.attachments.length > 0 && (
          <div className="mt-4 border-t border-accent/10 pt-4">
            <h3 className="text-xs uppercase tracking-widest text-accent/70 mb-2">
              Attachments
            </h3>
            <div className="space-y-1">
              {challenge.attachments.map((a, i) => (
                <div key={i} className="text-sm text-accent hover:underline cursor-pointer">
                  📎 {a.name} ({(a.size / 1024).toFixed(1)}KB)
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="mt-6 flex justify-end">
          <NeonButton variant="solid" onClick={() => setShowModal(true)}>
            Submit Flag
          </NeonButton>
        </div>
      </HudPanel>

      {/* Hints Panel */}
      {hints.length > 0 && (
        <HudPanel>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">💡</span>
            <h3 className="text-sm font-semibold uppercase tracking-widest text-accent/70">
              Hints ({hints.filter((h) => h.unlocked).length}/{hints.length})
            </h3>
          </div>
          {hintMsg && <p className="text-xs text-danger mb-2">{hintMsg}</p>}
          <div className="space-y-2">
            {hints.map((hint) => (
              <div
                key={hint.id}
                className={`p-3 border transition-all ${
                  hint.unlocked
                    ? 'border-success/30 bg-success/5'
                    : 'border-accent/20 bg-panel/50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-hud-text/40 font-mono">#{hint.order}</span>
                    <span className="font-semibold text-sm">
                      {hint.unlocked ? '🔓' : '🔒'} {hint.title || `Hint ${hint.order}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-warning font-semibold">-{hint.cost} pts</span>
                    {!hint.unlocked && (
                      <NeonButton
                        size="sm"
                        variant="solid"
                        onClick={() => handleUnlockHint(hint.id)}
                        disabled={unlocking === hint.id}
                      >
                        {unlocking === hint.id ? '...' : 'Unlock'}
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
      )}

      <TerminalSubmitModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        eventId={eventId}
        challengeId={challengeId}
        challengeTitle={challenge.title}
        onSolve={() => {
          // Could refresh solve status
        }}
      />
    </div>
  );
}
