import React, { useEffect, useState } from 'react';
import { HudPanel } from '../components/HudPanel';
import { NeonButton } from '../components/NeonButton';
import { HudTag } from '../components/HudTag';
import { apiGet, apiPost, apiPut, apiDelete } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { CourseDoc, COURSE_THEME_PRESETS, CTF_TYPE_OPTIONS } from '@mdavelctf/shared';
import { useTranslation } from 'react-i18next';

type CourseWithId = CourseDoc & { id: string };

export default function CoursesPage() {
  const { t } = useTranslation();
  const { userDoc } = useAuth();
  const [courses, setCourses] = useState<CourseWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<Record<string, any>>({});
  const [tagFilter, setTagFilter] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [ctfType, setCtfType] = useState('cybersecurity');
  const [themeId, setThemeId] = useState('neon-cyber');
  const [published, setPublished] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const isAdmin = userDoc?.role === 'admin';
  const isInstructor = userDoc?.role === 'instructor';

  if (!isAdmin && !isInstructor) {
    return <div className="p-8 text-center text-danger text-lg font-semibold">{t('admin.accessDenied')}</div>;
  }

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiGet('/courses');
      setCourses(res.courses || []);
      // Load analytics for each course
      const analyticsMap: Record<string, any> = {};
      for (const c of (res.courses || [])) {
        try {
          const a = await apiGet(`/courses/${c.id}/analytics`);
          analyticsMap[c.id] = a;
        } catch {}
      }
      setAnalytics(analyticsMap);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setName(''); setDescription(''); setTags([]); setTagInput('');
    setCtfType('cybersecurity'); setThemeId('neon-cyber'); setPublished(true);
    setEditId(null); setShowForm(false);
  };

  const handleEdit = (c: CourseWithId) => {
    setEditId(c.id);
    setName(c.name);
    setDescription(c.description || '');
    setTags(c.tags || []);
    setCtfType(c.ctfType);
    setThemeId(c.themeId);
    setPublished(c.published !== false);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!name.trim()) { setMsg('Name is required'); return; }
    setSaving(true);
    try {
      const body = { name, description, tags, ctfType, themeId, published };
      if (editId) {
        await apiPut(`/courses/${editId}`, body);
      } else {
        await apiPost('/courses', body);
      }
      resetForm();
      await load();
      setMsg(editId ? 'Course updated' : 'Course created');
    } catch (e: any) {
      setMsg(e.message);
    }
    setSaving(false);
    setTimeout(() => setMsg(''), 3000);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this course?')) return;
    try {
      await apiDelete(`/courses/${id}`);
      await load();
    } catch (e: any) {
      setMsg(e.message);
    }
  };

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput('');
  };
  const removeTag = (t: string) => setTags(tags.filter((x) => x !== t));

  // Get all unique tags for filtering
  const allTags = Array.from(new Set(courses.flatMap((c) => c.tags || [])));
  const filteredCourses = tagFilter ? courses.filter((c) => (c.tags || []).includes(tagFilter)) : courses;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📚</span>
          <h1 className="text-2xl font-extrabold text-accent glow-text tracking-wider">
            {t('courses.title', 'Courses')}
          </h1>
        </div>
        <NeonButton variant="solid" onClick={() => { resetForm(); setShowForm(true); }}>
          + {t('courses.create', 'Create Course')}
        </NeonButton>
      </div>

      {msg && <div className="text-sm text-success p-2">{msg}</div>}

      {/* Tag filter */}
      {allTags.length > 0 && (
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-xs uppercase tracking-widest text-hud-text/50">{t('courses.filterByTag', 'Filter by tag')}:</span>
          <button
            onClick={() => setTagFilter('')}
            className={`px-2 py-1 text-xs border transition-all ${!tagFilter ? 'border-accent text-accent bg-accent/10' : 'border-accent/20 text-hud-text/40 hover:text-accent'}`}
          >
            {t('common.all', 'ALL')}
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setTagFilter(tag === tagFilter ? '' : tag)}
              className={`px-2 py-1 text-xs border transition-all ${tagFilter === tag ? 'border-accent text-accent bg-accent/10' : 'border-accent/20 text-hud-text/40 hover:text-accent'}`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Course Form */}
      {showForm && (
        <HudPanel title={editId ? t('courses.editCourse', 'Edit Course') : t('courses.create', 'Create Course')}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs uppercase tracking-widest text-hud-text/70 mb-1">{t('courses.name', 'Name')}</label>
              <input className="terminal-input w-full px-3 py-2 text-sm" value={name} onChange={(e) => setName(e.target.value)} placeholder="Course name" />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-hud-text/70 mb-1">{t('courses.ctfType', 'CTF Type')}</label>
              <select className="terminal-input w-full px-3 py-2 text-sm bg-panel" value={ctfType} onChange={(e) => setCtfType(e.target.value)}>
                {CTF_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.icon} {o.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-xs uppercase tracking-widest text-hud-text/70 mb-1">{t('courses.description', 'Description')}</label>
            <textarea className="terminal-input w-full px-3 py-2 text-sm h-20" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Course description..." />
          </div>

          {/* Tags */}
          <div className="mb-4">
            <label className="block text-xs uppercase tracking-widest text-hud-text/70 mb-1">{t('courses.tags', 'Tags')}</label>
            <div className="flex gap-2 flex-wrap mb-2">
              {tags.map((tag) => (
                <span key={tag} className="flex items-center gap-1 px-2 py-1 text-xs border border-accent/30 text-accent bg-accent/5">
                  {tag}
                  <button onClick={() => removeTag(tag)} className="text-danger hover:text-danger/80 ml-1">&times;</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className="terminal-input px-3 py-1.5 text-sm flex-1"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                placeholder="Add tag..."
              />
              <NeonButton size="sm" onClick={addTag}>+</NeonButton>
            </div>
          </div>

          {/* Theme selector */}
          <div className="mb-4">
            <label className="block text-xs uppercase tracking-widest text-hud-text/70 mb-2">{t('courses.theme', 'Interface Theme')}</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {Object.values(COURSE_THEME_PRESETS).map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => setThemeId(preset.id)}
                  className={`flex flex-col items-center gap-2 p-3 border transition-all rounded-sm ${
                    themeId === preset.id
                      ? 'border-accent ring-1 ring-accent/50 bg-accent/10'
                      : 'border-accent/20 hover:border-accent/40'
                  }`}
                  style={{ backgroundColor: `${preset.bg}cc` }}
                >
                  <div className="flex gap-1">
                    <div className="w-5 h-5 rounded-full" style={{ backgroundColor: preset.accent }} />
                    <div className="w-5 h-5 rounded-full" style={{ backgroundColor: preset.accent2 }} />
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: preset.accent }}>
                    {preset.name}
                  </span>
                  {preset.vibe && (
                    <span className="text-[9px] text-center" style={{ color: preset.textDim }}>
                      {preset.vibe}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} className="accent-success" />
              <span className="uppercase tracking-widest text-hud-text/70">{t('courses.published', 'Published')}</span>
            </label>
          </div>

          <div className="flex gap-3">
            <NeonButton variant="solid" onClick={handleSave} disabled={saving}>
              {saving ? t('common.loading') : (editId ? t('common.save') : t('common.create'))}
            </NeonButton>
            <NeonButton onClick={() => resetForm()}>{t('common.cancel')}</NeonButton>
          </div>
        </HudPanel>
      )}

      {/* Course list */}
      {loading ? (
        <div className="text-center text-accent/50 py-8">{t('common.loading')}</div>
      ) : filteredCourses.length === 0 ? (
        <div className="text-center text-hud-text/30 py-8">{t('courses.noCourses', 'No courses yet.')}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCourses.map((c) => {
            const preset = COURSE_THEME_PRESETS[c.themeId];
            const ctfOpt = CTF_TYPE_OPTIONS.find((o) => o.value === c.ctfType);
            const a = analytics[c.id];
            return (
              <HudPanel key={c.id}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-bold" style={{ color: preset?.accent || 'var(--accent)' }}>
                      {c.icon && <span className="mr-2">{c.icon}</span>}
                      {c.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <HudTag color={preset?.accent2 || 'var(--accent2)'}>
                        {ctfOpt?.icon} {ctfOpt?.label || c.ctfType}
                      </HudTag>
                      {preset && (
                        <span className="flex gap-0.5">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: preset.accent }} />
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: preset.accent2 }} />
                        </span>
                      )}
                    </div>
                  </div>
                  {!c.published && <HudTag color="var(--warning)">Draft</HudTag>}
                </div>

                {c.description && (
                  <p className="text-sm text-hud-text/60 mb-3 line-clamp-2">{c.description}</p>
                )}

                {(c.tags || []).length > 0 && (
                  <div className="flex gap-1 flex-wrap mb-3">
                    {c.tags.map((tag) => (
                      <span key={tag} className="px-1.5 py-0.5 text-[10px] border border-accent/20 text-accent/60">{tag}</span>
                    ))}
                  </div>
                )}

                {/* Analytics */}
                {a && (
                  <div className="flex gap-4 text-xs text-hud-text/50 mb-3">
                    <span>{a.totalClasses || 0} {t('courses.classes', 'classes')}</span>
                    <span>{a.totalEvents || 0} {t('courses.events', 'events')}</span>
                    <span>{a.totalStudents || 0} {t('courses.students', 'students')}</span>
                  </div>
                )}

                {/* Theme preview bar */}
                {preset && (
                  <div className="flex gap-0.5 h-2 mb-3 rounded overflow-hidden">
                    <div className="flex-1" style={{ backgroundColor: preset.bg }} />
                    <div className="flex-1" style={{ backgroundColor: preset.panelBg }} />
                    <div className="flex-1" style={{ backgroundColor: preset.accent }} />
                    <div className="flex-1" style={{ backgroundColor: preset.accent2 }} />
                    <div className="flex-1" style={{ backgroundColor: preset.success }} />
                    <div className="flex-1" style={{ backgroundColor: preset.warning }} />
                    <div className="flex-1" style={{ backgroundColor: preset.danger }} />
                  </div>
                )}

                <div className="flex gap-2">
                  <NeonButton size="sm" onClick={() => handleEdit(c)}>{t('common.edit')}</NeonButton>
                  <NeonButton size="sm" variant="danger" onClick={() => handleDelete(c.id)}>{t('common.delete')}</NeonButton>
                </div>
              </HudPanel>
            );
          })}
        </div>
      )}
    </div>
  );
}
