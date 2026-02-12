import { Router, Response } from 'express';
import { verifyFirebaseToken, AuthRequest } from '../middleware/auth';
import { getDb } from '../firebase';
import { asyncHandler } from '../utils/asyncHandler';

export const profileRouter = Router();

profileRouter.use(verifyFirebaseToken);

/* ─── Update Profile ─── */
profileRouter.post('/update', asyncHandler(async (req: AuthRequest, res: Response) => {
  const uid = req.uid!;
  const db = getDb();

  const allowed = ['displayName', 'bio', 'course', 'classGroup', 'unit', 'locale'] as const;
  const updates: Record<string, any> = {};

  for (const k of allowed) {
    if (req.body[k] !== undefined) {
      const val = String(req.body[k]).slice(0, k === 'bio' ? 300 : 100);
      updates[k] = val;
    }
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  await db.collection('users').doc(uid).update(updates);
  return res.json({ success: true, updated: updates });
}));

/* ─── Update Avatar (base64 data URI saved to Firestore) ─── */
profileRouter.post('/avatar', asyncHandler(async (req: AuthRequest, res: Response) => {
  const uid = req.uid!;
  const { avatarUrl } = req.body;

  if (!avatarUrl || typeof avatarUrl !== 'string') {
    return res.status(400).json({ error: 'avatarUrl required' });
  }

  // Allow URLs or data URIs (base64)
  if (!avatarUrl.startsWith('http') && !avatarUrl.startsWith('data:image/')) {
    return res.status(400).json({ error: 'Invalid avatar (must be URL or data:image URI)' });
  }

  // Limit size to ~500KB base64 string
  if (avatarUrl.length > 700_000) {
    return res.status(400).json({ error: 'Image too large (max ~500KB)' });
  }

  const db = getDb();
  await db.collection('users').doc(uid).update({ avatarUrl });
  return res.json({ success: true });
}));

/* ─── Get My Full Profile ─── */
profileRouter.get('/me', asyncHandler(async (req: AuthRequest, res: Response) => {
  const uid = req.uid!;
  const db = getDb();
  const snap = await db.collection('users').doc(uid).get();
  if (!snap.exists) return res.status(404).json({ error: 'User not found' });

  return res.json({ profile: { uid, ...snap.data() } });
}));

/* ─── Get Public Profile (any user) ─── */
profileRouter.get('/:uid', asyncHandler(async (req: AuthRequest, res: Response) => {
  const targetUid = req.params.uid;
  const db = getDb();
  const snap = await db.collection('users').doc(targetUid).get();
  if (!snap.exists) return res.status(404).json({ error: 'User not found' });

  const data = snap.data()!;
  // Return only public fields
  return res.json({
    profile: {
      uid: targetUid,
      displayName: data.displayName,
      avatarUrl: data.avatarUrl || null,
      bio: data.bio || null,
      course: data.course || null,
      classGroup: data.classGroup || null,
      unit: data.unit || null,
      xp: data.xp || 0,
      level: data.level || 1,
      badges: data.badges || [],
      stats: data.stats || {},
      teamId: data.teamId || null,
      createdAt: data.createdAt,
    },
  });
}));
