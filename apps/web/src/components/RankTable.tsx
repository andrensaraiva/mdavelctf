import React from 'react';
import { LeaderboardRow } from '@mdavelctf/shared';

interface RankTableProps {
  rows: LeaderboardRow[];
  mode: 'individual' | 'teams';
}

const MEDAL = ['🥇', '🥈', '🥉'];

export function RankTable({ rows, mode }: RankTableProps) {
  const maxScore = rows.length > 0 ? Math.max(...rows.map((r) => r.score), 1) : 1;

  return (
    <div className="space-y-6">
      {/* Podium – top 3 */}
      {rows.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-2">
          {rows.slice(0, 3).map((row, idx) => {
            const pct = (row.score / maxScore) * 100;
            const sizes = ['text-3xl', 'text-2xl', 'text-xl'];
            const glows = [
              '0 0 20px rgba(255,215,0,0.4)',
              '0 0 14px rgba(192,192,192,0.3)',
              '0 0 10px rgba(205,127,50,0.25)',
            ];
            return (
              <div
                key={row.uid || row.teamId || idx}
                className="hud-panel p-4 flex flex-col items-center text-center relative overflow-hidden"
                style={{ boxShadow: glows[idx] }}
              >
                <span className="text-2xl mb-1">{MEDAL[idx]}</span>
                <span className="font-bold text-sm mb-1 truncate max-w-full">
                  {mode === 'individual' ? row.displayName : row.teamName}
                </span>
                <span
                  className={`font-extrabold font-mono glow-text ${sizes[idx]}`}
                  style={{ color: 'var(--accent)' }}
                >
                  {row.score.toLocaleString()}
                </span>
                <span className="text-xs text-hud-text/40 mt-1">pts</span>
                {/* Background fill bar */}
                <div
                  className="absolute bottom-0 left-0 h-1 bg-accent/30"
                  style={{ width: `${pct}%` }}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Full table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-accent/30 text-accent uppercase text-xs tracking-widest font-semibold">
              <th className="py-3 px-3 text-left w-14">#</th>
              <th className="py-3 px-3 text-left">
                {mode === 'individual' ? 'Player' : 'Team'}
              </th>
              <th className="py-3 px-3 text-left" style={{ width: '40%' }}>Progress</th>
              <th className="py-3 px-3 text-right">Score</th>
              <th className="py-3 px-3 text-right">Last Solve</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const pct = (row.score / maxScore) * 100;
              // Dynamic font size: top ranks get bigger text
              const scoreFontSize =
                idx === 0 ? '1.4rem' :
                idx === 1 ? '1.2rem' :
                idx === 2 ? '1.1rem' :
                idx < 5 ? '1rem' : '0.875rem';
              const rankColor =
                idx === 0 ? '#FFD700' :
                idx === 1 ? '#C0C0C0' :
                idx === 2 ? '#CD7F32' : 'var(--accent)';

              return (
                <tr key={row.uid || row.teamId || idx} className="rank-row group">
                  <td className="py-3 px-3 font-bold font-mono" style={{ color: rankColor, fontSize: scoreFontSize }}>
                    {idx < 3 ? MEDAL[idx] : idx + 1}
                  </td>
                  <td className="py-3 px-3 font-medium">
                    {mode === 'individual' ? row.displayName : row.teamName}
                  </td>
                  <td className="py-3 px-3">
                    <div className="w-full bg-accent/10 h-3 rounded-sm overflow-hidden">
                      <div
                        className="h-full bar-chart-bar rounded-sm"
                        style={{
                          width: `${pct}%`,
                          background: `linear-gradient(90deg, var(--accent2), var(--accent))`,
                        }}
                      />
                    </div>
                  </td>
                  <td
                    className="py-3 px-3 text-right font-extrabold font-mono glow-text"
                    style={{ fontSize: scoreFontSize, color: 'var(--accent)' }}
                  >
                    {row.score.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right text-xs opacity-50 font-mono">
                    {row.lastSolveAt
                      ? new Date(row.lastSolveAt).toLocaleTimeString()
                      : '—'}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-12 text-center opacity-40 text-base">
                  No rankings yet — be the first to solve!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
