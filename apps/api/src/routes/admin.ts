import { Router, Response } from 'express';
import { verifyFirebaseToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { getDb, getAuth } from '../firebase';
import { hashFlag, normalizeFlag } from '../utils/crypto';
import { writeAuditLog } from '../utils/audit';
import { DEFAULT_BADGES } from '@mdavelctf/shared';
import { clearSeedData, runSeed } from '../utils/seedData';

export const adminRouter = Router();

// All admin routes require auth + admin
adminRouter.use(verifyFirebaseToken);
adminRouter.use(requireAdmin);

/* ─── Admin Config (public config for the admin UI) ─── */
adminRouter.get('/config', async (_req: AuthRequest, res: Response) => {
  return res.json({
    allowSeedUI: process.env.ALLOW_SEED === 'true',
  });
});

/* ─── Events ─── */
adminRouter.post('/event', async (req: AuthRequest, res: Response) => {
  const { name, startsAt, endsAt, timezone, published, leagueId, visibility, classId, ownerId, teamMode, requireClassMembership } = req.body;
  if (!name || !startsAt || !endsAt) {
    return res.status(400).json({ error: 'name, startsAt, endsAt required' });
  }
  const db = getDb();
  const ref = db.collection('events').doc();
  const data: Record<string, any> = {
    name,
    startsAt,
    endsAt,
    timezone: timezone || 'UTC',
    published: published ?? false,
    leagueId: leagueId || null,
    visibility: visibility || 'public',
    classId: classId || null,
    ownerId: ownerId || req.uid,
    teamMode: teamMode || 'publicTeams',
    requireClassMembership: requireClassMembership ?? false,
    createdAt: new Date().toISOString(),
  };
  await ref.set(data);
  await writeAuditLog(req.uid!, 'CREATE_EVENT', `events/${ref.id}`, null, data);
  return res.json({ id: ref.id, ...data });
});

adminRouter.put('/event/:eventId', async (req: AuthRequest, res: Response) => {
  const { eventId } = req.params;
  const db = getDb();
  const ref = db.collection('events').doc(eventId);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: 'Not found' });

  const before = snap.data();
  const updates: Record<string, any> = {};
  const allowed = ['name', 'startsAt', 'endsAt', 'timezone', 'published', 'leagueId', 'visibility', 'classId', 'ownerId', 'teamMode', 'requireClassMembership'];
  for (const k of allowed) {
    if (req.body[k] !== undefined) updates[k] = req.body[k];
  }
  await ref.update(updates);
  await writeAuditLog(req.uid!, 'UPDATE_EVENT', `events/${eventId}`, before, updates);
  return res.json({ id: eventId, ...updates });
});

/* ─── Leagues ─── */
adminRouter.post('/league', async (req: AuthRequest, res: Response) => {
  const { name, startsAt, endsAt, published, eventIds } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const db = getDb();
  const ref = db.collection('leagues').doc();
  const data = {
    name,
    startsAt: startsAt || new Date().toISOString(),
    endsAt: endsAt || new Date(Date.now() + 90 * 86400000).toISOString(),
    published: published ?? false,
    eventIds: eventIds || [],
    createdAt: new Date().toISOString(),
  };
  await ref.set(data);
  await writeAuditLog(req.uid!, 'CREATE_LEAGUE', `leagues/${ref.id}`, null, data);
  return res.json({ id: ref.id, ...data });
});

adminRouter.put('/league/:leagueId', async (req: AuthRequest, res: Response) => {
  const { leagueId } = req.params;
  const db = getDb();
  const ref = db.collection('leagues').doc(leagueId);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: 'Not found' });

  const before = snap.data();
  const updates: Record<string, any> = {};
  const allowed = ['name', 'startsAt', 'endsAt', 'published', 'eventIds'];
  for (const k of allowed) {
    if (req.body[k] !== undefined) updates[k] = req.body[k];
  }
  await ref.update(updates);
  await writeAuditLog(req.uid!, 'UPDATE_LEAGUE', `leagues/${leagueId}`, before, updates);
  return res.json({ id: leagueId, ...updates });
});

/* ─── Challenges ─── */
adminRouter.post('/challenge', async (req: AuthRequest, res: Response) => {
  const {
    eventId, title, category, difficulty, pointsFixed,
    tags, descriptionMd, published, attachments,
  } = req.body;
  if (!eventId || !title || !category) {
    return res.status(400).json({ error: 'eventId, title, category required' });
  }
  const db = getDb();
  const ref = db.collection('events').doc(eventId).collection('challenges').doc();
  const data = {
    title,
    category: category.toUpperCase(),
    difficulty: difficulty || 1,
    pointsFixed: pointsFixed || 100,
    tags: tags || [],
    descriptionMd: descriptionMd || '',
    attachments: attachments || [],
    published: published ?? false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await ref.set(data);
  await writeAuditLog(req.uid!, 'CREATE_CHALLENGE', `events/${eventId}/challenges/${ref.id}`, null, data);
  return res.json({ id: ref.id, eventId, ...data });
});

adminRouter.put('/challenge/:challengeId', async (req: AuthRequest, res: Response) => {
  const { challengeId } = req.params;
  const { eventId } = req.body;
  if (!eventId) return res.status(400).json({ error: 'eventId required' });

  const db = getDb();
  const ref = db.collection('events').doc(eventId).collection('challenges').doc(challengeId);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: 'Not found' });

  const before = snap.data();
  const updates: Record<string, any> = { updatedAt: new Date().toISOString() };
  const allowed = [
    'title', 'category', 'difficulty', 'pointsFixed',
    'tags', 'descriptionMd', 'published', 'attachments',
  ];
  for (const k of allowed) {
    if (req.body[k] !== undefined) updates[k] = req.body[k];
  }
  await ref.update(updates);
  await writeAuditLog(req.uid!, 'UPDATE_CHALLENGE', `events/${eventId}/challenges/${challengeId}`, before, updates);
  return res.json({ id: challengeId, ...updates });
});

/* ─── Set Flag ─── */
adminRouter.post('/challenge/:challengeId/set-flag', async (req: AuthRequest, res: Response) => {
  const { challengeId } = req.params;
  const { eventId, flagText, caseSensitive } = req.body;
  if (!eventId || !flagText) {
    return res.status(400).json({ error: 'eventId and flagText required' });
  }

  const cs = caseSensitive === true;
  const normalized = normalizeFlag(flagText, cs);
  const flagHash = hashFlag(normalized);

  const db = getDb();
  const ref = db.collection('events').doc(eventId).collection('challengeSecrets').doc(challengeId);
  await ref.set({
    flagHash,
    caseSensitive: cs,
    createdAt: new Date().toISOString(),
  });

  await writeAuditLog(
    req.uid!,
    'SET_FLAG',
    `events/${eventId}/challengeSecrets/${challengeId}`,
    null,
    { caseSensitive: cs, hashSet: true },
  );

  return res.json({ success: true });
});

/* ─── Submission Logs (cursor-based) ─── */
adminRouter.get('/logs/submissions', async (req: AuthRequest, res: Response) => {
  const { eventId, challengeId, uid, correctOnly, cursor, limit: limitStr } = req.query;
  if (!eventId) return res.status(400).json({ error: 'eventId required' });

  const db = getDb();
  const pageLimit = Math.min(Number(limitStr) || 50, 100);

  let query: FirebaseFirestore.Query = db
    .collection('events')
    .doc(eventId as string)
    .collection('submissions')
    .orderBy('submittedAt', 'desc');

  if (challengeId) query = query.where('challengeId', '==', challengeId);
  if (uid) query = query.where('uid', '==', uid);
  if (correctOnly === 'true') query = query.where('isCorrect', '==', true);
  if (cursor) query = query.startAfter(cursor as string);

  query = query.limit(pageLimit);
  const snap = await query.get();
  const results = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Resolve display names
  const uidSet = new Set(results.map((r: any) => r.uid));
  const nameMap: Record<string, string> = {};
  for (const u of uidSet) {
    try {
      const uSnap = await db.collection('users').doc(u).get();
      nameMap[u] = uSnap.data()?.displayName || u.slice(0, 8);
    } catch { nameMap[u] = u.slice(0, 8); }
  }

  // Resolve challenge titles
  const cidSet = new Set(results.map((r: any) => r.challengeId));
  const chalMap: Record<string, string> = {};
  for (const c of cidSet) {
    try {
      const cSnap = await db.collection('events').doc(eventId as string).collection('challenges').doc(c).get();
      chalMap[c] = cSnap.data()?.title || c.slice(0, 8);
    } catch { chalMap[c] = c.slice(0, 8); }
  }

  const enriched = results.map((r: any) => ({
    ...r,
    displayName: nameMap[r.uid] || r.uid?.slice(0, 8),
    challengeTitle: chalMap[r.challengeId] || r.challengeId?.slice(0, 8),
  }));

  const nextCursor = snap.docs.length === pageLimit ? snap.docs[snap.docs.length - 1].data().submittedAt : null;
  return res.json({ submissions: enriched, nextCursor });
});

/* ─── Solve Logs (cursor-based) ─── */
adminRouter.get('/logs/solves', async (req: AuthRequest, res: Response) => {
  const { eventId, cursor, limit: limitStr } = req.query;
  if (!eventId) return res.status(400).json({ error: 'eventId required' });

  const db = getDb();
  const pageLimit = Math.min(Number(limitStr) || 50, 100);

  let query: FirebaseFirestore.Query = db
    .collection('events')
    .doc(eventId as string)
    .collection('solves')
    .orderBy('solvedAt', 'desc');

  if (cursor) query = query.startAfter(cursor as string);
  query = query.limit(pageLimit);

  const snap = await query.get();
  const results = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Resolve display names & challenge titles
  const uidSet = new Set(results.map((r: any) => r.uid));
  const nameMap: Record<string, string> = {};
  for (const u of uidSet) {
    try {
      const uSnap = await db.collection('users').doc(u).get();
      nameMap[u] = uSnap.data()?.displayName || u.slice(0, 8);
    } catch { nameMap[u] = u.slice(0, 8); }
  }
  const cidSet = new Set(results.map((r: any) => r.challengeId));
  const chalMap: Record<string, string> = {};
  for (const c of cidSet) {
    try {
      const cSnap = await db.collection('events').doc(eventId as string).collection('challenges').doc(c).get();
      chalMap[c] = cSnap.data()?.title || c.slice(0, 8);
    } catch { chalMap[c] = c.slice(0, 8); }
  }

  const enriched = results.map((r: any) => ({
    ...r,
    displayName: nameMap[r.uid] || r.uid?.slice(0, 8),
    challengeTitle: chalMap[r.challengeId] || r.challengeId?.slice(0, 8),
  }));

  const nextCursor = snap.docs.length === pageLimit ? snap.docs[snap.docs.length - 1].data().solvedAt : null;
  return res.json({ solves: enriched, nextCursor });
});

/* ─── Disable / Enable User ─── */
adminRouter.post('/user/:uid/disable', async (req: AuthRequest, res: Response) => {
  const targetUid = req.params.uid;
  const db = getDb();
  const before = (await db.collection('users').doc(targetUid).get()).data();
  await db.collection('users').doc(targetUid).update({ disabled: true });
  await writeAuditLog(req.uid!, 'DISABLE_USER', `users/${targetUid}`, before, { disabled: true });
  return res.json({ success: true });
});

adminRouter.post('/user/:uid/enable', async (req: AuthRequest, res: Response) => {
  const targetUid = req.params.uid;
  const db = getDb();
  const before = (await db.collection('users').doc(targetUid).get()).data();
  await db.collection('users').doc(targetUid).update({ disabled: false });
  await writeAuditLog(req.uid!, 'ENABLE_USER', `users/${targetUid}`, before, { disabled: false });
  return res.json({ success: true });
});

/* ─── Seed Default Badges ─── */
adminRouter.post('/badges/seed-default', async (req: AuthRequest, res: Response) => {
  const db = getDb();
  const batch = db.batch();
  let count = 0;

  for (const [key, badge] of Object.entries(DEFAULT_BADGES)) {
    batch.set(db.collection('badges').doc(key), badge);
    count++;
  }

  await batch.commit();
  await writeAuditLog(req.uid!, 'SEED_BADGES', 'badges/*', null, { count });
  return res.json({ success: true, count });
});

/* ─── Seed Default Quests ─── */
adminRouter.post('/quests/seed-default', async (req: AuthRequest, res: Response) => {
  const db = getDb();
  const now = new Date();
  const weekEnd = new Date(now.getTime() + 7 * 86400000);

  const defaultQuests = [
    {
      title: 'Weekly Warrior',
      description: 'Solve 3 challenges this week',
      activeFrom: now.toISOString(),
      activeTo: weekEnd.toISOString(),
      xpReward: 150,
      rules: { type: 'solve_total', target: 3 },
    },
    {
      title: 'Web Hunter',
      description: 'Solve 2 WEB challenges this week',
      activeFrom: now.toISOString(),
      activeTo: weekEnd.toISOString(),
      xpReward: 100,
      rules: { type: 'solve_category', target: 2, category: 'WEB' },
    },
    {
      title: 'Crypto Starter',
      description: 'Solve 1 CRYPTO challenge this week',
      activeFrom: now.toISOString(),
      activeTo: weekEnd.toISOString(),
      xpReward: 75,
      rules: { type: 'solve_category', target: 1, category: 'CRYPTO' },
    },
  ];

  const batch = db.batch();
  for (const quest of defaultQuests) {
    const ref = db.collection('quests').doc();
    batch.set(ref, quest);
  }
  await batch.commit();
  await writeAuditLog(req.uid!, 'SEED_QUESTS', 'quests/*', null, { count: defaultQuests.length });
  return res.json({ success: true, count: defaultQuests.length });
});

/* ─── Dashboard Summary ─── */
adminRouter.get('/dashboard/summary', async (req: AuthRequest, res: Response) => {
  const db = getDb();

  const usersSnap = await db.collection('users').get();
  const eventsSnap = await db.collection('events').get();

  let submissionsLast60m = 0;
  let solvesLast60m = 0;
  const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
  const recentSubmissions: any[] = [];
  const recentSolves: any[] = [];
  const challengeStats: Record<string, { wrong: number; solves: number; title?: string; category?: string; difficulty?: number; points?: number }> = {};
  const userSubCounts: Record<string, { uid: string; displayName: string; count: number }> = {};
  let liveEventName: string | undefined;
  let liveEventEndsAt: string | undefined;

  // Preload usernames
  const userNameMap: Record<string, string> = {};
  usersSnap.docs.forEach((d) => { userNameMap[d.id] = d.data().displayName || d.id.slice(0, 8); });

  for (const eventDoc of eventsSnap.docs) {
    const eid = eventDoc.id;
    const eventData = eventDoc.data();

    // Track live event
    const now = Date.now();
    if (now >= new Date(eventData.startsAt).getTime() && now <= new Date(eventData.endsAt).getTime()) {
      liveEventName = eventData.name;
      liveEventEndsAt = eventData.endsAt;
    }

    // Preload challenge titles for this event
    const chalSnap = await db.collection('events').doc(eid).collection('challenges').get();
    const chalMap: Record<string, any> = {};
    chalSnap.docs.forEach((c) => { chalMap[c.id] = c.data(); });

    // Recent submissions
    const subsSnap = await db.collection('events').doc(eid)
      .collection('submissions')
      .where('submittedAt', '>=', oneHourAgo)
      .orderBy('submittedAt', 'desc')
      .limit(50)
      .get();

    for (const s of subsSnap.docs) {
      const data = s.data();
      if (data.isCorrect) solvesLast60m++;
      submissionsLast60m++;

      // Track top active users
      if (!userSubCounts[data.uid]) {
        userSubCounts[data.uid] = { uid: data.uid, displayName: userNameMap[data.uid] || data.uid.slice(0, 8), count: 0 };
      }
      userSubCounts[data.uid].count++;

      if (recentSubmissions.length < 50) {
        recentSubmissions.push({
          id: s.id,
          eventId: eid,
          ...data,
          displayName: userNameMap[data.uid] || data.uid.slice(0, 8),
          challengeTitle: chalMap[data.challengeId]?.title || data.challengeId?.slice(0, 8),
        });
      }
    }

    // Recent solves
    const solvesSnap = await db.collection('events').doc(eid)
      .collection('solves')
      .orderBy('solvedAt', 'desc')
      .limit(50)
      .get();

    for (const s of solvesSnap.docs) {
      if (recentSolves.length < 50) {
        const data = s.data();
        recentSolves.push({
          id: s.id,
          eventId: eid,
          ...data,
          displayName: userNameMap[data.uid] || data.uid.slice(0, 8),
          challengeTitle: chalMap[data.challengeId]?.title || data.challengeId?.slice(0, 8),
        });
      }
    }

    // Challenge stats from analytics
    const analyticsSnap = await db.doc(`events/${eid}/analytics/summary`).get();
    if (analyticsSnap.exists) {
      const a = analyticsSnap.data()!;
      for (const [cid, count] of Object.entries(a.solvesByChallenge || {})) {
        if (!challengeStats[cid]) {
          const c = chalMap[cid];
          challengeStats[cid] = { wrong: 0, solves: 0, title: c?.title, category: c?.category, difficulty: c?.difficulty, points: c?.pointsFixed };
        }
        challengeStats[cid].solves += count as number;
      }
      for (const [cid, count] of Object.entries(a.wrongByChallenge || {})) {
        if (!challengeStats[cid]) {
          const c = chalMap[cid];
          challengeStats[cid] = { wrong: 0, solves: 0, title: c?.title, category: c?.category, difficulty: c?.difficulty, points: c?.pointsFixed };
        }
        challengeStats[cid].wrong += count as number;
      }
    }
  }

  const topHardChallenges = Object.entries(challengeStats)
    .map(([challengeId, s]) => ({ challengeId, ...s }))
    .sort((a, b) => b.wrong - a.wrong)
    .slice(0, 5);

  const topActiveUsers = Object.values(userSubCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((u) => ({ uid: u.uid, displayName: u.displayName, submissionCount: u.count }));

  const solveRate = submissionsLast60m > 0 ? Math.round((solvesLast60m / submissionsLast60m) * 100) : 0;

  return res.json({
    activeUsersLast15m: Object.keys(userSubCounts).length,
    submissionsLast60m,
    solvesLast60m,
    solveRate,
    topHardChallenges,
    topActiveUsers,
    recentSubmissions: recentSubmissions.slice(0, 50),
    recentSolves: recentSolves.slice(0, 50),
    totalUsers: usersSnap.size,
    totalEvents: eventsSnap.size,
    liveEventName,
    liveEventEndsAt,
  });
});

/* ─── Clear Seed Data (keep admin only) ─── */
adminRouter.post('/seed/clear', async (req: AuthRequest, res: Response) => {
  // Require ALLOW_SEED=true or valid SEED_TOKEN
  if (!isSeedAllowed(req)) {
    return res.status(403).json({ error: 'Seed operations not allowed. Set ALLOW_SEED=true or provide valid SEED_TOKEN header.' });
  }
  try {
    const result = await clearSeedData();
    await writeAuditLog(req.uid!, 'CLEAR_SEED', 'seed/*', null, { deletedCount: result.deleted.length });
    return res.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[CLEAR_SEED]', err);
    return res.status(500).json({ error: err.message || 'Failed to clear seed data' });
  }
});

/* ─── Re-Seed Demo Data ─── */
adminRouter.post('/seed/run', async (req: AuthRequest, res: Response) => {
  // Require ALLOW_SEED=true or valid SEED_TOKEN
  if (!isSeedAllowed(req)) {
    return res.status(403).json({ error: 'Seed operations not allowed. Set ALLOW_SEED=true or provide valid SEED_TOKEN header.' });
  }
  try {
    const mode: 'minimal' | 'full' = req.body?.mode === 'minimal' ? 'minimal' : 'full';
    const result = await runSeed(mode);
    await writeAuditLog(req.uid!, 'RUN_SEED', 'seed/*', null, { mode, steps: result.summary.length });
    return res.json({ success: true, mode, ...result });
  } catch (err: any) {
    console.error('[RUN_SEED]', err);
    return res.status(500).json({ error: err.message || 'Failed to run seed' });
  }
});

/** Check if seed operations are allowed via env vars or token */
function isSeedAllowed(req: AuthRequest): boolean {
  // Allow if ALLOW_SEED=true
  if (process.env.ALLOW_SEED === 'true') return true;
  // Allow if valid SEED_TOKEN header matches
  const seedToken = process.env.SEED_TOKEN;
  if (seedToken && req.headers['x-seed-token'] === seedToken) return true;
  return false;
}
