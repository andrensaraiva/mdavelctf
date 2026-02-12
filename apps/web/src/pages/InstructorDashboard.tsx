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

interface EventSummary {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  visibility: string;
  classId?: string;
  published: boolean;
}

interface Challenge {
  id: string;
  title: string;
  category: string;
  difficulty: number;
  pointsFixed: number;
  published: boolean;
}

export default function InstructorDashboard() {
  const { t } = useTranslation();
  const { userDoc } = useAuth();
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [tab, setTab] = useState<'classes' | 'create-event' | 'challenges' | 'guide'>('classes');

  // Create event form
  const [eventName, setEventName] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('private');
  const [teamMode, setTeamMode] = useState<'publicTeams' | 'eventTeams'>('eventTeams');
  const [linkedClassId, setLinkedClassId] = useState('');
  const [msg, setMsg] = useState('');

  // Challenge management
  const [selectedEventId, setSelectedEventId] = useState('');
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [chalMsg, setChalMsg] = useState('');
  // New challenge form
  const [chalTitle, setChalTitle] = useState('');
  const [chalCategory, setChalCategory] = useState('Web');
  const [chalDifficulty, setChalDifficulty] = useState(1);
  const [chalPoints, setChalPoints] = useState(100);
  const [chalDesc, setChalDesc] = useState('');
  const [chalFlag, setChalFlag] = useState('');
  const [chalCaseSensitive, setChalCaseSensitive] = useState(false);
  const [chalPublished, setChalPublished] = useState(true);
  const [chalFlagMode, setChalFlagMode] = useState<'standard' | 'unique' | 'decay'>('standard');
  const [chalDecayMin, setChalDecayMin] = useState(50);
  const [chalDecayPercent, setChalDecayPercent] = useState(10);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiGet('/classes/my');
        setClasses((res.classes || []).filter((c: ClassSummary) => c.isOwner));
      } catch {}
      try {
        const res = await apiGet('/classes/instructor/events');
        setEvents(res.events || []);
      } catch {}
    })();
  }, []);

  // Load challenges when event selected
  useEffect(() => {
    if (!selectedEventId) { setChallenges([]); return; }
    (async () => {
      try {
        const res = await apiGet(`/classes/instructor/events/${selectedEventId}/challenges`);
        setChallenges(res.challenges || []);
      } catch { setChallenges([]); }
    })();
  }, [selectedEventId]);

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
      const res = await apiPost('/classes/instructor/event', {
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
      setEvents((prev) => [...prev, { id: res.id, name: res.name, startsAt: res.startsAt, endsAt: res.endsAt, visibility: res.visibility, classId: res.classId, published: res.published }]);
      setTimeout(() => setMsg(''), 3000);
    } catch (e: any) { setMsg(e.message); }
  };

  const handleCreateChallenge = async () => {
    if (!selectedEventId || !chalTitle || !chalCategory) {
      setChalMsg('Select an event and fill in title + category');
      return;
    }
    try {
      const res = await apiPost('/classes/instructor/challenge', {
        eventId: selectedEventId,
        title: chalTitle,
        category: chalCategory,
        difficulty: chalDifficulty,
        pointsFixed: chalPoints,
        descriptionMd: chalDesc,
        published: chalPublished,
        flagText: chalFlag || undefined,
        caseSensitive: chalCaseSensitive,
        flagMode: chalFlagMode,
        ...(chalFlagMode === 'decay' ? {
          decayConfig: { minPoints: chalDecayMin, decayPercent: chalDecayPercent },
        } : {}),
      });
      setChallenges((prev) => [...prev, { id: res.id, title: res.title, category: res.category, difficulty: res.difficulty, pointsFixed: res.pointsFixed, published: res.published }]);
      setChalMsg('Challenge created!');
      setChalTitle('');
      setChalDesc('');
      setChalFlag('');
      setChalPoints(100);
      setChalDifficulty(1);
      setTimeout(() => setChalMsg(''), 3000);
    } catch (e: any) { setChalMsg(e.message); }
  };

  const handleSetFlag = async (challengeId: string) => {
    const flagText = prompt('Enter the flag value:');
    if (!flagText) return;
    try {
      await apiPost(`/classes/instructor/challenge/${challengeId}/set-flag`, { eventId: selectedEventId, flagText, caseSensitive: false });
      setChalMsg('Flag updated!');
      setTimeout(() => setChalMsg(''), 3000);
    } catch (e: any) { setChalMsg(e.message); }
  };

  const tabs = [
    { key: 'classes' as const, label: t('instructor.myClasses'), icon: '📚' },
    { key: 'create-event' as const, label: t('instructor.createEvent'), icon: '🏁' },
    { key: 'challenges' as const, label: 'Challenges', icon: '🧩' },
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

      {/* Challenges Tab */}
      {tab === 'challenges' && (
        <div className="space-y-4">
          {/* Event selector */}
          <HudPanel title="Select Event">
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="terminal-input w-full px-3 py-2 text-sm"
            >
              <option value="">-- Select an event --</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>{ev.name} ({ev.visibility})</option>
              ))}
            </select>
          </HudPanel>

          {selectedEventId && (
            <>
              {/* Existing challenges */}
              <HudPanel title={`Challenges (${challenges.length})`}>
                {challenges.length === 0 ? (
                  <p className="text-center text-hud-text/30 py-4 text-sm">No challenges yet. Create one below.</p>
                ) : (
                  <div className="space-y-2">
                    {challenges.map((ch) => (
                      <div key={ch.id} className="flex items-center justify-between border border-accent/15 px-3 py-2">
                        <div className="flex items-center gap-3">
                          <HudTag color={ch.published ? 'var(--success)' : 'var(--warning)'}>{ch.published ? 'Live' : 'Draft'}</HudTag>
                          <span className="text-sm font-bold text-accent">{ch.title}</span>
                          <span className="text-xs text-hud-text/40">{ch.category}</span>
                          <span className="text-xs text-hud-text/40">⭐{ch.difficulty}</span>
                          <span className="text-xs text-hud-text/40">{ch.pointsFixed}pts</span>
                        </div>
                        <NeonButton size="sm" onClick={() => handleSetFlag(ch.id)}>Set Flag</NeonButton>
                      </div>
                    ))}
                  </div>
                )}
              </HudPanel>

              {/* Create challenge form */}
              <HudPanel title="Create Challenge">
                <div className="space-y-3">
                  <input
                    value={chalTitle}
                    onChange={(e) => setChalTitle(e.target.value)}
                    placeholder="Challenge title"
                    className="terminal-input w-full px-3 py-2 text-sm"
                  />
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs uppercase tracking-widest mb-1 text-accent/70">Category</label>
                      <select value={chalCategory} onChange={(e) => setChalCategory(e.target.value)} className="terminal-input w-full px-3 py-2 text-sm">
                        {['Web', 'Crypto', 'Forensics', 'Rev', 'Pwn', 'Misc', 'OSINT', 'Network', 'Stego'].map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs uppercase tracking-widest mb-1 text-accent/70">Difficulty</label>
                      <select value={chalDifficulty} onChange={(e) => setChalDifficulty(Number(e.target.value))} className="terminal-input w-full px-3 py-2 text-sm">
                        {[1, 2, 3, 4, 5].map((d) => (<option key={d} value={d}>{d}</option>))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs uppercase tracking-widest mb-1 text-accent/70">Points</label>
                      <input type="number" value={chalPoints} onChange={(e) => setChalPoints(Number(e.target.value))} className="terminal-input w-full px-3 py-2 text-sm" />
                    </div>
                    <div className="flex items-end gap-2">
                      <label className="flex items-center gap-1 text-xs text-accent/70">
                        <input type="checkbox" checked={chalPublished} onChange={(e) => setChalPublished(e.target.checked)} />
                        Published
                      </label>
                      <label className="flex items-center gap-1 text-xs text-accent/70">
                        <input type="checkbox" checked={chalCaseSensitive} onChange={(e) => setChalCaseSensitive(e.target.checked)} />
                        Case Sensitive
                      </label>
                    </div>
                  </div>
                  <textarea
                    value={chalDesc}
                    onChange={(e) => setChalDesc(e.target.value)}
                    placeholder="Description (markdown supported)"
                    rows={4}
                    className="terminal-input w-full px-3 py-2 text-sm"
                  />
                  <input
                    value={chalFlag}
                    onChange={(e) => setChalFlag(e.target.value)}
                    placeholder="Flag (e.g. CTF{example_flag})"
                    className="terminal-input w-full px-3 py-2 text-sm font-mono"
                  />
                  {/* Flag Mode */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs uppercase tracking-widest mb-1 text-accent/70">Flag Mode</label>
                      <select value={chalFlagMode} onChange={(e) => setChalFlagMode(e.target.value as any)} className="terminal-input w-full px-3 py-2 text-sm">
                        <option value="standard">Standard</option>
                        <option value="unique">Unique (1st only)</option>
                        <option value="decay">Decay (pts decrease)</option>
                      </select>
                    </div>
                    {chalFlagMode === 'decay' && (
                      <>
                        <div>
                          <label className="block text-xs uppercase tracking-widest mb-1 text-accent/70">Min Points</label>
                          <input type="number" value={chalDecayMin} onChange={(e) => setChalDecayMin(Number(e.target.value))} className="terminal-input w-full px-3 py-2 text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs uppercase tracking-widest mb-1 text-accent/70">Decay % per solve</label>
                          <input type="number" value={chalDecayPercent} onChange={(e) => setChalDecayPercent(Number(e.target.value))} className="terminal-input w-full px-3 py-2 text-sm" />
                        </div>
                      </>
                    )}
                  </div>
                  <NeonButton size="sm" variant="solid" onClick={handleCreateChallenge}>Create Challenge</NeonButton>
                  {chalMsg && <p className="text-accent text-xs mt-2">{chalMsg}</p>}
                </div>
              </HudPanel>
            </>
          )}
        </div>
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
          <p>Como <Code>instrutor</Code>, você pode gerenciar <strong>turmas</strong>, criar <strong>eventos</strong> e <strong>desafios</strong> de CTF.</p>
          <p>As <Code>instructor</Code>, you manage <strong>classes</strong>, create <strong>events</strong> and <strong>challenges</strong> linked to them.</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Acesse <strong>📚 Turmas</strong> para ver e gerenciar suas turmas</li>
            <li>Use <strong>🏁 Criar Evento</strong> para criar competições para seus alunos</li>
            <li>Use <strong>🧩 Challenges</strong> para criar desafios nos seus eventos</li>
            <li>Consulte <strong>📖 Guia</strong> (esta aba) para instruções detalhadas</li>
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
      id: 'challenges',
      icon: '🧩',
      title: 'Desafios / Challenges',
      content: (
        <>
          <p>Crie <strong>desafios</strong> diretamente nos seus eventos sem precisar de um admin!</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Acesse a aba <strong>🧩 Challenges</strong> neste painel</li>
            <li>Selecione um <strong>evento que você criou</strong> no dropdown</li>
            <li>Preencha: <strong>título</strong>, <strong>categoria</strong> (WEB, CRYPTO, FORENSICS, OSINT, PWN, REV, MISC, NETWORK, STEGO), <strong>dificuldade</strong> (1-5), <strong>pontos</strong></li>
            <li>Escreva a <strong>descrição</strong> em Markdown (suporta código, links, imagens)</li>
            <li>Defina a <strong>flag</strong> (ex: <Code>CTF&#123;minha_flag&#125;</Code>)</li>
          </ul>
          <p className="font-bold text-accent mt-3">🏳️ Modos de Flag:</p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Standard</strong> — Qualquer participante pode resolver. Pontos fixos. (Padrão)</li>
            <li><strong>🏆 Unique</strong> — Apenas a 1ª pessoa que resolver ganha os pontos. O desafio é trancado depois.</li>
            <li><strong>📉 Decay</strong> — Pontos diminuem a cada solve. Mesmo time não resolve 2x. Configure <strong>Min Points</strong> (piso) e <strong>Decay %</strong> (redução por solve).</li>
          </ul>
          <p className="text-accent/60 text-xs mt-2">
            Exemplo Decay: 100pts com 10% decay → 100, 90, 81, 73... até o piso.
          </p>
          <p className="font-bold text-accent mt-3">Alterar flag existente:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Clique no botão <strong>🔑 Set Flag</strong> ao lado do desafio na lista</li>
            <li>Digite a nova flag e confirme (é hasheada com HMAC-SHA256 + PEPPER)</li>
          </ul>
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
            <li>Vá para a aba <strong>🧩 Challenges</strong> e crie desafios no evento</li>
            <li>Defina as <strong>flags</strong> e escolha o <strong>modo</strong> (Standard, Unique, Decay)</li>
            <li>Acompanhe o progresso pelo <strong>placar</strong> (<Code>/scoreboard</Code>)</li>
          </ol>
          <p className="text-accent/60 text-xs mt-2">1. Create class → 2. Share code → 3. Create event → 4. Create challenges → 5. Set flags & modes → 6. Monitor scores</p>
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
            <li>Use <strong>🏆 Unique</strong> para competições de velocidade (primeiro a resolver ganha)</li>
            <li>Use <strong>📉 Decay</strong> para equilibrar pontos quando muitos resolvem</li>
            <li>Configure <strong>Min Points</strong> alto (ex: 50%) no Decay para evitar pontuações muito baixas</li>
            <li>Combine categorias (WEB, CRYPTO, FORENSICS...) para treinar habilidades variadas</li>
            <li>Dificuldade 1-2 para iniciantes, 3-5 para avançados — ajuste os <strong>pontos</strong> proporcionalmente</li>
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
