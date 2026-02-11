/**
 * MdavelCTF Seed Script
 * Runs against Firebase Emulator Suite to populate demo data.
 *
 * Usage: npm run seed
 *
 * Requirements:
 *   - Firebase emulators running (npm run emu)
 *   - Environment vars set for emulator hosts
 */

import * as admin from 'firebase-admin';
import * as crypto from 'crypto';

// ─── Emulator config ───
const PROJECT_ID = 'mdavelctf-local';
const PEPPER_SECRET = 'mdavel-dev-pepper-secret-2026';

process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199';

admin.initializeApp({ projectId: PROJECT_ID });
const authAdmin = admin.auth();
const db = admin.firestore();

// ─── Helpers ───
function normalizeFlag(raw: string, caseSensitive: boolean): string {
  let flag = raw.trim().normalize('NFKC');
  if (!caseSensitive) flag = flag.toLowerCase();
  return flag;
}

function hashFlag(normalizedFlag: string): string {
  return crypto.createHmac('sha256', PEPPER_SECRET).update(normalizedFlag).digest('hex');
}

function generateJoinCode(): string {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

async function createUser(
  email: string,
  password: string,
  displayName: string,
  role: 'admin' | 'participant' | 'instructor',
  themePreset: { accent: string; accent2: string },
): Promise<string> {
  let userRecord;
  try {
    userRecord = await authAdmin.createUser({
      email,
      password,
      displayName,
      emailVerified: true,
    });
  } catch (err: any) {
    // User might exist from previous run
    if (err.code === 'auth/email-already-exists') {
      userRecord = await authAdmin.getUserByEmail(email);
    } else {
      throw err;
    }
  }

  // Set custom claims
  await authAdmin.setCustomUserClaims(userRecord.uid, { admin: role === 'admin' });

  // Create Firestore user doc
  await db.collection('users').doc(userRecord.uid).set({
    displayName,
    role,
    disabled: false,
    teamId: null,
    theme: themePreset,
    createdAt: new Date().toISOString(),
    avatarUrl: null,
    bio: '',
    course: '',
    classGroup: '',
    unit: '',
    xp: 0,
    level: 1,
    badges: [],
    stats: {
      solvesTotal: 0,
      correctSubmissions: 0,
      wrongSubmissions: 0,
      solvesByCategory: {},
    },
  });

  console.log(`  ✓ User: ${displayName} (${email}) uid=${userRecord.uid}`);
  return userRecord.uid;
}

async function main() {
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║     MdavelCTF Seed Script            ║');
  console.log('╚══════════════════════════════════════╝\n');

  // ═══════════════════════════════════════
  // STEP 1: Create Users
  // ═══════════════════════════════════════
  console.log('📦 Step 1: Creating users...');

  const adminUid = await createUser(
    'admin@mdavelctf.local', 'Admin#12345', 'Admin Mdavel', 'admin',
    { accent: '#00f0ff', accent2: '#0077ff' },
  );

  const user1Uid = await createUser(
    'user1@mdavelctf.local', 'User#12345', 'NeoByte', 'participant',
    { accent: '#00f0ff', accent2: '#0077ff' }, // cyan
  );

  const user2Uid = await createUser(
    'user2@mdavelctf.local', 'User#12345', 'CipherCat', 'participant',
    { accent: '#39ff14', accent2: '#00b300' }, // green
  );

  const user3Uid = await createUser(
    'user3@mdavelctf.local', 'User#12345', 'RootRaven', 'participant',
    { accent: '#ff00ff', accent2: '#b300b3' }, // magenta
  );

  const user4Uid = await createUser(
    'user4@mdavelctf.local', 'User#12345', 'PacketPixie', 'participant',
    { accent: '#ffbf00', accent2: '#ff8c00' }, // amber
  );

  // ═══════════════════════════════════════
  // STEP 2: Create Teams
  // ═══════════════════════════════════════
  console.log('\n📦 Step 2: Creating teams...');

  const teamAId = 'teamSynapse';
  const teamACode = generateJoinCode();
  await db.collection('teams').doc(teamAId).set({
    name: 'SYNAPSE',
    joinCode: teamACode,
    captainUid: user1Uid,
    memberCount: 2,
    createdAt: new Date().toISOString(),
    avatarUrl: null,
    description: 'Elite exploit developers and web security enthusiasts.',
    tagline: 'Connecting the dots, one byte at a time.',
    stats: { scoreEvent: 0, scoreLeague: 0, solvesTotal: 0 },
  });
  await db.collection('teams').doc(teamAId).collection('members').doc(user1Uid).set({
    role: 'captain', joinedAt: new Date().toISOString(),
  });
  await db.collection('teams').doc(teamAId).collection('members').doc(user2Uid).set({
    role: 'member', joinedAt: new Date().toISOString(),
  });
  await db.collection('users').doc(user1Uid).update({ teamId: teamAId });
  await db.collection('users').doc(user2Uid).update({ teamId: teamAId });
  console.log(`  ✓ Team SYNAPSE (code: ${teamACode})`);

  const teamBId = 'teamNullpulse';
  const teamBCode = generateJoinCode();
  await db.collection('teams').doc(teamBId).set({
    name: 'NULLPULSE',
    joinCode: teamBCode,
    captainUid: user3Uid,
    memberCount: 2,
    createdAt: new Date().toISOString(),
    avatarUrl: null,
    description: 'Reverse engineers and binary exploitation specialists.',
    tagline: 'From zero to root in 60 seconds.',
    stats: { scoreEvent: 0, scoreLeague: 0, solvesTotal: 0 },
  });
  await db.collection('teams').doc(teamBId).collection('members').doc(user3Uid).set({
    role: 'captain', joinedAt: new Date().toISOString(),
  });
  await db.collection('teams').doc(teamBId).collection('members').doc(user4Uid).set({
    role: 'member', joinedAt: new Date().toISOString(),
  });
  await db.collection('users').doc(user3Uid).update({ teamId: teamBId });
  await db.collection('users').doc(user4Uid).update({ teamId: teamBId });
  console.log(`  ✓ Team NULLPULSE (code: ${teamBCode})`);

  // ═══════════════════════════════════════
  // STEP 3: Create Events + Challenges
  // ═══════════════════════════════════════
  console.log('\n📦 Step 3: Creating events and challenges...');

  const now = Date.now();
  const DAY = 86400000;
  const HOUR = 3600000;
  const MIN = 60000;

  // Event IDs
  const event1Id = 'evt-warmup';
  const event2Id = 'evt-weekly1';
  const event3Id = 'evt-weekly2';

  // League
  const leagueId = 'league-s01';
  await db.collection('leagues').doc(leagueId).set({
    name: 'Mdavel League — Season 01',
    startsAt: new Date(now - 7 * DAY).toISOString(),
    endsAt: new Date(now + 60 * DAY).toISOString(),
    published: true,
    eventIds: [event1Id, event2Id, event3Id],
    createdAt: new Date().toISOString(),
  });
  console.log('  ✓ League: Mdavel League — Season 01');

  // ─── Event 1: Warmup CTF (ENDED) ───
  await db.collection('events').doc(event1Id).set({
    name: 'Warmup CTF',
    startsAt: new Date(now - 2 * DAY).toISOString(),
    endsAt: new Date(now - 1 * DAY).toISOString(),
    timezone: 'UTC',
    published: true,
    leagueId,
    createdAt: new Date().toISOString(),
  });
  console.log('  ✓ Event 1: Warmup CTF (ENDED)');

  const e1Challenges = [
    {
      id: 'e1c1', title: 'Hello Web', category: 'WEB', difficulty: 1,
      pointsFixed: 50, tags: ['http', 'beginner'],
      descriptionMd: '## Hello Web\n\nCheck the page source for a hidden comment.\n\n```\nHint: View Source\n```',
      flag: 'CTF{mdavel_warmup_web_01}',
    },
    {
      id: 'e1c2', title: 'Caesar Salad', category: 'CRYPTO', difficulty: 1,
      pointsFixed: 75, tags: ['caesar', 'classical'],
      descriptionMd: '## Caesar Salad\n\nDecrypt this: `PGS{zqniry_jnezhc_pelcgb_02}`\n\nThe shift is classic.',
      flag: 'CTF{mdavel_warmup_crypto_02}',
    },
    {
      id: 'e1c3', title: 'File Header', category: 'FORENSICS', difficulty: 2,
      pointsFixed: 100, tags: ['magic-bytes', 'file-analysis'],
      descriptionMd: '## File Header\n\nIdentify the file type from its magic bytes:\n\n`89 50 4E 47 0D 0A 1A 0A`\n\nThe flag is the file extension wrapped in flag format.',
      flag: 'CTF{mdavel_warmup_forensics_03}',
    },
  ];

  for (const c of e1Challenges) {
    await db.collection('events').doc(event1Id).collection('challenges').doc(c.id).set({
      title: c.title, category: c.category, difficulty: c.difficulty,
      pointsFixed: c.pointsFixed, tags: c.tags, descriptionMd: c.descriptionMd,
      attachments: [], published: true,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    const normalized = normalizeFlag(c.flag, false);
    await db.collection('events').doc(event1Id).collection('challengeSecrets').doc(c.id).set({
      flagHash: hashFlag(normalized), caseSensitive: false, createdAt: new Date().toISOString(),
    });
  }
  console.log(`    → ${e1Challenges.length} challenges created`);

  // ─── Event 2: Weekly CTF #1 (LIVE) ───
  await db.collection('events').doc(event2Id).set({
    name: 'Weekly CTF #1',
    startsAt: new Date(now - 30 * MIN).toISOString(),
    endsAt: new Date(now + 2 * HOUR).toISOString(),
    timezone: 'UTC',
    published: true,
    leagueId,
    createdAt: new Date().toISOString(),
  });
  console.log('  ✓ Event 2: Weekly CTF #1 (LIVE)');

  const e2Challenges = [
    {
      id: 'e2c1', title: 'SQL Injection 101', category: 'WEB', difficulty: 2,
      pointsFixed: 100, tags: ['sqli', 'auth-bypass'],
      descriptionMd: '## SQL Injection 101\n\nThe login form is vulnerable to SQL injection.\n\nBypass authentication and find the flag in the admin panel.\n\n**Target:** `http://challenge.local:8080/login`',
      flag: 'CTF{mdavel_weekly1_web_01}',
    },
    {
      id: 'e2c2', title: 'RSA Basics', category: 'CRYPTO', difficulty: 3,
      pointsFixed: 150, tags: ['rsa', 'factoring'],
      descriptionMd: '## RSA Basics\n\nGiven:\n- n = 3233\n- e = 17\n- ciphertext = 2790\n\nFactor n and decrypt the message.',
      flag: 'CTF{mdavel_weekly1_crypto_02}',
    },
    {
      id: 'e2c3', title: 'Hidden Layers', category: 'FORENSICS', difficulty: 2,
      pointsFixed: 100, tags: ['steganography', 'image'],
      descriptionMd: '## Hidden Layers\n\nExtract the hidden message from the provided PNG file.\n\nTools: `zsteg`, `binwalk`, or `strings`',
      flag: 'CTF{mdavel_weekly1_forensics_03}',
    },
    {
      id: 'e2c4', title: 'GeoGuesser', category: 'OSINT', difficulty: 2,
      pointsFixed: 100, tags: ['geolocation', 'image-analysis'],
      descriptionMd: '## GeoGuesser\n\nIdentify the location shown in this satellite image.\n\nThe flag is the city name in flag format.',
      flag: 'CTF{mdavel_weekly1_osint_04}',
    },
    {
      id: 'e2c5', title: 'Buffer Overflow 101', category: 'PWN', difficulty: 4,
      pointsFixed: 200, tags: ['bof', 'stack', 'x86'],
      descriptionMd: '## Buffer Overflow 101\n\nA classic stack-based buffer overflow.\n\n```c\nvoid vulnerable() {\n  char buf[64];\n  gets(buf); // uh oh\n}\n```\n\nOverflow the buffer and call `win()`.',
      flag: 'CTF{mdavel_weekly1_pwn_05}',
    },
  ];

  for (const c of e2Challenges) {
    await db.collection('events').doc(event2Id).collection('challenges').doc(c.id).set({
      title: c.title, category: c.category, difficulty: c.difficulty,
      pointsFixed: c.pointsFixed, tags: c.tags, descriptionMd: c.descriptionMd,
      attachments: [], published: true,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    const normalized = normalizeFlag(c.flag, false);
    await db.collection('events').doc(event2Id).collection('challengeSecrets').doc(c.id).set({
      flagHash: hashFlag(normalized), caseSensitive: false, createdAt: new Date().toISOString(),
    });
  }
  console.log(`    → ${e2Challenges.length} challenges created`);

  // ─── Event 3: Weekly CTF #2 (UPCOMING) ───
  await db.collection('events').doc(event3Id).set({
    name: 'Weekly CTF #2',
    startsAt: new Date(now + 3 * DAY).toISOString(),
    endsAt: new Date(now + 3 * DAY + 3 * HOUR).toISOString(),
    timezone: 'UTC',
    published: true,
    leagueId,
    createdAt: new Date().toISOString(),
  });
  console.log('  ✓ Event 3: Weekly CTF #2 (UPCOMING)');

  const e3Challenges = [
    {
      id: 'e3c1', title: 'XSS Playground', category: 'WEB', difficulty: 3,
      pointsFixed: 150, tags: ['xss', 'dom'],
      descriptionMd: '## XSS Playground\n\nFind a reflected XSS vulnerability and steal the admin cookie.\n\nThe flag is in the cookie.',
      flag: 'CTF{mdavel_weekly2_web_01}',
    },
    {
      id: 'e3c2', title: 'Vigenère Vault', category: 'CRYPTO', difficulty: 3,
      pointsFixed: 150, tags: ['vigenere', 'frequency-analysis'],
      descriptionMd: '## Vigenère Vault\n\nBreak the Vigenère cipher with the given ciphertext.\n\nKey length is 5 characters.',
      flag: 'CTF{mdavel_weekly2_crypto_02}',
    },
    {
      id: 'e3c3', title: 'Reverse Me', category: 'REV', difficulty: 4,
      pointsFixed: 200, tags: ['binary', 'x86', 'disassembly'],
      descriptionMd: '## Reverse Me\n\nReverse engineer the binary to find the correct input.\n\nTools: Ghidra, IDA, radare2',
      flag: 'CTF{mdavel_weekly2_rev_03}',
    },
    {
      id: 'e3c4', title: 'Memory Dump', category: 'FORENSICS', difficulty: 3,
      pointsFixed: 150, tags: ['volatility', 'memory'],
      descriptionMd: '## Memory Dump\n\nAnalyze the memory dump and find the password used for login.\n\nTool: Volatility 3',
      flag: 'CTF{mdavel_weekly2_forensics_04}',
    },
  ];

  for (const c of e3Challenges) {
    await db.collection('events').doc(event3Id).collection('challenges').doc(c.id).set({
      title: c.title, category: c.category, difficulty: c.difficulty,
      pointsFixed: c.pointsFixed, tags: c.tags, descriptionMd: c.descriptionMd,
      attachments: [], published: true,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    const normalized = normalizeFlag(c.flag, false);
    await db.collection('events').doc(event3Id).collection('challengeSecrets').doc(c.id).set({
      flagHash: hashFlag(normalized), caseSensitive: false, createdAt: new Date().toISOString(),
    });
  }
  console.log(`    → ${e3Challenges.length} challenges created`);

  // ═══════════════════════════════════════
  // STEP 4: Seed Gameplay Data (Event 2 — LIVE)
  // ═══════════════════════════════════════
  console.log('\n📦 Step 4: Seeding gameplay data for Event 2...');

  const baseTime = new Date(now - 20 * MIN);

  // Submission helper
  async function addSubmission(
    uid: string, teamId: string | null, challengeId: string,
    isCorrect: boolean, attemptNum: number, minuteOffset: number,
  ) {
    const submittedAt = new Date(baseTime.getTime() + minuteOffset * MIN).toISOString();
    await db.collection('events').doc(event2Id).collection('submissions').add({
      uid, teamId, challengeId, submittedAt, isCorrect, attemptNumber: attemptNum,
    });
    return submittedAt;
  }

  async function addSolve(
    uid: string, teamId: string | null, challengeId: string,
    pointsAwarded: number, solvedAt: string,
  ) {
    const solveId = `${uid}_${challengeId}`;
    await db.collection('events').doc(event2Id).collection('solves').doc(solveId).set({
      solveId, uid, teamId, challengeId, solvedAt, pointsAwarded,
    });
  }

  // NeoByte: solves e2c1 (100pts) and e2c2 (150pts)
  await addSubmission(user1Uid, teamAId, 'e2c1', false, 1, 1);
  const neo1 = await addSubmission(user1Uid, teamAId, 'e2c1', true, 2, 3);
  await addSolve(user1Uid, teamAId, 'e2c1', 100, neo1);

  const neo2 = await addSubmission(user1Uid, teamAId, 'e2c2', true, 1, 5);
  await addSolve(user1Uid, teamAId, 'e2c2', 150, neo2);

  // CipherCat: solves e2c3 (100pts)
  await addSubmission(user2Uid, teamAId, 'e2c3', false, 1, 2);
  const cc1 = await addSubmission(user2Uid, teamAId, 'e2c3', true, 2, 6);
  await addSolve(user2Uid, teamAId, 'e2c3', 100, cc1);

  // RootRaven: solves e2c1 (100), e2c2 (150), e2c5 (200)
  const rr1 = await addSubmission(user3Uid, teamBId, 'e2c1', true, 1, 2);
  await addSolve(user3Uid, teamBId, 'e2c1', 100, rr1);

  const rr2 = await addSubmission(user3Uid, teamBId, 'e2c2', true, 1, 4);
  await addSolve(user3Uid, teamBId, 'e2c2', 150, rr2);

  await addSubmission(user3Uid, teamBId, 'e2c5', false, 1, 7);
  const rr3 = await addSubmission(user3Uid, teamBId, 'e2c5', true, 2, 10);
  await addSolve(user3Uid, teamBId, 'e2c5', 200, rr3);

  // PacketPixie: solves e2c4 (100pts)
  const pp1 = await addSubmission(user4Uid, teamBId, 'e2c4', true, 1, 8);
  await addSolve(user4Uid, teamBId, 'e2c4', 100, pp1);

  console.log('  ✓ 10 submissions + 7 solves created');

  // ═══════════════════════════════════════
  // STEP 5: Build Leaderboards + Analytics
  // ═══════════════════════════════════════
  console.log('\n📦 Step 5: Building leaderboards and analytics...');

  // Individual leaderboard
  const individualRows = [
    { uid: user3Uid, displayName: 'RootRaven', score: 450, lastSolveAt: rr3 },
    { uid: user1Uid, displayName: 'NeoByte', score: 250, lastSolveAt: neo2 },
    { uid: user2Uid, displayName: 'CipherCat', score: 100, lastSolveAt: cc1 },
    { uid: user4Uid, displayName: 'PacketPixie', score: 100, lastSolveAt: pp1 },
  ];

  // Team leaderboard
  // SYNAPSE: NeoByte(250) + CipherCat(100) = 350
  // NULLPULSE: RootRaven(450) + PacketPixie(100) = 550
  const teamRows = [
    { teamId: teamBId, teamName: 'NULLPULSE', score: 550, lastSolveAt: rr3 },
    { teamId: teamAId, teamName: 'SYNAPSE', score: 350, lastSolveAt: cc1 },
  ];

  await db.doc(`events/${event2Id}/leaderboards/individual`).set({
    rows: individualRows, updatedAt: new Date().toISOString(),
  });
  await db.doc(`events/${event2Id}/leaderboards/teams`).set({
    rows: teamRows, updatedAt: new Date().toISOString(),
  });
  console.log('  ✓ Event 2 leaderboards built');

  // League standings (only event 2 has gameplay data)
  await db.doc(`leagues/${leagueId}/standings/individual`).set({
    rows: individualRows, updatedAt: new Date().toISOString(),
  });
  await db.doc(`leagues/${leagueId}/standings/teams`).set({
    rows: teamRows, updatedAt: new Date().toISOString(),
  });
  console.log('  ✓ League standings built');

  // Event analytics
  await db.doc(`events/${event2Id}/analytics/summary`).set({
    activeUsersLast15m: 4,
    submissionsTotal: 10,
    solvesTotal: 7,
    solvesByChallenge: { e2c1: 2, e2c2: 2, e2c3: 1, e2c4: 1, e2c5: 1 },
    wrongByChallenge: { e2c1: 1, e2c3: 1, e2c5: 1 },
    submissionsByMinute: [
      { minuteKey: 'min-1', count: 1 },
      { minuteKey: 'min-2', count: 2 },
      { minuteKey: 'min-3', count: 1 },
      { minuteKey: 'min-5', count: 1 },
      { minuteKey: 'min-6', count: 1 },
      { minuteKey: 'min-7', count: 1 },
      { minuteKey: 'min-8', count: 2 },
      { minuteKey: 'min-10', count: 1 },
    ],
    updatedAt: new Date().toISOString(),
  });
  console.log('  ✓ Event 2 analytics built');

  // League analytics
  await db.doc(`leagues/${leagueId}/analytics/summary`).set({
    participantsTotal: 4,
    participationByEvent: { [event2Id]: 4 },
    retentionBuckets: { one: 4, two: 0, threePlus: 0 },
    updatedAt: new Date().toISOString(),
  });
  console.log('  ✓ League analytics built');

  // ═══════════════════════════════════════
  // STEP 6: Extend User Profiles
  // ═══════════════════════════════════════
  console.log('\n📦 Step 6: Extending user profiles...');

  await db.collection('users').doc(user1Uid).update({
    bio: 'CTF beginner turned web security enthusiast. Started hacking in 2024.',
    course: 'Cybersecurity B.Sc.',
    classGroup: 'CS-2026-A',
    unit: 'Engineering',
    xp: 700,
    level: 2,
    badges: ['first_solve', 'team_player'],
    stats: {
      solvesTotal: 2,
      correctSubmissions: 2,
      wrongSubmissions: 1,
      solvesByCategory: { WEB: 1, CRYPTO: 1 },
    },
  });

  await db.collection('users').doc(user2Uid).update({
    bio: 'Forensics nerd. I see hex everywhere.',
    course: 'Computer Science B.Sc.',
    classGroup: 'CS-2026-B',
    unit: 'Engineering',
    xp: 250,
    level: 2,
    badges: ['first_solve'],
    stats: {
      solvesTotal: 1,
      correctSubmissions: 1,
      wrongSubmissions: 1,
      solvesByCategory: { FORENSICS: 1 },
    },
  });

  await db.collection('users').doc(user3Uid).update({
    bio: 'Binary exploitation is my zen. Reverse engineering is my therapy.',
    course: 'Information Security M.Sc.',
    classGroup: 'IS-2025-A',
    unit: 'Engineering',
    xp: 1400,
    level: 3,
    badges: ['first_solve', 'five_solves', 'three_categories', 'team_player', 'speed_demon'],
    stats: {
      solvesTotal: 3,
      correctSubmissions: 3,
      wrongSubmissions: 1,
      solvesByCategory: { WEB: 1, CRYPTO: 1, PWN: 1 },
    },
  });

  await db.collection('users').doc(user4Uid).update({
    bio: 'OSINT geek. Loves finding needles in digital haystacks.',
    course: 'Digital Forensics B.Sc.',
    classGroup: 'DF-2026-A',
    unit: 'Engineering',
    xp: 250,
    level: 2,
    badges: ['first_solve'],
    stats: {
      solvesTotal: 1,
      correctSubmissions: 1,
      wrongSubmissions: 0,
      solvesByCategory: { OSINT: 1 },
    },
  });

  await db.collection('users').doc(adminUid).update({
    bio: 'Platform admin. Building the playground.',
    course: 'Staff',
    unit: 'IT Department',
  });

  console.log('  ✓ User profiles extended');

  // Update team stats
  await db.collection('teams').doc(teamAId).update({
    stats: { scoreEvent: 350, scoreLeague: 350, solvesTotal: 3 },
  });
  await db.collection('teams').doc(teamBId).update({
    stats: { scoreEvent: 550, scoreLeague: 550, solvesTotal: 4 },
  });
  console.log('  ✓ Team stats updated');

  // ═══════════════════════════════════════
  // STEP 7: Seed Badge Catalog
  // ═══════════════════════════════════════
  console.log('\n📦 Step 7: Seeding badge catalog...');

  const badges: Record<string, any> = {
    first_solve:       { name: 'First Blood', description: 'Solve your first challenge', icon: '🩸', rarity: 'common', criteriaKey: 'first_solve', xpReward: 50 },
    five_solves:       { name: 'Pentakill', description: 'Solve 5 challenges', icon: '⚔️', rarity: 'common', criteriaKey: 'five_solves', xpReward: 100 },
    ten_solves:        { name: 'Veteran Hacker', description: 'Solve 10 challenges', icon: '🎖️', rarity: 'rare', criteriaKey: 'ten_solves', xpReward: 200 },
    twenty_solves:     { name: 'Elite Operator', description: 'Solve 20 challenges', icon: '💀', rarity: 'epic', criteriaKey: 'twenty_solves', xpReward: 500 },
    three_categories:  { name: 'Versatile', description: 'Solve challenges in 3 different categories', icon: '🔀', rarity: 'rare', criteriaKey: 'three_categories', xpReward: 150 },
    five_categories:   { name: 'Full-Spectrum', description: 'Solve challenges in 5 different categories', icon: '🌈', rarity: 'epic', criteriaKey: 'five_categories', xpReward: 300 },
    team_player:       { name: 'Team Player', description: 'Solve 2+ challenges while in a team', icon: '🤝', rarity: 'common', criteriaKey: 'team_player', xpReward: 75 },
    web_master:        { name: 'Web Master', description: 'Solve 5 WEB challenges', icon: '🌐', rarity: 'rare', criteriaKey: 'web_master', xpReward: 200 },
    crypto_breaker:    { name: 'Crypto Breaker', description: 'Solve 5 CRYPTO challenges', icon: '🔐', rarity: 'rare', criteriaKey: 'crypto_breaker', xpReward: 200 },
    forensics_expert:  { name: 'Forensics Expert', description: 'Solve 5 FORENSICS challenges', icon: '🔍', rarity: 'rare', criteriaKey: 'forensics_expert', xpReward: 200 },
    speed_demon:       { name: 'Speed Demon', description: 'Solve a challenge on first attempt', icon: '⚡', rarity: 'common', criteriaKey: 'speed_demon', xpReward: 50 },
    night_owl:         { name: 'Night Owl', description: 'Submit a flag after midnight', icon: '🦉', rarity: 'common', criteriaKey: 'night_owl', xpReward: 50 },
  };

  for (const [key, badge] of Object.entries(badges)) {
    await db.collection('badges').doc(key).set(badge);
  }
  console.log(`  ✓ ${Object.keys(badges).length} badges seeded`);

  // ═══════════════════════════════════════
  // STEP 8: Seed Quests
  // ═══════════════════════════════════════
  console.log('\n📦 Step 8: Seeding quests...');

  const weekEnd = new Date(now + 7 * DAY);
  const quests = [
    {
      id: 'quest-weekly-warrior',
      title: 'Weekly Warrior',
      description: 'Solve 3 challenges this week',
      activeFrom: new Date(now - 1 * DAY).toISOString(),
      activeTo: weekEnd.toISOString(),
      xpReward: 150,
      rules: { type: 'solve_total', target: 3 },
    },
    {
      id: 'quest-web-hunter',
      title: 'Web Hunter',
      description: 'Solve 2 WEB challenges this week',
      activeFrom: new Date(now - 1 * DAY).toISOString(),
      activeTo: weekEnd.toISOString(),
      xpReward: 100,
      rules: { type: 'solve_category', target: 2, category: 'WEB' },
    },
    {
      id: 'quest-crypto-starter',
      title: 'Crypto Starter',
      description: 'Solve 1 CRYPTO challenge this week',
      activeFrom: new Date(now - 1 * DAY).toISOString(),
      activeTo: weekEnd.toISOString(),
      xpReward: 75,
      rules: { type: 'solve_category', target: 1, category: 'CRYPTO' },
    },
  ];

  for (const quest of quests) {
    const { id, ...data } = quest;
    await db.collection('quests').doc(id).set(data);
  }

  // Add some quest progress
  await db.collection('quests').doc('quest-weekly-warrior').collection('progress').doc(user3Uid).set({
    progress: 3, completed: true, updatedAt: new Date().toISOString(),
  });
  await db.collection('quests').doc('quest-weekly-warrior').collection('progress').doc(user1Uid).set({
    progress: 2, completed: false, updatedAt: new Date().toISOString(),
  });
  await db.collection('quests').doc('quest-web-hunter').collection('progress').doc(user1Uid).set({
    progress: 1, completed: false, updatedAt: new Date().toISOString(),
  });
  await db.collection('quests').doc('quest-crypto-starter').collection('progress').doc(user1Uid).set({
    progress: 1, completed: true, updatedAt: new Date().toISOString(),
  });
  await db.collection('quests').doc('quest-crypto-starter').collection('progress').doc(user3Uid).set({
    progress: 1, completed: true, updatedAt: new Date().toISOString(),
  });

  console.log(`  ✓ ${quests.length} quests seeded with progress`);

  // ═══════════════════════════════════════
  // STEP 9: Seed Team Chat Messages
  // ═══════════════════════════════════════
  console.log('\n📦 Step 9: Seeding team chat messages...');

  const chatMessages = [
    // Team SYNAPSE
    { teamId: teamAId, uid: user1Uid, displayName: 'NeoByte', text: 'Hey team! Let\'s crush this CTF 💪', offset: -15 },
    { teamId: teamAId, uid: user2Uid, displayName: 'CipherCat', text: 'I\'m working on the forensics challenge', offset: -12 },
    { teamId: teamAId, uid: user1Uid, displayName: 'NeoByte', text: 'Got the web one! It was basic SQLi', offset: -10 },
    { teamId: teamAId, uid: user2Uid, displayName: 'CipherCat', text: 'Nice! I found the hidden layers flag too 🎉', offset: -6 },
    { teamId: teamAId, uid: user1Uid, displayName: 'NeoByte', text: 'RSA challenge was fun. Classic small n factoring', offset: -4 },
    { teamId: teamAId, uid: user2Uid, displayName: 'CipherCat', text: 'Can you look at the OSINT one? I\'m stuck', offset: -2 },
    // Team NULLPULSE
    { teamId: teamBId, uid: user3Uid, displayName: 'RootRaven', text: 'Let\'s own this leaderboard 🔥', offset: -18 },
    { teamId: teamBId, uid: user4Uid, displayName: 'PacketPixie', text: 'I\'ll take the OSINT challenge', offset: -16 },
    { teamId: teamBId, uid: user3Uid, displayName: 'RootRaven', text: 'Web and crypto done. Moving to pwn', offset: -8 },
    { teamId: teamBId, uid: user4Uid, displayName: 'PacketPixie', text: 'OSINT solved! GeoGuesser was tricky', offset: -5 },
    { teamId: teamBId, uid: user3Uid, displayName: 'RootRaven', text: 'Buffer overflow got! We\'re leading! 🏆', offset: -3 },
    { teamId: teamBId, uid: user4Uid, displayName: 'PacketPixie', text: 'Amazing work! 550 total points', offset: -1 },
  ];

  for (const msg of chatMessages) {
    await db.collection('teams').doc(msg.teamId).collection('chat').add({
      uid: msg.uid,
      displayName: msg.displayName,
      avatarUrl: null,
      text: msg.text,
      createdAt: new Date(now + msg.offset * MIN).toISOString(),
    });
  }
  console.log(`  ✓ ${chatMessages.length} team chat messages seeded`);

  // ═══════════════════════════════════════
  // STEP 10: Create Instructor User + Class + Private Event + Event Teams
  // ═══════════════════════════════════════
  console.log('\n📦 Step 10: Creating instructor, class, private event, and event teams...');

  const instructorUid = await createUser(
    'instructor@mdavelctf.local', 'Instructor#12345', 'Prof. Mdavel', 'instructor',
    { accent: '#ff6600', accent2: '#cc5200' },
  );

  // Create a class
  const classId = 'class-cyber101';
  const classCode = generateJoinCode();
  await db.collection('classes').doc(classId).set({
    name: 'Cybersecurity 101',
    description: 'Introduction to cybersecurity techniques and CTF competitions.',
    createdAt: new Date().toISOString(),
    ownerInstructorId: instructorUid,
    inviteCode: classCode,
    published: true,
    settings: {
      defaultEventVisibility: 'private',
      allowStudentPublicTeams: true,
    },
  });

  // Add instructor as member
  await db.collection('classes').doc(classId).collection('members').doc(instructorUid).set({
    uid: instructorUid,
    roleInClass: 'instructor',
    joinedAt: new Date().toISOString(),
    displayNameSnapshot: 'Prof. Mdavel',
  });

  // Add students to class (user1, user2, user3)
  for (const stuUid of [user1Uid, user2Uid, user3Uid]) {
    await db.collection('classes').doc(classId).collection('members').doc(stuUid).set({
      uid: stuUid,
      roleInClass: 'student',
      joinedAt: new Date().toISOString(),
      displayNameSnapshot: '',
    });
  }

  // Update user classIds
  for (const uid of [instructorUid, user1Uid, user2Uid, user3Uid]) {
    await db.collection('users').doc(uid).update({
      classIds: admin.firestore.FieldValue.arrayUnion(classId),
    });
  }

  console.log(`  ✓ Class: Cybersecurity 101 (code: ${classCode})`);

  // Create a private event linked to the class
  const event4Id = 'evt-class-lab1';
  await db.collection('events').doc(event4Id).set({
    name: 'Class Lab #1 — Intro Challenges',
    startsAt: new Date(now - 1 * HOUR).toISOString(),
    endsAt: new Date(now + 4 * HOUR).toISOString(),
    timezone: 'UTC',
    published: true,
    leagueId: null,
    visibility: 'private',
    classId,
    ownerId: instructorUid,
    teamMode: 'eventTeams',
    requireClassMembership: true,
    createdAt: new Date().toISOString(),
  });
  console.log('  ✓ Event 4: Class Lab #1 (PRIVATE, LIVE)');

  // Add a challenge to the private event
  const e4c1 = 'e4c1';
  await db.collection('events').doc(event4Id).collection('challenges').doc(e4c1).set({
    title: 'Recon 101',
    category: 'OSINT',
    difficulty: 1,
    pointsFixed: 50,
    tags: ['recon', 'beginner'],
    descriptionMd: '## Recon 101\n\nFind the hidden info on the target website.\n\nHint: Check robots.txt',
    attachments: [],
    published: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  const e4c1flag = normalizeFlag('CTF{mdavel_classlab_osint_01}', false);
  await db.collection('events').doc(event4Id).collection('challengeSecrets').doc(e4c1).set({
    flagHash: hashFlag(e4c1flag),
    caseSensitive: false,
    createdAt: new Date().toISOString(),
  });
  console.log('    → 1 challenge created for private event');

  // Create event teams for Event 4
  const evtTeam1Id = 'evt-team-alpha';
  const evtTeam1Code = generateJoinCode();
  await db.collection('teams').doc(evtTeam1Id).set({
    name: 'Team Alpha',
    joinCode: evtTeam1Code,
    captainUid: user1Uid,
    memberCount: 2,
    createdAt: new Date().toISOString(),
    scope: 'event',
    eventId: event4Id,
    classId,
    avatarUrl: null,
    description: null,
    tagline: null,
    stats: { scoreEvent: 0, solvesTotal: 0 },
  });
  await db.collection('teams').doc(evtTeam1Id).collection('members').doc(user1Uid).set({
    role: 'captain', joinedAt: new Date().toISOString(),
  });
  await db.collection('teams').doc(evtTeam1Id).collection('members').doc(user2Uid).set({
    role: 'member', joinedAt: new Date().toISOString(),
  });
  console.log(`  ✓ Event Team: Team Alpha (code: ${evtTeam1Code})`);

  const evtTeam2Id = 'evt-team-bravo';
  const evtTeam2Code = generateJoinCode();
  await db.collection('teams').doc(evtTeam2Id).set({
    name: 'Team Bravo',
    joinCode: evtTeam2Code,
    captainUid: user3Uid,
    memberCount: 1,
    createdAt: new Date().toISOString(),
    scope: 'event',
    eventId: event4Id,
    classId,
    avatarUrl: null,
    description: null,
    tagline: null,
    stats: { scoreEvent: 0, solvesTotal: 0 },
  });
  await db.collection('teams').doc(evtTeam2Id).collection('members').doc(user3Uid).set({
    role: 'captain', joinedAt: new Date().toISOString(),
  });
  console.log(`  ✓ Event Team: Team Bravo (code: ${evtTeam2Code})`);

  // ═══════════════════════════════════════
  // DONE
  // ═══════════════════════════════════════
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║  ✅ Seed completed successfully!     ║');
  console.log('╠══════════════════════════════════════╣');
  console.log('║                                      ║');
  console.log('║  Admin:      admin@mdavelctf.local    ║');
  console.log('║              Admin#12345              ║');
  console.log('║                                      ║');
  console.log('║  Instructor: instructor@mdavelctf.local║');
  console.log('║              Instructor#12345         ║');
  console.log('║                                      ║');
  console.log('║  Users:      user1-4@mdavelctf.local  ║');
  console.log('║              User#12345               ║');
  console.log('║                                      ║');
  console.log('║  Emulator UI: http://localhost:4040   ║');
  console.log('║  API:         http://localhost:4000   ║');
  console.log('║  Web:         http://localhost:3000   ║');
  console.log('║                                      ║');
  console.log('╚══════════════════════════════════════╝\n');

  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
