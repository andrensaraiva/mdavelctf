# Análise Completa do MdavelCTF

## Visão Geral

O **MdavelCTF** é uma plataforma de **Capture The Flag (CTF)** full-stack com estética cyberpunk neon, construída como monorepo com 3 camadas:

- **shared/** — Tipos TypeScript compartilhados entre frontend e backend
- **apps/api/** — Backend Express.js + Firebase Admin SDK
- **apps/web/** — Frontend React 18 + Tailwind CSS v4 + Vite

---

## 1. Modelos de Dados (Shared Types)

Todas as interfaces ficam em `shared/src/index.ts` e são compartilhadas entre frontend e backend:

| Modelo          | Descrição                                                                 |
|-----------------|---------------------------------------------------------------------------|
| **User**        | Roles (participant, instructor, admin, superadmin), XP, badges, stats     |
| **Team**        | Times públicos persistentes + times temporários por evento                |
| **Event**       | Eventos públicos/privados com modos de flag (standard, unique, decay)     |
| **Challenge**   | Dificuldade 1–5, hints inline, múltiplos modos de flag                    |
| **Class**       | Turmas educacionais com instrutores, eventos vinculados, tema herdado     |
| **Gamification**| XP/Level (quadrático), 12 tipos de badges, quests semanais                |

---

## 2. Backend API — Rotas e Lógica de Negócio

### 2.1 Flag Submission (`apps/api/src/routes/submit.ts`)

Endpoint central do jogo: `POST /submit-flag`

1. Valida se o evento está ativo e se o usuário já não resolveu
2. Aplica **rate limiting** (máx 10 submissões/min, 30 tentativas/challenge)
3. Aplica **cooldown** de 10s após tentativa errada (anti brute-force)
4. Compara hash da flag via **HMAC-SHA256** com pepper secreto
5. Se correto: cria registro de solve, atualiza leaderboard, concede XP/badges, progride quests
6. 3 modos de flag:
   - **Standard**: todos resolvem, todos ganham pontos
   - **Unique**: primeiro solver trava o desafio
   - **Decay**: pontos diminuem a cada solve

### 2.2 Times (`apps/api/src/routes/team.ts`)

- Criar time (usuário vira capitão)
- Entrar em time existente
- Sair do time
- Listar membros
- Chat interno do time (mensagens em tempo real)

### 2.3 Times de Evento (`apps/api/src/routes/eventTeams.ts`)

- Times temporários criados especificamente para um evento
- Separados dos times públicos persistentes
- Gerenciamento de membros por evento

### 2.4 Turmas (`apps/api/src/routes/classes.ts`)

- Instrutor cria turma com código de convite, tipo e tema opcional
- Alunos entram via código de convite
- Instrutor cria eventos privados vinculados à turma
- Alunos acessam eventos exclusivos da turma
- Gerenciamento de roster (lista de alunos)

### 2.5 Gamificação (`apps/api/src/routes/gamification.ts`)

- Catálogo de badges disponíveis
- Consulta de progresso de quests por usuário
- Recomputação de estatísticas do usuário
- Auto-concessão de badges ao atingir milestones

### 2.6 Admin (`apps/api/src/routes/admin.ts`)

- CRUD completo de eventos
- CRUD completo de challenges (com hash da flag)
- CRUD de leagues (ligas)
- CRUD de badges e quests
- Logs de auditoria
- Seed de dados iniciais

### 2.7 Perfil (`apps/api/src/routes/profile.ts`)

- Upload de avatar (base64)
- Estatísticas do usuário (solves, XP, level, badges)
- Perfis públicos consultáveis

### 2.8 Hints (`apps/api/src/routes/hints.ts`)

- Hints inline vinculadas a cada challenge
- Cada hint tem um custo em pontos
- Ao desbloquear, os pontos são deduzidos da pontuação final ao resolver
- Registro de histórico de hints compradas

### 2.9 Health (`apps/api/src/routes/health.ts`)

- Endpoint de health check para monitoramento

### 2.10 Segurança

- **Autenticação**: Verificação de token Firebase em todas as rotas protegidas (`apps/api/src/middleware/auth.ts`)
- **Firestore Rules**: Cliente não pode escrever diretamente; `challengeSecrets` nunca legível pelo cliente
- **Crypto**: HMAC-SHA256 com pepper para hashing de flags (`apps/api/src/utils/crypto.ts`)
- **Auditoria**: Log de todas as ações administrativas (`apps/api/src/utils/audit.ts`)
- **Rate Limiting**: Máximo 10 submissões por minuto, 30 tentativas por challenge
- **Cooldown**: 10 segundos após tentativa errada

---

## 3. Frontend Web — Páginas e Componentes

### 3.1 Autenticação & Contexto

- **AuthContext** (`apps/web/src/context/AuthContext.tsx`): Estado do usuário logado, login/logout via Firebase Auth, carrega dados do perfil do Firestore
- **ThemeContext** (`apps/web/src/context/ThemeContext.tsx`): Sistema de temas com CSS variables dinâmicas, prioridade: Turma > Custom > Padrão
- **i18n** (`apps/web/src/i18n/index.ts`): Internacionalização com i18next, suporte a EN e PT-BR

### 3.2 Roteamento e Fluxo de Páginas

```
[Login/Register] → [HomePage (Hub)] → ramifica para:
├── [EventPage] → [ChallengePage] → [TerminalSubmitModal] (submissão de flag)
├── [TeamPage] (membros, chat, atividade, controles de capitão)
├── [ScoreboardPage / LeaguePage] (leaderboards)
├── [ClassesPage] → [ClassDetailPage] (turmas, roster, eventos)
├── [ProfilePage] (stats, badges, avatar)
├── [InstructorDashboard] (gestão de turma/eventos)
├── [AdminPage] (CRUD geral, logs, seed)
├── [ThemeSettingsPage] (customização visual)
└── [StudentGuidePage] (onboarding)
```

### 3.3 Páginas Detalhadas

#### LoginPage (`apps/web/src/pages/LoginPage.tsx`)
- Formulário de login com email/senha via Firebase Auth
- Link para registro e recuperação de senha
- Estilo cyberpunk com efeitos neon

#### RegisterPage (`apps/web/src/pages/RegisterPage.tsx`)
- Formulário de cadastro com nome, email, senha
- Cria conta no Firebase Auth + documento no Firestore
- Redireciona para HomePage após cadastro

#### ResetPasswordPage (`apps/web/src/pages/ResetPasswordPage.tsx`)
- Envio de email de recuperação de senha via Firebase Auth

#### HomePage (`apps/web/src/pages/HomePage.tsx`)
- Hub central do usuário logado
- Exibe XP, nível, badges recentes
- Lista de eventos ativos e quests
- Cards de estatísticas rápidas
- Acesso rápido a todas as seções

#### EventPage (`apps/web/src/pages/EventPage.tsx`)
- Detalhes do evento (nome, descrição, datas, modo)
- Lista de challenges do evento com dificuldade e status
- Timer regressivo para eventos com prazo
- Leaderboard do evento
- Botão de acesso a cada challenge

#### ChallengePage (`apps/web/src/pages/ChallengePage.tsx`)
- Descrição completa do challenge
- Informações de dificuldade e categoria
- Botão para abrir o TerminalSubmitModal
- Lista de hints disponíveis (com custo)
- Status de resolução (resolvido/não resolvido)
- Para modo unique: indica se já foi travado por outro solver
- Para modo decay: exibe pontuação atual diminuída

#### ScoreboardPage (`apps/web/src/pages/ScoreboardPage.tsx`)
- Leaderboard geral ou por evento
- Ranking de usuários e/ou times
- Tabela com posição, nome, pontuação, solves

#### LeaguePage (`apps/web/src/pages/LeaguePage.tsx`)
- Ligas competitivas com standings
- Estatísticas e analytics da liga
- Ranking entre times/jogadores

#### TeamPage (`apps/web/src/pages/TeamPage.tsx`)
- Visualização dos membros do time
- Chat interno do time (mensagens em tempo real)
- Atividade recente (solves dos membros)
- Controles de capitão (remover membro, etc.)
- Criar novo time ou entrar em time existente

#### ClassesPage (`apps/web/src/pages/ClassesPage.tsx`)
- Lista de turmas do usuário
- Criar nova turma (instrutor)
- Entrar em turma via código de convite (aluno)

#### ClassDetailPage (`apps/web/src/pages/ClassDetailPage.tsx`)
- Roster completo da turma
- Eventos vinculados à turma
- Configurações da turma (instrutor)
- Tema da turma

#### ProfilePage (`apps/web/src/pages/ProfilePage.tsx`)
- Avatar do usuário (com upload)
- Estatísticas completas (XP, nível, solves, badges)
- Barra de progresso de XP
- Lista de badges conquistadas
- Histórico de atividade

#### InstructorDashboard (`apps/web/src/pages/InstructorDashboard.tsx`)
- Gestão de turmas do instrutor
- Criação e edição de eventos vinculados
- Criação e edição de challenges
- Visualização de desempenho dos alunos

#### AdminPage (`apps/web/src/pages/AdminPage.tsx`)
- Dashboard completo de administração
- CRUD de eventos, challenges, badges, quests, leagues
- Logs de auditoria
- Seed de dados iniciais
- Gerenciamento de usuários

#### ThemeSettingsPage (`apps/web/src/pages/ThemeSettingsPage.tsx`)
- Escolha de preset de tema visual
- Customização de cores (accent, accent2, bg, glow)
- Preview em tempo real
- Salva preferência no perfil do usuário

#### StudentGuidePage (`apps/web/src/pages/StudentGuidePage.tsx`)
- Guia de onboarding para novos alunos
- Explicação do sistema de gamificação
- Tutorial de como submeter flags
- Dicas e boas práticas

### 3.4 Componentes Reutilizáveis

| Componente             | Arquivo                                        | Função                                              |
|------------------------|------------------------------------------------|-----------------------------------------------------|
| **Navbar**             | `apps/web/src/components/Navbar.tsx`            | Navegação principal + menu hamburger mobile          |
| **HudPanel**           | `apps/web/src/components/HudPanel.tsx`          | Painel estilo HUD cyberpunk (container visual)       |
| **HudTag**             | `apps/web/src/components/HudTag.tsx`            | Tag/label estilo HUD                                 |
| **ChatPanel**          | `apps/web/src/components/ChatPanel.tsx`         | Chat em tempo real do time                           |
| **TerminalSubmitModal**| `apps/web/src/components/TerminalSubmitModal.tsx`| Modal estilo terminal para submeter flags            |
| **QuestCard**          | `apps/web/src/components/QuestCard.tsx`         | Card de quest com barra de progresso                 |
| **BadgeCard**          | `apps/web/src/components/BadgeCard.tsx`         | Card de badge conquistada com ícone e descrição      |
| **CountdownTimer**     | `apps/web/src/components/CountdownTimer.tsx`    | Timer regressivo para eventos com prazo              |
| **RankTable**          | `apps/web/src/components/RankTable.tsx`         | Tabela de ranking/leaderboard                        |
| **XPProgressBar**      | `apps/web/src/components/XPProgressBar.tsx`     | Barra de progresso de XP com indicador de nível      |
| **StatCard**           | `apps/web/src/components/StatCard.tsx`          | Card de estatística individual (número + label)      |
| **NeonButton**         | `apps/web/src/components/NeonButton.tsx`        | Botão com efeito glow neon customizável              |
| **AvatarUploader**     | `apps/web/src/components/AvatarUploader.tsx`    | Upload e preview de avatar do perfil                 |

### 3.5 Camada de API do Frontend (`apps/web/src/lib/api.ts`)

- Funções wrapper para todas as chamadas HTTP ao backend
- Inclui token Firebase automaticamente nos headers
- Tratamento de erros padronizado

---

## 4. Mecânicas de Gamificação

### 4.1 XP e Níveis

- **XP por solve**: `2 × pontos do challenge` (mínimo 10 XP)
- **Fórmula de nível**: `1 + √(XP / 200)` (progressão quadrática)
- Exemplo: 200 XP = nível 2, 800 XP = nível 3, 1800 XP = nível 4

### 4.2 Badges (12 tipos)

Badges são auto-concedidas ao atingir milestones:

| Badge            | Critério                                    |
|------------------|---------------------------------------------|
| `first_solve`    | Primeira flag resolvida                     |
| `team_player`    | Entrou em um time                           |
| `speed_demon`    | Resolveu challenge em tempo recorde         |
| `perfectionist`  | Resolveu todos os challenges de um evento   |
| `streak`         | Sequência de solves consecutivos            |
| `category_*`     | Expertise em categoria específica           |
| (outros)         | Diversos milestones de progressão           |

### 4.3 Quests

- Missões semanais ativas com regras customizáveis
- Tipos: resolver N challenges total, resolver em categoria X, participar de evento
- Barra de progresso visível no QuestCard
- Recompensa em XP ao completar

### 4.4 Modos de Challenge

| Modo         | Comportamento                                                   |
|--------------|----------------------------------------------------------------|
| **Standard** | Todos os jogadores podem resolver, todos ganham pontos          |
| **Unique**   | Primeiro solver trava o challenge (locked: true)                |
| **Decay**    | Pontos diminuem a cada solve; membros do mesmo time bloqueados  |

### 4.5 Sistema de Hints

- Cada challenge pode ter hints inline
- Cada hint tem um custo em pontos
- Ao desbloquear, o custo é registrado
- Na resolução, os pontos gastos em hints são deduzidos do score final

---

## 5. Fluxo Principal: Submissão de Flag

```
Usuário abre o Challenge na ChallengePage
    ↓
Clica em "Submit Flag" → Abre TerminalSubmitModal
    ↓
Digita a flag no input estilo terminal
    ↓
Frontend envia POST /api/submit-flag com { eventId, challengeId, flag }
    ↓
Backend (middleware auth):
  1. Verifica token Firebase (autenticação)
  2. Carrega dados do evento e challenge
  3. Verifica se evento está ativo (dentro das datas)
  4. Verifica se usuário já resolveu este challenge
  5. Checa rate limit (máx 10 submissões por minuto)
  6. Checa cooldown (10s após tentativa errada)
  7. Hash da flag: HMAC-SHA256(flag_digitada, PEPPER_SECRET)
  8. Busca hash correto em challengeSecrets/{challengeId}
  9. Compara os hashes
    ↓
  ❌ Flag ERRADA:
    - Registra tentativa em submissions/
    - Aplica cooldown de 10s
    - Retorna { correct: false, message: "Incorrect flag" }
    - Frontend exibe mensagem de erro no terminal
    ↓
  ✅ Flag CORRETA:
    10. Cria registro de solve em events/{eventId}/solves/
    11. Calcula pontuação (considerando hints desbloqueadas e modo)
    12. Atualiza leaderboard em events/{eventId}/leaderboard/
    13. Calcula XP: max(10, pontos × 2)
    14. Atualiza XP e nível do usuário em users/{uid}
    15. Verifica e concede badges aplicáveis
    16. Atualiza progresso de quests ativas
    17. Retorna { correct: true, scoreAwarded, xpAwarded, locked?, teamBlocked? }
    18. Frontend exibe animação de sucesso no terminal
```

---

## 6. Fluxo de Turmas (Educacional)

```
1. Instrutor acessa ClassesPage → Clica "Criar Turma"
    ↓
2. Preenche: nome, código de convite, tipo (classType), tema opcional
    ↓
3. Backend cria documento em classes/{classId} no Firestore
    ↓
4. Instrutor compartilha código de convite com alunos
    ↓
5. Aluno acessa ClassesPage → Insere código → Entra na turma
    ↓
6. Backend adiciona aluno à lista de membros da classe
    ↓
7. Se a turma tem tema, o ThemeContext aplica automaticamente ao aluno
    ↓
8. Instrutor acessa InstructorDashboard → Cria evento privado
    ↓
9. Evento é vinculado à turma (classId no evento)
    ↓
10. Apenas alunos da turma veem o evento na EventPage
    ↓
11. Instrutor pode criar challenges dentro do evento
    ↓
12. Alunos competem normalmente (submit flags, ganham XP/badges)
    ↓
13. Instrutor acompanha desempenho no InstructorDashboard
```

---

## 7. Sistema de Temas

### 7.1 Presets de Usuário (5)

| Preset    | Cor principal |
|-----------|---------------|
| Cyan      | Ciano/azul    |
| Green     | Verde         |
| Magenta   | Magenta/rosa  |
| Amber     | Âmbar/dourado |
| Red       | Vermelho      |

### 7.2 Presets de Curso (6)

| Preset          | Estilo              |
|-----------------|----------------------|
| Neon Cyber      | Cyberpunk clássico   |
| Matrix Green    | Estilo Matrix        |
| Sunset          | Tons quentes         |
| (outros 3)      | Variações temáticas  |

### 7.3 Prioridade de Tema

```
1. Tema da turma (se aluno pertence a turma com tema) → MAIOR PRIORIDADE
2. Tema custom do usuário (escolhido em ThemeSettingsPage)
3. Tema padrão (Cyan)                                  → MENOR PRIORIDADE
```

### 7.4 Variáveis CSS Dinâmicas

O ThemeContext aplica em tempo real:
- `--accent` — Cor principal
- `--accent2` — Cor secundária
- `--bg` — Cor de fundo
- `--glow` — Cor do efeito glow
- (e outras variáveis de estilo)

---

## 8. Internacionalização (i18n)

- Framework: **i18next** com **react-i18next**
- Idiomas suportados:
  - **Inglês** (`apps/web/src/i18n/en.json`)
  - **Português Brasil** (`apps/web/src/i18n/pt-BR.json`)
- Detecção automática do idioma do navegador
- Todas as strings da interface são traduzíveis

---

## 9. Banco de Dados (Firestore)

### 9.1 Estrutura de Coleções

```
users/{uid}
  ├── displayName, email, role
  ├── xp, level, badges[]
  ├── stats { totalSolves, totalScore, ... }
  └── avatar (base64)

teams/{teamId}
  ├── name, captainUid, members[]
  └── chat[] (mensagens)

events/{eventId}
  ├── title, description, startDate, endDate
  ├── flagMode (standard | unique | decay)
  ├── classId (opcional, vínculo com turma)
  ├── visibility (public | private)
  │
  ├── challenges/{challengeId}
  │     ├── title, description, category, difficulty
  │     ├── points, flagMode
  │     └── hints[] { text, cost }
  │
  ├── submissions/{submissionId}
  │     ├── userId, challengeId, flag, correct
  │     └── timestamp
  │
  ├── solves/{solveId}
  │     ├── userId, challengeId, scoreAwarded
  │     └── timestamp
  │
  ├── leaderboard/{entry}
  │     ├── userId/teamId, totalScore
  │     └── solveCount
  │
  └── analytics/{doc}
        └── estatísticas do evento

challengeSecrets/{challengeId}
  └── flagHash (HMAC-SHA256) — NUNCA exposto ao cliente

leagues/{leagueId}
  ├── name, description
  ├── standings[]
  └── analytics

classes/{classId}
  ├── name, inviteCode, classType
  ├── instructorUid, theme
  └── members[]

quests/{questId}
  ├── title, description, type, target
  ├── xpReward
  └── progress { [userId]: currentProgress }

badges/{badgeKey}
  ├── name, description, icon
  └── criteria

hintUnlocks/{docId}
  ├── userId, challengeId, hintIndex
  └── cost, timestamp

auditLogs/{logId}
  ├── action, adminUid, targetId
  ├── details
  └── timestamp
```

### 9.2 Regras de Segurança (Firestore Rules)

- **Leitura**: Usuários autenticados podem ler a maioria dos dados
- **Escrita**: Apenas via backend (Firebase Admin SDK) — cliente nunca escreve diretamente
- **challengeSecrets**: NUNCA legível pelo cliente (contém hashes das flags)
- **auditLogs**: Apenas admins podem ler

---

## 10. Utilitários do Backend

| Utilitário              | Arquivo                                   | Função                                             |
|-------------------------|-------------------------------------------|----------------------------------------------------|
| **asyncHandler**        | `apps/api/src/utils/asyncHandler.ts`      | Wrapper para tratamento de erros em rotas async     |
| **audit**               | `apps/api/src/utils/audit.ts`             | Registra ações admin no auditLogs                   |
| **bootstrapAdmin**      | `apps/api/src/utils/bootstrapAdmin.ts`    | Cria admin inicial no primeiro boot                 |
| **crypto**              | `apps/api/src/utils/crypto.ts`            | HMAC-SHA256 com pepper para hash de flags           |
| **event**               | `apps/api/src/utils/event.ts`             | Funções auxiliares para validação de eventos         |
| **seedData**            | `apps/api/src/utils/seedData.ts`          | Dados iniciais para popular o banco                 |

---

## 11. Deploy e Infraestrutura

### 11.1 Render.yaml

Dois serviços definidos:

1. **API Service** (Web Service)
   - Runtime: Node.js
   - Build: `npm install && npm run build`
   - Start: `node apps/api/dist/index.js`
   - Porta: 4000

2. **Web Service** (Static Site)
   - Build: `npm install && npm run build`
   - Diretório: `apps/web/dist`
   - Rewrite: `/*` → `/index.html` (SPA catch-all)

### 11.2 Variáveis de Ambiente

- `FIREBASE_PROJECT_ID` — ID do projeto Firebase
- `FIREBASE_SERVICE_ACCOUNT` — JSON da service account
- `PEPPER_SECRET` — Segredo para HMAC das flags
- `CORS_ORIGINS` — Origens permitidas para CORS

---

## 12. Tecnologias Utilizadas

| Camada     | Tecnologias                                                    |
|------------|---------------------------------------------------------------|
| **Backend**| Express.js, Firebase Admin SDK, TypeScript, Node.js            |
| **Frontend**| React 18, React Router v6, Tailwind CSS v4, Vite, i18next    |
| **Database**| Cloud Firestore + Security Rules + Composite Indexes          |
| **Auth**   | Firebase Authentication (email/senha)                          |
| **Styling**| Neon cyberpunk: clip-path, glow effects, grid background       |
| **i18n**   | i18next + react-i18next (EN + PT-BR)                          |
| **Deploy** | Render.com (API + Static Site)                                 |
| **Scripts**| PowerShell (seed), TypeScript (seed data)                      |

---

## 13. Resumo

O MdavelCTF é uma plataforma CTF completa e gamificada, voltada para ensino de segurança da informação, com:

- **Gamificação rica**: XP, níveis, badges (12 tipos), quests semanais, ligas competitivas
- **Suporte educacional**: Turmas com instrutor, eventos privados, dashboard do instrutor
- **Sistema de times**: Times persistentes e por evento, chat interno, atividade compartilhada
- **Múltiplos modos de competição**: Standard, Unique (first-blood) e Decay
- **Segurança robusta**: Hash com pepper (HMAC-SHA256), rate limiting, cooldown, audit logs, Firestore rules
- **Frontend cyberpunk**: Design neon temático com personalização visual (temas por usuário e por turma)
- **Suporte bilíngue**: Inglês e Português do Brasil
- **Arquitetura moderna**: Monorepo TypeScript, tipos compartilhados, deploy automatizado no Render
