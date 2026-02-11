import React, { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  color?: string;
}

export function StatCard({ label, value, icon, color }: StatCardProps) {
  return (
    <div
      className="hud-panel p-4 flex flex-col items-center justify-center min-w-[120px]"
      style={color ? { borderColor: `${color}66` } : {}}
    >
      {icon && <div className="text-2xl mb-1">{icon}</div>}
      <div
        className="text-2xl font-bold glow-text"
        style={color ? { color } : {}}
      >
        {value}
      </div>
      <div className="text-xs uppercase tracking-widest opacity-60 mt-1">{label}</div>
    </div>
  );
}
