import { Request, Response, NextFunction } from 'express';
import { getAuth, getDb } from '../firebase';
import { asyncHandler } from '../utils/asyncHandler';

export interface AuthRequest extends Request {
  uid?: string;
  userRole?: string;
  userDoc?: FirebaseFirestore.DocumentData;
}

/**
 * Verifies Firebase ID token from Authorization: Bearer <token>
 * Sets req.uid and req.userRole on success.
 */
export async function verifyFirebaseToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const idToken = header.split('Bearer ')[1];
  try {
    const decoded = await getAuth().verifyIdToken(idToken);
    req.uid = decoded.uid;

    // Fetch user doc for role and disabled check
    const userSnap = await getDb().collection('users').doc(decoded.uid).get();
    if (!userSnap.exists) {
      return res.status(403).json({ error: 'User profile not found' });
    }
    const userData = userSnap.data()!;
    if (userData.disabled) {
      return res.status(403).json({ error: 'Account is disabled' });
    }
    req.userRole = userData.role || 'participant';
    req.userDoc = userData;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Requires admin role. Must be used AFTER verifyFirebaseToken.
 */
export function requireAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

/**
 * Requires instructor or admin role. Must be used AFTER verifyFirebaseToken.
 */
export function requireInstructorOrAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  if (req.userRole !== 'admin' && req.userRole !== 'instructor') {
    return res.status(403).json({ error: 'Instructor or admin access required' });
  }
  next();
}

/**
 * Checks that the user is admin OR is the owner of the event referenced in
 * req.params.eventId or req.body.eventId. Must be used AFTER verifyFirebaseToken.
 */
export function requireEventOwnerOrAdmin(paramKey = 'eventId') {
  return asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.userRole === 'admin') return next();

    const eventId = req.params[paramKey] || req.body[paramKey] || req.query[paramKey] as string;
    if (!eventId) return res.status(400).json({ error: 'eventId required' });

    const db = getDb();
    const snap = await db.collection('events').doc(eventId).get();
    if (!snap.exists) return res.status(404).json({ error: 'Event not found' });

    const data = snap.data()!;
    if (data.ownerId === req.uid) return next();

    // Check if instructor owns the class that owns this event
    if (data.classId && req.userRole === 'instructor') {
      const classSnap = await db.collection('classes').doc(data.classId).get();
      if (classSnap.exists && classSnap.data()?.ownerInstructorId === req.uid) {
        return next();
      }
    }

    return res.status(403).json({ error: 'You do not have access to this event' });
  });
}
