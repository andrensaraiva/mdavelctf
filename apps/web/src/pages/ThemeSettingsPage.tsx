import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserTheme, DEFAULT_THEME, isThemeReadable } from '@mdavelctf/shared';
import { HudPanel } from '../components/HudPanel';
import { NeonButton } from '../components/NeonButton';
import { HudTag } from '../components/HudTag';
import { StatCard } from '../components/StatCard';

export default function ThemeSettingsPage() {
  const { user, refreshUserDoc } = useAuth();
  const { theme, setTheme, presets } = useTheme();
  const [accent, setAccent] = useState(theme.accent);
  const [accent2, setAccent2] = useState(theme.accent2);
  const [panelBg, setPanelBg] = useState(theme.panelBg || '#111827');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const currentTheme: UserTheme = { accent, accent2, panelBg };
  const readable = isThemeReadable(currentTheme);

  const handlePreset = (name: string) => {
    const p = presets[name];
    setAccent(p.accent);
    setAccent2(p.accent2);
    setPanelBg('#111827');
    setTheme({ accent: p.accent, accent2: p.accent2 });
  };

  const handleReset = () => {
    setAccent(DEFAULT_THEME.accent);
    setAccent2(DEFAULT_THEME.accent2);
    setPanelBg('#111827');
    setTheme(DEFAULT_THEME);
    setMsg('Reset to default Cyan theme');
    setTimeout(() => setMsg(''), 2000);
  };

  const handleApply = () => {
    if (!readable) {
      setMsg('⚠ Colors too dark — may be hard to read. Consider using a preset.');
      setTimeout(() => setMsg(''), 4000);
    }
    setTheme(currentTheme);
  };

  const handleSave = async () => {
    if (!user) return;
    const themeToSave = readable ? currentTheme : DEFAULT_THEME;
    if (!readable) {
      setAccent(DEFAULT_THEME.accent);
      setAccent2(DEFAULT_THEME.accent2);
      setPanelBg('#111827');
      setTheme(DEFAULT_THEME);
      setMsg('Colors were too dark — saved default theme instead.');
      setTimeout(() => setMsg(''), 3000);
    }
    setSaving(true);
    await updateDoc(doc(db, 'users', user.uid), { theme: themeToSave });
    setTheme(themeToSave);
    await refreshUserDoc();
    setSaving(false);
    if (readable) {
      setMsg('Theme saved!');
      setTimeout(() => setMsg(''), 2000);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <HudPanel title="Theme Settings">
        {/* Presets */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-accent/70 mb-3">
            Quick Presets
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {Object.entries(presets).map(([name, p]) => (
              <button
                key={name}
                onClick={() => handlePreset(name)}
                className="group flex flex-col items-center gap-2 p-4 border border-accent/20 hover:border-accent/60 transition-all rounded-sm"
                style={{ borderColor: `${p.accent}33` }}
              >
                <div className="flex gap-1">
                  <div
                    className="w-6 h-6 rounded-full ring-2 ring-transparent group-hover:ring-white/20 transition-all"
                    style={{ backgroundColor: p.accent }}
                  />
                  <div
                    className="w-6 h-6 rounded-full"
                    style={{ backgroundColor: p.accent2 }}
                  />
                </div>
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: p.accent }}>
                  {p.label || name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Custom Colors */}
        <h3 className="text-sm font-semibold uppercase tracking-widest text-accent/70 mb-3">
          Custom Colors
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium uppercase tracking-widest mb-2 text-hud-text/70">
              Primary Accent
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={accent}
                onChange={(e) => setAccent(e.target.value)}
                className="w-10 h-10 bg-transparent cursor-pointer border-0"
              />
              <input
                type="text"
                value={accent}
                onChange={(e) => setAccent(e.target.value)}
                className="terminal-input px-3 py-2 text-sm flex-1"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-widest mb-2 text-hud-text/70">
              Secondary Accent
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={accent2}
                onChange={(e) => setAccent2(e.target.value)}
                className="w-10 h-10 bg-transparent cursor-pointer border-0"
              />
              <input
                type="text"
                value={accent2}
                onChange={(e) => setAccent2(e.target.value)}
                className="terminal-input px-3 py-2 text-sm flex-1"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-widest mb-2 text-hud-text/70">
              Panel Background
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={panelBg}
                onChange={(e) => setPanelBg(e.target.value)}
                className="w-10 h-10 bg-transparent cursor-pointer border-0"
              />
              <input
                type="text"
                value={panelBg}
                onChange={(e) => setPanelBg(e.target.value)}
                className="terminal-input px-3 py-2 text-sm flex-1"
              />
            </div>
          </div>
        </div>

        {/* Readability warning */}
        {!readable && (
          <div className="flex items-center gap-2 p-3 border border-danger/40 bg-danger/10 mb-4 text-sm text-danger">
            <span className="text-lg">⚠</span>
            <span>Colors may be too dark against the background. If saved, defaults will be applied.</span>
          </div>
        )}

        <div className="flex gap-3 flex-wrap">
          <NeonButton onClick={handleApply}>Preview</NeonButton>
          <NeonButton variant="solid" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Theme'}
          </NeonButton>
          <NeonButton variant="danger" onClick={handleReset}>
            Reset to Default
          </NeonButton>
        </div>
        {msg && <p className={`text-sm mt-3 ${msg.includes('⚠') || msg.includes('dark') ? 'text-warning' : 'text-success'}`}>{msg}</p>}
      </HudPanel>

      {/* Live Preview */}
      <HudPanel title="Live Preview">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <StatCard label="Score" value="1337" />
          <StatCard label="Solves" value="42" color="var(--accent2)" />
          <StatCard label="Rank" value="#1" color="var(--success)" />
          <StatCard label="Fails" value="7" color="var(--danger)" />
        </div>
        <div className="flex gap-3 mb-4">
          <NeonButton size="sm">Outline</NeonButton>
          <NeonButton size="sm" variant="solid">Solid</NeonButton>
          <NeonButton size="sm" variant="danger">Danger</NeonButton>
        </div>
        <div className="flex gap-2 flex-wrap">
          <HudTag>WEB</HudTag>
          <HudTag color="var(--accent2)">CRYPTO</HudTag>
          <HudTag color="var(--success)">SOLVED</HudTag>
          <HudTag color="var(--warning)">MEDIUM</HudTag>
        </div>
        <p className="mt-4 text-sm opacity-80">
          This is a preview of how text looks with your current theme. The quick brown fox jumps over the lazy dog.
        </p>
      </HudPanel>
    </div>
  );
}
