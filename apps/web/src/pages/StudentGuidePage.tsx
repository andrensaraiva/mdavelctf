import React, { useState } from 'react';
import { HudPanel } from '../components/HudPanel';
import { HudTag } from '../components/HudTag';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function StudentGuidePage() {
  const { t } = useTranslation();
  const [openSection, setOpenSection] = useState<string | null>('welcome');

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

  const Step = ({ n, children }: { n: number; children: React.ReactNode }) => (
    <div className="flex items-start gap-2">
      <span className="bg-accent/20 text-accent text-xs font-bold w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">{n}</span>
      <div className="text-xs">{children}</div>
    </div>
  );

  const Tip = ({ children }: { children: React.ReactNode }) => (
    <div className="mt-3 p-3 border-l-2 border-warning/50 bg-warning/5">
      <p className="text-xs text-warning/90"><strong>💡 Dica:</strong> {children}</p>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-4 p-4">
      {/* Header */}
      <HudPanel>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">📖</span>
          <div>
            <h1 className="text-xl font-extrabold text-accent glow-text">
              Guia do Aluno / Student Guide
            </h1>
            <p className="text-xs text-hud-text/50 mt-1">
              Tudo que você precisa saber para participar do MdavelCTF
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {['welcome', 'account', 'classes', 'events', 'challenges', 'hints', 'flags', 'teams', 'progress', 'courses', 'categories', 'tips'].map((id) => (
            <button
              key={id}
              onClick={() => setOpenSection(id)}
              className={`text-xs px-2 py-1 border transition-colors ${
                openSection === id
                  ? 'border-accent text-accent bg-accent/10'
                  : 'border-accent/20 text-hud-text/50 hover:border-accent/40'
              }`}
            >
              {id}
            </button>
          ))}
        </div>
      </HudPanel>

      {/* Sections */}
      <div className="space-y-1">

        <Section id="welcome" icon="👋" title="Bem-vindo / Welcome">
          <p>
            <strong>MdavelCTF</strong> é uma plataforma de <Code>Capture The Flag</Code> (CTF) educacional.
            Aqui você vai resolver desafios de segurança da informação, ganhar pontos, subir de nível e competir com outros alunos!
          </p>
          <p>
            <strong>MdavelCTF</strong> is an educational <Code>Capture The Flag</Code> platform.
            Solve cybersecurity challenges, earn points, level up, and compete with other students!
          </p>
          <h4 className="font-bold text-accent mt-3">O que é um CTF?</h4>
          <p>
            Um CTF é uma competição onde você precisa encontrar uma <strong>"flag"</strong> (bandeira)
            escondida em desafios de segurança. A flag geralmente tem o formato <Code>CTF&#123;texto_aqui&#125;</Code>.
            Ao encontrar a flag, você a submete e ganha pontos!
          </p>
          <h4 className="font-bold text-accent mt-3">Navegação rápida:</h4>
          <ul className="list-disc list-inside space-y-1">
            <li><Link to="/home" className="text-accent hover:underline">/home</Link> — Painel principal com seu progresso</li>
            <li><Link to="/classes" className="text-accent hover:underline">/classes</Link> — Suas turmas</li>
            <li><Link to="/scoreboard" className="text-accent hover:underline">/scoreboard</Link> — Placar geral</li>
            <li><Link to="/team" className="text-accent hover:underline">/team</Link> — Gerenciar equipe</li>
            <li><Link to="/profile" className="text-accent hover:underline">/profile</Link> — Seu perfil e conquistas</li>
            <li><Link to="/theme-settings" className="text-accent hover:underline">/theme-settings</Link> — Personalizar tema visual</li>
            <li><Link to="/courses" className="text-accent hover:underline">/courses</Link> — Cursos e temáticas (instrutores)</li>
          </ul>
        </Section>

        <Section id="account" icon="🔑" title="Primeira vez / Getting Started">
          <h4 className="font-bold text-accent">Criando sua conta:</h4>
          <div className="space-y-2">
            <Step n={1}><span>Acesse a página de <Link to="/register" className="text-accent hover:underline">registro</Link></span></Step>
            <Step n={2}><span>Preencha: <strong>nome de usuário</strong> (handle), <strong>e-mail</strong> e <strong>senha</strong></span></Step>
            <Step n={3}><span>Faça <Link to="/login" className="text-accent hover:underline">login</Link> com suas credenciais</span></Step>
            <Step n={4}><span>Personalize seu <Link to="/profile" className="text-accent hover:underline">perfil</Link>: avatar, bio, links</span></Step>
          </div>
          <Tip>
            Use um nome de usuário (handle) criativo! Ele aparecerá no placar e para outros participantes.
          </Tip>
          <h4 className="font-bold text-accent mt-3">Configurando o perfil:</h4>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Avatar:</strong> Faça upload de uma imagem de perfil</li>
            <li><strong>Bio:</strong> Escreva uma breve descrição sobre você</li>
            <li><strong>Links:</strong> Adicione GitHub, LinkedIn, site pessoal</li>
            <li><strong>Idioma:</strong> Troque entre PT-BR 🇧🇷 e EN 🇺🇸 no menu do navbar</li>
            <li><strong>Tema visual:</strong> Em <Link to="/theme-settings" className="text-accent hover:underline">/theme-settings</Link>, escolha entre seguir o tema do curso ou usar seu tema customizado</li>
          </ul>
          <Tip>
            Quando você acessa um evento vinculado a um curso, o tema visual muda automaticamente para combinar com a temática do curso!
          </Tip>
        </Section>

        <Section id="classes" icon="📚" title="Turmas / Classes">
          <p>
            Seu professor pode criar uma <strong>turma</strong> e te dar um <Code>código de convite</Code>.
            Este código permite que você entre na turma e acesse eventos privativos.
          </p>
          <h4 className="font-bold text-accent mt-3">Como entrar em uma turma:</h4>
          <div className="space-y-2">
            <Step n={1}><span>Acesse <Link to="/classes" className="text-accent hover:underline">/classes</Link></span></Step>
            <Step n={2}><span>Clique em <strong>"Entrar com Código"</strong></span></Step>
            <Step n={3}><span>Cole o <strong>código de convite</strong> fornecido pelo professor</span></Step>
            <Step n={4}><span>Pronto! Agora você faz parte da turma</span></Step>
          </div>
          <Tip>
            Se o código não funcionar, peça ao professor para gerar um novo. Códigos podem ser trocados pelo instrutor.
          </Tip>
        </Section>

        <Section id="events" icon="🏁" title="Eventos / Events">
          <p>
            <strong>Eventos</strong> são competições de CTF com um período de início e fim.
            Eles contêm desafios que você deve resolver para ganhar pontos.
          </p>
          <h4 className="font-bold text-accent mt-3">Tipos de eventos:</h4>
          <ul className="list-disc list-inside space-y-1">
            <li><HudTag>Público</HudTag> — Qualquer pessoa pode participar</li>
            <li><HudTag>Privado</HudTag> — Apenas membros da turma vinculada</li>
          </ul>
          <h4 className="font-bold text-accent mt-3">Status do evento:</h4>
          <ul className="list-disc list-inside space-y-1">
            <li><span className="text-warning font-bold">⏳ UPCOMING</span> — Ainda não começou. Prepare-se!</li>
            <li><span className="text-success font-bold">🟢 LIVE</span> — Em andamento! Resolva os desafios agora</li>
            <li><span className="text-hud-text/40 font-bold">🔴 ENDED</span> — Já encerrado. Placar final disponível</li>
          </ul>
          <h4 className="font-bold text-accent mt-3">Como participar:</h4>
          <div className="space-y-2">
            <Step n={1}><span>Acesse <Link to="/home" className="text-accent hover:underline">/home</Link> e veja os eventos disponíveis</span></Step>
            <Step n={2}><span>Clique em um evento <strong>LIVE</strong></span></Step>
            <Step n={3}><span>Veja a lista de desafios e comece a resolver!</span></Step>
          </div>
        </Section>

        <Section id="challenges" icon="🧩" title="Desafios / Challenges">
          <p>
            Dentro de cada evento, há <strong>desafios</strong> de várias categorias.
            Cada desafio tem uma <strong>flag</strong> oculta que você deve encontrar e submeter.
          </p>
          <h4 className="font-bold text-accent mt-3">Informações de um desafio:</h4>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Título:</strong> Nome do desafio</li>
            <li><strong>Categoria:</strong> Tipo (WEB, CRYPTO, FORENSICS...)</li>
            <li><strong>Dificuldade:</strong> ⭐ 1 (fácil) a ⭐⭐⭐⭐⭐ 5 (muito difícil)</li>
            <li><strong>Pontos:</strong> Quantos pontos você ganha ao resolver</li>
            <li><strong>Descrição:</strong> Instruções e pistas para resolver</li>
            <li><strong>Anexos:</strong> Arquivos que podem ser necessários (downloads)</li>
          </ul>
          <h4 className="font-bold text-accent mt-3">Como resolver:</h4>
          <div className="space-y-2">
            <Step n={1}><span>Leia a <strong>descrição</strong> com atenção</span></Step>
            <Step n={2}><span>Baixe os <strong>anexos</strong> se houver</span></Step>
            <Step n={3}><span>Use suas habilidades para encontrar a <strong>flag</strong></span></Step>
            <Step n={4}><span>Clique em <strong>"Submit Flag"</strong> (ícone de terminal)</span></Step>
            <Step n={5}><span>Digite a flag no terminal e pressione Enter</span></Step>
          </div>
          <Tip>
            O terminal de submissão tem uma interface hacker-style! Digite a flag exatamente como encontrou.
            A comparação ignora maiúsculas/minúsculas.
          </Tip>
          <h4 className="font-bold text-accent mt-3">Precisa de ajuda?</h4>
          <p className="text-xs">
            Alguns desafios possuem <strong>💡 Dicas (Hints)</strong> que podem ser desbloqueadas.
            Veja a seção <button onClick={() => setOpenSection('hints')} className="text-accent hover:underline">Dicas / Hints</button> para mais detalhes.
          </p>
        </Section>

        <Section id="hints" icon="💡" title="Dicas / Hints">
          <p>
            Ficou preso em um desafio? Alguns desafios oferecem <strong>dicas (hints)</strong> que podem te ajudar
            a encontrar a flag. Mas atenção — desbloquear uma dica tem um <strong>custo em pontos</strong>!
          </p>
          <h4 className="font-bold text-accent mt-3">Como funciona:</h4>
          <ul className="list-disc list-inside space-y-1">
            <li>Cada dica tem um <strong>custo</strong> (ex: -50 pts) que é descontado da sua pontuação</li>
            <li>As dicas são <strong>sequenciais</strong> — você precisa desbloquear a #1 antes da #2</li>
            <li>Dicas bloqueadas mostram apenas o título e o custo</li>
            <li>Depois de desbloqueada, o conteúdo completo da dica é revelado</li>
          </ul>
          <h4 className="font-bold text-accent mt-3">Como desbloquear:</h4>
          <div className="space-y-2">
            <Step n={1}><span>Na página do desafio, procure o painel <strong>💡 Hints</strong></span></Step>
            <Step n={2}><span>Veja a próxima dica disponível e seu custo</span></Step>
            <Step n={3}><span>Clique em <strong>"🔓 Unlock"</strong> para desbloquear</span></Step>
            <Step n={4}><span>Leia a dica revelada e use-a para resolver o desafio</span></Step>
          </div>
          <div className="mt-3 space-y-2">
            <div className="p-3 border border-warning/20 bg-warning/5">
              <h4 className="font-bold text-warning text-sm">⚠️ Atenção ao custo!</h4>
              <p className="text-xs mt-1">
                Os pontos da dica são <strong>descontados da sua pontuação</strong> no evento.
                Use com sabedoria — tente resolver sozinho primeiro!
              </p>
            </div>
          </div>
          <Tip>
            Quanto menos dicas usar, mais pontos você mantém. Tente resolver sem dicas primeiro —
            se ficar travado por muito tempo, desbloquear uma dica é melhor do que desistir!
          </Tip>
        </Section>

        <Section id="flags" icon="🏳️" title="Modos de Flag / Flag Modes">
          <p>
            Desafios podem ter diferentes <strong>modos de flag</strong> que afetam como os pontos são distribuídos.
            Fique atento aos badges nos desafios!
          </p>
          <div className="space-y-3 mt-3">
            <div className="p-3 border border-accent/20 bg-accent/5">
              <h4 className="font-bold text-accent text-sm">Standard (Padrão)</h4>
              <p className="text-xs mt-1">
                Qualquer participante pode resolver. Todos recebem os <strong>mesmos pontos</strong>.
                Este é o modo mais comum.
              </p>
            </div>
            <div className="p-3 border border-warning/20 bg-warning/5">
              <h4 className="font-bold text-warning text-sm">🏆 Unique (Único)</h4>
              <p className="text-xs mt-1">
                Apenas a <strong>primeira pessoa</strong> que resolver ganha os pontos!
                Depois disso, o desafio é <strong>trancado</strong> e ninguém mais pode resolver.
                Seja rápido!
              </p>
              <p className="text-xs text-warning/60 mt-1">
                Se você tentar submeter e aparecer "🔒 Trancado" — alguém já resolveu primeiro.
              </p>
            </div>
            <div className="p-3 border border-accent2/20 bg-accent2/5">
              <h4 className="font-bold text-accent2 text-sm">📉 Decay (Decrescente)</h4>
              <p className="text-xs mt-1">
                Os pontos <strong>diminuem</strong> a cada pessoa que resolve. Quanto mais cedo você resolver, mais pontos ganha!
                Além disso, <strong>apenas 1 pessoa por time</strong> pode resolvê-lo.
              </p>
              <p className="text-xs text-accent2/60 mt-1">
                Exemplo: 100 pts com 10% decay → 1ª pessoa: 100pts, 2ª: 90pts, 3ª: 81pts...
              </p>
              <p className="text-xs text-accent2/60 mt-1">
                Se você tentar e aparecer "🚫 Time bloqueado" — alguém do seu time já resolveu.
              </p>
            </div>
          </div>
          <Tip>
            Procure por badges nos desafios: <strong>🏆 Unique</strong> ou <strong>📉 Decay</strong> + número de solves.
            Desafios sem badge são Standard.
          </Tip>
        </Section>

        <Section id="teams" icon="👥" title="Equipes / Teams">
          <p>
            Equipes permitem que vocês somem pontos e compitam juntos no placar.
          </p>
          <h4 className="font-bold text-accent mt-3">Tipos de equipe:</h4>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Equipes Públicas:</strong> Criadas em <Link to="/team" className="text-accent hover:underline">/team</Link>, abertas para qualquer um entrar</li>
            <li><strong>Equipes do Evento:</strong> Criadas dentro de um evento específico, válidas só naquele evento</li>
          </ul>
          <h4 className="font-bold text-accent mt-3">Como criar/entrar em uma equipe:</h4>
          <div className="space-y-2">
            <Step n={1}><span>Acesse <Link to="/team" className="text-accent hover:underline">/team</Link></span></Step>
            <Step n={2}><span>Crie sua própria equipe ou entre em uma existente</span></Step>
            <Step n={3}><span>Compartilhe o nome da equipe com seus colegas</span></Step>
          </div>
          <Tip>
            Em desafios com modo <strong>📉 Decay</strong>, apenas 1 pessoa do time pode resolver cada desafio.
            Coordenem quem vai resolver o quê!
          </Tip>
        </Section>

        <Section id="progress" icon="📈" title="Progresso e XP / Progress & XP">
          <p>
            Ao resolver desafios, você ganha <strong>XP</strong> (experiência) e sobe de <strong>nível</strong>!
          </p>
          <h4 className="font-bold text-accent mt-3">Sistema de XP:</h4>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>XP por solve:</strong> 2x os pontos do desafio (mínimo 10 XP)</li>
            <li><strong>XP por badges:</strong> Conquistas especiais dão XP bônus</li>
            <li><strong>XP por quests:</strong> Complete missões para ganhar mais XP</li>
          </ul>
          <h4 className="font-bold text-accent mt-3">Seu nível:</h4>
          <p className="text-xs">
            <Code>Nível = 1 + floor(sqrt(XP / 200))</Code> — Quanto mais XP, mais alto seu nível!
          </p>
          <h4 className="font-bold text-accent mt-3">Onde ver seu progresso:</h4>
          <ul className="list-disc list-inside space-y-1">
            <li><Link to="/home" className="text-accent hover:underline">/home</Link> — Barra de XP, nível, badges recentes</li>
            <li><Link to="/profile" className="text-accent hover:underline">/profile</Link> — Todas as suas conquistas e estatísticas</li>
            <li><Link to="/scoreboard" className="text-accent hover:underline">/scoreboard</Link> — Compare com outros jogadores</li>
          </ul>
          <h4 className="font-bold text-accent mt-3">🏅 Badges e Quests:</h4>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Badges:</strong> Conquistas desbloqueadas automaticamente (ex: "First Blood", "WEB Master")</li>
            <li><strong>Quests:</strong> Missões com objetivos específicos (ex: "Resolva 5 desafios de CRYPTO")</li>
            <li>Veja seus badges e quests ativos no <Link to="/home" className="text-accent hover:underline">/home</Link></li>
          </ul>
        </Section>

        <Section id="courses" icon="📘" title="Cursos e Temas / Courses & Themes">
          <p>
            Eventos e turmas podem ser vinculados a um <strong>curso</strong> específico.
            Cada curso tem uma <strong>temática visual</strong> própria que muda as cores da interface!
          </p>
          <h4 className="font-bold text-accent mt-3">Temas disponíveis:</h4>
          <div className="space-y-2 mt-2">
            <div className="grid grid-cols-2 gap-2">
              {[
                { name: 'Neon Cyber', desc: 'Verde neon hacker' },
                { name: 'Synthwave', desc: 'Rosa/roxo neon retrô' },
                { name: 'Deep Ocean', desc: 'Azul oceânico profundo' },
                { name: 'Crimson Ops', desc: 'Vermelho operação secreta' },
                { name: 'Solar Flare', desc: 'Amarelo/laranja solar' },
                { name: 'Arctic Frost', desc: 'Azul gelo ártico' },
                { name: 'Toxic Waste', desc: 'Verde tóxico radioativo' },
                { name: 'Royal Cipher', desc: 'Roxo imperial' },
                { name: 'Ghost Protocol', desc: 'Cinza monitoramento' },
                { name: 'Ember Grid', desc: 'Laranja escuro grade' },
              ].map((t) => (
                <div key={t.name} className="p-2 border border-accent/15 text-xs">
                  <span className="font-bold text-accent">{t.name}</span>
                  <span className="text-hud-text/50 ml-1">— {t.desc}</span>
                </div>
              ))}
            </div>
          </div>
          <h4 className="font-bold text-accent mt-3">Comportamento do tema:</h4>
          <ul className="list-disc list-inside space-y-1">
            <li>Ao entrar em um evento/turma com curso, o tema é aplicado <strong>automaticamente</strong></li>
            <li>Você pode escolher seguir o tema do curso ou manter seu tema customizado</li>
            <li>Acesse <Link to="/theme-settings" className="text-accent hover:underline">/theme-settings</Link> para configurar sua preferência</li>
          </ul>
          <Tip>
            Se o tema mudar de repente quando você entra em um evento, é porque ele está vinculado a um curso!
            Isso é normal — é para criar a atmosfera certa para cada tipo de desafio.
          </Tip>
        </Section>

        <Section id="categories" icon="🗂️" title="Categorias de Desafio">
          <p>Os desafios são organizados por categoria. Aqui está o que cada uma cobre:</p>
          <div className="space-y-2 mt-3">
            <div className="flex items-start gap-2">
              <HudTag>WEB</HudTag>
              <span className="text-xs">Vulnerabilidades web: SQL Injection, XSS, CSRF, directory traversal, autenticação quebrada</span>
            </div>
            <div className="flex items-start gap-2">
              <HudTag>CRYPTO</HudTag>
              <span className="text-xs">Criptografia: cifras clássicas, RSA, AES, hashing, encoding (Base64, hex)</span>
            </div>
            <div className="flex items-start gap-2">
              <HudTag>FORENSICS</HudTag>
              <span className="text-xs">Análise forense: arquivos corrompidos, metadados, análise de memória, logs, pcap</span>
            </div>
            <div className="flex items-start gap-2">
              <HudTag>OSINT</HudTag>
              <span className="text-xs">Open Source Intelligence: pesquisa em fontes abertas, geolocalização, redes sociais</span>
            </div>
            <div className="flex items-start gap-2">
              <HudTag>PWN</HudTag>
              <span className="text-xs">Exploração binária: buffer overflow, format strings, ROP chains, shellcode</span>
            </div>
            <div className="flex items-start gap-2">
              <HudTag>REV</HudTag>
              <span className="text-xs">Engenharia reversa: decompilação, debugging, análise de assembly, crackmes</span>
            </div>
            <div className="flex items-start gap-2">
              <HudTag>MISC</HudTag>
              <span className="text-xs">Diversos: programação, lógica, trivia, desafios que não se encaixam em outra categoria</span>
            </div>
            <div className="flex items-start gap-2">
              <HudTag>NETWORK</HudTag>
              <span className="text-xs">Redes: análise de tráfego, protocolos, Wireshark, firewalls, DNS</span>
            </div>
            <div className="flex items-start gap-2">
              <HudTag>STEGO</HudTag>
              <span className="text-xs">Esteganografia: dados ocultos em imagens, áudio, vídeo, textos</span>
            </div>
          </div>
        </Section>

        <Section id="tips" icon="💡" title="Dicas para CTF / CTF Tips">
          <h4 className="font-bold text-accent">Para iniciantes:</h4>
          <ul className="list-disc list-inside space-y-1">
            <li>Comece pelos desafios de <strong>dificuldade 1-2</strong> — eles ensinam o básico</li>
            <li>Leia a descrição <strong>inteira</strong> antes de começar — pistas estão nos detalhes</li>
            <li>A flag sempre tem um formato específico: <Code>CTF&#123;...&#125;</Code></li>
            <li>Use o <strong>Google</strong>! CTFs são sobre pesquisa e aprendizado</li>
            <li>Não tenha medo de errar — tentativas incorretas não penalizam</li>
          </ul>
          <h4 className="font-bold text-accent mt-3">Ferramentas úteis:</h4>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>CyberChef</strong> — Decodificação e manipulação de dados (gchq.github.io/CyberChef)</li>
            <li><strong>Wireshark</strong> — Análise de tráfego de rede</li>
            <li><strong>Burp Suite</strong> — Interceptação de requisições web</li>
            <li><strong>Ghidra / IDA</strong> — Engenharia reversa de binários</li>
            <li><strong>Python</strong> — Scripting para automação e solução de desafios</li>
            <li><strong>DevTools (F12)</strong> — Inspecionar páginas web, cookies, localStorage</li>
          </ul>
          <h4 className="font-bold text-accent mt-3">Estratégias:</h4>
          <ul className="list-disc list-inside space-y-1">
            <li>Em desafios <strong>🏆 Unique</strong> — resolva rápido! Só o 1° ganha</li>
            <li>Em desafios <strong>📉 Decay</strong> — resolva cedo para mais pontos</li>
            <li>Trabalhe em <strong>equipe</strong> — dividam as categorias entre os membros</li>
            <li>Anote seus passos — isso ajuda a aprender e a resolver desafios similares no futuro</li>
            <li>Não fique preso em um só desafio — pule e volte depois com a mente fresca</li>
          </ul>
          <Tip>
            CTFs são sobre <strong>aprender</strong>, não apenas competir. Cada desafio resolvido te torna um profissional melhor em segurança da informação!
          </Tip>
        </Section>

      </div>

      {/* Footer */}
      <HudPanel>
        <div className="text-center py-2">
          <p className="text-xs text-hud-text/50">
            Pronto para começar? Acesse o{' '}
            <Link to="/home" className="text-accent hover:underline font-bold">/home</Link>
            {' '}e resolva seus primeiros desafios!
          </p>
          <p className="text-xs text-hud-text/30 mt-1">
            MdavelCTF — Learn. Hack. Compete. 🚩
          </p>
        </div>
      </HudPanel>
    </div>
  );
}
