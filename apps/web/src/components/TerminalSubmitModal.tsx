import React, { useState, useEffect, useRef } from 'react';
import { NeonButton } from './NeonButton';
import { apiPost } from '../lib/api';
import { SubmitFlagResponse } from '@mdavelctf/shared';

interface TerminalSubmitModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  challengeId: string;
  challengeTitle: string;
  onSolve?: () => void;
}

export function TerminalSubmitModal({
  isOpen,
  onClose,
  eventId,
  challengeId,
  challengeTitle,
  onSolve,
}: TerminalSubmitModalProps) {
  const [flag, setFlag] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SubmitFlagResponse | null>(null);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setFlag('');
      setResult(null);
      setError('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!flag.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await apiPost<SubmitFlagResponse>('/submit-flag', {
        eventId,
        challengeId,
        flagText: flag,
      });
      setResult(res);
      if (res.correct && !res.alreadySolved && onSolve) {
        onSolve();
      }
    } catch (err: any) {
      setError(err.message || 'Submission failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center terminal-modal-overlay"
      onClick={onClose}
    >
      <div
        className="hud-panel p-6 w-full max-w-lg mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-accent font-bold">$</span>
            <span className="text-accent text-sm uppercase tracking-widest glow-text">
              Submit Flag
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-accent/50 hover:text-accent text-lg"
          >
            ✕
          </button>
        </div>

        <div className="text-xs text-accent/60 mb-3 font-mono">
          Target: {challengeTitle}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-accent">{'>'}</span>
            <input
              ref={inputRef}
              type="text"
              value={flag}
              onChange={(e) => setFlag(e.target.value)}
              placeholder="CTF{...}"
              className="terminal-input flex-1 px-3 py-2 text-sm"
              disabled={loading}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="text-xs">
              {result && (
                <span
                  className={
                    result.correct
                      ? 'text-success glow-text'
                      : 'text-danger'
                  }
                >
                  {result.correct
                    ? result.alreadySolved
                      ? '✓ Already solved'
                      : `✓ CORRECT! +${result.scoreAwarded} pts`
                    : `✗ Wrong flag — ${result.attemptsLeft} attempts left`}
                </span>
              )}
              {error && <span className="text-danger">{error}</span>}
            </div>
            <NeonButton type="submit" variant="solid" size="sm" disabled={loading}>
              {loading ? '...' : 'SEND'}
            </NeonButton>
          </div>
        </form>
      </div>
    </div>
  );
}
