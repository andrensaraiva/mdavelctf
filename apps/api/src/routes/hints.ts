import { Router, Response } from 'express';
import { verifyFirebaseToken, AuthRequest } from '../middleware/auth';
import { getDb } from '../firebase';
import { asyncHandler } from '../utils/asyncHandler';

export const hintsRouter = Router();

/* ─────────────────────────────────────
   PARTICIPANT HINT ENDPOINTS
   Hints are stored inline on the challenge doc (hints[])
   Purchases are tracked in the hintUnlocks collection
   ───────────────────────────────────── */

// Get hints for a challenge (participant view — content hidden for unpurchased)
hintsRouter.get(
  '/challenges/:challengeId/hints',
  verifyFirebaseToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { challengeId } = req.params;
    const eventId = req.query.eventId as string;
    if (!eventId) return res.status(400).json({ error: 'eventId query param required' });

    const db = getDb();
    const chalSnap = await db.collection('events').doc(eventId).collection('challenges').doc(challengeId).get();
    if (!chalSnap.exists) return res.status(404).json({ error: 'Challenge not found' });

    const chal = chalSnap.data()!;
    const inlineHints: any[] = chal.hints || [];

    // Get user's purchased hints
    const unlocksSnap = await db.collection('hintUnlocks')
      .where('uid', '==', req.uid)
      .where('eventId', '==', eventId)
      .where('challengeId', '==', challengeId)
      .get();
    const purchasedIndices = new Set(unlocksSnap.docs.map((d) => d.data().hintIndex));

    const hints = inlineHints.map((h, i) => {
      const unlocked = purchasedIndices.has(i);
      return {
        index: i,
        title: h.title,
        cost: h.cost,
        unlocked,
        content: unlocked ? h.content : null,
      };
    });

    return res.json({ hints });
  }),
);

// Purchase (unlock) a hint
hintsRouter.post(
  '/challenges/:challengeId/hints/:hintIndex/unlock',
  verifyFirebaseToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { challengeId, hintIndex: hintIndexStr } = req.params;
    const { eventId } = req.body;
    if (!eventId) return res.status(400).json({ error: 'eventId required' });

    const hintIndex = Number(hintIndexStr);
    if (isNaN(hintIndex) || hintIndex < 0) return res.status(400).json({ error: 'Invalid hint index' });

    const db = getDb();

    // Load challenge and validate hint index
    const chalSnap = await db.collection('events').doc(eventId).collection('challenges').doc(challengeId).get();
    if (!chalSnap.exists) return res.status(404).json({ error: 'Challenge not found' });

    const chal = chalSnap.data()!;
    const inlineHints: any[] = chal.hints || [];
    if (hintIndex >= inlineHints.length) return res.status(404).json({ error: 'Hint not found' });

    const hint = inlineHints[hintIndex];

    // Check if already purchased
    const existingSnap = await db.collection('hintUnlocks')
      .where('uid', '==', req.uid)
      .where('eventId', '==', eventId)
      .where('challengeId', '==', challengeId)
      .where('hintIndex', '==', hintIndex)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      return res.json({ alreadyUnlocked: true, content: hint.content, cost: hint.cost });
    }

    // Record purchase
    const unlockData = {
      uid: req.uid!,
      challengeId,
      hintIndex,
      eventId,
      unlockedAt: new Date().toISOString(),
      costDeducted: hint.cost,
    };
    await db.collection('hintUnlocks').add(unlockData);

    return res.json({ unlocked: true, content: hint.content, cost: hint.cost });
  }),
);
