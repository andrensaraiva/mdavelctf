import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { ChallengeDoc, EventDoc } from '@mdavelctf/shared';
import { HudPanel } from '../components/HudPanel';
import { HudTag } from '../components/HudTag';
import { NeonButton } from '../components/NeonButton';
import { TerminalSubmitModal } from '../components/TerminalSubmitModal';
import ReactMarkdown from 'react-markdown';

export default function ChallengePage() {
  const { eventId, challengeId } = useParams<{
    eventId: string;
    challengeId: string;
  }>();
  const [challenge, setChallenge] = useState<ChallengeDoc | null>(null);
  const [event, setEvent] = useState<EventDoc | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!eventId || !challengeId) return;
    (async () => {
      const eSnap = await getDoc(doc(db, 'events', eventId));
      if (eSnap.exists()) setEvent(eSnap.data() as EventDoc);

      const cSnap = await getDoc(
        doc(db, 'events', eventId, 'challenges', challengeId),
      );
      if (cSnap.exists()) setChallenge(cSnap.data() as ChallengeDoc);
    })();
  }, [eventId, challengeId]);

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
