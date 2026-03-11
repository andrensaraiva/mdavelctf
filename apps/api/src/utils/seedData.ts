/**
 * Seed Data Module
 * Contains the logic to populate demo data, callable from API routes.
 * Mirrors the logic of scripts/seed.ts but runs inside the API process.
 */

import * as admin from 'firebase-admin';
import { getDb, getAuth } from '../firebase';
import { normalizeFlag, hashFlag } from './crypto';
import { SUPERADMIN_EMAIL } from '../middleware/auth';
import crypto from 'crypto';
import { UserRole } from '@mdavelctf/shared';

function generateJoinCode(): string {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

async function ensureUser(
  email: string,
  password: string,
  displayName: string,
  role: UserRole,
  themePreset: { accent: string; accent2: string },
): Promise<string> {
  const auth = getAuth();
  const db = getDb();

  let userRecord;
  try {
    userRecord = await auth.createUser({ email, password, displayName, emailVerified: true });
  } catch (err: any) {
    if (err.code === 'auth/email-already-exists') {
      userRecord = await auth.getUserByEmail(email);
    } else {
      throw err;
    }
  }

  const isSuperAdmin = role === 'superadmin';
  const isAdmin = role === 'admin' || isSuperAdmin;
  await auth.setCustomUserClaims(userRecord.uid, { admin: isAdmin, superadmin: isSuperAdmin });

  await db.collection('users').doc(userRecord.uid).set({
    displayName, role, disabled: false, teamId: null,
    theme: themePreset, createdAt: new Date().toISOString(),
    avatarUrl: null, bio: '', course: '', classGroup: '', unit: '',
    xp: 0, level: 1, badges: [],
    stats: { solvesTotal: 0, correctSubmissions: 0, wrongSubmissions: 0, solvesByCategory: {} },
  });

  return userRecord.uid;
}

/** Delete all docs in a collection (and optionally sub-collections). */
async function deleteCollection(collectionPath: string, subcollections?: string[]) {
  const db = getDb();
  const snap = await db.collection(collectionPath).get();
  if (snap.empty) return;

  for (const doc of snap.docs) {
    if (subcollections) {
      for (const sub of subcollections) {
        const subSnap = await doc.ref.collection(sub).get();
        const batch = db.batch();
        subSnap.docs.forEach((d) => batch.delete(d.ref));
        if (!subSnap.empty) await batch.commit();
      }
    }
    await doc.ref.delete();
  }
}

/**
 * Clear ALL data except the admin account.
 * Returns a summary of what was deleted.
 */
export async function clearSeedData(): Promise<{ deleted: string[] }> {
  const db = getDb();
  const auth = getAuth();
  const deleted: string[] = [];

  // 1. Delete all non-admin/superadmin users from Auth + Firestore
  const usersSnap = await db.collection('users').get();
  for (const doc of usersSnap.docs) {
    const data = doc.data();
    if (data.role === 'admin' || data.role === 'superadmin') continue; // keep admins
    try { await auth.deleteUser(doc.id); } catch { /* may not exist */ }
    await doc.ref.delete();
    deleted.push(`user:${data.displayName || doc.id}`);
  }

  // 2. Delete teams (with members + chat subcollections)
  const teamsSnap = await db.collection('teams').get();
  for (const doc of teamsSnap.docs) {
    for (const sub of ['members', 'chat']) {
      const subSnap = await doc.ref.collection(sub).get();
      for (const s of subSnap.docs) await s.ref.delete();
    }
    await doc.ref.delete();
    deleted.push(`team:${doc.data().name || doc.id}`);
  }

  // Update admin/superadmin teamId to null
  const adminSnap = await db.collection('users').where('role', 'in', ['admin', 'superadmin']).get();
  for (const doc of adminSnap.docs) {
    await doc.ref.update({ teamId: null });
  }

  // 3. Delete events (with challenges (+ hints subcollection), challengeSecrets, submissions, solves, leaderboards, analytics)
  const eventsSnap = await db.collection('events').get();
  for (const doc of eventsSnap.docs) {
    // Delete hints subcollections from each challenge first
    const chalSnap = await doc.ref.collection('challenges').get();
    for (const chalDoc of chalSnap.docs) {
      const hintsSnap = await chalDoc.ref.collection('hints').get();
      for (const h of hintsSnap.docs) await h.ref.delete();
    }
    for (const sub of ['challenges', 'challengeSecrets', 'submissions', 'solves']) {
      const subSnap = await doc.ref.collection(sub).get();
      for (const s of subSnap.docs) await s.ref.delete();
    }
    // leaderboards + analytics are single docs
    for (const path of ['leaderboards/individual', 'leaderboards/teams', 'analytics/summary']) {
      try { await doc.ref.collection(path.split('/')[0]).doc(path.split('/')[1]).delete(); } catch { /* ok */ }
    }
    await doc.ref.delete();
    deleted.push(`event:${doc.data().name || doc.id}`);
  }

  // 4. Delete leagues (with standings + analytics subcollections)
  const leaguesSnap = await db.collection('leagues').get();
  for (const doc of leaguesSnap.docs) {
    for (const path of ['standings/individual', 'standings/teams', 'analytics/summary']) {
      try { await doc.ref.collection(path.split('/')[0]).doc(path.split('/')[1]).delete(); } catch { /* ok */ }
    }
    await doc.ref.delete();
    deleted.push(`league:${doc.data().name || doc.id}`);
  }

  // 5. Delete badges
  await deleteCollection('badges');
  deleted.push('badges:all');

  // 6. Delete quests (with progress subcollection)
  const questsSnap = await db.collection('quests').get();
  for (const doc of questsSnap.docs) {
    const progSnap = await doc.ref.collection('progress').get();
    for (const p of progSnap.docs) await p.ref.delete();
    await doc.ref.delete();
  }
  deleted.push('quests:all');

  // 7. Delete classes (with members subcollection)
  const classesSnap = await db.collection('classes').get();
  for (const doc of classesSnap.docs) {
    const membersSnap = await doc.ref.collection('members').get();
    for (const m of membersSnap.docs) await m.ref.delete();
    await doc.ref.delete();
    deleted.push(`class:${doc.data().name || doc.id}`);
  }

  // 8. Delete audit_logs
  await deleteCollection('audit_logs');
  deleted.push('audit_logs:all');

  // 9. Delete hintUnlocks
  await deleteCollection('hintUnlocks');
  deleted.push('hintUnlocks:all');

  return { deleted };
}

/**
 * Re-seed all demo data (same as scripts/seed.ts).
 * Supports 'minimal' mode (2 teams, 4 users, 1 league, 3 events, 12 challenges)
 * and 'full' mode (everything including gameplay data, chat, classes, etc.)
 */
export async function runSeed(mode: 'minimal' | 'full' = 'full'): Promise<{ summary: string[] }> {
  const db = getDb();
  const summary: string[] = [];

  const now = Date.now();
  const DAY = 86400000;
  const HOUR = 3600000;
  const MIN = 60000;

  // ── Users ──
  const superAdminUid = await ensureUser(SUPERADMIN_EMAIL, 'SuperAdmin#12345', 'Super Admin', 'superadmin', { accent: '#ff0055', accent2: '#cc0044' });
  const adminUid = await ensureUser('admin@mdavelctf.local', 'Admin#12345', 'Admin Mdavel', 'admin', { accent: '#00f0ff', accent2: '#0077ff' });
  const user1Uid = await ensureUser('user1@mdavelctf.local', 'User#12345', 'NeoByte', 'participant', { accent: '#00f0ff', accent2: '#0077ff' });
  const user2Uid = await ensureUser('user2@mdavelctf.local', 'User#12345', 'CipherCat', 'participant', { accent: '#39ff14', accent2: '#00b300' });
  const user3Uid = await ensureUser('user3@mdavelctf.local', 'User#12345', 'RootRaven', 'participant', { accent: '#ff00ff', accent2: '#b300b3' });
  const user4Uid = await ensureUser('user4@mdavelctf.local', 'User#12345', 'PacketPixie', 'participant', { accent: '#ffbf00', accent2: '#ff8c00' });
  const instructorUid = await ensureUser('instructor@mdavelctf.local', 'Instructor#12345', 'Prof. Mdavel', 'instructor', { accent: '#ff6600', accent2: '#cc5200' });
  summary.push('7 users created (1 superadmin, 1 admin, 1 instructor, 4 participants)');

  // ── Teams ──
  const teamAId = 'teamSynapse';
  const teamACode = generateJoinCode();
  await db.collection('teams').doc(teamAId).set({
    name: 'SYNAPSE', joinCode: teamACode, captainUid: user1Uid, memberCount: 2,
    createdAt: new Date().toISOString(), avatarUrl: null,
    description: 'Elite exploit developers and web security enthusiasts.',
    tagline: 'Connecting the dots, one byte at a time.',
    stats: { scoreEvent: 0, scoreLeague: 0, solvesTotal: 0 },
  });
  await db.collection('teams').doc(teamAId).collection('members').doc(user1Uid).set({ role: 'captain', joinedAt: new Date().toISOString() });
  await db.collection('teams').doc(teamAId).collection('members').doc(user2Uid).set({ role: 'member', joinedAt: new Date().toISOString() });
  await db.collection('users').doc(user1Uid).update({ teamId: teamAId });
  await db.collection('users').doc(user2Uid).update({ teamId: teamAId });

  const teamBId = 'teamNullpulse';
  const teamBCode = generateJoinCode();
  await db.collection('teams').doc(teamBId).set({
    name: 'NULLPULSE', joinCode: teamBCode, captainUid: user3Uid, memberCount: 2,
    createdAt: new Date().toISOString(), avatarUrl: null,
    description: 'Reverse engineers and binary exploitation specialists.',
    tagline: 'From zero to root in 60 seconds.',
    stats: { scoreEvent: 0, scoreLeague: 0, solvesTotal: 0 },
  });
  await db.collection('teams').doc(teamBId).collection('members').doc(user3Uid).set({ role: 'captain', joinedAt: new Date().toISOString() });
  await db.collection('teams').doc(teamBId).collection('members').doc(user4Uid).set({ role: 'member', joinedAt: new Date().toISOString() });
  await db.collection('users').doc(user3Uid).update({ teamId: teamBId });
  await db.collection('users').doc(user4Uid).update({ teamId: teamBId });
  summary.push('2 public teams created');

  // ── Events ──
  const event1Id = 'evt-warmup';
  const event2Id = 'evt-weekly1';
  const event3Id = 'evt-weekly2';
  const leagueId = 'league-s01';

  await db.collection('leagues').doc(leagueId).set({
    name: 'Mdavel League — Season 01',
    startsAt: new Date(now - 7 * DAY).toISOString(),
    endsAt: new Date(now + 60 * DAY).toISOString(),
    published: true, eventIds: [event1Id, event2Id, event3Id],
    createdAt: new Date().toISOString(),
  });
  summary.push('1 league created');

  // Event 1: Warmup CTF (ENDED)
  await db.collection('events').doc(event1Id).set({
    name: 'Warmup CTF', startsAt: new Date(now - 2 * DAY).toISOString(),
    endsAt: new Date(now - 1 * DAY).toISOString(), timezone: 'UTC',
    published: true, leagueId, classType: 'Segurança', createdAt: new Date().toISOString(),
  });

  const e1Challenges = [
    { id: 'e1c1', title: 'Hello Web', category: 'Segurança', difficulty: 1, pointsFixed: 50, tags: ['http', 'beginner'], classType: 'Segurança', descriptionMd: '## Hello Web\n\nCheck the page source.', flag: 'CTF{mdavel_warmup_web_01}', hints: [{ title: 'View Source', description: 'Right-click the page and view source code.', penaltyPercent: 10 }] },
    { id: 'e1c2', title: 'Caesar Salad', category: 'Segurança', difficulty: 1, pointsFixed: 75, tags: ['caesar'], classType: 'Segurança', descriptionMd: '## Caesar Salad\n\nDecrypt: `PGS{zqniry_jnezhc_pelcgb_02}`', flag: 'CTF{mdavel_warmup_crypto_02}', hints: [{ title: 'ROT13', description: 'Try rotating the alphabet by 13 positions.', penaltyPercent: 20 }] },
    { id: 'e1c3', title: 'File Header', category: 'Segurança', difficulty: 2, pointsFixed: 100, tags: ['magic-bytes'], classType: 'Segurança', descriptionMd: '## File Header\n\nIdentify: `89 50 4E 47 0D 0A 1A 0A`', flag: 'CTF{mdavel_warmup_forensics_03}', hints: [] },
  ];
  for (const c of e1Challenges) {
    await db.collection('events').doc(event1Id).collection('challenges').doc(c.id).set({
      title: c.title, category: c.category, difficulty: c.difficulty, pointsFixed: c.pointsFixed,
      tags: c.tags, classType: c.classType, descriptionMd: c.descriptionMd, attachments: [], published: true,
      hints: c.hints, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    await db.collection('events').doc(event1Id).collection('challengeSecrets').doc(c.id).set({
      flagHash: hashFlag(normalizeFlag(c.flag, false)), caseSensitive: false, createdAt: new Date().toISOString(),
    });
  }

  // Event 2: Weekly CTF #1 (LIVE)
  await db.collection('events').doc(event2Id).set({
    name: 'Weekly CTF #1', startsAt: new Date(now - 30 * MIN).toISOString(),
    endsAt: new Date(now + 2 * HOUR).toISOString(), timezone: 'UTC',
    published: true, leagueId, classType: 'TI', createdAt: new Date().toISOString(),
  });

  const e2Challenges = [
    { id: 'e2c1', title: 'SQL Injection 101', category: 'TI', difficulty: 2, pointsFixed: 100, tags: ['sqli'], classType: 'TI', descriptionMd: '## SQL Injection 101\n\nBypass auth.', flag: 'CTF{mdavel_weekly1_web_01}', hints: [
      { title: 'Think Input', description: 'Try entering a single quote in the login field.', penaltyPercent: 10 },
      { title: 'Classic Payload', description: 'The classic `\' OR 1=1 --` might help.', penaltyPercent: 25 },
    ]},
    { id: 'e2c2', title: 'RSA Basics', category: 'TI', difficulty: 3, pointsFixed: 150, tags: ['rsa'], classType: 'TI', descriptionMd: '## RSA Basics\n\nn=3233, e=17, ct=2790', flag: 'CTF{mdavel_weekly1_crypto_02}', hints: [
      { title: 'Small Primes', description: 'n=3233 factors into two small primes. Try dividing!', penaltyPercent: 15 },
      { title: 'Compute d', description: 'p=53, q=61. Now compute d = e^-1 mod (p-1)(q-1).', penaltyPercent: 30 },
    ]},
    { id: 'e2c3', title: 'Hidden Layers', category: 'Multimídia', difficulty: 2, pointsFixed: 100, tags: ['steganography'], classType: 'TI', descriptionMd: '## Hidden Layers\n\nExtract hidden message from PNG.', flag: 'CTF{mdavel_weekly1_forensics_03}', hints: [
      { title: 'Tool Hint', description: 'Try using `steghide` or `zsteg` on the image.', penaltyPercent: 20 },
    ]},
    { id: 'e2c4', title: 'GeoGuesser', category: 'Administração', difficulty: 2, pointsFixed: 100, tags: ['geolocation'], classType: 'TI', descriptionMd: '## GeoGuesser\n\nIdentify the location.', flag: 'CTF{mdavel_weekly1_osint_04}', hints: [] },
    { id: 'e2c5', title: 'Buffer Overflow 101', category: 'Segurança', difficulty: 4, pointsFixed: 200, tags: ['bof'], classType: 'TI', descriptionMd: '## Buffer Overflow 101\n\nOverflow buf and call win().', flag: 'CTF{mdavel_weekly1_pwn_05}', hints: [
      { title: 'Buffer Size', description: 'The buffer is 64 bytes. What comes after it on the stack?', penaltyPercent: 10 },
      { title: 'Return Address', description: 'Overwrite the return address with the address of `win()`.', penaltyPercent: 20 },
      { title: 'Exact Offset', description: 'Offset is 72 bytes (64 buffer + 8 saved RBP). Address of win: check with `objdump`.', penaltyPercent: 35 },
    ]},
  ];
  for (const c of e2Challenges) {
    await db.collection('events').doc(event2Id).collection('challenges').doc(c.id).set({
      title: c.title, category: c.category, difficulty: c.difficulty, pointsFixed: c.pointsFixed,
      tags: c.tags, classType: c.classType, descriptionMd: c.descriptionMd, attachments: [], published: true,
      hints: c.hints, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    await db.collection('events').doc(event2Id).collection('challengeSecrets').doc(c.id).set({
      flagHash: hashFlag(normalizeFlag(c.flag, false)), caseSensitive: false, createdAt: new Date().toISOString(),
    });
  }

  // Event 3: Weekly CTF #2 (UPCOMING)
  await db.collection('events').doc(event3Id).set({
    name: 'Weekly CTF #2', startsAt: new Date(now + 3 * DAY).toISOString(),
    endsAt: new Date(now + 3 * DAY + 3 * HOUR).toISOString(), timezone: 'UTC',
    published: true, leagueId, classType: 'Redes', createdAt: new Date().toISOString(),
  });

  const e3Challenges = [
    { id: 'e3c1', title: 'XSS Playground', category: 'Redes', difficulty: 3, pointsFixed: 150, tags: ['xss'], classType: 'Redes', descriptionMd: '## XSS Playground\n\nFind reflected XSS.', flag: 'CTF{mdavel_weekly2_web_01}', hints: [{ title: 'Input Fields', description: 'Look for user input reflected in the page without sanitization.', penaltyPercent: 15 }] },
    { id: 'e3c2', title: 'Vigenère Vault', category: 'Redes', difficulty: 3, pointsFixed: 150, tags: ['vigenere'], classType: 'Redes', descriptionMd: '## Vigenère Vault\n\nBreak the cipher.', flag: 'CTF{mdavel_weekly2_crypto_02}', hints: [] },
    { id: 'e3c3', title: 'Reverse Me', category: 'Mecânica', difficulty: 4, pointsFixed: 200, tags: ['binary'], classType: 'Redes', descriptionMd: '## Reverse Me\n\nReverse engineer the binary.', flag: 'CTF{mdavel_weekly2_rev_03}', hints: [
      { title: 'Strings', description: 'Run `strings` on the binary to find readable text.', penaltyPercent: 10 },
      { title: 'Disassemble', description: 'Use Ghidra or IDA to find the comparison function.', penaltyPercent: 25 },
    ]},
    { id: 'e3c4', title: 'Memory Dump', category: 'Redes', difficulty: 3, pointsFixed: 150, tags: ['volatility'], classType: 'Redes', descriptionMd: '## Memory Dump\n\nAnalyze the memory dump.', flag: 'CTF{mdavel_weekly2_forensics_04}', hints: [] },
  ];
  for (const c of e3Challenges) {
    await db.collection('events').doc(event3Id).collection('challenges').doc(c.id).set({
      title: c.title, category: c.category, difficulty: c.difficulty, pointsFixed: c.pointsFixed,
      tags: c.tags, classType: c.classType, descriptionMd: c.descriptionMd, attachments: [], published: true,
      hints: c.hints, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    await db.collection('events').doc(event3Id).collection('challengeSecrets').doc(c.id).set({
      flagHash: hashFlag(normalizeFlag(c.flag, false)), caseSensitive: false, createdAt: new Date().toISOString(),
    });
  }
  summary.push('3 public events + 12 challenges created');

  // ── Minimal mode stops here ──
  if (mode === 'minimal') {
    // Create leaderboards with empty data for minimal mode
    await db.doc(`events/${event2Id}/leaderboards/individual`).set({ rows: [], updatedAt: new Date().toISOString() });
    await db.doc(`events/${event2Id}/leaderboards/teams`).set({ rows: [], updatedAt: new Date().toISOString() });
    await db.doc(`leagues/${leagueId}/standings/individual`).set({ rows: [], updatedAt: new Date().toISOString() });
    await db.doc(`leagues/${leagueId}/standings/teams`).set({ rows: [], updatedAt: new Date().toISOString() });
    summary.push('Minimal seed complete (no gameplay data, no classes, no badges/quests)');
    return { summary };
  }

  // ── Gameplay data (Event 2) ──
  const baseTime = new Date(now - 20 * MIN);
  async function addSub(uid: string, teamId: string | null, cid: string, ok: boolean, att: number, mOff: number) {
    const at = new Date(baseTime.getTime() + mOff * MIN).toISOString();
    await db.collection('events').doc(event2Id).collection('submissions').add({ uid, teamId, challengeId: cid, submittedAt: at, isCorrect: ok, attemptNumber: att });
    return at;
  }
  async function addSolve(uid: string, teamId: string | null, cid: string, pts: number, at: string) {
    await db.collection('events').doc(event2Id).collection('solves').doc(`${uid}_${cid}`).set({ solveId: `${uid}_${cid}`, uid, teamId, challengeId: cid, solvedAt: at, pointsAwarded: pts });
  }

  await addSub(user1Uid, teamAId, 'e2c1', false, 1, 1);
  const neo1 = await addSub(user1Uid, teamAId, 'e2c1', true, 2, 3);
  await addSolve(user1Uid, teamAId, 'e2c1', 100, neo1);
  const neo2 = await addSub(user1Uid, teamAId, 'e2c2', true, 1, 5);
  await addSolve(user1Uid, teamAId, 'e2c2', 150, neo2);
  await addSub(user2Uid, teamAId, 'e2c3', false, 1, 2);
  const cc1 = await addSub(user2Uid, teamAId, 'e2c3', true, 2, 6);
  await addSolve(user2Uid, teamAId, 'e2c3', 100, cc1);
  const rr1 = await addSub(user3Uid, teamBId, 'e2c1', true, 1, 2);
  await addSolve(user3Uid, teamBId, 'e2c1', 100, rr1);
  const rr2 = await addSub(user3Uid, teamBId, 'e2c2', true, 1, 4);
  await addSolve(user3Uid, teamBId, 'e2c2', 150, rr2);
  await addSub(user3Uid, teamBId, 'e2c5', false, 1, 7);
  const rr3 = await addSub(user3Uid, teamBId, 'e2c5', true, 2, 10);
  await addSolve(user3Uid, teamBId, 'e2c5', 200, rr3);
  const pp1 = await addSub(user4Uid, teamBId, 'e2c4', true, 1, 8);
  await addSolve(user4Uid, teamBId, 'e2c4', 100, pp1);
  summary.push('10 submissions + 7 solves created');

  // ── Leaderboards ──
  const individualRows = [
    { uid: user3Uid, displayName: 'RootRaven', score: 450, lastSolveAt: rr3 },
    { uid: user1Uid, displayName: 'NeoByte', score: 250, lastSolveAt: neo2 },
    { uid: user2Uid, displayName: 'CipherCat', score: 100, lastSolveAt: cc1 },
    { uid: user4Uid, displayName: 'PacketPixie', score: 100, lastSolveAt: pp1 },
  ];
  const teamRows = [
    { teamId: teamBId, teamName: 'NULLPULSE', score: 550, lastSolveAt: rr3 },
    { teamId: teamAId, teamName: 'SYNAPSE', score: 350, lastSolveAt: cc1 },
  ];
  await db.doc(`events/${event2Id}/leaderboards/individual`).set({ rows: individualRows, updatedAt: new Date().toISOString() });
  await db.doc(`events/${event2Id}/leaderboards/teams`).set({ rows: teamRows, updatedAt: new Date().toISOString() });
  await db.doc(`leagues/${leagueId}/standings/individual`).set({ rows: individualRows, updatedAt: new Date().toISOString() });
  await db.doc(`leagues/${leagueId}/standings/teams`).set({ rows: teamRows, updatedAt: new Date().toISOString() });
  summary.push('Leaderboards + standings built');

  // ── Analytics ──
  await db.doc(`events/${event2Id}/analytics/summary`).set({
    activeUsersLast15m: 4, submissionsTotal: 10, solvesTotal: 7,
    solvesByChallenge: { e2c1: 2, e2c2: 2, e2c3: 1, e2c4: 1, e2c5: 1 },
    wrongByChallenge: { e2c1: 1, e2c3: 1, e2c5: 1 },
    submissionsByMinute: [], updatedAt: new Date().toISOString(),
  });
  await db.doc(`leagues/${leagueId}/analytics/summary`).set({
    participantsTotal: 4, participationByEvent: { [event2Id]: 4 },
    retentionBuckets: { one: 4, two: 0, threePlus: 0 }, updatedAt: new Date().toISOString(),
  });
  summary.push('Analytics built');

  // ── User profiles ──
  await db.collection('users').doc(user1Uid).update({
    bio: 'CTF beginner turned web security enthusiast.', course: 'Cybersecurity B.Sc.', classGroup: 'CS-2026-A', unit: 'Engineering',
    xp: 700, level: 2, badges: ['first_solve', 'team_player'], stats: { solvesTotal: 2, correctSubmissions: 2, wrongSubmissions: 1, solvesByCategory: { Segurança: 1, TI: 1 } },
  });
  await db.collection('users').doc(user2Uid).update({
    bio: 'Forensics nerd.', course: 'Computer Science B.Sc.', classGroup: 'CS-2026-B', unit: 'Engineering',
    xp: 250, level: 2, badges: ['first_solve'], stats: { solvesTotal: 1, correctSubmissions: 1, wrongSubmissions: 1, solvesByCategory: { Multimídia: 1 } },
  });
  await db.collection('users').doc(user3Uid).update({
    bio: 'Binary exploitation is my zen.', course: 'Information Security M.Sc.', classGroup: 'IS-2025-A', unit: 'Engineering',
    xp: 1400, level: 3, badges: ['first_solve', 'five_solves', 'three_categories', 'team_player', 'speed_demon'],
    stats: { solvesTotal: 3, correctSubmissions: 3, wrongSubmissions: 1, solvesByCategory: { TI: 1, Segurança: 1, Redes: 1 } },
  });
  await db.collection('users').doc(user4Uid).update({
    bio: 'OSINT geek.', course: 'Digital Forensics B.Sc.', classGroup: 'DF-2026-A', unit: 'Engineering',
    xp: 250, level: 2, badges: ['first_solve'], stats: { solvesTotal: 1, correctSubmissions: 1, wrongSubmissions: 0, solvesByCategory: { Administração: 1 } },
  });
  await db.collection('users').doc(adminUid).update({ bio: 'Platform admin.', course: 'Staff', unit: 'IT Department' });
  summary.push('User profiles extended');

  // Team stats
  await db.collection('teams').doc(teamAId).update({ stats: { scoreEvent: 350, scoreLeague: 350, solvesTotal: 3 } });
  await db.collection('teams').doc(teamBId).update({ stats: { scoreEvent: 550, scoreLeague: 550, solvesTotal: 4 } });

  // ── Badges ──
  const badges: Record<string, any> = {
    first_solve: { name: 'First Blood', description: 'Solve your first challenge', icon: '🩸', rarity: 'common', criteriaKey: 'first_solve', xpReward: 50 },
    five_solves: { name: 'Pentakill', description: 'Solve 5 challenges', icon: '⚔️', rarity: 'common', criteriaKey: 'five_solves', xpReward: 100 },
    ten_solves: { name: 'Veteran Hacker', description: 'Solve 10 challenges', icon: '🎖️', rarity: 'rare', criteriaKey: 'ten_solves', xpReward: 200 },
    twenty_solves: { name: 'Elite Operator', description: 'Solve 20 challenges', icon: '💀', rarity: 'epic', criteriaKey: 'twenty_solves', xpReward: 500 },
    three_categories: { name: 'Versatile', description: 'Solve in 3 tags', icon: '🔀', rarity: 'rare', criteriaKey: 'three_categories', xpReward: 150 },
    five_categories: { name: 'Full-Spectrum', description: 'Solve in 5 tags', icon: '🌈', rarity: 'epic', criteriaKey: 'five_categories', xpReward: 300 },
    team_player: { name: 'Team Player', description: 'Solve 2+ in a team', icon: '🤝', rarity: 'common', criteriaKey: 'team_player', xpReward: 75 },
    web_master: { name: 'Web Master', description: 'Solve 5 Segurança', icon: '🌐', rarity: 'rare', criteriaKey: 'web_master', xpReward: 200 },
    crypto_breaker: { name: 'Crypto Breaker', description: 'Solve 5 TI', icon: '🔐', rarity: 'rare', criteriaKey: 'crypto_breaker', xpReward: 200 },
    forensics_expert: { name: 'Forensics Expert', description: 'Solve 5 Redes', icon: '🔍', rarity: 'rare', criteriaKey: 'forensics_expert', xpReward: 200 },
    speed_demon: { name: 'Speed Demon', description: 'Solve on first attempt', icon: '⚡', rarity: 'common', criteriaKey: 'speed_demon', xpReward: 50 },
    night_owl: { name: 'Night Owl', description: 'Submit after midnight', icon: '🦉', rarity: 'common', criteriaKey: 'night_owl', xpReward: 50 },
  };
  for (const [key, badge] of Object.entries(badges)) {
    await db.collection('badges').doc(key).set(badge);
  }
  summary.push('12 badges seeded');

  // ── Quests ──
  const weekEnd = new Date(now + 7 * DAY);
  const quests = [
    { id: 'quest-weekly-warrior', title: 'Weekly Warrior', description: 'Solve 3 challenges this week', activeFrom: new Date(now - 1 * DAY).toISOString(), activeTo: weekEnd.toISOString(), xpReward: 150, rules: { type: 'solve_total', target: 3 } },
    { id: 'quest-web-hunter', title: 'Web Hunter', description: 'Solve 2 Segurança challenges this week', activeFrom: new Date(now - 1 * DAY).toISOString(), activeTo: weekEnd.toISOString(), xpReward: 100, rules: { type: 'solve_category', target: 2, category: 'Segurança' } },
    { id: 'quest-crypto-starter', title: 'Crypto Starter', description: 'Solve 1 TI challenge this week', activeFrom: new Date(now - 1 * DAY).toISOString(), activeTo: weekEnd.toISOString(), xpReward: 75, rules: { type: 'solve_category', target: 1, category: 'TI' } },
  ];
  for (const q of quests) {
    const { id, ...data } = q;
    await db.collection('quests').doc(id).set(data);
  }
  // Quest progress
  await db.collection('quests').doc('quest-weekly-warrior').collection('progress').doc(user3Uid).set({ progress: 3, completed: true, updatedAt: new Date().toISOString() });
  await db.collection('quests').doc('quest-weekly-warrior').collection('progress').doc(user1Uid).set({ progress: 2, completed: false, updatedAt: new Date().toISOString() });
  await db.collection('quests').doc('quest-web-hunter').collection('progress').doc(user1Uid).set({ progress: 1, completed: false, updatedAt: new Date().toISOString() });
  await db.collection('quests').doc('quest-crypto-starter').collection('progress').doc(user1Uid).set({ progress: 1, completed: true, updatedAt: new Date().toISOString() });
  await db.collection('quests').doc('quest-crypto-starter').collection('progress').doc(user3Uid).set({ progress: 1, completed: true, updatedAt: new Date().toISOString() });
  summary.push('3 quests + progress seeded');

  // ── Chat messages ──
  const chatMessages = [
    { teamId: teamAId, uid: user1Uid, displayName: 'NeoByte', text: 'Hey team! Let\'s crush this CTF 💪', offset: -15 },
    { teamId: teamAId, uid: user2Uid, displayName: 'CipherCat', text: 'I\'m working on the forensics challenge', offset: -12 },
    { teamId: teamAId, uid: user1Uid, displayName: 'NeoByte', text: 'Got the web one! SQLi for the win', offset: -10 },
    { teamId: teamAId, uid: user2Uid, displayName: 'CipherCat', text: 'Found the hidden layers flag 🎉', offset: -6 },
    { teamId: teamBId, uid: user3Uid, displayName: 'RootRaven', text: 'Let\'s own this leaderboard 🔥', offset: -18 },
    { teamId: teamBId, uid: user4Uid, displayName: 'PacketPixie', text: 'I\'ll take the OSINT challenge', offset: -16 },
    { teamId: teamBId, uid: user3Uid, displayName: 'RootRaven', text: 'Web and crypto done. Moving to pwn', offset: -8 },
    { teamId: teamBId, uid: user4Uid, displayName: 'PacketPixie', text: 'OSINT solved! We\'re leading! 🏆', offset: -5 },
  ];
  for (const msg of chatMessages) {
    await db.collection('teams').doc(msg.teamId).collection('chat').add({
      uid: msg.uid, displayName: msg.displayName, avatarUrl: null,
      text: msg.text, createdAt: new Date(now + msg.offset * MIN).toISOString(),
    });
  }
  summary.push('8 chat messages seeded');

  // ── Class + Private Event + Event Teams ──
  const classId = 'class-cyber101';
  const classCode = generateJoinCode();
  await db.collection('classes').doc(classId).set({
    name: 'Cybersecurity 101', description: 'Introduction to cybersecurity techniques and CTF competitions.',
    createdAt: new Date().toISOString(), ownerInstructorId: instructorUid, inviteCode: classCode, published: true,
    classType: 'Segurança', themeId: 'neon-cyber', icon: '🛡️', tags: ['security', 'beginner', 'web'],
    settings: { defaultEventVisibility: 'private', allowStudentPublicTeams: true },
  });
  await db.collection('classes').doc(classId).collection('members').doc(instructorUid).set({ uid: instructorUid, roleInClass: 'instructor', joinedAt: new Date().toISOString(), displayNameSnapshot: 'Prof. Mdavel' });
  for (const stuUid of [user1Uid, user2Uid, user3Uid]) {
    await db.collection('classes').doc(classId).collection('members').doc(stuUid).set({ uid: stuUid, roleInClass: 'student', joinedAt: new Date().toISOString(), displayNameSnapshot: '' });
  }
  for (const uid of [instructorUid, user1Uid, user2Uid, user3Uid]) {
    await db.collection('users').doc(uid).update({ classIds: admin.firestore.FieldValue.arrayUnion(classId) });
  }
  summary.push('1 class created (Cybersecurity 101)');

  const event4Id = 'evt-class-lab1';
  await db.collection('events').doc(event4Id).set({
    name: 'Class Lab #1 — Intro Challenges', startsAt: new Date(now - 1 * HOUR).toISOString(),
    endsAt: new Date(now + 4 * HOUR).toISOString(), timezone: 'UTC', published: true,
    leagueId: null, visibility: 'private', classId, ownerId: instructorUid,
    teamMode: 'eventTeams', requireClassMembership: true, classType: 'Segurança',
    createdAt: new Date().toISOString(),
  });
  const e4c1flag = normalizeFlag('CTF{mdavel_classlab_osint_01}', false);
  await db.collection('events').doc(event4Id).collection('challenges').doc('e4c1').set({
    title: 'Recon 101', category: 'OSINT', difficulty: 1, pointsFixed: 50,
    tags: ['recon', 'beginner'], classType: 'Segurança', descriptionMd: '## Recon 101\n\nCheck robots.txt',
    attachments: [], published: true, hints: [{ title: 'Robots', description: 'Navigate to /robots.txt on the target.', penaltyPercent: 15 }],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  await db.collection('events').doc(event4Id).collection('challengeSecrets').doc('e4c1').set({
    flagHash: hashFlag(e4c1flag), caseSensitive: false, createdAt: new Date().toISOString(),
  });
  summary.push('1 private event + 1 challenge created');

  // Event teams
  const evtTeam1Id = 'evt-team-alpha';
  const evtTeam1Code = generateJoinCode();
  await db.collection('teams').doc(evtTeam1Id).set({
    name: 'Team Alpha', joinCode: evtTeam1Code, captainUid: user1Uid, memberCount: 2,
    createdAt: new Date().toISOString(), scope: 'event', eventId: event4Id, classId,
    avatarUrl: null, description: null, tagline: null, stats: { scoreEvent: 0, solvesTotal: 0 },
  });
  await db.collection('teams').doc(evtTeam1Id).collection('members').doc(user1Uid).set({ role: 'captain', joinedAt: new Date().toISOString() });
  await db.collection('teams').doc(evtTeam1Id).collection('members').doc(user2Uid).set({ role: 'member', joinedAt: new Date().toISOString() });

  const evtTeam2Id = 'evt-team-bravo';
  const evtTeam2Code = generateJoinCode();
  await db.collection('teams').doc(evtTeam2Id).set({
    name: 'Team Bravo', joinCode: evtTeam2Code, captainUid: user3Uid, memberCount: 1,
    createdAt: new Date().toISOString(), scope: 'event', eventId: event4Id, classId,
    avatarUrl: null, description: null, tagline: null, stats: { scoreEvent: 0, solvesTotal: 0 },
  });
  await db.collection('teams').doc(evtTeam2Id).collection('members').doc(user3Uid).set({ role: 'captain', joinedAt: new Date().toISOString() });
  summary.push('2 event teams created');

  // ── Admin profile ──
  await db.collection('users').doc(superAdminUid).update({ bio: 'Platform super admin.', course: 'Staff', unit: 'IT Department' });
  await db.collection('users').doc(adminUid).update({ bio: 'Platform admin.', course: 'Staff', unit: 'IT Department' });

  // ── Second class for variety ──
  const class2Id = 'class-networks';
  const class2Code = generateJoinCode();
  await db.collection('classes').doc(class2Id).set({
    name: 'Redes e Infraestrutura', description: 'Análise de tráfego, pacotes e segurança de infraestrutura.',
    createdAt: new Date().toISOString(), ownerInstructorId: instructorUid, inviteCode: class2Code, published: true,
    classType: 'Redes', themeId: 'deep-ocean', icon: '🌊', tags: ['networking', 'infrastructure'],
    settings: { defaultEventVisibility: 'private', allowStudentPublicTeams: true },
  });
  await db.collection('classes').doc(class2Id).collection('members').doc(instructorUid).set({ uid: instructorUid, roleInClass: 'instructor', joinedAt: new Date().toISOString(), displayNameSnapshot: 'Prof. Mdavel' });
  summary.push('2 classes created');

  return { summary };
}
