import { Router, Response } from 'express';
import { verifyFirebaseToken, requireInstructorOrAdmin, AuthRequest } from '../middleware/auth';
import { getDb } from '../firebase';
import { v4 as uuid } from 'uuid';
import { FieldValue } from 'firebase-admin/firestore';
import { asyncHandler } from '../utils/asyncHandler';

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

  const classIds: string[] = req.userDoc?.classIds || [];
  if (classIds.length === 0) return res.json({ classes: [] });

  const classes: any[] = [];
  for (const cid of classIds) {
    const snap = await db.collection('classes').doc(cid).get();
    if (snap.exists) {
      const data = snap.data()!;
      // Get member count
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
    class: { id: classId, ...classData },
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
