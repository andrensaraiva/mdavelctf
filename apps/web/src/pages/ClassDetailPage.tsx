import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiGet, apiPost } from '../lib/api';
import { HudPanel } from '../components/HudPanel';
import { NeonButton } from '../components/NeonButton';
import { HudTag } from '../components/HudTag';
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
  const [tab, setTab] = useState<'details' | 'roster' | 'events'>('details');

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
  };

  useEffect(() => { load(); }, [classId]);

  if (!classData) {
    return <div className="p-8 text-center text-accent/50">{t('common.loading')}</div>;
  }

  const isOwner = user?.uid === classData.ownerInstructorId || userDoc?.role === 'admin';

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

  const tabs = [
    { key: 'details' as const, label: t('classes.details') },
    { key: 'roster' as const, label: t('classes.roster') },
    { key: 'events' as const, label: t('classes.events') },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <HudPanel>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-accent glow-text">{classData.name}</h1>
            {classData.description && (
              <p className="text-sm text-hud-text/60 mt-1">{classData.description}</p>
            )}
            <p className="text-xs text-hud-text/40 mt-2">
              {classData.memberCount} {t('classes.members')} · {t('classes.createdBy')} {classData.ownerInstructorId.slice(0, 8)}
            </p>
          </div>
          <HudTag color={isOwner ? 'var(--warning)' : 'var(--accent)'}>
            {isOwner ? t('classes.owner') : t('classes.student')}
          </HudTag>
        </div>
      </HudPanel>

      {/* Tabs */}
      <div className="flex gap-1">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={`px-4 py-2 text-xs font-semibold uppercase tracking-widest border transition-all ${
              tab === tb.key
                ? 'border-accent text-accent bg-accent/10'
                : 'border-accent/20 text-hud-text/50 hover:text-accent'
            }`}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {/* Details Tab */}
      {tab === 'details' && (
        <HudPanel>
          {isOwner && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-xs text-hud-text/50 uppercase tracking-wider font-medium">{t('classes.inviteCode')}:</span>
                <span className="font-mono text-accent font-bold text-lg tracking-widest">{classData.inviteCode}</span>
              </div>
              <div className="flex gap-2">
                <NeonButton size="sm" variant="outline" onClick={handleRotateCode}>
                  {t('classes.rotateCode')}
                </NeonButton>
              </div>
            </div>
          )}
          {!isOwner && (
            <p className="text-sm text-hud-text/50">
              {t('classes.student')} — {classData.name}
            </p>
          )}
        </HudPanel>
      )}

      {/* Roster Tab */}
      {tab === 'roster' && (
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
              <p className="text-center text-hud-text/30 py-4 text-sm">{t('classes.noMembers')}</p>
            )}
          </div>
        </HudPanel>
      )}

      {/* Events Tab */}
      {tab === 'events' && (
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
              <p className="text-center text-hud-text/30 py-4 text-sm">{t('classes.noEvents')}</p>
            )}
          </div>
        </HudPanel>
      )}

      {msg && <div className="text-center text-sm text-accent">{msg}</div>}
    </div>
  );
}
