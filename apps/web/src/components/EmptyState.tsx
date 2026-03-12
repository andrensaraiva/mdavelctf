import React, { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="text-center py-12 px-4">
      {icon && <div className="text-4xl mb-3 opacity-40">{icon}</div>}
      <h3 className="text-sm font-semibold text-hud-text/50 mb-1">{title}</h3>
      {description && (
        <p className="text-xs text-hud-text/30 max-w-sm mx-auto mb-4">{description}</p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
}
