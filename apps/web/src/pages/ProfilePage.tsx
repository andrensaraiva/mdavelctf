import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiPost, apiGet } from '../lib/api';
import { HudPanel } from '../components/HudPanel';
import { NeonButton } from '../components/NeonButton';
import { HudTag } from '../components/HudTag';
import { AvatarUploader } from '../components/AvatarUploader';
import { XPProgressBar } from '../components/XPProgressBar';
import { BadgeCard } from '../components/BadgeCard';
import { StatCard } from '../components/StatCard';
import { Link } from 'react-router-dom';
import { BadgeDoc } from '@mdavelctf/shared';
import { useTranslation } from 'react-i18next';

export default function ProfilePage() {
  const { t } = useTranslation();
  const { user, userDoc, refreshUserDoc } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [course, setCourse] = useState('');
  const [classGroup, setClassGroup] = useState('');
  const [unit, setUnit] = useState('');
  const [saving, setSaving] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [teamName, setTeamName] = useState('');
  const [msg, setMsg] = useState('');
  const [badgeCatalog, setBadgeCatalog] = useState<(BadgeDoc & { id: string })[]>([]);

  useEffect(() => {
    if (userDoc) {
      setDisplayName(userDoc.displayName || '');
      setBio(userDoc.bio || '');
      setCourse(userDoc.course || '');
      setClassGroup(userDoc.classGroup || '');
      setUnit(userDoc.unit || '');
    }
  }, [userDoc]);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiGet('/gamification/badges');
        setBadgeCatalog(res.badges || []);
      } catch {}
    })();
  }, []);

  if (!user || !userDoc) return null;

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await apiPost('/profile/update', { displayName, bio, course, classGroup, unit });
      await refreshUserDoc();
      setMsg('Profile updated');
    } catch (e: any) {
      setMsg(e.message);
    }
    setSaving(false);
    setTimeout(() => setMsg(''), 2500);
  };

  const handleAvatarUpload = async (dataUrl: string) => {
    try {
      await apiPost('/profile/avatar', { avatarUrl: dataUrl });
      await refreshUserDoc();
      setMsg('Avatar updated');
      setTimeout(() => setMsg(''), 2000);
    } catch (e: any) {
      setMsg(e.message);
    }
  };

  const handleCreateTeam = async () => {
    try {
      const res = await apiPost('/team/create', { name: teamName });
      setMsg(`Team created! Code: ${res.joinCode}`);
      setTeamName('');
      await refreshUserDoc();
    } catch (e: any) { setMsg(e.message); }
  };

  const handleJoinTeam = async () => {
    try {
      const res = await apiPost('/team/join', { joinCode });
      setMsg(`Joined team: ${res.teamName}`);
      setJoinCode('');
      await refreshUserDoc();
    } catch (e: any) { setMsg(e.message); }
  };

  const handleLeaveTeam = async () => {
    try {
      await apiPost('/team/leave', {});
      setMsg('Left team');
      await refreshUserDoc();
    } catch (e: any) { setMsg(e.message); }
  };

  const xp = userDoc.xp || 0;
  const level = userDoc.level || 1;
  const stats = userDoc.stats || {};
  const userBadges = userDoc.badges || [];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Profile Header */}
      <HudPanel>
        <div className="flex flex-col sm:flex-row items-start gap-6">
          <AvatarUploader
            currentUrl={userDoc.avatarUrl}
            onUpload={handleAvatarUpload}
            size={96}
          />
          <div className="flex-1 space-y-3 w-full">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-extrabold text-accent glow-text">
                {userDoc.displayName}
              </h1>
              <HudTag color={userDoc.role === 'admin' ? 'var(--warning)' : 'var(--accent)'}>
                {userDoc.role}
              </HudTag>
            </div>
            {userDoc.bio && (
              <p className="text-sm text-hud-text/60">{userDoc.bio}</p>
            )}
            <div className="flex gap-4 text-xs text-hud-text/40 flex-wrap">
              {userDoc.course && <span>📚 {userDoc.course}</span>}
              {userDoc.classGroup && <span>🏷️ {userDoc.classGroup}</span>}
              {userDoc.unit && <span>🏛️ {userDoc.unit}</span>}
              <span>📅 {t('profile.joined')} {new Date(userDoc.createdAt).toLocaleDateString()}</span>
            </div>
            <XPProgressBar xp={xp} level={level} />
          </div>
        </div>
      </HudPanel>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label={t('profile.totalSolves')} value={stats.solvesTotal || 0} color="var(--success)" />
        <StatCard label={t('profile.correctSubs')} value={stats.correctSubmissions || 0} color="var(--accent)" />
        <StatCard label={t('profile.wrongSubs')} value={stats.wrongSubmissions || 0} color="var(--danger)" />
        <StatCard label={t('profile.badgesEarned')} value={userBadges.length} color="var(--warning)" />
      </div>

      {/* Category Breakdown */}
      {stats.solvesByCategory && Object.keys(stats.solvesByCategory).length > 0 && (
        <HudPanel title={t('profile.solvesByCategory')}>
          <div className="space-y-2">
            {Object.entries(stats.solvesByCategory as Record<string, number>)
              .sort(([, a], [, b]) => b - a)
              .map(([cat, count]) => {
                const max = Math.max(...Object.values(stats.solvesByCategory as Record<string, number>), 1);
                const pct = (count / max) * 100;
                return (
                  <div key={cat} className="flex items-center gap-3">
                    <span className="text-xs font-mono w-24 text-hud-text/60 uppercase">{cat}</span>
                    <div className="flex-1 bg-accent/10 h-4 rounded-sm overflow-hidden">
                      <div
                        className="h-full rounded-sm"
                        style={{
                          width: `${pct}%`,
                          background: 'linear-gradient(90deg, var(--accent2), var(--accent))',
                        }}
                      />
                    </div>
                    <span className="text-xs font-bold w-8 text-right">{count}</span>
                  </div>
                );
              })}
          </div>
        </HudPanel>
      )}

      {/* Badges */}
      <HudPanel title={`${t('profile.badges')} (${userBadges.length}/${badgeCatalog.length})`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {badgeCatalog.map((badge) => (
            <BadgeCard
              key={badge.id}
              icon={badge.icon}
              name={badge.name}
              description={badge.description}
              rarity={badge.rarity}
              earned={userBadges.includes(badge.id)}
              xpReward={badge.xpReward}
            />
          ))}
        </div>
        {badgeCatalog.length === 0 && (
          <p className="text-center text-hud-text/30 text-sm py-4">
            {t('profile.noBadges')}
          </p>
        )}
      </HudPanel>

      {/* Edit Profile */}
      <HudPanel title={t('profile.editProfile')}>
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs uppercase tracking-widest mb-1 text-accent/70">{t('profile.displayName')}</label>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="terminal-input w-full px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest mb-1 text-accent/70">{t('profile.courseProgram')}</label>
              <input value={course} onChange={(e) => setCourse(e.target.value)} placeholder={t('profile.courseProgram')} className="terminal-input w-full px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest mb-1 text-accent/70">{t('profile.classGroup')}</label>
              <input value={classGroup} onChange={(e) => setClassGroup(e.target.value)} placeholder={t('profile.classGroup')} className="terminal-input w-full px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest mb-1 text-accent/70">{t('profile.unitDepartment')}</label>
              <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder={t('profile.unitDepartment')} className="terminal-input w-full px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest mb-1 text-accent/70">{t('profile.bio')}</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder={t('profile.bioPlaceholder')} className="terminal-input w-full px-3 py-2 text-sm h-20" maxLength={300} />
            <span className="text-[10px] text-hud-text/30">{bio.length}/300</span>
          </div>
          <NeonButton size="sm" onClick={handleSaveProfile} disabled={saving}>
            {saving ? t('profile.saving') : t('profile.saveProfile')}
          </NeonButton>
        </div>
      </HudPanel>

      {/* Team Management */}
      <HudPanel title={t('profile.team')}>
        {userDoc.teamId ? (
          <div className="space-y-3">
            <Link to={`/team/${userDoc.teamId}`} className="flex items-center gap-3 p-3 border border-accent/20 hover:border-accent/40 transition-all group">
              <span className="text-2xl">🛡️</span>
              <div className="flex-1">
                <span className="font-bold text-accent group-hover:underline">{t('profile.goToTeamHub')}</span>
                <p className="text-xs text-hud-text/50 mt-0.5">{t('profile.teamHubSub')}</p>
              </div>
            </Link>
            <NeonButton variant="danger" size="sm" onClick={handleLeaveTeam}>
              {t('profile.leaveTeam')}
            </NeonButton>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-widest mb-1 text-accent/70">{t('profile.createNewTeam')}</label>
              <div className="flex gap-2">
                <input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder={t('profile.teamNamePlaceholder')} className="terminal-input flex-1 px-3 py-2 text-sm" />
                <NeonButton size="sm" onClick={handleCreateTeam}>{t('profile.create')}</NeonButton>
              </div>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest mb-1 text-accent/70">{t('profile.joinExistingTeam')}</label>
              <div className="flex gap-2">
                <input value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder={t('profile.joinCodePlaceholder')} className="terminal-input flex-1 px-3 py-2 text-sm" />
                <NeonButton size="sm" onClick={handleJoinTeam}>{t('profile.join')}</NeonButton>
              </div>
            </div>
          </div>
        )}
      </HudPanel>

      {msg && <div className="text-center text-sm text-accent">{msg}</div>}

      <div className="text-center">
        <Link to="/settings/theme">
          <NeonButton variant="outline" size="sm">🎨 {t('profile.customizeTheme')}</NeonButton>
        </Link>
      </div>
    </div>
  );
}
