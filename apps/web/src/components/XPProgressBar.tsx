import React from 'react';
import { xpToLevel, levelToXp } from '@mdavelctf/shared';

interface XPProgressBarProps {
  xp: number;
  level: number;
}

export function XPProgressBar({ xp, level }: XPProgressBarProps) {
  const currentLevelXp = levelToXp(level);
  const nextLevelXp = levelToXp(level + 1);
  const progress = nextLevelXp > currentLevelXp
    ? ((xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100
    : 100;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="text-accent font-extrabold text-lg">Lv.{level}</span>
          <span className="text-hud-text/50">{xp.toLocaleString()} XP</span>
        </div>
        <span className="text-hud-text/40">
          {(nextLevelXp - xp).toLocaleString()} XP to Lv.{level + 1}
        </span>
      </div>
      <div className="h-3 bg-accent/10 rounded-full overflow-hidden border border-accent/20">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${Math.min(100, Math.max(2, progress))}%`,
            background: 'linear-gradient(90deg, var(--accent2), var(--accent))',
          }}
        />
      </div>
    </div>
  );
}
