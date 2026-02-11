import React, { ReactNode } from 'react';

interface HudTagProps {
  children: ReactNode;
  color?: string;
  className?: string;
}

export function HudTag({ children, color, className = '' }: HudTagProps) {
  return (
    <span
      className={`hud-tag ${className}`}
      style={color ? { borderColor: color, color } : {}}
    >
      {children}
    </span>
  );
}
