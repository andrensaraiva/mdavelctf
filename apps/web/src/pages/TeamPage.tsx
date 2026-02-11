import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { TeamDoc, TeamActivityEntry } from '@mdavelctf/shared';
import { HudPanel } from '../components/HudPanel';
import { HudTag } from '../components/HudTag';
import { NeonButton } from '../components/NeonButton';
import { StatCard } from '../components/StatCard';
import { AvatarUploader } from '../components/AvatarUploader';
import { ChatPanel } from '../components/ChatPanel';
import { useAuth } from '../context/AuthContext';
import { apiPost, apiGet } from '../lib/api';
import { useTranslation } from 'react-i18next';

interface Member {
  uid: string;
  displayName: string;
  avatarUrl?: string;
  role: string;
  joinedAt: string;
  xp?: number;
  level?: number;
}

export default function TeamPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const { t } = useTranslation();
  const { user, userDoc } = useAuth();
  const [team, setTeam] = useState<TeamDoc | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [activity, setActivity] = useState<TeamActivityEntry[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [description, setDescription] = useState('');
  const [tagline, setTagline] = useState('');
  const [msg, setMsg] = useState('');

  const load = async () => {
    if (!teamId) return;
    const snap = await getDoc(doc(db, 'teams', teamId));
    if (snap.exists()) {
      const data = snap.data() as TeamDoc;
      setTeam(data);
      setTeamName(data.name || '');
      setDescription(data.description || '');
      setTagline(data.tagline || '');
    }

    const mSnap = await getDocs(collection(db, 'teams', teamId, 'members'));
    const mems = await Promise.all(
      mSnap.docs.map(async (m) => {
        const uSnap = await getDoc(doc(db, 'users', m.id));
        const uData = uSnap.data();
        return {
          uid: m.id,
          displayName: uData?.displayName || 'Unknown',
          avatarUrl: uData?.avatarUrl || undefined,
          xp: uData?.xp || 0,
          level: uData?.level || 1,
          ...m.data(),
        } as Member;
      }),
    );
    // Captain first
    mems.sort((a, b) => (a.role === 'captain' ? -1 : b.role === 'captain' ? 1 : 0));
    setMembers(mems);

    // Load activity
    try {
      const res = await apiGet('/team/activity?limit=10');
      setActivity(res.activity || []);
    } catch {}
  };

  useEffect(() => { load(); }, [teamId]);

  if (!team || !teamId) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="text-accent/40 text-lg animate-pulse">{t('team.loading')}</div>
      </div>
    );
  }

  const isCaptain = user?.uid === team.captainUid;
  const isMyTeam = userDoc?.teamId === teamId;

  const handleSaveTeam = async () => {
    try {
      await apiPost('/team/update', {
        ...(teamName !== team.name && { name: teamName }),
        description,
        tagline,
      });
      setMsg('Team updated!');
      setEditMode(false);
      await load();
      setTimeout(() => setMsg(''), 3000);
    } catch (e: any) { setMsg(e.message); }
  };

  const handleRotateCode = async () => {
    try {
      const res = await apiPost('/team/rotate-code', {});
      setMsg(`New join code: ${res.joinCode}`);
      await load();
      setTimeout(() => setMsg(''), 4000);
    } catch (e: any) { setMsg(e.message); }
  };

  const handleAvatarUpload = async (dataUrl: string) => {
    try {
      await apiPost('/team/update', { avatarUrl: dataUrl });
      setMsg('Avatar updated');
      await load();
      setTimeout(() => setMsg(''), 2000);
    } catch (e: any) { setMsg(e.message); }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* ═══ Team Header ═══ */}
      <HudPanel>
        <div className="flex flex-col sm:flex-row items-start gap-5">
          {/* Team avatar */}
          <div className="flex-shrink-0">
            {isCaptain && editMode ? (
              <AvatarUploader currentUrl={team.avatarUrl} onUpload={handleAvatarUpload} size={80} />
            ) : (
              <div className="w-20 h-20 rounded-full border-2 border-accent/30 bg-accent/10 flex items-center justify-center overflow-hidden">
                {team.avatarUrl ? (
                  <img src={team.avatarUrl} alt={team.name} className="w-full h-full object-cover rounded-full" />
                ) : (
                  <span className="text-accent text-3xl font-extrabold">{team.name[0].toUpperCase()}</span>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 space-y-2 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-extrabold text-accent glow-text truncate">{team.name}</h1>
              <HudTag>{team.memberCount} {team.memberCount !== 1 ? t('team.membersPlural') : t('team.members')}</HudTag>
            </div>
            {team.tagline && (
              <p className="text-sm text-accent2 italic font-medium">"{team.tagline}"</p>
            )}
            {team.description && (
              <p className="text-sm text-hud-text/60 leading-relaxed">{team.description}</p>
            )}
            <div className="text-xs text-hud-text/40">
              {t('team.created')} {new Date(team.createdAt).toLocaleDateString()}
            </div>
          </div>
        </div>
      </HudPanel>

      {/* ═══ Team Stats ═══ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label={t('team.eventScore')} value={team.stats?.scoreEvent ?? 0} color="var(--accent)" />
        <StatCard label={t('team.leagueScore')} value={team.stats?.scoreLeague ?? 0} color="var(--accent2)" />
        <StatCard label={t('team.totalSolves')} value={team.stats?.solvesTotal ?? 0} color="var(--success)" />
        <StatCard label={t('team.membersLabel')} value={team.memberCount} color="var(--warning)" />
      </div>

      {/* ═══ Captain Controls ═══ */}
      {isCaptain && (
        <HudPanel title={t('team.captainControls')}>
          {!editMode ? (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-hud-text/50 uppercase tracking-wider font-medium">{t('team.joinCode')}</span>
                  <span className="font-mono text-accent font-bold text-lg tracking-widest">{team.joinCode}</span>
                </div>
                <div className="flex gap-2">
                  <NeonButton size="sm" variant="outline" onClick={handleRotateCode}>
                    {t('team.rotateCode')}
                  </NeonButton>
                  <NeonButton size="sm" variant="solid" onClick={() => setEditMode(true)}>
                    {t('team.editTeam')}
                  </NeonButton>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs uppercase tracking-widest mb-1.5 text-accent/70 font-medium">{t('team.teamName')}</label>
                  <input
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="Team name (2-30 chars)"
                    className="terminal-input w-full px-3 py-2.5 text-sm"
                    maxLength={30}
                    minLength={2}
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-widest mb-1.5 text-accent/70 font-medium">{t('team.tagline')}</label>
                  <input
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    placeholder="Short team motto..."
                    className="terminal-input w-full px-3 py-2.5 text-sm"
                    maxLength={100}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest mb-1.5 text-accent/70 font-medium">{t('team.description')}</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tell the world about your team..."
                  className="terminal-input w-full px-3 py-2.5 text-sm h-24"
                  maxLength={500}
                />
                <span className="text-[10px] text-hud-text/30">{description.length}/500</span>
              </div>
              <div className="flex gap-2">
                <NeonButton size="sm" variant="solid" onClick={handleSaveTeam}>{t('team.saveChanges')}</NeonButton>
                <NeonButton size="sm" variant="outline" onClick={() => setEditMode(false)}>{t('team.cancel')}</NeonButton>
              </div>
            </div>
          )}
        </HudPanel>
      )}

      {/* ═══ Members ═══ */}
      <HudPanel title={`${t('team.membersLabel')} (${members.length})`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {members.map((m) => (
            <div
              key={m.uid}
              className="flex items-center gap-3 p-3 border border-accent/10 hover:border-accent/25 transition-colors rounded-sm"
            >
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-accent/15 flex items-center justify-center text-sm font-bold text-accent overflow-hidden flex-shrink-0">
                {m.avatarUrl ? (
                  <img src={m.avatarUrl} className="w-full h-full object-cover rounded-full" alt="" />
                ) : (
                  (m.displayName || '?')[0].toUpperCase()
                )}
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm truncate">{m.displayName}</span>
                  <HudTag
                    color={m.role === 'captain' ? 'var(--warning)' : 'var(--accent)'}
                  >
                    {m.role === 'captain' ? `👑 ${t('team.captain')}` : t('team.member')}
                  </HudTag>
                </div>
                <div className="text-xs text-hud-text/40 mt-0.5">
                  Lv.{m.level || 1} • {(m.xp || 0).toLocaleString()} XP
                </div>
              </div>
            </div>
          ))}
        </div>
      </HudPanel>

      {/* ═══ Recent Activity ═══ */}
      {activity.length > 0 && (
        <HudPanel title={t('team.recentActivity')}>
          <div className="space-y-2">
            {activity.map((a, i) => (
              <div key={i} className="flex items-center justify-between p-3 border border-accent/8 hover:border-accent/20 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-success text-sm">✓</span>
                  <div className="min-w-0">
                    <div className="text-sm">
                      <span className="font-semibold text-accent">{a.displayName}</span>
                      <span className="text-hud-text/50"> {t('team.solved')} </span>
                      <span className="font-semibold">{a.challengeTitle || a.challengeId.slice(0, 8)}</span>
                    </div>
                    <div className="text-xs text-hud-text/35 flex items-center gap-2 mt-0.5">
                      {a.category && <HudTag>{a.category}</HudTag>}
                      <span className="font-mono">{new Date(a.solvedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                </div>
                <span className="text-accent font-bold text-sm flex-shrink-0">+{a.pointsAwarded} pts</span>
              </div>
            ))}
          </div>
        </HudPanel>
      )}

      {/* ═══ Team Chat ═══ */}
      {isMyTeam && (
        <HudPanel title={t('team.teamChat')}>
          <ChatPanel teamId={teamId} />
        </HudPanel>
      )}

      {/* Status message */}
      {msg && (
        <div className="text-center text-sm text-accent font-medium py-2">{msg}</div>
      )}
    </div>
  );
}
