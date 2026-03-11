import { Router, Response } from 'express';
import { verifyFirebaseToken, requireInstructorOrAdmin, requireAdmin, AuthRequest } from '../middleware/auth';
import { getDb } from '../firebase';
import { writeAuditLog } from '../utils/audit';
import { asyncHandler } from '../utils/asyncHandler';

export const coursesRouter = Router();

/* ─────────────────────────────────────
   COURSE MANAGEMENT (admin + instructor)
   ───────────────────────────────────── */

// List all courses (public — authenticated users)
coursesRouter.get(
  '/',
  verifyFirebaseToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const db = getDb();
    let query: FirebaseFirestore.Query = db.collection('courses');

    // Non-admin/instructor only see published courses
    if (req.userRole !== 'admin' && req.userRole !== 'instructor') {
      query = query.where('published', '==', true);
    }

    const snap = await query.get();
    const courses = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return res.json({ courses });
  }),
);

// Get single course
coursesRouter.get(
  '/:courseId',
  verifyFirebaseToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { courseId } = req.params;
    const db = getDb();
    const snap = await db.collection('courses').doc(courseId).get();
    if (!snap.exists) return res.status(404).json({ error: 'Course not found' });
    return res.json({ id: snap.id, ...snap.data() });
  }),
);

// Create course
coursesRouter.post(
  '/',
  verifyFirebaseToken,
  requireInstructorOrAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { name, description, tags, ctfType, themeId, icon, published, colorAccent, slug } = req.body;
    if (!name || !ctfType || !themeId) {
      return res.status(400).json({ error: 'name, ctfType, themeId required' });
    }

    const db = getDb();
    const ref = db.collection('courses').doc();
    const data: Record<string, any> = {
      name,
      slug: slug || name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      description: description || '',
      tags: tags || [],
      ctfType,
      themeId,
      icon: icon || null,
      colorAccent: colorAccent || null,
      published: published ?? true,
      ownerInstructorId: req.userRole === 'instructor' ? req.uid : null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await ref.set(data);
    await writeAuditLog(req.uid!, 'CREATE_COURSE', `courses/${ref.id}`, null, data);
    return res.json({ id: ref.id, ...data });
  }),
);

// Update course
coursesRouter.put(
  '/:courseId',
  verifyFirebaseToken,
  requireInstructorOrAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { courseId } = req.params;
    const db = getDb();
    const ref = db.collection('courses').doc(courseId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Course not found' });

    const courseData = snap.data()!;
    // Instructors can only edit their own courses
    if (req.userRole === 'instructor' && courseData.ownerInstructorId !== req.uid) {
      return res.status(403).json({ error: 'You can only edit your own courses' });
    }

    const before = courseData;
    const updates: Record<string, any> = { updatedAt: new Date().toISOString() };
    const allowed = ['name', 'description', 'tags', 'ctfType', 'themeId', 'icon', 'published', 'colorAccent', 'slug'];
    for (const k of allowed) {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    }
    await ref.update(updates);
    await writeAuditLog(req.uid!, 'UPDATE_COURSE', `courses/${courseId}`, before, updates);
    return res.json({ id: courseId, ...updates });
  }),
);

// Delete course
coursesRouter.delete(
  '/:courseId',
  verifyFirebaseToken,
  requireInstructorOrAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { courseId } = req.params;
    const db = getDb();
    const ref = db.collection('courses').doc(courseId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Course not found' });

    const courseData = snap.data()!;
    if (req.userRole === 'instructor' && courseData.ownerInstructorId !== req.uid) {
      return res.status(403).json({ error: 'You can only delete your own courses' });
    }

    const before = courseData;
    await ref.delete();
    await writeAuditLog(req.uid!, 'DELETE_COURSE', `courses/${courseId}`, before, null);
    return res.json({ success: true });
  }),
);

// Course analytics (lightweight)
coursesRouter.get(
  '/:courseId/analytics',
  verifyFirebaseToken,
  requireInstructorOrAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { courseId } = req.params;
    const db = getDb();

    const [classesSnap, eventsSnap] = await Promise.all([
      db.collection('classes').where('courseId', '==', courseId).get(),
      db.collection('events').where('courseId', '==', courseId).get(),
    ]);

    let totalStudents = 0;
    for (const classDoc of classesSnap.docs) {
      const membersSnap = await classDoc.ref.collection('members').where('roleInClass', '==', 'student').get();
      totalStudents += membersSnap.size;
    }

    return res.json({
      totalClasses: classesSnap.size,
      totalEvents: eventsSnap.size,
      totalStudents,
    });
  }),
);
