# MdavelCTF

A Jeopardy-style CTF (Capture The Flag) platform with a futuristic Cyber HUD interface.

## Architecture

**Monorepo** structure with three packages:

| Package | Stack | Purpose |
|---------|-------|---------|
| `shared/` | TypeScript | Shared types & constants |
| `apps/api/` | Node.js + Express + TypeScript | Backend API with Firebase Admin SDK |
| `apps/web/` | React + Vite + Tailwind CSS v4 | Frontend SPA |

**Key decisions:**
- **Express** over Fastify — better Firebase ecosystem support, more middleware options
- **Firestore** — powerful querying, granular security rules, native transactions
- **Tailwind CSS v4** — utility-first with CSS variables for dynamic theming
- **Firebase Auth** — email/password with custom claims for admin role

**Security:**
- Flags stored as HMAC-SHA256 hashes (never plaintext)
- Flag validation is server-only (Node API)
- Firestore rules block client writes to submissions/solves/leaderboards/analytics/secrets
- Rate limiting: 10 submits/min, 10s cooldown after wrong, 30 max attempts per challenge

---

## Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9
- **Firebase CLI**: `npm install -g firebase-tools`
- **Java** ≥ 11 (required by Firebase Emulators)

---

## Quick Start (Local Development)

### Step 1: Install dependencies

```bash
cd "CTF Mdavel"
npm install
cd shared && npm install && npm run build && cd ..
cd apps/api && npm install && cd ../..
cd apps/web && npm install && cd ../..
```

### Step 2: Start Firebase Emulators

```bash
npm run emu:clean
```

Wait until you see "All emulators ready". The Emulator UI will be at **http://localhost:4040**.

### Step 3: Run the Seed Script

Open a **new terminal**:

```bash
npm run seed
```

This creates:
- 1 admin user (`admin@mdavelctf.local` / `Admin#12345`)
- 4 participant users (`user1-4@mdavelctf.local` / `User#12345`)
- 2 teams (SYNAPSE, NULLPULSE)
- 1 league with 3 events (ENDED, LIVE, UPCOMING)
- 12 challenges with flags set
- Gameplay data: submissions, solves, leaderboards, analytics

### Step 4: Start API + Web

```bash
# Terminal 1 (API)
cd apps/api
npm run dev

# Terminal 2 (Web)
cd apps/web
npm run dev
```

Or use the combined command (requires emulators already running):

```bash
npm run dev:win
```

### Step 5: Open the App

Go to **http://localhost:3000** and login with:

| Account | Email | Password |
|---------|-------|----------|
| Admin | admin@mdavelctf.local | Admin#12345 |
| NeoByte | user1@mdavelctf.local | User#12345 |
| CipherCat | user2@mdavelctf.local | User#12345 |
| RootRaven | user3@mdavelctf.local | User#12345 |
| PacketPixie | user4@mdavelctf.local | User#12345 |

---

## Environment Variables

### API (`apps/api/.env`)

```env
# Local development
USE_EMULATORS=true
FIREBASE_PROJECT_ID=mdavelctf-local
PEPPER_SECRET=mdavel-dev-pepper-secret-2026
PORT=4000
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199

# Bootstrap admin (set for first run, remove after)
BOOTSTRAP_ADMIN_EMAIL=admin@mdavelctf.local
BOOTSTRAP_ADMIN_PASSWORD=Admin#12345

# Seed control
ALLOW_SEED=true
# SEED_TOKEN=mysecrettoken

# Production only (not needed with emulators)
# FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
# CORS_ORIGINS=https://mdavelctf-web.onrender.com
```

---

## Firestore Data Model

```
users/{uid}                           — User profile + theme
teams/{teamId}                        — Team metadata
teams/{teamId}/members/{uid}          — Team members
events/{eventId}                      — Event (start/end/published)
events/{eventId}/challenges/{id}      — Challenge details
events/{eventId}/submissions/{id}     — Submission logs
events/{eventId}/solves/{solveId}      — Solve records (idempotent)
events/{eventId}/leaderboards/{type}  — individual/teams
events/{eventId}/analytics/summary    — Event analytics
leagues/{leagueId}                    — League metadata
leagues/{leagueId}/standings/{type}   — Accumulated standings
leagues/{leagueId}/analytics/summary  — League analytics
serverSecrets/events/{id}/challengeSecrets/{id} — Flag hashes (SERVER ONLY)
auditLogs/{id}                        — Admin action logs
```

---

## API Endpoints

### Participant
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/submit-flag` | Submit a flag attempt |
| POST | `/api/team/create` | Create a team |
| POST | `/api/team/join` | Join team by code |
| POST | `/api/team/leave` | Leave current team |
| POST | `/api/team/rotate-code` | Rotate join code (captain) |
| GET | `/api/team/me` | Get my team info |

### Admin
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/admin/event` | Create event |
| PUT | `/api/admin/event/:id` | Update event |
| POST | `/api/admin/league` | Create league |
| PUT | `/api/admin/league/:id` | Update league |
| POST | `/api/admin/challenge` | Create challenge |
| PUT | `/api/admin/challenge/:id` | Update challenge |
| POST | `/api/admin/challenge/:id/set-flag` | Set flag hash |
| GET | `/api/admin/logs/submissions` | View submission logs |
| POST | `/api/admin/user/:uid/disable` | Disable user |
| POST | `/api/admin/user/:uid/enable` | Enable user |

---

## Theme Presets

| Name | Primary | Secondary |
|------|---------|-----------|
| Cyan | #00f0ff | #0077ff |
| Green | #39ff14 | #00b300 |
| Magenta | #ff00ff | #b300b3 |
| Amber | #ffbf00 | #ff8c00 |
| Red | #ff003c | #cc0000 |

Users can customize colors at `/settings/theme`.

---

## Production Deployment Notes

### Deploy on Render (Recommended)

MdavelCTF deploys as **two Render services** from a single monorepo using the included `render.yaml` Blueprint.

| Service | Type | Path |
|---------|------|------|
| `mdavelctf-api` | Web Service (Node) | `/apps/api` |
| `mdavelctf-web` | Static Site | `/apps/web` |

#### Prerequisites

1. A **Firebase project** at [console.firebase.google.com](https://console.firebase.google.com)
   - Enable **Firebase Auth** (Email/Password provider)
   - Create a **Firestore database**
   - Generate a **service account key** (Project Settings → Service Accounts → Generate)
2. A **Render account** at [render.com](https://render.com)
3. Your repo pushed to **GitHub** or **GitLab**

#### Step-by-Step

1. **Push to GitHub** — ensure the repo contains `render.yaml` at the root.

2. **Create Blueprint on Render:**
   - Go to Render Dashboard → **Blueprints** → **New Blueprint Instance**
   - Connect your GitHub repo
   - Render will auto-detect `render.yaml` and create both services

3. **Configure API environment variables** on Render (mdavelctf-api service):

   | Variable | Required | Description |
   |----------|----------|-------------|
   | `FIREBASE_PROJECT_ID` | ✅ | Your Firebase project ID |
   | `FIREBASE_SERVICE_ACCOUNT_JSON` | ✅ | Full JSON string of the service account key |
   | `PEPPER_SECRET` | ✅ | Secret for HMAC flag hashing (auto-generated by Blueprint) |
   | `CORS_ORIGINS` | ✅ | Comma-separated allowed origins, e.g. `https://mdavelctf-web.onrender.com` |
   | `BOOTSTRAP_ADMIN_EMAIL` | 🔸 | Initial admin email (set for first deploy, then remove) |
   | `BOOTSTRAP_ADMIN_PASSWORD` | 🔸 | Initial admin password (set for first deploy, then remove) |
   | `ALLOW_SEED` | ❌ | Set to `true` to enable seed button in Admin UI |
   | `SEED_TOKEN` | ❌ | Token for seed API auth (auto-generated by Blueprint) |
   | `PORT` | ❌ | Defaults to `4000` |
   | `NODE_ENV` | ❌ | Set to `production` |

4. **Configure Web environment variables** (mdavelctf-web service):

   | Variable | Required | Description |
   |----------|----------|-------------|
   | `VITE_API_BASE_URL` | ✅ | URL of the API service, e.g. `https://mdavelctf-api.onrender.com` |
   | `VITE_FIREBASE_API_KEY` | ✅ | Firebase Web API key |
   | `VITE_FIREBASE_AUTH_DOMAIN` | ✅ | e.g. `myproject.firebaseapp.com` |
   | `VITE_FIREBASE_PROJECT_ID` | ✅ | Firebase project ID |
   | `VITE_FIREBASE_STORAGE_BUCKET` | ✅ | e.g. `myproject.appspot.com` |
   | `VITE_FIREBASE_MESSAGING_SENDER_ID` | ✅ | Firebase messaging sender ID |
   | `VITE_FIREBASE_APP_ID` | ✅ | Firebase app ID |

5. **Deploy Firestore rules:**
   ```bash
   firebase deploy --only firestore:rules,firestore:indexes --project YOUR_PROJECT_ID
   firebase deploy --only storage --project YOUR_PROJECT_ID
   ```

6. **First boot:**
   - Set `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` before the first deploy
   - The API will automatically create the admin user on startup
   - After confirming the admin login works, **remove** those env vars from Render

7. **Seed data (optional):**
   - Set `ALLOW_SEED=true` on the API if you want the Admin Dashboard seed button
   - Log in as admin → Admin → Seed tab → choose mode (Minimal / Full) → Run Seed
   - Disable `ALLOW_SEED` after seeding in production

#### Alternative: Manual Deploy

1. Create a Firebase project and enable Auth (Email/Password) + Firestore
2. Deploy Firestore rules: `firebase deploy --only firestore:rules,firestore:indexes`
3. Deploy Storage rules: `firebase deploy --only storage`
4. Set a strong `PEPPER_SECRET` env var for production
5. Build: `npm install && npm run build`
6. Deploy API to any Node.js host (Cloud Run, Railway, etc.)
7. Deploy `apps/web/dist/` to any static host (Vercel, Netlify, Firebase Hosting, etc.)
8. Set all environment variables as listed above

---

## License

Private — MdavelCTF
