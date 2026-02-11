import React from 'react';

interface QuestCardProps {
  title: string;
  description: string;
  xpReward: number;
  badgeReward?: string;
  progress: number;
  target: number;
  completed: boolean;
}

export function QuestCard({
  title,
  description,
  xpReward,
  badgeReward,
  progress,
  target,
  completed,
}: QuestCardProps) {
  const pct = Math.min(100, (progress / target) * 100);

  return (
    <div
      className={`p-4 border transition-all ${
        completed
          ? 'border-success/40 bg-success/5'
          : 'border-accent/20 hover:border-accent/40'
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <h4 className={`font-bold text-sm ${completed ? 'text-success' : 'text-accent'}`}>
            {completed && '✓ '}{title}
          </h4>
          <p className="text-xs text-hud-text/50 mt-0.5">{description}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <span className="text-warning font-bold text-xs">+{xpReward} XP</span>
          {badgeReward && (
            <div className="text-[10px] text-accent2 mt-0.5">+ Badge reward</div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="h-2 bg-accent/10 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              background: completed
                ? 'var(--success)'
                : 'linear-gradient(90deg, var(--accent2), var(--accent))',
            }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-hud-text/40">
          <span>{progress}/{target}</span>
          <span>{Math.round(pct)}%</span>
        </div>
      </div>
    </div>
  );
}
