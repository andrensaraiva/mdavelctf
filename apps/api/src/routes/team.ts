import { Router, Response } from 'express';
import { verifyFirebaseToken, AuthRequest } from '../middleware/auth';
import { getDb } from '../firebase';
import { v4 as uuid } from 'uuid';

export const teamRouter = Router();

// Create team
teamRouter.post('/create', verifyFirebaseToken, async (req: AuthRequest, res: Response) => {
  const uid = req.uid!;
  const { name } = req.body;
  if (!name || typeof name !== 'string' || name.length < 2 || name.length > 30) {
    return res.status(400).json({ error: 'Team name must be 2-30 characters' });
  }

  const db = getDb();
  const userDoc = req.userDoc!;
  if (userDoc.teamId) {
    return res.status(400).json({ error: 'You are already in a team. Leave first.' });
  }

  const teamId = uuid().slice(0, 8);
  const joinCode = uuid().slice(0, 6).toUpperCase();

  const batch = db.batch();
  const teamRef = db.collection('teams').doc(teamId);
  batch.set(teamRef, {
    name,
    joinCode,
    captainUid: uid,
    memberCount: 1,
    createdAt: new Date().toISOString(),
  });

  batch.set(teamRef.collection('members').doc(uid), {
    role: 'captain',
    joinedAt: new Date().toISOString(),
  });

  batch.update(db.collection('users').doc(uid), { teamId });
  await batch.commit();

  return res.json({ teamId, joinCode });
});

// Join team
teamRouter.post('/join', verifyFirebaseToken, async (req: AuthRequest, res: Response) => {
  const uid = req.uid!;
  const { joinCode } = req.body;
  if (!joinCode) return res.status(400).json({ error: 'joinCode required' });

  const db = getDb();
  const userDoc = req.userDoc!;
  if (userDoc.teamId) {
    return res.status(400).json({ error: 'Already in a team' });
  }

  const snap = await db
    .collection('teams')
    .where('joinCode', '==', joinCode)
    .limit(1)
    .get();
  if (snap.empty) return res.status(404).json({ error: 'Invalid join code' });

  const teamDoc = snap.docs[0];
  const teamId = teamDoc.id;
  const teamData = teamDoc.data();

  const batch = db.batch();
  batch.set(
    db.collection('teams').doc(teamId).collection('members').doc(uid),
    { role: 'member', joinedAt: new Date().toISOString() },
  );
  batch.update(db.collection('teams').doc(teamId), {
    memberCount: (teamData.memberCount || 1) + 1,
  });
  batch.update(db.collection('users').doc(uid), { teamId });
  await batch.commit();

  return res.json({ teamId, teamName: teamData.name });
});

// Leave team
teamRouter.post('/leave', verifyFirebaseToken, async (req: AuthRequest, res: Response) => {
  const uid = req.uid!;
  const db = getDb();
  const userDoc = req.userDoc!;
  if (!userDoc.teamId) return res.status(400).json({ error: 'Not in a team' });

  const teamId = userDoc.teamId;
  const teamSnap = await db.collection('teams').doc(teamId).get();
  if (!teamSnap.exists) return res.status(404).json({ error: 'Team not found' });

  const teamData = teamSnap.data()!;
  const batch = db.batch();

  // If captain and team has other members, prevent leaving
  if (teamData.captainUid === uid && teamData.memberCount > 1) {
    return res.status(400).json({ error: 'Transfer captaincy before leaving' });
  }

  batch.delete(db.collection('teams').doc(teamId).collection('members').doc(uid));
  batch.update(db.collection('users').doc(uid), { teamId: null });

  if (teamData.memberCount <= 1) {
    batch.delete(db.collection('teams').doc(teamId));
  } else {
    batch.update(db.collection('teams').doc(teamId), {
      memberCount: teamData.memberCount - 1,
    });
  }

  await batch.commit();
  return res.json({ success: true });
});

// Rotate join code (captain only)
teamRouter.post('/rotate-code', verifyFirebaseToken, async (req: AuthRequest, res: Response) => {
  const uid = req.uid!;
  const db = getDb();
  const userDoc = req.userDoc!;
  if (!userDoc.teamId) return res.status(400).json({ error: 'Not in a team' });

  const teamId = userDoc.teamId;
  const teamSnap = await db.collection('teams').doc(teamId).get();
  if (!teamSnap.exists) return res.status(404).json({ error: 'Team not found' });
  if (teamSnap.data()!.captainUid !== uid) {
    return res.status(403).json({ error: 'Only captain can rotate code' });
  }

  const newCode = uuid().slice(0, 6).toUpperCase();
  await db.collection('teams').doc(teamId).update({ joinCode: newCode });

  return res.json({ joinCode: newCode });
});

// Update team (captain only)
teamRouter.post('/update', verifyFirebaseToken, async (req: AuthRequest, res: Response) => {
  const uid = req.uid!;
  const db = getDb();
  const userDoc = req.userDoc!;
  if (!userDoc.teamId) return res.status(400).json({ error: 'Not in a team' });

  const teamId = userDoc.teamId;
  const teamSnap = await db.collection('teams').doc(teamId).get();
  if (!teamSnap.exists) return res.status(404).json({ error: 'Team not found' });
  if (teamSnap.data()!.captainUid !== uid) {
    return res.status(403).json({ error: 'Only captain can update team' });
  }

  const allowed = ['name', 'description', 'tagline', 'avatarUrl'] as const;
  const updates: Record<string, any> = {};
  for (const k of allowed) {
    if (req.body[k] !== undefined) {
      const maxLen = k === 'description' ? 500 : k === 'name' ? 30 : 200;
      const val = String(req.body[k]).slice(0, maxLen);
      if (k === 'name' && val.length < 2) {
        return res.status(400).json({ error: 'Team name must be 2-30 characters' });
      }
      updates[k] = val;
    }
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  await db.collection('teams').doc(teamId).update(updates);
  return res.json({ success: true, updated: updates });
});

// Send team chat message
teamRouter.post('/chat/send', verifyFirebaseToken, async (req: AuthRequest, res: Response) => {
  const uid = req.uid!;
  const db = getDb();
  const userDoc = req.userDoc!;
  if (!userDoc.teamId) return res.status(400).json({ error: 'Not in a team' });

  const { text } = req.body;
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({ error: 'Message text required' });
  }

  const teamId = userDoc.teamId;
  const msgRef = db.collection('teams').doc(teamId).collection('chat').doc();
  await msgRef.set({
    uid,
    displayName: userDoc.displayName || 'Unknown',
    avatarUrl: userDoc.avatarUrl || null,
    text: text.trim().slice(0, 500),
    createdAt: new Date().toISOString(),
  });

  return res.json({ success: true, messageId: msgRef.id });
});

// Get team chat (cursor-based)
teamRouter.get('/chat', verifyFirebaseToken, async (req: AuthRequest, res: Response) => {
  const uid = req.uid!;
  const db = getDb();
  const userDoc = req.userDoc!;
  if (!userDoc.teamId) return res.status(400).json({ error: 'Not in a team' });

  const teamId = userDoc.teamId;
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const cursor = req.query.cursor as string | undefined;

  let q = db.collection('teams').doc(teamId)
    .collection('chat')
    .orderBy('createdAt', 'desc');

  if (cursor) {
    // cursor is the createdAt ISO string of the last message in the older direction
    q = q.startAfter(cursor);
  }

  q = q.limit(limit);
  const snap = await q.get();

  const messages = snap.docs.map((d) => ({ id: d.id, ...d.data() })).reverse();
  const nextCursor = snap.docs.length === limit ? snap.docs[snap.docs.length - 1].data().createdAt : null;
  return res.json({ messages, nextCursor });
});

// Get my team
teamRouter.get('/me', verifyFirebaseToken, async (req: AuthRequest, res: Response) => {
  const uid = req.uid!;
  const db = getDb();
  const userDoc = req.userDoc!;
  if (!userDoc.teamId) return res.json({ team: null });

  const teamId = userDoc.teamId;
  const teamSnap = await db.collection('teams').doc(teamId).get();
  if (!teamSnap.exists) return res.json({ team: null });

  const membersSnap = await db
    .collection('teams')
    .doc(teamId)
    .collection('members')
    .get();

  const members = await Promise.all(
    membersSnap.docs.map(async (m) => {
      const uSnap = await db.collection('users').doc(m.id).get();
      const uData = uSnap.data();
      return {
        uid: m.id,
        displayName: uData?.displayName || 'Unknown',
        avatarUrl: uData?.avatarUrl || null,
        xp: uData?.xp || 0,
        level: uData?.level || 1,
        ...m.data(),
      };
    }),
  );

  return res.json({
    team: { id: teamId, ...teamSnap.data(), members },
  });
});

// Get team recent activity (solves by members)
teamRouter.get('/activity', verifyFirebaseToken, async (req: AuthRequest, res: Response) => {
  const db = getDb();
  const userDoc = req.userDoc!;
  if (!userDoc.teamId) return res.status(400).json({ error: 'Not in a team' });

  const teamId = userDoc.teamId;
  const limit = Math.min(Number(req.query.limit) || 10, 30);

  // Gather member UIDs
  const membersSnap = await db.collection('teams').doc(teamId).collection('members').get();
  const memberUids = membersSnap.docs.map((d) => d.id);
  if (memberUids.length === 0) return res.json({ activity: [] });

  // Gather recent solves from all events for those members
  const eventsSnap = await db.collection('events').get();
  const allSolves: any[] = [];

  for (const eDo of eventsSnap.docs) {
    const eid = eDo.id;
    const solvesSnap = await db.collection('events').doc(eid)
      .collection('solves')
      .where('teamId', '==', teamId)
      .orderBy('solvedAt', 'desc')
      .limit(limit)
      .get();

    for (const s of solvesSnap.docs) {
      const data = s.data();
      // Look up challenge title
      let challengeTitle = '';
      let category = '';
      try {
        const cSnap = await db.collection('events').doc(eid).collection('challenges').doc(data.challengeId).get();
        if (cSnap.exists) {
          challengeTitle = cSnap.data()?.title || '';
          category = cSnap.data()?.category || '';
        }
      } catch {}

      // Look up user displayName
      let displayName = '';
      try {
        const uSnap = await db.collection('users').doc(data.uid).get();
        displayName = uSnap.data()?.displayName || data.uid.slice(0, 8);
      } catch {}

      allSolves.push({
        uid: data.uid,
        displayName,
        challengeId: data.challengeId,
        challengeTitle,
        category,
        pointsAwarded: data.pointsAwarded || 0,
        solvedAt: data.solvedAt,
        eventId: eid,
      });
    }
  }

  // Sort by solvedAt desc and take limit
  allSolves.sort((a, b) => b.solvedAt.localeCompare(a.solvedAt));
  return res.json({ activity: allSolves.slice(0, limit) });
});
