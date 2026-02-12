<p align="center">
  <img src="apps/web/public/brand/logo.png" alt="MdavelCTF Logo" width="120" />
</p>

<h1 align="center">MdavelCTF</h1>

<p align="center">
  Plataforma Jeopardy-style Capture The Flag com interface Cyber HUD futurista.<br/>
  Ideal para competições acadêmicas, treinamentos de cibersegurança e eventos organizados por turma.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react" />
  <img src="https://img.shields.io/badge/Vite-6-646CFF?logo=vite" />
  <img src="https://img.shields.io/badge/Express-4-000000?logo=express" />
  <img src="https://img.shields.io/badge/Firebase-Auth%20%2B%20Firestore-FFCA28?logo=firebase" />
  <img src="https://img.shields.io/badge/Render-Deploy-46E3B7?logo=render" />
  <img src="https://img.shields.io/badge/i18n-EN%20%7C%20PT--BR-blue" />
</p>

---

## Funcionalidades

### Participante

- **Registro e Login** — email/senha via Firebase Auth, reset de senha por e-mail
- **Perfil** — editar nome, bio, curso, turma, unidade, idioma e avatar (base64)
- **Perfis públicos** — visualizar perfil, badges, XP e nível de outros jogadores
- **Submissão de flags** — modal terminal-style com validação server-side (HMAC-SHA256)
- **Navegar eventos** — eventos ao vivo, próximos e encerrados agrupados na home
- **Detalhe do evento** — lista de challenges filtráveis por categoria com countdown
- **Detalhe do challenge** — descrição em Markdown, anexos, submissão de flag
- **Scoreboard** — individual e por equipe, gráficos de solves e retenção
- **Ligas** — standings acumulados de múltiplos eventos
- **Turmas** — entrar em turma via código de convite, ver membros e eventos

### Equipes

- **Equipes públicas** — criar, entrar via código, chat em tempo real, feed de atividade
- **Equipes por evento** — criar/entrar em equipe scoped a um evento específico
- **Controles do capitão** — rotacionar código, editar perfil da equipe, transferir liderança

### Gamificação

- **Sistema de XP** — XP por solve (pontos × 2) + recompensas de badges
- **Níveis** — calculados automaticamente: `1 + floor(sqrt(xp / 200))`
- **12 Badges padrão** — First Blood, Pentakill, Veteran, Elite, Versatile, Full-Spectrum, Team Player, Web Master, Crypto Breaker, Forensics Expert, Speed Demon, Night Owl
- **4 Raridades** — Common, Rare, Epic, Legendary (cada uma com cor distinta)
- **Quests** — missões temporais com 3 tipos de regra: `solve_total`, `solve_category`, `participate_event`
- **Auto-award** — badges concedidos automaticamente após cada solve
- **Recomputar stats** — recalcular solves/submissions/badges a partir de todos os eventos

### Admin

- **Dashboard em tempo real** — usuários ativos, submissões/solves últimos 60min, solve rate, top challenges, top users, atividade recente
- **CRUD completo** — eventos, ligas, challenges, flags, badges, quests
- **Gestão de flags** — flags armazenadas como HMAC-SHA256 (nunca plaintext), suporte a case-sensitive
- **Logs paginados** — submissões e solves com filtros (evento, challenge, uid, correctOnly)
- **Gestão de usuários** — desabilitar/reabilitar contas
- **Seed on demand** — modo Minimal ou Full via botão no Admin UI + clear de dados
- **Auditoria** — todas as ações admin logadas com snapshots before/after
- **Guia interativo** — documentação built-in em accordion no painel Admin

### Instrutor

- **Dashboard dedicado** — tabs: Minhas Turmas, Criar Evento, Guia
- **Criar turma** — com código de convite gerado automaticamente
- **Gerenciar membros** — remover alunos, rotacionar código de convite
- **Criar eventos vinculados** — eventos privados scoped a uma turma

### Temas

| Preset | Cor primária |
|--------|-------------|
| Neon Cyan | `#00f0ff` |
| Matrix Green | `#39ff14` |
| Magenta Punk | `#ff00ff` |
| Amber Terminal | `#ffbf00` |
| Red Alert | `#ff003c` |

- 5 presets + cores custom (accent, accent2, panelBg)
- Validação de contraste via `isThemeReadable()`
- Persistido no Firestore por usuário
- Injeção de CSS variables em runtime

### Internacionalização (i18n)

- **Idiomas:** Inglês (en) e Português Brasileiro (pt-BR) — 254 chaves cada
- **Persistência:** `localStorage` + campo `locale` no Firestore
- **Fallback:** English

### Segurança

- Firebase Auth com token verification no middleware
- Role-based access control (participant/instructor/admin)
- Flags HMAC-SHA256 com `PEPPER_SECRET` (nunca plaintext)
- Rate limiting: 10 submits/min, cooldown 10s após erro, máximo 30 tentativas por challenge
- IP e User-Agent hasheados (SHA-256 truncado) nos logs
- Firestore rules bloqueiam escrita client em submissions/solves/leaderboards/secrets
- Helmet.js para headers HTTP de segurança
- CORS configurável via `CORS_ORIGINS`
- `X-Frame-Options: DENY` no static site
- Prevenção de double-solve via transações Firestore
- Body limit de 1MB no Express

---

## Arquitetura

```
mdavelctf/
├── shared/          → Tipos TypeScript, constantes, utility functions
├── apps/
│   ├── api/         → Node.js + Express + Firebase Admin SDK
│   └── web/         → React 18 + Vite 6 + Tailwind CSS v4
├── firebase/        → Firestore rules & indexes
├── firebase-data/   → Dados do emulador local
├── scripts/         → Seed script local
└── render.yaml      → Blueprint para deploy no Render
```

| Pacote | Stack | Propósito |
|--------|-------|-----------|
| `shared/` | TypeScript | Tipos compartilhados, XP/level formulas, theme presets, default badges |
| `apps/api/` | Express + TypeScript + firebase-admin | API REST, autenticação, flag validation, gamificação |
| `apps/web/` | React + Vite + Tailwind CSS v4 + i18next | SPA com interface Cyber HUD |

---

## Modelo de Dados (Firestore)

```
users/{uid}                                     — Perfil + tema + stats
teams/{teamId}                                  — Metadados da equipe
teams/{teamId}/members/{uid}                    — Membros
teams/{teamId}/messages/{msgId}                 — Chat da equipe
classes/{classId}                               — Turmas
classes/{classId}/members/{uid}                 — Membros da turma
events/{eventId}                                — Evento (start/end/published)
events/{eventId}/challenges/{id}                — Challenges
events/{eventId}/submissions/{id}               — Log de submissões
events/{eventId}/solves/{solveId}               — Solves (idempotent)
events/{eventId}/leaderboards/{type}            — individual / teams
events/{eventId}/analytics/summary              — Analytics do evento
leagues/{leagueId}                              — Ligas
leagues/{leagueId}/standings/{type}             — Standings acumulados
leagues/{leagueId}/analytics/summary            — Analytics da liga
badges/{badgeId}                                — Catálogo de badges
quests/{questId}                                — Quests ativas
quests/{questId}/progress/{uid}                 — Progresso por user
serverSecrets/events/{id}/challengeSecrets/{id} — Flag hashes (SERVER ONLY)
auditLogs/{id}                                  — Logs de auditoria admin
```

---

## API Endpoints

### Health
| Método | Path | Descrição |
|--------|------|-----------|
| GET | `/health` | Health check |

### Participante
| Método | Path | Descrição |
|--------|------|-----------|
| POST | `/api/submit-flag` | Submeter flag |
| GET | `/api/profile/me` | Meu perfil |
| GET | `/api/profile/:uid` | Perfil público |
| POST | `/api/profile/update` | Atualizar perfil |
| POST | `/api/profile/avatar` | Upload de avatar (base64) |

### Equipes
| Método | Path | Descrição |
|--------|------|-----------|
| POST | `/api/team/create` | Criar equipe |
| POST | `/api/team/join` | Entrar via código |
| POST | `/api/team/leave` | Sair da equipe |
| POST | `/api/team/rotate-code` | Rotacionar código (capitão) |
| POST | `/api/team/update` | Editar equipe (capitão) |
| GET | `/api/team/me` | Minha equipe |
| GET | `/api/team/activity` | Feed de atividade |
| POST | `/api/team/chat/send` | Enviar mensagem no chat |
| GET | `/api/team/chat` | Ler mensagens do chat |

### Equipes por Evento
| Método | Path | Descrição |
|--------|------|-----------|
| POST | `/api/event-teams/create` | Criar equipe no evento |
| POST | `/api/event-teams/join` | Entrar via código + eventId |
| POST | `/api/event-teams/leave` | Sair |
| GET | `/api/event-teams/me?eventId=` | Minha equipe no evento |

### Turmas
| Método | Path | Descrição |
|--------|------|-----------|
| POST | `/api/classes/create` | Criar turma |
| POST | `/api/classes/join` | Entrar via código |
| GET | `/api/classes/my` | Minhas turmas |
| GET | `/api/classes/:classId` | Detalhe da turma |
| POST | `/api/classes/:classId/remove-member` | Remover membro |
| POST | `/api/classes/:classId/rotate-code` | Rotacionar código |

### Gamificação
| Método | Path | Descrição |
|--------|------|-----------|
| GET | `/api/gamification/badges` | Catálogo de badges |
| GET | `/api/gamification/quests` | Quests ativas + progresso |
| POST | `/api/gamification/recompute-my-stats` | Recomputar stats |

### Admin
| Método | Path | Descrição |
|--------|------|-----------|
| GET | `/api/admin/config` | Config do admin |
| GET | `/api/admin/dashboard/summary` | Dashboard em tempo real |
| POST | `/api/admin/event` | Criar evento |
| PUT | `/api/admin/event/:id` | Atualizar evento |
| POST | `/api/admin/league` | Criar liga |
| PUT | `/api/admin/league/:id` | Atualizar liga |
| POST | `/api/admin/challenge` | Criar challenge |
| PUT | `/api/admin/challenge/:id` | Atualizar challenge |
| POST | `/api/admin/challenge/:id/set-flag` | Definir flag (HMAC hash) |
| GET | `/api/admin/logs/submissions` | Logs de submissões |
| GET | `/api/admin/logs/solves` | Logs de solves |
| POST | `/api/admin/user/:uid/disable` | Desabilitar usuário |
| POST | `/api/admin/user/:uid/enable` | Reabilitar usuário |
| POST | `/api/admin/badges/seed-default` | Seed de badges padrão |
| POST | `/api/admin/quests/seed-default` | Seed de quests padrão |
| POST | `/api/admin/seed/run` | Seed de dados (minimal/full) |
| POST | `/api/admin/seed/clear` | Limpar dados seed |

---

## Pré-requisitos (Local)

- **Node.js** ≥ 18
- **npm** ≥ 9
- **Firebase CLI**: `npm install -g firebase-tools`
- **Java** ≥ 11 (necessário para Firebase Emulators)

---

## Quick Start (Desenvolvimento Local)

### 1. Instalar dependências

```bash
npm install
npm --prefix shared run build
```

### 2. Iniciar Firebase Emulators

```bash
npm run emu:clean
```

Aguarde até ver "All emulators ready". Emulator UI em **http://localhost:4040**.

### 3. Seed (novo terminal)

```bash
npm run seed
```

Cria automaticamente:
- 1 admin (`admin@mdavelctf.local` / `Admin#12345`)
- 1 instrutor + 4 participantes
- 2 equipes, 1 liga, 3 eventos, 12 challenges
- Submissões, solves, leaderboards, analytics

### 4. Iniciar API + Web

```bash
npm run dev:win
```

Ou em terminais separados:

```bash
# Terminal 1
cd apps/api && npm run dev

# Terminal 2
cd apps/web && npm run dev
```

### 5. Abrir o App

**http://localhost:3000**

| Conta | Email | Senha |
|-------|-------|-------|
| Admin | `admin@mdavelctf.local` | `Admin#12345` |
| Instructor | `instructor@mdavelctf.local` | `Instructor#12345` |
| NeoByte | `user1@mdavelctf.local` | `User#12345` |
| CipherCat | `user2@mdavelctf.local` | `User#12345` |
| RootRaven | `user3@mdavelctf.local` | `User#12345` |
| PacketPixie | `user4@mdavelctf.local` | `User#12345` |

---

## Variáveis de Ambiente

### API (`apps/api/.env`)

```env
# ── Desenvolvimento local ──
USE_EMULATORS=true
FIREBASE_PROJECT_ID=mdavelctf-local
PEPPER_SECRET=mdavel-dev-pepper-secret-2026
PORT=4000
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080

# Bootstrap admin (primeira execução)
BOOTSTRAP_ADMIN_EMAIL=admin@mdavelctf.local
BOOTSTRAP_ADMIN_PASSWORD=Admin#12345

# Seed
ALLOW_SEED=true

# ── Produção ──
# FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
# CORS_ORIGINS=https://mdavelctf.onrender.com
```

### Web (`apps/web/.env`)

```env
VITE_API_BASE_URL=http://localhost:4000
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

---

## Deploy no Render

MdavelCTF faz deploy como **dois serviços** via `render.yaml` Blueprint.

| Serviço | Tipo | URL |
|---------|------|-----|
| `mdavelctf-api` | Web Service (Node.js, free) | `https://mdavelctf-api.onrender.com` |
| `mdavelctf` | Static Site | `https://mdavelctf.onrender.com` |

### Pré-requisitos

1. **Projeto Firebase** em [console.firebase.google.com](https://console.firebase.google.com):
   - Ativar **Firebase Auth** (Email/Password)
   - Criar **Firestore database**
   - Gerar **service account key** (Project Settings → Service Accounts → Generate)
2. **Conta Render** em [render.com](https://render.com)
3. Repositório no **GitHub**

### Passo a Passo

1. **Criar Blueprint no Render:**
   - Dashboard → **Blueprints** → **New Blueprint Instance**
   - Conectar repositório GitHub
   - Render detecta `render.yaml` e cria ambos os serviços

2. **Configurar variáveis do API** (`mdavelctf-api`):

   | Variável | Obrig. | Descrição |
   |----------|--------|-----------|
   | `FIREBASE_PROJECT_ID` | ✅ | ID do projeto Firebase |
   | `FIREBASE_SERVICE_ACCOUNT_JSON` | ✅ | JSON completo da service account key |
   | `PEPPER_SECRET` | ✅ | Auto-gerado pelo Blueprint |
   | `CORS_ORIGINS` | ✅ | Ex: `https://mdavelctf.onrender.com` |
   | `BOOTSTRAP_ADMIN_EMAIL` | 🔸 | Email do admin inicial (remover após 1º boot) |
   | `BOOTSTRAP_ADMIN_PASSWORD` | 🔸 | Senha do admin inicial (remover após 1º boot) |
   | `ALLOW_SEED` | — | `true` para habilitar seed via Admin UI |
   | `SEED_TOKEN` | — | Auto-gerado pelo Blueprint |

3. **Configurar variáveis do Web** (`mdavelctf`):

   | Variável | Obrig. | Descrição |
   |----------|--------|-----------|
   | `VITE_API_BASE_URL` | ✅ | Ex: `https://mdavelctf-api.onrender.com` |
   | `VITE_FIREBASE_API_KEY` | ✅ | API key do Firebase Web |
   | `VITE_FIREBASE_AUTH_DOMAIN` | ✅ | Ex: `myproject.firebaseapp.com` |
   | `VITE_FIREBASE_PROJECT_ID` | ✅ | ID do projeto Firebase |
   | `VITE_FIREBASE_MESSAGING_SENDER_ID` | ✅ | Messaging sender ID |
   | `VITE_FIREBASE_APP_ID` | ✅ | Firebase App ID |

4. **Deploy Firestore rules:**
   ```bash
   firebase deploy --only firestore:rules,firestore:indexes --project SEU_PROJECT_ID
   ```

5. **Primeiro boot:**
   - Definir `BOOTSTRAP_ADMIN_EMAIL` e `BOOTSTRAP_ADMIN_PASSWORD` antes do primeiro deploy
   - API cria o admin automaticamente ao iniciar
   - Após confirmar login, **remover** essas env vars do Render

6. **Seed (opcional):**
   - Com `ALLOW_SEED=true`, o admin pode usar Admin → Seed para popular dados demo
   - Escolher modo **Minimal** (estrutura básica) ou **Full** (dados completos com gameplay)
   - Botão **Clear** limpa todos os dados seed (mantém apenas admin)

### Deploy Manual (Alternativo)

1. Criar projeto Firebase + ativar Auth + Firestore
2. Deploy rules: `firebase deploy --only firestore:rules,firestore:indexes`
3. Definir `PEPPER_SECRET` forte para produção
4. Build: `npm install && npm run build`
5. Deploy API em qualquer host Node.js (Cloud Run, Railway, etc.)
6. Deploy `apps/web/dist/` em qualquer host estático (Vercel, Netlify, etc.)
7. Configurar todas as variáveis de ambiente listadas acima

---

## Scripts

| Comando | Descrição |
|---------|-----------|
| `npm install` | Instala todas as dependências (workspaces) |
| `npm run build` | Build de shared + api + web |
| `npm run dev` | Inicia emulators + api + web (Linux/Mac) |
| `npm run dev:win` | Inicia api + web (Windows, emulators já rodando) |
| `npm run emu` | Emulators com import/export de dados |
| `npm run emu:clean` | Emulators com banco limpo |
| `npm run seed` | Seed de dados via script local |

---

## Tecnologias

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18, Vite 6, Tailwind CSS v4, React Router 7, react-i18next |
| Backend | Node.js, Express 4, TypeScript, firebase-admin SDK |
| Database | Cloud Firestore |
| Auth | Firebase Authentication (Email/Password) |
| Deploy | Render (Web Service + Static Site) |
| Monorepo | npm workspaces |

---

## Licença

Privado — MdavelCTF
