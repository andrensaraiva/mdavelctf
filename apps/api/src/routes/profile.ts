import { Router, Response } from 'express';
import { verifyFirebaseToken, AuthRequest } from '../middleware/auth';
import { getDb, getStorage } from '../firebase';

export const profileRouter = Router();

profileRouter.use(verifyFirebaseToken);

/* ─── Update Profile ─── */
profileRouter.post('/update', async (req: AuthRequest, res: Response) => {
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
});

/* ─── Upload Avatar (base64 → Firebase Storage) ─── */
profileRouter.post('/avatar', async (req: AuthRequest, res: Response) => {
  const uid = req.uid!;
  const { avatarData } = req.body;

  // Support both old field name (avatarUrl with data URI) and new (avatarData)
  const data: string | undefined = avatarData || req.body.avatarUrl;

  if (!data || typeof data !== 'string') {
    return res.status(400).json({ error: 'avatarData required (base64 data URI)' });
  }

  // If it's already a URL (not a data URI), just save it directly
  if (data.startsWith('http')) {
    const db = getDb();
    await db.collection('users').doc(uid).update({ avatarUrl: data.slice(0, 2048) });
    return res.json({ success: true, avatarUrl: data });
  }

  // Validate data URI format
  const match = data.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) {
    return res.status(400).json({ error: 'Invalid image data URI' });
  }

  const contentType = match[1];
  const base64Data = match[2];
  const buffer = Buffer.from(base64Data, 'base64');

  // Max 1MB
  if (buffer.byteLength > 1024 * 1024) {
    return res.status(400).json({ error: 'Image must be under 1MB' });
  }

  try {
    const ext = contentType.split('/')[1] || 'png';
    const filePath = `avatars/${uid}/avatar.${ext}`;
    const bucket = getStorage().bucket();
    const file = bucket.file(filePath);

    await file.save(buffer, {
      metadata: { contentType },
      public: true,
    });

    // Make the file publicly accessible and get its URL
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

    const db = getDb();
    await db.collection('users').doc(uid).update({ avatarUrl: publicUrl });

    return res.json({ success: true, avatarUrl: publicUrl });
  } catch (err: any) {
    console.error('[Avatar Upload]', err);
    return res.status(500).json({ error: 'Failed to upload avatar' });
  }
});

/* ─── Get My Full Profile ─── */
profileRouter.get('/me', async (req: AuthRequest, res: Response) => {
  const uid = req.uid!;
  const db = getDb();
  const snap = await db.collection('users').doc(uid).get();
  if (!snap.exists) return res.status(404).json({ error: 'User not found' });

  return res.json({ profile: { uid, ...snap.data() } });
});

/* ─── Get Public Profile (any user) ─── */
profileRouter.get('/:uid', async (req: AuthRequest, res: Response) => {
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
});
