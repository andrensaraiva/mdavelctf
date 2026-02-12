import { Router, Response } from 'express';
import { verifyFirebaseToken, requireInstructorOrAdmin, requireEventOwnerOrAdmin, AuthRequest } from '../middleware/auth';
import { getDb } from '../firebase';
import { v4 as uuid } from 'uuid';
import { FieldValue } from 'firebase-admin/firestore';
import { asyncHandler } from '../utils/asyncHandler';
import { hashFlag, normalizeFlag } from '../utils/crypto';
import { writeAuditLog } from '../utils/audit';

export const classesRouter = Router();

classesRouter.use(verifyFirebaseToken);

/* ─── Create Class (instructor/admin) ─── */
classesRouter.post('/create', requireInstructorOrAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const uid = req.uid!;
  const { name, description } = req.body;
  if (!name || typeof name !== 'string' || name.length < 2 || name.length > 60) {
    return res.status(400).json({ error: 'Class name must be 2-60 characters' });
  }

  const db = getDb();
  const classId = uuid().slice(0, 12);
  const inviteCode = uuid().slice(0, 6).toUpperCase();

  const classData = {
    name: name.trim(),
    description: description ? String(description).trim().slice(0, 500) : '',
    createdAt: new Date().toISOString(),
    ownerInstructorId: uid,
    inviteCode,
    published: true,
    settings: {
      defaultEventVisibility: 'private' as const,
      allowStudentPublicTeams: true,
    },
  };

  const batch = db.batch();
  batch.set(db.collection('classes').doc(classId), classData);

  // Add creator as instructor member
  batch.set(db.collection('classes').doc(classId).collection('members').doc(uid), {
    uid,
    roleInClass: 'instructor',
    joinedAt: new Date().toISOString(),
    displayNameSnapshot: req.userDoc?.displayName || 'Unknown',
  });

  // Update user's classIds
  batch.update(db.collection('users').doc(uid), {
    classIds: FieldValue.arrayUnion(classId),
  });

  await batch.commit();
  return res.json({ classId, ...classData });
}));

/* ─── Join Class (any authenticated user) ─── */
classesRouter.post('/join', asyncHandler(async (req: AuthRequest, res: Response) => {
  const uid = req.uid!;
  const { inviteCode } = req.body;
  if (!inviteCode || typeof inviteCode !== 'string') {
    return res.status(400).json({ error: 'inviteCode required' });
  }

  const db = getDb();
  const snap = await db.collection('classes')
    .where('inviteCode', '==', inviteCode.toUpperCase())
    .limit(1)
    .get();

  if (snap.empty) return res.status(404).json({ error: 'Invalid invite code' });

  const classDoc = snap.docs[0];
  const classId = classDoc.id;

  // Check if already a member
  const memberSnap = await db.collection('classes').doc(classId).collection('members').doc(uid).get();
  if (memberSnap.exists) {
    return res.status(400).json({ error: 'Already a member of this class' });
  }

  const batch = db.batch();
  batch.set(db.collection('classes').doc(classId).collection('members').doc(uid), {
    uid,
    roleInClass: 'student',
    joinedAt: new Date().toISOString(),
    displayNameSnapshot: req.userDoc?.displayName || 'Unknown',
  });

  batch.update(db.collection('users').doc(uid), {
    classIds: FieldValue.arrayUnion(classId),
  });

  await batch.commit();
  return res.json({ classId, className: classDoc.data().name });
}));

/* ─── Remove Member (instructor/admin of class) ─── */
classesRouter.post('/:classId/remove-member', requireInstructorOrAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { classId } = req.params;
  const { uid: targetUid } = req.body;
  if (!targetUid) return res.status(400).json({ error: 'uid required' });

  const db = getDb();
  const classSnap = await db.collection('classes').doc(classId).get();
  if (!classSnap.exists) return res.status(404).json({ error: 'Class not found' });

  const classData = classSnap.data()!;
  // Only the owner instructor or admin can remove members
  if (req.userRole !== 'admin' && classData.ownerInstructorId !== req.uid) {
    return res.status(403).json({ error: 'Only class owner or admin can remove members' });
  }

  const batch = db.batch();
  batch.delete(db.collection('classes').doc(classId).collection('members').doc(targetUid));
  batch.update(db.collection('users').doc(targetUid), {
    classIds: FieldValue.arrayRemove(classId),
  });

  await batch.commit();
  return res.json({ success: true });
}));

/* ─── My Classes (all roles) ─── */
classesRouter.get('/my', asyncHandler(async (req: AuthRequest, res: Response) => {
  const uid = req.uid!;
  const db = getDb();

  // Collect class IDs from user doc AND from membership subcollections
  const classIdSet = new Set<string>(req.userDoc?.classIds || []);

  // Also scan all classes where user is a member (handles missing classIds field)
  const allClassesSnap = await db.collectionGroup('members')
    .where('uid', '==', uid)
    .get();
  for (const mDoc of allClassesSnap.docs) {
    // Path: classes/{classId}/members/{uid}
    const classId = mDoc.ref.parent.parent?.id;
    if (classId) classIdSet.add(classId);
  }

  if (classIdSet.size === 0) return res.json({ classes: [] });

  const classes: any[] = [];
  for (const cid of classIdSet) {
    const snap = await db.collection('classes').doc(cid).get();
    if (snap.exists) {
      const data = snap.data()!;
      const membersSnap = await db.collection('classes').doc(cid).collection('members').get();
      classes.push({
        id: cid,
        ...data,
        memberCount: membersSnap.size,
        isOwner: data.ownerInstructorId === uid,
      });
    }
  }

  return res.json({ classes });
}));

/* ─── Get Class Details ─── */
classesRouter.get('/:classId', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { classId } = req.params;
  const uid = req.uid!;
  const db = getDb();

  const classSnap = await db.collection('classes').doc(classId).get();
  if (!classSnap.exists) return res.status(404).json({ error: 'Class not found' });

  const classData = classSnap.data()!;
  const membersSnap = await db.collection('classes').doc(classId).collection('members').get();

  // Check if user is member or admin
  const isMember = membersSnap.docs.some((d) => d.id === uid);
  const isAdmin = req.userRole === 'admin';
  const isOwner = classData.ownerInstructorId === uid;

  if (!isMember && !isAdmin) {
    return res.status(403).json({ error: 'Not a member of this class' });
  }

  // Instructor/admin get full member list, students get limited info
  const showFull = isOwner || isAdmin || req.userRole === 'instructor';

  const members = membersSnap.docs.map((d) => {
    const data = d.data();
    if (showFull) {
      return { uid: d.id, ...data };
    }
    return {
      uid: d.id,
      displayNameSnapshot: data.displayNameSnapshot,
      roleInClass: data.roleInClass,
    };
  });

  // Get events for this class
  const eventsSnap = await db.collection('events')
    .where('classId', '==', classId)
    .get();
  const events = eventsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  return res.json({
    class: { id: classId, ...classData, memberCount: membersSnap.size },
    members,
    events,
    isOwner,
  });
}));

/* ─── Rotate Invite Code (owner/admin) ─── */
classesRouter.post('/:classId/rotate-code', requireInstructorOrAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { classId } = req.params;
  const db = getDb();

  const classSnap = await db.collection('classes').doc(classId).get();
  if (!classSnap.exists) return res.status(404).json({ error: 'Class not found' });

  if (req.userRole !== 'admin' && classSnap.data()!.ownerInstructorId !== req.uid) {
    return res.status(403).json({ error: 'Only class owner or admin' });
  }

  const newCode = uuid().slice(0, 6).toUpperCase();
  await db.collection('classes').doc(classId).update({ inviteCode: newCode });

  return res.json({ inviteCode: newCode });
}));

/* ══════════ Instructor Event / Challenge Management ══════════ */

/* ─── List instructor's own events ─── */
classesRouter.get('/instructor/events', requireInstructorOrAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const uid = req.uid!;
  const db = getDb();

  // Events this user directly owns
  let events: any[] = [];
  const ownedSnap = await db.collection('events').where('ownerId', '==', uid).get();
  events = ownedSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Events linked to classes this instructor owns
  const classSnap = await db.collection('classes').where('ownerInstructorId', '==', uid).get();
  for (const cDoc of classSnap.docs) {
    const linkedSnap = await db.collection('events').where('classId', '==', cDoc.id).get();
    for (const eDoc of linkedSnap.docs) {
      if (!events.some((e) => e.id === eDoc.id)) {
        events.push({ id: eDoc.id, ...eDoc.data() });
      }
    }
  }

  return res.json({ events });
}));

/* ─── List challenges for an event (instructor must own the event) ─── */
classesRouter.get('/instructor/events/:eventId/challenges', requireInstructorOrAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { eventId } = req.params;
  const uid = req.uid!;
  const db = getDb();

  // Verify ownership
  const eventSnap = await db.collection('events').doc(eventId).get();
  if (!eventSnap.exists) return res.status(404).json({ error: 'Event not found' });
  const eventData = eventSnap.data()!;

  const isOwner = eventData.ownerId === uid;
  const isAdmin = req.userRole === 'admin';
  let classOwner = false;
  if (eventData.classId) {
    const cSnap = await db.collection('classes').doc(eventData.classId).get();
    if (cSnap.exists && cSnap.data()?.ownerInstructorId === uid) classOwner = true;
  }
  if (!isOwner && !isAdmin && !classOwner) {
    return res.status(403).json({ error: 'Not authorized for this event' });
  }

  const snap = await db.collection('events').doc(eventId).collection('challenges').get();
  const challenges = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return res.json({ challenges });
}));

/* ─── Create challenge (instructor must own the event) ─── */
classesRouter.post('/instructor/challenge', requireInstructorOrAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const {
    eventId, title, category, difficulty, pointsFixed,
    tags, descriptionMd, published, attachments, flagText, caseSensitive,
  } = req.body;
  if (!eventId || !title || !category) {
    return res.status(400).json({ error: 'eventId, title, category required' });
  }

  const uid = req.uid!;
  const db = getDb();

  // Verify ownership
  const eventSnap = await db.collection('events').doc(eventId).get();
  if (!eventSnap.exists) return res.status(404).json({ error: 'Event not found' });
  const eventData = eventSnap.data()!;

  const isOwner = eventData.ownerId === uid;
  const isAdmin = req.userRole === 'admin';
  let classOwner = false;
  if (eventData.classId) {
    const cSnap = await db.collection('classes').doc(eventData.classId).get();
    if (cSnap.exists && cSnap.data()?.ownerInstructorId === uid) classOwner = true;
  }
  if (!isOwner && !isAdmin && !classOwner) {
    return res.status(403).json({ error: 'Not authorized for this event' });
  }

  const ref = db.collection('events').doc(eventId).collection('challenges').doc();
  const data = {
    title,
    category: category.toUpperCase(),
    difficulty: difficulty || 1,
    pointsFixed: pointsFixed || 100,
    tags: tags || [],
    descriptionMd: descriptionMd || '',
    attachments: attachments || [],
    published: published ?? true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await ref.set(data);
  await writeAuditLog(uid, 'CREATE_CHALLENGE', `events/${eventId}/challenges/${ref.id}`, null, data);

  // Set flag if provided
  if (flagText) {
    const cs = caseSensitive === true;
    const normalized = normalizeFlag(flagText, cs);
    const flagHash = hashFlag(normalized);
    await db.collection('events').doc(eventId).collection('challengeSecrets').doc(ref.id).set({
      flagHash,
      caseSensitive: cs,
      createdAt: new Date().toISOString(),
    });
  }

  return res.json({ id: ref.id, eventId, ...data });
}));

/* ─── Set flag for a challenge (instructor must own the event) ─── */
classesRouter.post('/instructor/challenge/:challengeId/set-flag', requireInstructorOrAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { challengeId } = req.params;
  const { eventId, flagText, caseSensitive } = req.body;
  if (!eventId || !flagText) {
    return res.status(400).json({ error: 'eventId and flagText required' });
  }

  const uid = req.uid!;
  const db = getDb();

  // Verify ownership
  const eventSnap = await db.collection('events').doc(eventId).get();
  if (!eventSnap.exists) return res.status(404).json({ error: 'Event not found' });
  const eventData = eventSnap.data()!;

  const isOwner = eventData.ownerId === uid;
  const isAdmin = req.userRole === 'admin';
  let classOwner = false;
  if (eventData.classId) {
    const cSnap = await db.collection('classes').doc(eventData.classId).get();
    if (cSnap.exists && cSnap.data()?.ownerInstructorId === uid) classOwner = true;
  }
  if (!isOwner && !isAdmin && !classOwner) {
    return res.status(403).json({ error: 'Not authorized for this event' });
  }

  const cs = caseSensitive === true;
  const normalized = normalizeFlag(flagText, cs);
  const flagHash = hashFlag(normalized);

  const ref = db.collection('events').doc(eventId).collection('challengeSecrets').doc(challengeId);
  await ref.set({
    flagHash,
    caseSensitive: cs,
    createdAt: new Date().toISOString(),
  });

  await writeAuditLog(uid, 'SET_FLAG', `events/${eventId}/challengeSecrets/${challengeId}`, null, { caseSensitive: cs, hashSet: true });
  return res.json({ success: true });
}));

/* ─── Create event (instructor or admin) ─── */
classesRouter.post('/instructor/event', requireInstructorOrAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { name, startsAt, endsAt, timezone, published, leagueId, visibility, classId, teamMode, requireClassMembership } = req.body;
  if (!name || !startsAt || !endsAt) {
    return res.status(400).json({ error: 'name, startsAt, endsAt required' });
  }

  const uid = req.uid!;
  const db = getDb();

  // If linking to a class, verify user owns it
  if (classId) {
    const cSnap = await db.collection('classes').doc(classId).get();
    if (!cSnap.exists) return res.status(404).json({ error: 'Class not found' });
    if (cSnap.data()?.ownerInstructorId !== uid && req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Not authorized for this class' });
    }
  }

  const ref = db.collection('events').doc();
  const data: Record<string, any> = {
    name,
    startsAt,
    endsAt,
    timezone: timezone || 'UTC',
    published: published ?? true,
    leagueId: leagueId || null,
    visibility: visibility || 'private',
    classId: classId || null,
    ownerId: uid,
    teamMode: teamMode || 'eventTeams',
    requireClassMembership: requireClassMembership ?? (visibility === 'private'),
    createdAt: new Date().toISOString(),
  };
  await ref.set(data);
  await writeAuditLog(uid, 'CREATE_EVENT', `events/${ref.id}`, null, data);
  return res.json({ id: ref.id, ...data });
}));
