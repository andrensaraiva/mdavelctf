import React, { ReactNode } from 'react';

interface HudPanelProps {
  children: ReactNode;
  title?: string;
  className?: string;
  noPad?: boolean;
}

export function HudPanel({ children, title, className = '', noPad }: HudPanelProps) {
  return (
    <div className={`hud-panel ${noPad ? 'p-0' : 'p-5 md:p-6'} ${className}`}>
      {title && (
        <div className={`flex items-center gap-2 mb-4 pb-2.5 border-b border-accent/15 ${noPad ? 'px-5 pt-5 md:px-6 md:pt-6' : ''}`}>
          <div className="w-2 h-2 bg-accent rotate-45 flex-shrink-0" />
          <h2 className="text-accent font-semibold uppercase tracking-widest text-sm glow-text">
            {title}
          </h2>
        </div>
      )}
      {children}
    </div>
  );
}
