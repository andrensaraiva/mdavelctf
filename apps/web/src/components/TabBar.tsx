import React, { ReactNode } from 'react';

export interface Tab {
  key: string;
  label: string;
  icon?: string;
  badge?: string | number;
  hidden?: boolean;
}

interface TabBarProps {
  tabs: Tab[];
  active: string;
  onChange: (key: string) => void;
  size?: 'sm' | 'md';
}

export function TabBar({ tabs, active, onChange, size = 'md' }: TabBarProps) {
  const visible = tabs.filter((t) => !t.hidden);
  const pad = size === 'sm' ? 'px-3 py-2' : 'px-4 py-2.5';
  const text = size === 'sm' ? 'text-[11px]' : 'text-xs';

  return (
    <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
      {visible.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`flex items-center gap-1.5 ${pad} ${text} font-semibold uppercase tracking-widest border transition-all whitespace-nowrap flex-shrink-0 ${
            active === tab.key
              ? 'border-accent text-accent bg-accent/10'
              : 'border-accent/15 text-hud-text/40 hover:text-accent hover:border-accent/30'
          }`}
        >
          {tab.icon && <span>{tab.icon}</span>}
          <span>{tab.label}</span>
          {tab.badge !== undefined && (
            <span className={`ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-sm ${
              active === tab.key ? 'bg-accent/20 text-accent' : 'bg-hud-text/10 text-hud-text/40'
            }`}>
              {tab.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

interface TabPanelProps {
  active: string;
  tab: string;
  children: ReactNode;
}

export function TabPanel({ active, tab, children }: TabPanelProps) {
  if (active !== tab) return null;
  return <>{children}</>;
}
