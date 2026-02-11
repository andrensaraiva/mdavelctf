import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiGet, apiPost } from '../lib/api';
import { HudPanel } from '../components/HudPanel';
import { NeonButton } from '../components/NeonButton';
import { HudTag } from '../components/HudTag';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface ClassSummary {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  isOwner: boolean;
  ownerInstructorId: string;
}

export default function ClassesPage() {
  const { t } = useTranslation();
  const { userDoc } = useAuth();
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [joinCode, setJoinCode] = useState('');
  const [className, setClassName] = useState('');
  const [classDesc, setClassDesc] = useState('');
  const [msg, setMsg] = useState('');

  const load = async () => {
    try {
      const res = await apiGet('/classes/my');
      setClasses(res.classes || []);
    } catch {}
  };

  useEffect(() => { load(); }, []);

  const handleJoin = async () => {
    try {
      const res = await apiPost('/classes/join', { inviteCode: joinCode });
      setMsg(`Joined: ${res.className}`);
      setJoinCode('');
      await load();
    } catch (e: any) { setMsg(e.message); }
    setTimeout(() => setMsg(''), 3000);
  };

  const handleCreate = async () => {
    try {
      await apiPost('/classes/create', { name: className, description: classDesc });
      setMsg('Class created!');
      setClassName('');
      setClassDesc('');
      await load();
    } catch (e: any) { setMsg(e.message); }
    setTimeout(() => setMsg(''), 3000);
  };

  const isInstructor = userDoc?.role === 'instructor' || userDoc?.role === 'admin';

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-extrabold text-accent glow-text tracking-wider">
        {t('classes.title')}
      </h1>

      {/* Join a Class */}
      <HudPanel title={t('classes.joinClass')}>
        <div className="flex gap-2">
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder={t('classes.inviteCodePlaceholder')}
            className="terminal-input flex-1 px-3 py-2 text-sm"
          />
          <NeonButton size="sm" onClick={handleJoin}>{t('classes.join')}</NeonButton>
        </div>
      </HudPanel>

      {/* Create a Class (instructors only) */}
      {isInstructor && (
        <HudPanel title={t('classes.createClass')}>
          <div className="space-y-3">
            <input
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              placeholder={t('classes.className')}
              className="terminal-input w-full px-3 py-2 text-sm"
            />
            <input
              value={classDesc}
              onChange={(e) => setClassDesc(e.target.value)}
              placeholder={t('classes.classDescription')}
              className="terminal-input w-full px-3 py-2 text-sm"
            />
            <NeonButton size="sm" variant="solid" onClick={handleCreate}>{t('classes.create')}</NeonButton>
          </div>
        </HudPanel>
      )}

      {msg && <div className="text-center text-sm text-accent">{msg}</div>}

      {/* My Classes List */}
      <div className="space-y-3">
        {classes.map((c) => (
          <Link key={c.id} to={`/classes/${c.id}`} className="block">
            <div className="hud-panel p-4 hover:border-accent/40 transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 border border-accent/30 bg-accent/10 flex items-center justify-center text-accent font-bold text-lg">
                    {c.name[0].toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-accent text-base">{c.name}</h3>
                    {c.description && (
                      <p className="text-xs text-hud-text/50 mt-0.5">{c.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <HudTag color={c.isOwner ? 'var(--warning)' : 'var(--accent)'}>
                    {c.isOwner ? t('classes.owner') : t('classes.student')}
                  </HudTag>
                  <span className="text-xs text-hud-text/40">{c.memberCount} {t('classes.members')}</span>
                </div>
              </div>
            </div>
          </Link>
        ))}

        {classes.length === 0 && (
          <div className="text-center py-12 text-hud-text/30 text-sm">
            {t('classes.noClasses')}
          </div>
        )}
      </div>
    </div>
  );
}
