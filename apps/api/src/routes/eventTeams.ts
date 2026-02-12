import { Router, Response } from 'express';
import { verifyFirebaseToken, AuthRequest } from '../middleware/auth';
import { getDb } from '../firebase';
import { v4 as uuid } from 'uuid';
import { asyncHandler } from '../utils/asyncHandler';

export const eventTeamsRouter = Router();

eventTeamsRouter.use(verifyFirebaseToken);

/* ─── Helper: check user has access to event ─── */
async function checkEventAccess(db: FirebaseFirestore.Firestore, uid: string, eventId: string): Promise<{ ok: boolean; error?: string }> {
  const eventSnap = await db.collection('events').doc(eventId).get();
  if (!eventSnap.exists) return { ok: false, error: 'Event not found' };

  const event = eventSnap.data()!;
  if (event.visibility !== 'private') return { ok: true };

  // Private event: check class membership
  if (event.classId) {
    const memberSnap = await db.collection('classes').doc(event.classId).collection('members').doc(uid).get();
    if (memberSnap.exists) return { ok: true };
  }

  return { ok: false, error: 'No access to this private event. Join the class first.' };
}

/* ─── Create Event Team ─── */
eventTeamsRouter.post('/create', asyncHandler(async (req: AuthRequest, res: Response) => {
  const uid = req.uid!;
  const { eventId, name, tagline, description } = req.body;
  if (!eventId || !name || typeof name !== 'string' || name.length < 2 || name.length > 30) {
    return res.status(400).json({ error: 'eventId and name (2-30 chars) required' });
  }

  const db = getDb();

  // Check event access
  const access = await checkEventAccess(db, uid, eventId);
  if (!access.ok) return res.status(403).json({ error: access.error });

  // Check if user already has event team for this event
  const existingSnap = await db.collection('teams')
    .where('scope', '==', 'event')
    .where('eventId', '==', eventId)
    .get();

  for (const d of existingSnap.docs) {
    const memberSnap = await db.collection('teams').doc(d.id).collection('members').doc(uid).get();
    if (memberSnap.exists) {
      return res.status(400).json({ error: 'You already have an event team for this event' });
    }
  }

  const eventData = (await db.collection('events').doc(eventId).get()).data()!;

  const teamId = `evt-${uuid().slice(0, 8)}`;
  const joinCode = uuid().slice(0, 6).toUpperCase();

  const batch = db.batch();
  batch.set(db.collection('teams').doc(teamId), {
    name,
    joinCode,
    captainUid: uid,
    memberCount: 1,
    createdAt: new Date().toISOString(),
    scope: 'event',
    eventId,
    classId: eventData.classId || null,
    tagline: tagline ? String(tagline).slice(0, 200) : null,
    description: description ? String(description).slice(0, 500) : null,
    avatarUrl: null,
    stats: { scoreEvent: 0, solvesTotal: 0 },
  });

  batch.set(db.collection('teams').doc(teamId).collection('members').doc(uid), {
    role: 'captain',
    joinedAt: new Date().toISOString(),
  });

  await batch.commit();
  return res.json({ teamId, joinCode, eventId });
}));

/* ─── Join Event Team ─── */
eventTeamsRouter.post('/join', asyncHandler(async (req: AuthRequest, res: Response) => {
  const uid = req.uid!;
  const { eventId, joinCode } = req.body;
  if (!eventId || !joinCode) return res.status(400).json({ error: 'eventId and joinCode required' });

  const db = getDb();

  // Check event access
  const access = await checkEventAccess(db, uid, eventId);
  if (!access.ok) return res.status(403).json({ error: access.error });

  // Find team by joinCode + eventId
  const snap = await db.collection('teams')
    .where('joinCode', '==', joinCode)
    .where('scope', '==', 'event')
    .where('eventId', '==', eventId)
    .limit(1)
    .get();

  if (snap.empty) return res.status(404).json({ error: 'Invalid join code for this event' });

  const teamDoc = snap.docs[0];
  const teamId = teamDoc.id;
  const teamData = teamDoc.data();

  // Check if already in a team for this event
  const allEventTeams = await db.collection('teams')
    .where('scope', '==', 'event')
    .where('eventId', '==', eventId)
    .get();

  for (const d of allEventTeams.docs) {
    const memberSnap = await db.collection('teams').doc(d.id).collection('members').doc(uid).get();
    if (memberSnap.exists) {
      return res.status(400).json({ error: 'Already in an event team for this event' });
    }
  }

  const batch = db.batch();
  batch.set(
    db.collection('teams').doc(teamId).collection('members').doc(uid),
    { role: 'member', joinedAt: new Date().toISOString() },
  );
  batch.update(db.collection('teams').doc(teamId), {
    memberCount: (teamData.memberCount || 1) + 1,
  });

  await batch.commit();
  return res.json({ teamId, teamName: teamData.name, eventId });
}));

/* ─── Leave Event Team ─── */
eventTeamsRouter.post('/leave', asyncHandler(async (req: AuthRequest, res: Response) => {
  const uid = req.uid!;
  const { eventId } = req.body;
  if (!eventId) return res.status(400).json({ error: 'eventId required' });

  const db = getDb();

  // Find user's event team for this event
  const allEventTeams = await db.collection('teams')
    .where('scope', '==', 'event')
    .where('eventId', '==', eventId)
    .get();

  let foundTeamId: string | null = null;
  for (const d of allEventTeams.docs) {
    const memberSnap = await db.collection('teams').doc(d.id).collection('members').doc(uid).get();
    if (memberSnap.exists) {
      foundTeamId = d.id;
      break;
    }
  }

  if (!foundTeamId) return res.status(400).json({ error: 'Not in an event team for this event' });

  const teamSnap = await db.collection('teams').doc(foundTeamId).get();
  const teamData = teamSnap.data()!;

  if (teamData.captainUid === uid && teamData.memberCount > 1) {
    return res.status(400).json({ error: 'Transfer captaincy before leaving' });
  }

  const batch = db.batch();
  batch.delete(db.collection('teams').doc(foundTeamId).collection('members').doc(uid));

  if (teamData.memberCount <= 1) {
    batch.delete(db.collection('teams').doc(foundTeamId));
  } else {
    batch.update(db.collection('teams').doc(foundTeamId), {
      memberCount: teamData.memberCount - 1,
    });
  }

  await batch.commit();
  return res.json({ success: true });
}));

/* ─── Get My Event Team ─── */
eventTeamsRouter.get('/me', asyncHandler(async (req: AuthRequest, res: Response) => {
  const uid = req.uid!;
  const eventId = req.query.eventId as string;
  if (!eventId) return res.status(400).json({ error: 'eventId query param required' });

  const db = getDb();

  const allEventTeams = await db.collection('teams')
    .where('scope', '==', 'event')
    .where('eventId', '==', eventId)
    .get();

  for (const d of allEventTeams.docs) {
    const memberSnap = await db.collection('teams').doc(d.id).collection('members').doc(uid).get();
    if (memberSnap.exists) {
      // Load full team data + members
      const membersSnap = await db.collection('teams').doc(d.id).collection('members').get();
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
        team: { id: d.id, ...d.data(), members },
      });
    }
  }

  return res.json({ team: null });
}));
