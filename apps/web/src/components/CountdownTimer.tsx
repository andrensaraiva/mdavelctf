import React, { useEffect, useState } from 'react';

interface CountdownTimerProps {
  targetDate: string;
  label?: string;
}

export function CountdownTimer({ targetDate, label }: CountdownTimerProps) {
  const [diff, setDiff] = useState(0);

  useEffect(() => {
    const update = () => {
      const d = new Date(targetDate).getTime() - Date.now();
      setDiff(Math.max(0, d));
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [targetDate]);

  if (diff <= 0) return null;

  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);

  return (
    <div className="flex items-center gap-2 text-accent font-mono">
      {label && <span className="text-xs uppercase tracking-widest opacity-60">{label}</span>}
      <div className="flex gap-1">
        <span className="bg-accent/10 border border-accent/30 px-2 py-1 text-sm">
          {String(hours).padStart(2, '0')}
        </span>
        <span className="text-accent/50">:</span>
        <span className="bg-accent/10 border border-accent/30 px-2 py-1 text-sm">
          {String(mins).padStart(2, '0')}
        </span>
        <span className="text-accent/50">:</span>
        <span className="bg-accent/10 border border-accent/30 px-2 py-1 text-sm">
          {String(secs).padStart(2, '0')}
        </span>
      </div>
    </div>
  );
}
