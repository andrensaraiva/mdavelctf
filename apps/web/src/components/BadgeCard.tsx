import React from 'react';
import { BadgeRarity, rarityColor } from '@mdavelctf/shared';

interface BadgeCardProps {
  icon: string;
  name: string;
  description: string;
  rarity: BadgeRarity;
  earned?: boolean;
  xpReward?: number;
}

export function BadgeCard({ icon, name, description, rarity, earned = false, xpReward }: BadgeCardProps) {
  const color = rarityColor(rarity);

  return (
    <div
      className={`relative p-3 border transition-all ${
        earned
          ? 'border-accent/40 bg-accent/5'
          : 'border-hud-text/10 opacity-40 grayscale'
      }`}
      style={earned ? { borderColor: `${color}66` } : {}}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm truncate" style={earned ? { color } : {}}>
              {name}
            </span>
            <span
              className="text-[10px] uppercase tracking-widest px-1.5 py-0.5 font-bold"
              style={{ color, borderColor: `${color}44`, border: '1px solid' }}
            >
              {rarity}
            </span>
          </div>
          <p className="text-xs text-hud-text/50 mt-0.5 truncate">{description}</p>
          {xpReward && (
            <span className="text-[10px] text-warning font-semibold">+{xpReward} XP</span>
          )}
        </div>
      </div>
      {earned && (
        <div className="absolute top-1 right-2 text-success text-xs font-bold">✓</div>
      )}
    </div>
  );
}
