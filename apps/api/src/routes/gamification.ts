import { Router, Response } from 'express';
import { verifyFirebaseToken, AuthRequest } from '../middleware/auth';
import { getDb } from '../firebase';
import { xpToLevel, DEFAULT_BADGES } from '@mdavelctf/shared';
import { asyncHandler } from '../utils/asyncHandler';

export const gamificationRouter = Router();

gamificationRouter.use(verifyFirebaseToken);

/* ─── Award badge to user (idempotent) ─── */
async function awardBadge(
  db: FirebaseFirestore.Firestore,
  uid: string,
  badgeKey: string,
): Promise<{ awarded: boolean; xpGained: number }> {
  const userRef = db.collection('users').doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) return { awarded: false, xpGained: 0 };

  const userData = userSnap.data()!;
  const currentBadges: string[] = userData.badges || [];

  if (currentBadges.includes(badgeKey)) {
    return { awarded: false, xpGained: 0 };
  }

  // Check badge exists in catalog
  const badgeSnap = await db.collection('badges').doc(badgeKey).get();
  const badgeDef = badgeSnap.exists ? badgeSnap.data()! : DEFAULT_BADGES[badgeKey];
  if (!badgeDef) return { awarded: false, xpGained: 0 };

  const xpReward = badgeDef.xpReward || 0;
  const newXp = (userData.xp || 0) + xpReward;
  const newLevel = xpToLevel(newXp);

  await userRef.update({
    badges: [...currentBadges, badgeKey],
    xp: newXp,
    level: newLevel,
  });

  return { awarded: true, xpGained: xpReward };
}

/* ─── Check and award all applicable badges ─── */
export async function checkAndAwardBadges(
  db: FirebaseFirestore.Firestore,
  uid: string,
): Promise<string[]> {
  const userSnap = await db.collection('users').doc(uid).get();
  if (!userSnap.exists) return [];
  const userData = userSnap.data()!;
  const stats = userData.stats || {};
  const currentBadges: string[] = userData.badges || [];
  const awarded: string[] = [];

  const solvesTotal = stats.solvesTotal || 0;
  const solvesByCategory: Record<string, number> = stats.solvesByCategory || {};
  const categoriesCount = Object.keys(solvesByCategory).length;

  // first_solve
  if (solvesTotal >= 1 && !currentBadges.includes('first_solve')) {
    const r = await awardBadge(db, uid, 'first_solve');
    if (r.awarded) awarded.push('first_solve');
  }

  // five_solves
  if (solvesTotal >= 5 && !currentBadges.includes('five_solves')) {
    const r = await awardBadge(db, uid, 'five_solves');
    if (r.awarded) awarded.push('five_solves');
  }

  // ten_solves
  if (solvesTotal >= 10 && !currentBadges.includes('ten_solves')) {
    const r = await awardBadge(db, uid, 'ten_solves');
    if (r.awarded) awarded.push('ten_solves');
  }

  // twenty_solves
  if (solvesTotal >= 20 && !currentBadges.includes('twenty_solves')) {
    const r = await awardBadge(db, uid, 'twenty_solves');
    if (r.awarded) awarded.push('twenty_solves');
  }

  // three_categories
  if (categoriesCount >= 3 && !currentBadges.includes('three_categories')) {
    const r = await awardBadge(db, uid, 'three_categories');
    if (r.awarded) awarded.push('three_categories');
  }

  // five_categories
  if (categoriesCount >= 5 && !currentBadges.includes('five_categories')) {
    const r = await awardBadge(db, uid, 'five_categories');
    if (r.awarded) awarded.push('five_categories');
  }

  // team_player — 2+ solves while in a team
  if (userData.teamId && solvesTotal >= 2 && !currentBadges.includes('team_player')) {
    const r = await awardBadge(db, uid, 'team_player');
    if (r.awarded) awarded.push('team_player');
  }

  // Category-specific badges
  const categoryBadges: Record<string, { key: string; needed: number }> = {
    WEB: { key: 'web_master', needed: 5 },
    CRYPTO: { key: 'crypto_breaker', needed: 5 },
    FORENSICS: { key: 'forensics_expert', needed: 5 },
  };

  for (const [cat, { key, needed }] of Object.entries(categoryBadges)) {
    if ((solvesByCategory[cat] || 0) >= needed && !currentBadges.includes(key)) {
      const r = await awardBadge(db, uid, key);
      if (r.awarded) awarded.push(key);
    }
  }

  return awarded;
}

/* ─── Update quest progress ─── */
export async function updateQuestProgress(
  db: FirebaseFirestore.Firestore,
  uid: string,
  category: string,
): Promise<void> {
  const now = new Date().toISOString();
  const questsSnap = await db.collection('quests')
    .where('activeFrom', '<=', now)
    .get();

  for (const qDoc of questsSnap.docs) {
    const quest = qDoc.data();
    if (quest.activeTo < now) continue;

    const progressRef = db.collection('quests').doc(qDoc.id)
      .collection('progress').doc(uid);
    const progressSnap = await progressRef.get();
    const current = progressSnap.exists ? progressSnap.data()! : { progress: 0, completed: false };

    if (current.completed) continue;

    let shouldIncrement = false;
    const rules = quest.rules;

    switch (rules.type) {
      case 'solve_total':
        shouldIncrement = true;
        break;
      case 'solve_category':
        if (category.toUpperCase() === (rules.category || '').toUpperCase()) {
          shouldIncrement = true;
        }
        break;
      case 'participate_event':
        shouldIncrement = true;
        break;
    }

    if (shouldIncrement) {
      const newProgress = (current.progress || 0) + 1;
      const completed = newProgress >= rules.target;

      await progressRef.set({
        progress: newProgress,
        completed,
        updatedAt: now,
      });

      // If quest completed, award XP and optional badge
      if (completed && !current.completed) {
        const userRef = db.collection('users').doc(uid);
        const userSnap = await userRef.get();
        if (userSnap.exists) {
          const userData = userSnap.data()!;
          const newXp = (userData.xp || 0) + (quest.xpReward || 0);
          const newLevel = xpToLevel(newXp);
          const updates: Record<string, any> = { xp: newXp, level: newLevel };

          if (quest.badgeReward) {
            const badges: string[] = userData.badges || [];
            if (!badges.includes(quest.badgeReward)) {
              updates.badges = [...badges, quest.badgeReward];
            }
          }

          await userRef.update(updates);
        }
      }
    }
  }
}

/* ─── GET /gamification/badges — Get badge catalog ─── */
gamificationRouter.get('/badges', asyncHandler(async (req: AuthRequest, res: Response) => {
  const db = getDb();
  const snap = await db.collection('badges').get();

  if (snap.empty) {
    // Return defaults from shared
    return res.json({ badges: Object.entries(DEFAULT_BADGES).map(([id, b]) => ({ id, ...(b as Record<string, unknown>) })) });
  }

  const badges = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return res.json({ badges });
}));

/* ─── GET /gamification/quests — Get active quests with user progress ─── */
gamificationRouter.get('/quests', asyncHandler(async (req: AuthRequest, res: Response) => {
  const uid = req.uid!;
  const db = getDb();
  const now = new Date().toISOString();

  const questsSnap = await db.collection('quests')
    .where('activeFrom', '<=', now)
    .get();

  const quests = [];
  for (const qDoc of questsSnap.docs) {
    const quest = qDoc.data();
    if (quest.activeTo < now) continue;

    const progressSnap = await db.collection('quests').doc(qDoc.id)
      .collection('progress').doc(uid).get();
    const progress = progressSnap.exists ? progressSnap.data() : { progress: 0, completed: false };

    quests.push({
      id: qDoc.id,
      ...quest,
      userProgress: progress,
    });
  }

  return res.json({ quests });
}));

/* ─── POST /gamification/recompute-my-stats — Recompute user stats from solves ─── */
gamificationRouter.post('/recompute-my-stats', asyncHandler(async (req: AuthRequest, res: Response) => {
  const uid = req.uid!;
  const db = getDb();

  // Gather all solves across all events
  const eventsSnap = await db.collection('events').get();
  let solvesTotal = 0;
  let correctSubmissions = 0;
  let wrongSubmissions = 0;
  const solvesByCategory: Record<string, number> = {};

  for (const eventDoc of eventsSnap.docs) {
    const eventId = eventDoc.id;

    // Count submissions
    const subsSnap = await db.collection('events').doc(eventId)
      .collection('submissions').where('uid', '==', uid).get();
    for (const sub of subsSnap.docs) {
      const data = sub.data();
      if (data.isCorrect) correctSubmissions++;
      else wrongSubmissions++;
    }

    // Count solves with category
    const solvesSnap = await db.collection('events').doc(eventId)
      .collection('solves').where('uid', '==', uid).get();
    for (const solveDoc of solvesSnap.docs) {
      const solve = solveDoc.data();
      solvesTotal++;

      // Get challenge category
      const chalSnap = await db.collection('events').doc(eventId)
        .collection('challenges').doc(solve.challengeId).get();
      if (chalSnap.exists) {
        const cat = chalSnap.data()!.category || 'UNKNOWN';
        solvesByCategory[cat] = (solvesByCategory[cat] || 0) + 1;
      }
    }
  }

  const stats = {
    solvesTotal,
    correctSubmissions,
    wrongSubmissions,
    solvesByCategory,
  };

  await db.collection('users').doc(uid).update({ stats });

  // Re-check badges
  const newBadges = await checkAndAwardBadges(db, uid);

  return res.json({ stats, newBadges });
}));
