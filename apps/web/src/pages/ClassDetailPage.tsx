import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiGet, apiPost, apiPut } from '../lib/api';
import { HudPanel } from '../components/HudPanel';
import { NeonButton } from '../components/NeonButton';
import { HudTag } from '../components/HudTag';
import { TabBar, TabPanel } from '../components/TabBar';
import { EmptyState } from '../components/EmptyState';
import { useTranslation } from 'react-i18next';

interface ClassDetail {
  id: string;
  name: string;
  description: string;
  inviteCode: string;
  ownerInstructorId: string;
  createdAt: string;
  published: boolean;
  memberCount: number;
  classType?: string;
}

interface ClassMember {
  uid: string;
  displayName: string;
  roleInClass: string;
  joinedAt: string;
  avatarUrl?: string;
}

interface ClassEvent {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  visibility: string;
}

export default function ClassDetailPage() {
  const { t } = useTranslation();
  const { classId } = useParams<{ classId: string }>();
  const { user, userDoc } = useAuth();
  const [classData, setClassData] = useState<ClassDetail | null>(null);
  const [members, setMembers] = useState<ClassMember[]>([]);
  const [events, setEvents] = useState<ClassEvent[]>([]);
  const [msg, setMsg] = useState('');
  const [tab, setTab] = useState('details');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', description: '', classType: '', published: true });
  const [saving, setSaving] = useState(false);
  const [availableTags, setAvailableTags] = useState<any[]>([]);

  const load = async () => {
    if (!classId) return;
    try {
      const res = await apiGet(`/classes/${classId}`);
      setClassData(res.class || res.classDoc);
      setMembers(res.members || []);
      setEvents(res.events || []);
    } catch (e: any) {
      setMsg(e.message);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [classId]);
  useEffect(() => {
    apiGet('/gamification/tags').then((res) => setAvailableTags(res.tags || [])).catch(() => {});
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="inline-block w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (!classData) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <p className="text-hud-text/50">{msg || t('classes.notFound', 'Class not found')}</p>
      </div>
    );
  }

  const isOwner = user?.uid === classData.ownerInstructorId || userDoc?.role === 'admin' || userDoc?.role === 'superadmin';

  const handleRotateCode = async () => {
    try {
      const res = await apiPost(`/classes/${classId}/rotate-code`, {});
      setMsg(`New code: ${res.inviteCode}`);
      await load();
      setTimeout(() => setMsg(''), 4000);
    } catch (e: any) { setMsg(e.message); }
  };

  const handleRemoveMember = async (uid: string) => {
    try {
      await apiPost(`/classes/${classId}/remove-member`, { uid });
      setMsg('Member removed');
      await load();
      setTimeout(() => setMsg(''), 3000);
    } catch (e: any) { setMsg(e.message); }
  };

  const startEdit = () => {
    if (!classData) return;
    setEditForm({ name: classData.name, description: classData.description || '', classType: classData.classType || '', published: classData.published ?? true });
    setEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!classId || !editForm.name.trim()) return;
    setSaving(true);
    try {
      await apiPut(`/classes/${classId}`, editForm);
      setMsg(t('classes.classSaved') || 'Class updated');
      setEditing(false);
      await load();
      setTimeout(() => setMsg(''), 3000);
    } catch (e: any) { setMsg(e.message); }
    setSaving(false);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold text-accent">{classData.name}</h1>
            <HudTag color={isOwner ? 'var(--warning)' : 'var(--accent)'}>
              {isOwner ? t('classes.owner') : t('classes.student')}
            </HudTag>
            {classData.classType && <HudTag color="var(--accent2)">🏷️ {classData.classType}</HudTag>}
          </div>
          {classData.description && <p className="text-sm text-hud-text/60">{classData.description}</p>}
          <p className="text-xs text-hud-text/40">{classData.memberCount} {t('classes.members')}</p>
        </div>
      </div>

      {/* Tabs */}
      <TabBar
        tabs={[
          { key: 'details', label: t('classes.details'), icon: 'ℹ️' },
          { key: 'roster', label: t('classes.roster'), icon: '👥', badge: members.length || undefined },
          { key: 'events', label: t('classes.events'), icon: '🎯', badge: events.length || undefined },
        ]}
        active={tab}
        onChange={setTab}
      />

      {/* Details Tab */}
      <TabPanel active={tab} tab="details">
        <HudPanel>
          {isOwner && !editing && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-xs text-hud-text/50 uppercase tracking-wider font-medium">{t('classes.inviteCode')}:</span>
                <span className="font-mono text-accent font-bold text-lg tracking-widest">{classData.inviteCode}</span>
              </div>
              <div className="flex gap-2">
                <NeonButton size="sm" variant="outline" onClick={handleRotateCode}>
                  {t('classes.rotateCode')}
                </NeonButton>
                <NeonButton size="sm" variant="solid" onClick={startEdit}>
                  ✏️ {t('classes.editClass') || 'Edit Class'}
                </NeonButton>
              </div>
            </div>
          )}
          {isOwner && editing && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-accent">{t('classes.editClass') || 'Edit Class'}</h3>
              <div>
                <label className="text-xs text-hud-text/50 block mb-1">{t('common.name') || 'Name'}</label>
                <input className="w-full bg-transparent border border-accent/20 px-3 py-2 text-sm" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-hud-text/50 block mb-1">{t('common.description') || 'Description'}</label>
                <textarea className="w-full bg-transparent border border-accent/20 px-3 py-2 text-sm" rows={3} value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-hud-text/50 block mb-1">{t('classes.classType') || 'Type'}</label>
                <select className="w-full bg-transparent border border-accent/20 px-3 py-2 text-sm" value={editForm.classType} onChange={(e) => setEditForm({ ...editForm, classType: e.target.value })}>
                  <option value="">{t('common.select') || 'Select…'}</option>
                  {availableTags.map((tag: any) => (
                    <option key={tag.id} value={tag.name}>{tag.icon} {tag.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-hud-text/50">{t('admin.published') || 'Published'}</label>
                <input type="checkbox" checked={editForm.published} onChange={(e) => setEditForm({ ...editForm, published: e.target.checked })} />
              </div>
              <div className="flex gap-2">
                <NeonButton size="sm" variant="solid" onClick={handleSaveEdit} disabled={saving || !editForm.name.trim()}>
                  {saving ? '...' : t('common.save') || 'Save'}
                </NeonButton>
                <NeonButton size="sm" variant="ghost" onClick={() => setEditing(false)}>{t('common.cancel') || 'Cancel'}</NeonButton>
              </div>
            </div>
          )}
          {!isOwner && (
            <p className="text-sm text-hud-text/50">
              {t('classes.student')} — {classData.name}
            </p>
          )}
        </HudPanel>
      </TabPanel>

      {/* Roster Tab */}
      <TabPanel active={tab} tab="roster">
        <HudPanel title={`${t('classes.roster')} (${members.length})`}>
          <div className="space-y-2">
            {members.map((m) => (
              <div key={m.uid} className="flex items-center justify-between p-3 border border-accent/10 hover:border-accent/25 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center text-sm font-bold text-accent">
                    {(m.displayName || '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <span className="font-semibold text-sm">{m.displayName}</span>
                    <HudTag className="ml-2" color={m.roleInClass === 'instructor' ? 'var(--warning)' : 'var(--accent)'}>
                      {m.roleInClass}
                    </HudTag>
                  </div>
                </div>
                {isOwner && m.uid !== user?.uid && (
                  <NeonButton size="sm" variant="danger" onClick={() => handleRemoveMember(m.uid)}>
                    {t('classes.removeMember')}
                  </NeonButton>
                )}
              </div>
            ))}
            {members.length === 0 && (
              <EmptyState icon="👥" title={t('classes.noMembers')} />
            )}
          </div>
        </HudPanel>
      </TabPanel>

      {/* Events Tab */}
      <TabPanel active={tab} tab="events">
        <HudPanel title={t('classes.events')}>
          <div className="space-y-2">
            {events.map((e) => {
              const now = Date.now();
              const s = new Date(e.startsAt).getTime();
              const en = new Date(e.endsAt).getTime();
              const status = now < s ? 'UPCOMING' : now > en ? 'ENDED' : 'LIVE';
              const statusColor = status === 'LIVE' ? 'var(--success)' : status === 'UPCOMING' ? 'var(--warning)' : 'var(--hud-text)';
              return (
                <Link key={e.id} to={`/event/${e.id}`} className="block p-3 border border-accent/20 hover:border-accent/40 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {status === 'LIVE' && <span className="live-dot" />}
                      <span className="font-bold text-sm">{e.name}</span>
                      <HudTag color={statusColor}>{status}</HudTag>
                      {e.visibility === 'private' && <HudTag color="var(--danger)">🔒</HudTag>}
                    </div>
                  </div>
                </Link>
              );
            })}
            {events.length === 0 && (
              <EmptyState icon="🎯" title={t('classes.noEvents')} />
            )}
          </div>
        </HudPanel>
      </TabPanel>

      {msg && <div className="text-center text-sm text-accent font-medium py-1 border border-accent/20 bg-accent/5">{msg}</div>}
    </div>
  );
}
