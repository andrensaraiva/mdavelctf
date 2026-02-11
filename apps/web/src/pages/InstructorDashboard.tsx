import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiGet, apiPost } from '../lib/api';
import { HudPanel } from '../components/HudPanel';
import { NeonButton } from '../components/NeonButton';
import { HudTag } from '../components/HudTag';
import { StatCard } from '../components/StatCard';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface ClassSummary {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  isOwner: boolean;
}

export default function InstructorDashboard() {
  const { t } = useTranslation();
  const { userDoc } = useAuth();
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [tab, setTab] = useState<'classes' | 'create-event' | 'guide'>('classes');

  // Create event form
  const [eventName, setEventName] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('private');
  const [teamMode, setTeamMode] = useState<'publicTeams' | 'eventTeams'>('eventTeams');
  const [linkedClassId, setLinkedClassId] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await apiGet('/classes/my');
        setClasses((res.classes || []).filter((c: ClassSummary) => c.isOwner));
      } catch {}
    })();
  }, []);

  if (userDoc?.role !== 'instructor' && userDoc?.role !== 'admin') {
    return (
      <div className="p-8 text-center text-danger text-lg font-semibold">
        Access denied. Instructor or Admin only.
      </div>
    );
  }

  const totalStudents = classes.reduce((s, c) => s + c.memberCount, 0);

  const handleCreateEvent = async () => {
    try {
      await apiPost('/admin/event', {
        name: eventName,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        published: true,
        visibility,
        teamMode,
        classId: linkedClassId || null,
        requireClassMembership: visibility === 'private',
      });
      setMsg('Event created!');
      setEventName('');
      setStartsAt('');
      setEndsAt('');
      setTimeout(() => setMsg(''), 3000);
    } catch (e: any) { setMsg(e.message); }
  };

  const tabs = [
    { key: 'classes' as const, label: t('instructor.myClasses'), icon: '📚' },
    { key: 'create-event' as const, label: t('instructor.createEvent'), icon: '🏁' },
    { key: 'guide' as const, label: t('admin.guide'), icon: '📖' },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <span className="text-2xl">🎓</span>
        <h1 className="text-2xl font-extrabold text-accent glow-text tracking-wider">
          {t('instructor.title')}
        </h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard label={t('instructor.totalClasses')} value={classes.length} color="var(--accent)" />
        <StatCard label={t('instructor.totalStudents')} value={totalStudents} color="var(--accent2)" />
        <StatCard label={t('instructor.totalEvents')} value="-" color="var(--success)" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold uppercase tracking-widest border transition-all ${
              tab === tb.key
                ? 'border-accent text-accent bg-accent/10'
                : 'border-accent/20 text-hud-text/50 hover:text-accent'
            }`}
          >
            <span>{tb.icon}</span> {tb.label}
          </button>
        ))}
      </div>

      {/* Classes Tab */}
      {tab === 'classes' && (
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
                      <h3 className="font-bold text-accent">{c.name}</h3>
                      <p className="text-xs text-hud-text/50">{c.memberCount} {t('classes.members')}</p>
                    </div>
                  </div>
                  <span className="text-accent text-xl">→</span>
                </div>
              </div>
            </Link>
          ))}
          {classes.length === 0 && (
            <HudPanel>
              <p className="text-center text-hud-text/30 py-4">
                {t('classes.noClasses')}
              </p>
              <div className="text-center">
                <Link to="/classes">
                  <NeonButton size="sm" variant="solid">{t('classes.createClass')}</NeonButton>
                </Link>
              </div>
            </HudPanel>
          )}
        </div>
      )}

      {/* Create Event Tab */}
      {tab === 'create-event' && (
        <HudPanel title={t('instructor.createEvent')}>
          <div className="space-y-3">
            <input
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder={t('instructor.eventName')}
              className="terminal-input w-full px-3 py-2 text-sm"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs uppercase tracking-widest mb-1 text-accent/70">{t('instructor.startsAt')}</label>
                <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="terminal-input w-full px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest mb-1 text-accent/70">{t('instructor.endsAt')}</label>
                <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="terminal-input w-full px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs uppercase tracking-widest mb-1 text-accent/70">{t('instructor.visibility')}</label>
                <select value={visibility} onChange={(e) => setVisibility(e.target.value as any)} className="terminal-input w-full px-3 py-2 text-sm">
                  <option value="public">{t('instructor.public')}</option>
                  <option value="private">{t('instructor.private')}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest mb-1 text-accent/70">{t('instructor.teamMode')}</label>
                <select value={teamMode} onChange={(e) => setTeamMode(e.target.value as any)} className="terminal-input w-full px-3 py-2 text-sm">
                  <option value="publicTeams">{t('instructor.publicTeams')}</option>
                  <option value="eventTeams">{t('instructor.eventTeams')}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest mb-1 text-accent/70">{t('instructor.linkedClass')}</label>
                <select value={linkedClassId} onChange={(e) => setLinkedClassId(e.target.value)} className="terminal-input w-full px-3 py-2 text-sm">
                  <option value="">{t('instructor.none')}</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <NeonButton size="sm" variant="solid" onClick={handleCreateEvent}>{t('instructor.createEvent')}</NeonButton>
            {msg && <p className="text-accent text-xs mt-2">{msg}</p>}
          </div>
        </HudPanel>
      )}

      {/* Guide Tab */}
      {tab === 'guide' && <InstructorGuide />}
    </div>
  );
}

/* ─── Instructor Guide ─── */
function InstructorGuide() {
  const { t } = useTranslation();
  const [openSection, setOpenSection] = useState<string | null>('getting-started');

  const toggle = (key: string) => setOpenSection(openSection === key ? null : key);

  const Section = ({ id, icon, title, children }: { id: string; icon: string; title: string; children: React.ReactNode }) => {
    const isOpen = openSection === id;
    return (
      <div className="border border-accent/15 hover:border-accent/30 transition-all">
        <button
          onClick={() => toggle(id)}
          className="w-full flex items-center gap-3 p-4 text-left hover:bg-accent/5 transition-colors"
        >
          <span className="text-xl flex-shrink-0">{icon}</span>
          <span className="font-bold text-sm flex-1 text-accent">{title}</span>
          <span className={`text-accent/50 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>▼</span>
        </button>
        {isOpen && (
          <div className="px-4 pb-4 pt-0 border-t border-accent/10">
            <div className="prose prose-sm prose-invert max-w-none space-y-3 text-hud-text/80 text-sm leading-relaxed">
              {children}
            </div>
          </div>
        )}
      </div>
    );
  };

  const Code = ({ children }: { children: React.ReactNode }) => (
    <code className="px-1.5 py-0.5 bg-accent/10 border border-accent/20 text-accent text-xs font-mono">{children}</code>
  );

  const sections = [
    {
      id: 'getting-started',
      icon: '🚀',
      title: 'Introdução / Getting Started',
      content: (
        <>
          <p>Como <Code>instrutor</Code>, você pode gerenciar <strong>turmas</strong> e criar <strong>eventos privativos</strong>.</p>
          <p>As <Code>instructor</Code>, you manage <strong>classes</strong> and create <strong>private events</strong> linked to them.</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Acesse a aba <strong>📚 Turmas</strong> para ver e gerenciar suas turmas</li>
            <li>Use <strong>🏁 Criar Evento</strong> para criar competições para seus alunos</li>
          </ul>
        </>
      ),
    },
    {
      id: 'classes',
      icon: '📚',
      title: 'Turmas / Classes',
      content: (
        <>
          <p><strong>Turmas</strong> agrupam seus alunos. Cada turma tem um <Code>código de convite</Code> único.</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Crie turmas em <strong>/classes</strong> → Criar Turma</li>
            <li>Compartilhe o <strong>código de convite</strong> com os alunos</li>
            <li>Gerencie membros: veja roster, remova alunos</li>
            <li>Troque o código com <strong>Trocar Código</strong> se necessário</li>
          </ul>
          <p className="text-accent/60 text-xs mt-2">Create classes, share invite codes with students, and manage membership.</p>
        </>
      ),
    },
    {
      id: 'events',
      icon: '🏁',
      title: 'Eventos / Events',
      content: (
        <>
          <p>Crie eventos <Code>privados</Code> vinculados a uma turma ou <Code>públicos</Code> abertos a todos.</p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Visibilidade:</strong> Público (qualquer pessoa) ou Privado (só membros da turma)</li>
            <li><strong>Modo de equipe:</strong> Equipes Públicas (globais) ou Equipes do Evento (criadas dentro)</li>
            <li><strong>Turma vinculada:</strong> Vincule a uma turma para restringir acesso</li>
            <li>Defina <strong>início</strong> e <strong>fim</strong> do evento</li>
          </ul>
          <p className="text-accent/60 text-xs mt-2">Create private events for your class or public competitions open to all.</p>
        </>
      ),
    },
    {
      id: 'workflow',
      icon: '📋',
      title: 'Fluxo de Trabalho / Workflow',
      content: (
        <>
          <p>Fluxo típico de um instrutor:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Crie uma <strong>turma</strong> e compartilhe o código de convite</li>
            <li>Espere os alunos entrarem na turma</li>
            <li>Crie um <strong>evento privado</strong> vinculado à turma</li>
            <li>Peça ao <strong>admin</strong> para adicionar desafios ao evento</li>
            <li>Acompanhe o progresso pelo <strong>placar</strong></li>
          </ol>
          <p className="text-accent/60 text-xs mt-2">1. Create class → 2. Share code → 3. Create event → 4. Admin adds challenges → 5. Monitor scores</p>
        </>
      ),
    },
    {
      id: 'tips',
      icon: '💡',
      title: 'Dicas / Tips',
      content: (
        <>
          <ul className="list-disc list-inside space-y-1">
            <li>Use <strong>eventos privados</strong> para avaliações e exercícios de sala</li>
            <li>Use <strong>equipes do evento</strong> para trabalhos em grupo</li>
            <li>O <strong>placar</strong> mostra ranking individual e por equipe</li>
            <li>Alunos podem trocar de <strong>idioma</strong> no navbar (PT-BR / EN)</li>
            <li>Combine com o admin para criar <strong>desafios</strong> adequados ao nível da turma</li>
          </ul>
        </>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <HudPanel>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">📖</span>
          <div>
            <h2 className="text-lg font-extrabold text-accent glow-text">{t('admin.guide')}</h2>
            <p className="text-xs text-hud-text/50 mt-1">
              Guia do instrutor — como usar a plataforma MdavelCTF
            </p>
          </div>
        </div>
      </HudPanel>

      <div className="space-y-1">
        {sections.map((s) => (
          <Section key={s.id} id={s.id} icon={s.icon} title={s.title}>
            {s.content}
          </Section>
        ))}
      </div>
    </div>
  );
}
