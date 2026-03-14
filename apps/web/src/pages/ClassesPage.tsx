import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiGet, apiPost } from '../lib/api';
import { HudPanel } from '../components/HudPanel';
import { NeonButton } from '../components/NeonButton';
import { HudTag } from '../components/HudTag';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
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
  const [classTag, setClassTag] = useState('');
  const [customClassTag, setCustomClassTag] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [availableTags, setAvailableTags] = useState<any[]>([]);

  const load = async () => {
    try {
      const res = await apiGet('/classes/my');
      setClasses(res.classes || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    apiGet('/gamification/tags').then((res) => setAvailableTags(res.tags || [])).catch(() => {});
  }, []);

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
    const finalTag = classTag === '__custom__' ? customClassTag : classTag;
    try {
      await apiPost('/classes/create', { name: className, description: classDesc, classType: finalTag || undefined });
      setMsg('Class created!');
      setClassName('');
      setClassDesc('');
      setClassTag('');
      setCustomClassTag('');
      await load();
    } catch (e: any) { setMsg(e.message); }
    setTimeout(() => setMsg(''), 3000);
  };

  const isInstructor = userDoc?.role === 'instructor' || userDoc?.role === 'admin' || userDoc?.role === 'superadmin';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="inline-block w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
      <PageHeader title={t('classes.title')} icon="📚" />

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
            <div>
              <label className="block text-xs uppercase tracking-widest mb-1 text-accent/70">Tag</label>
              <div className="flex gap-2 items-center">
                <select value={classTag} onChange={(e) => setClassTag(e.target.value)} className="terminal-input px-3 py-2 text-sm w-full">
                  <option value="">Select tag...</option>
                  {availableTags.map((tag: any) => <option key={tag.id} value={tag.name}>{tag.icon} {tag.name}</option>)}
                  <option value="__custom__">+ Custom tag...</option>
                </select>
                {classTag === '__custom__' && <input value={customClassTag} onChange={(e) => setCustomClassTag(e.target.value)} placeholder="Tag name" className="terminal-input px-3 py-2 text-sm" />}
              </div>
            </div>
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
          <EmptyState icon="📚" title={t('classes.noClasses')} description={t('classes.joinClassHint')} />
        )}
      </div>
    </div>
  );
}
