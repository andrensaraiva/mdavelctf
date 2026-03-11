import { Router, Response } from 'express';
import { verifyFirebaseToken, requireInstructorOrAdmin, requireEventOwnerOrAdmin, AuthRequest } from '../middleware/auth';
import { getDb } from '../firebase';
import { writeAuditLog } from '../utils/audit';
import { asyncHandler } from '../utils/asyncHandler';

export const hintsRouter = Router();

/* ─────────────────────────────────────
   ADMIN / INSTRUCTOR HINT MANAGEMENT
   ───────────────────────────────────── */

// Create hint for a challenge
hintsRouter.post(
  '/admin/challenges/:challengeId/hints',
  verifyFirebaseToken,
  requireInstructorOrAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { challengeId } = req.params;
    const { eventId, title, content, order, cost } = req.body;
    if (!eventId || !content || order === undefined || cost === undefined) {
      return res.status(400).json({ error: 'eventId, content, order, cost required' });
    }

    // Verify challenge exists
    const db = getDb();
    const chalRef = db.collection('events').doc(eventId).collection('challenges').doc(challengeId);
    const chalSnap = await chalRef.get();
    if (!chalSnap.exists) return res.status(404).json({ error: 'Challenge not found' });

    // Check permission: admin or event owner
    if (req.userRole !== 'admin') {
      const eventSnap = await db.collection('events').doc(eventId).get();
      if (!eventSnap.exists) return res.status(404).json({ error: 'Event not found' });
      const eventData = eventSnap.data()!;
      const isOwner = eventData.ownerId === req.uid;
      let isClassOwner = false;
      if (eventData.classId && req.userRole === 'instructor') {
        const classSnap = await db.collection('classes').doc(eventData.classId).get();
        isClassOwner = classSnap.exists && classSnap.data()?.ownerInstructorId === req.uid;
      }
      if (!isOwner && !isClassOwner) {
        return res.status(403).json({ error: 'You do not have access to this event' });
      }
    }

    const ref = chalRef.collection('hints').doc();
    const data = {
      title: title || null,
      content,
      order: Number(order),
      cost: Math.max(0, Number(cost)),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await ref.set(data);
    await writeAuditLog(req.uid!, 'CREATE_HINT', `events/${eventId}/challenges/${challengeId}/hints/${ref.id}`, null, data);
    return res.json({ id: ref.id, ...data });
  }),
);

// Update hint
hintsRouter.put(
  '/admin/challenges/:challengeId/hints/:hintId',
  verifyFirebaseToken,
  requireInstructorOrAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { challengeId, hintId } = req.params;
    const { eventId } = req.body;
    if (!eventId) return res.status(400).json({ error: 'eventId required' });

    const db = getDb();
    const ref = db.collection('events').doc(eventId).collection('challenges').doc(challengeId).collection('hints').doc(hintId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Hint not found' });

    const before = snap.data();
    const updates: Record<string, any> = { updatedAt: new Date().toISOString() };
    for (const k of ['title', 'content', 'order', 'cost']) {
      if (req.body[k] !== undefined) {
        updates[k] = k === 'order' || k === 'cost' ? Number(req.body[k]) : req.body[k];
      }
    }
    await ref.update(updates);
    await writeAuditLog(req.uid!, 'UPDATE_HINT', `events/${eventId}/challenges/${challengeId}/hints/${hintId}`, before, updates);
    return res.json({ id: hintId, ...updates });
  }),
);

// Delete hint
hintsRouter.delete(
  '/admin/challenges/:challengeId/hints/:hintId',
  verifyFirebaseToken,
  requireInstructorOrAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { challengeId, hintId } = req.params;
    const eventId = req.query.eventId as string;
    if (!eventId) return res.status(400).json({ error: 'eventId query param required' });

    const db = getDb();
    const ref = db.collection('events').doc(eventId).collection('challenges').doc(challengeId).collection('hints').doc(hintId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Hint not found' });

    const before = snap.data();
    await ref.delete();
    await writeAuditLog(req.uid!, 'DELETE_HINT', `events/${eventId}/challenges/${challengeId}/hints/${hintId}`, before, null);
    return res.json({ success: true });
  }),
);

// List hints (admin view — returns content)
hintsRouter.get(
  '/admin/challenges/:challengeId/hints',
  verifyFirebaseToken,
  requireInstructorOrAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { challengeId } = req.params;
    const eventId = req.query.eventId as string;
    if (!eventId) return res.status(400).json({ error: 'eventId query param required' });

    const db = getDb();
    const snap = await db.collection('events').doc(eventId).collection('challenges').doc(challengeId)
      .collection('hints').orderBy('order', 'asc').get();
    const hints = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return res.json({ hints });
  }),
);

/* ─────────────────────────────────────
   PARTICIPANT HINT ENDPOINTS
   ───────────────────────────────────── */

// Get hints for a challenge (participant view — hidden content for locked hints)
hintsRouter.get(
  '/challenges/:challengeId/hints',
  verifyFirebaseToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { challengeId } = req.params;
    const eventId = req.query.eventId as string;
    if (!eventId) return res.status(400).json({ error: 'eventId query param required' });

    const db = getDb();
    const hintsSnap = await db.collection('events').doc(eventId).collection('challenges').doc(challengeId)
      .collection('hints').orderBy('order', 'asc').get();

    // Get user's unlocked hints
    const unlocksSnap = await db.collection('hintUnlocks')
      .where('uid', '==', req.uid)
      .where('eventId', '==', eventId)
      .where('challengeId', '==', challengeId)
      .get();
    const unlockedIds = new Set(unlocksSnap.docs.map((d) => d.data().hintId));

    const hints = hintsSnap.docs.map((d) => {
      const data = d.data();
      const unlocked = unlockedIds.has(d.id);
      return {
        id: d.id,
        title: data.title || null,
        order: data.order,
        cost: data.cost,
        unlocked,
        content: unlocked ? data.content : null,
      };
    });

    return res.json({ hints });
  }),
);

// Unlock a hint
hintsRouter.post(
  '/challenges/:challengeId/hints/:hintId/unlock',
  verifyFirebaseToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { challengeId, hintId } = req.params;
    const { eventId } = req.body;
    if (!eventId) return res.status(400).json({ error: 'eventId required' });

    const db = getDb();

    // Check hint exists
    const hintRef = db.collection('events').doc(eventId).collection('challenges').doc(challengeId)
      .collection('hints').doc(hintId);
    const hintSnap = await hintRef.get();
    if (!hintSnap.exists) return res.status(404).json({ error: 'Hint not found' });

    const hintData = hintSnap.data()!;

    // Check if already unlocked
    const existingSnap = await db.collection('hintUnlocks')
      .where('uid', '==', req.uid)
      .where('hintId', '==', hintId)
      .where('eventId', '==', eventId)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      return res.json({ alreadyUnlocked: true, content: hintData.content, cost: hintData.cost });
    }

    // Sequential unlock check: ensure all lower-order hints are unlocked first
    const lowerHintsSnap = await db.collection('events').doc(eventId)
      .collection('challenges').doc(challengeId)
      .collection('hints')
      .where('order', '<', hintData.order)
      .get();

    if (!lowerHintsSnap.empty) {
      const lowerIds = lowerHintsSnap.docs.map((d) => d.id);
      const userUnlocksSnap = await db.collection('hintUnlocks')
        .where('uid', '==', req.uid)
        .where('eventId', '==', eventId)
        .where('challengeId', '==', challengeId)
        .get();
      const userUnlockedIds = new Set(userUnlocksSnap.docs.map((d) => d.data().hintId));
      const allLowerUnlocked = lowerIds.every((id) => userUnlockedIds.has(id));
      if (!allLowerUnlocked) {
        return res.status(400).json({ error: 'Unlock previous hints first' });
      }
    }

    // Record unlock
    const unlockData = {
      uid: req.uid!,
      challengeId,
      hintId,
      eventId,
      unlockedAt: new Date().toISOString(),
      costApplied: hintData.cost,
    };
    await db.collection('hintUnlocks').add(unlockData);

    return res.json({ unlocked: true, content: hintData.content, cost: hintData.cost });
  }),
);
