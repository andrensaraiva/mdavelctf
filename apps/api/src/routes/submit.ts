import { Router, Response } from 'express';
import { verifyFirebaseToken, AuthRequest } from '../middleware/auth';
import { getDb } from '../firebase';
import { normalizeFlag, hashFlag, hashMeta } from '../utils/crypto';
import { getEventStatus } from '../utils/event';
import { EventDoc, SubmitFlagResponse, xpToLevel } from '@mdavelctf/shared';
import { FieldValue } from 'firebase-admin/firestore';
import { checkAndAwardBadges, updateQuestProgress } from './gamification';

export const submitRouter = Router();

const MAX_ATTEMPTS = 30;
const COOLDOWN_MS = 10_000; // 10 seconds after wrong attempt
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 10;

submitRouter.post(
  '/submit-flag',
  verifyFirebaseToken,
  async (req: AuthRequest, res: Response) => {
    const uid = req.uid!;
    const userDoc = req.userDoc!;
    const { eventId, challengeId, flagText } = req.body;

    if (!eventId || !challengeId || typeof flagText !== 'string') {
      return res.status(400).json({ error: 'Missing eventId, challengeId, or flagText' });
    }

    const db = getDb();

    try {
      // 1. Load event and check LIVE
      const eventSnap = await db.collection('events').doc(eventId).get();
      if (!eventSnap.exists) {
        return res.status(404).json({ error: 'Event not found' });
      }
      const event = eventSnap.data() as EventDoc;
      const status = getEventStatus(event);
      if (status !== 'LIVE') {
        return res.status(403).json({ error: `Event is ${status}, not accepting submissions` });
      }

      // 2. Load challenge
      const chalSnap = await db
        .collection('events')
        .doc(eventId)
        .collection('challenges')
        .doc(challengeId)
        .get();
      if (!chalSnap.exists) {
        return res.status(404).json({ error: 'Challenge not found' });
      }
      const chal = chalSnap.data()!;
      if (!chal.published) {
        return res.status(404).json({ error: 'Challenge not available' });
      }

      // 3. Rate limiting — simple: count recent submissions
      const oneMinuteAgo = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
      const recentSubs = await db
        .collection('events')
        .doc(eventId)
        .collection('submissions')
        .where('uid', '==', uid)
        .where('submittedAt', '>=', oneMinuteAgo)
        .get();
      if (recentSubs.size >= RATE_LIMIT_MAX) {
        return res.status(429).json({ error: 'Rate limit exceeded. Max 10 submissions/minute.' });
      }

      // 4. Get existing attempts for this challenge
      const prevAttempts = await db
        .collection('events')
        .doc(eventId)
        .collection('submissions')
        .where('uid', '==', uid)
        .where('challengeId', '==', challengeId)
        .orderBy('submittedAt', 'desc')
        .get();

      const attemptCount = prevAttempts.size;
      if (attemptCount >= MAX_ATTEMPTS) {
        return res.status(403).json({
          error: 'Max attempts reached for this challenge',
          attemptsLeft: 0,
        });
      }

      // 5. Cooldown check — last wrong attempt
      if (prevAttempts.size > 0) {
        const lastSub = prevAttempts.docs[0].data();
        if (!lastSub.isCorrect) {
          const lastTime = new Date(lastSub.submittedAt).getTime();
          const remaining = COOLDOWN_MS - (Date.now() - lastTime);
          if (remaining > 0) {
            return res.status(429).json({
              error: 'Cooldown active after wrong attempt',
              cooldownRemaining: Math.ceil(remaining / 1000),
            });
          }
        }
      }

      // 6. Check if already solved
      const solveId = `${uid}_${challengeId}`;
      const existingSolve = await db
        .collection('events')
        .doc(eventId)
        .collection('solves')
        .doc(solveId)
        .get();
      if (existingSolve.exists) {
        return res.json({
          correct: true,
          alreadySolved: true,
          attemptsLeft: MAX_ATTEMPTS - attemptCount,
          cooldownRemaining: 0,
        } as SubmitFlagResponse);
      }

      // 7. Load secret and compare
      const secretSnap = await db
        .collection('events').doc(eventId)
        .collection('challengeSecrets').doc(challengeId)
        .get();
      if (!secretSnap.exists) {
        return res.status(500).json({ error: 'Challenge flag not configured' });
      }
      const secret = secretSnap.data()!;
      const caseSensitive = secret.caseSensitive === true;

      const normalized = normalizeFlag(flagText, caseSensitive);
      const computedHash = hashFlag(normalized);
      const isCorrect = computedHash === secret.flagHash;

      // 8. Log submission
      const ipHash = req.ip ? hashMeta(req.ip) : undefined;
      const uaHash = req.headers['user-agent']
        ? hashMeta(req.headers['user-agent'] as string)
        : undefined;

      const submissionRef = db
        .collection('events')
        .doc(eventId)
        .collection('submissions')
        .doc();
      await submissionRef.set({
        uid,
        teamId: userDoc.teamId || null,
        challengeId,
        submittedAt: new Date().toISOString(),
        isCorrect,
        attemptNumber: attemptCount + 1,
        ...(ipHash && { ipHash }),
        ...(uaHash && { userAgentHash: uaHash }),
      });

      const response: SubmitFlagResponse = {
        correct: isCorrect,
        alreadySolved: false,
        attemptsLeft: MAX_ATTEMPTS - (attemptCount + 1),
        cooldownRemaining: isCorrect ? 0 : Math.ceil(COOLDOWN_MS / 1000),
      };

      // 9. If correct — create solve + update leaderboards
      if (isCorrect) {
        const pointsAwarded = chal.pointsFixed || 0;
        response.scoreAwarded = pointsAwarded;

        await db.runTransaction(async (tx) => {
          const solveRef = db
            .collection('events')
            .doc(eventId)
            .collection('solves')
            .doc(solveId);
          const solveCheck = await tx.get(solveRef);
          if (solveCheck.exists) {
            // Already solved (race condition)
            return;
          }

          tx.set(solveRef, {
            solveId,
            uid,
            teamId: userDoc.teamId || null,
            challengeId,
            solvedAt: new Date().toISOString(),
            pointsAwarded,
          });
        });

        // Update leaderboards (outside transaction for simplicity)
        await updateLeaderboards(db, eventId, event, uid, userDoc);
        await updateAnalytics(db, eventId, challengeId, true);

        // ─── Gamification: XP, stats, badges, quests ───
        try {
          const pointsXp = pointsAwarded * 2;
          const userRef = db.collection('users').doc(uid);
          const freshUser = await userRef.get();
          const userData = freshUser.data()!;
          const currentXp = userData.xp || 0;
          const newXp = currentXp + pointsXp;
          const newLevel = xpToLevel(newXp);

          // Update stats
          const stats = userData.stats || {};
          const solvesTotal = (stats.solvesTotal || 0) + 1;
          const correctSubmissions = (stats.correctSubmissions || 0) + 1;
          const solvesByCategory = { ...(stats.solvesByCategory || {}) };
          solvesByCategory[chal.category] = (solvesByCategory[chal.category] || 0) + 1;

          await userRef.update({
            xp: newXp,
            level: newLevel,
            stats: {
              ...stats,
              solvesTotal,
              correctSubmissions,
              solvesByCategory,
            },
          });

          // Check badges
          await checkAndAwardBadges(db, uid);

          // Speed demon - first attempt solve
          if (attemptCount === 0) {
            const speedSnap = await db.collection('users').doc(uid).get();
            const speedData = speedSnap.data()!;
            if (!(speedData.badges || []).includes('speed_demon')) {
              const speedBadges = [...(speedData.badges || []), 'speed_demon'];
              const badgeXpBonus = 50;
              const updXp = (speedData.xp || 0) + badgeXpBonus;
              await userRef.update({
                badges: speedBadges,
                xp: updXp,
                level: xpToLevel(updXp),
              });
            }
          }

          // Night owl - submit after midnight
          const hour = new Date().getHours();
          if (hour >= 0 && hour < 5) {
            const nightSnap = await db.collection('users').doc(uid).get();
            const nightData = nightSnap.data()!;
            if (!(nightData.badges || []).includes('night_owl')) {
              const nightBadges = [...(nightData.badges || []), 'night_owl'];
              const nightXp = (nightData.xp || 0) + 50;
              await userRef.update({
                badges: nightBadges,
                xp: nightXp,
                level: xpToLevel(nightXp),
              });
            }
          }

          // Update quest progress
          await updateQuestProgress(db, uid, chal.category);
        } catch (gamErr) {
          console.error('[gamification]', gamErr);
          // Don't fail the main solve flow
        }
      } else {
        await updateAnalytics(db, eventId, challengeId, false);

        // Track wrong submissions in stats
        try {
          const userRef = db.collection('users').doc(uid);
          const freshUser = await userRef.get();
          const userData = freshUser.data()!;
          const stats = userData.stats || {};
          await userRef.update({
            stats: {
              ...stats,
              wrongSubmissions: (stats.wrongSubmissions || 0) + 1,
            },
          });
        } catch {}
      }

      return res.json(response);
    } catch (err: any) {
      console.error('[submit-flag]', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  },
);

async function updateLeaderboards(
  db: FirebaseFirestore.Firestore,
  eventId: string,
  event: EventDoc,
  uid: string,
  userDoc: FirebaseFirestore.DocumentData,
) {
  // Rebuild individual leaderboard
  const solves = await db
    .collection('events')
    .doc(eventId)
    .collection('solves')
    .get();

  // Group by user
  const userScores: Record<
    string,
    { uid: string; displayName: string; score: number; lastSolveAt: string }
  > = {};
  const teamScores: Record<
    string,
    { teamId: string; teamName: string; score: number; lastSolveAt: string }
  > = {};

  for (const doc of solves.docs) {
    const s = doc.data();
    // Individual
    if (!userScores[s.uid]) {
      // Fetch display name
      const uSnap = await db.collection('users').doc(s.uid).get();
      const uData = uSnap.data();
      userScores[s.uid] = {
        uid: s.uid,
        displayName: uData?.displayName || 'Unknown',
        score: 0,
        lastSolveAt: s.solvedAt,
      };
    }
    userScores[s.uid].score += s.pointsAwarded;
    if (s.solvedAt > userScores[s.uid].lastSolveAt) {
      userScores[s.uid].lastSolveAt = s.solvedAt;
    }

    // Team
    if (s.teamId) {
      if (!teamScores[s.teamId]) {
        const tSnap = await db.collection('teams').doc(s.teamId).get();
        const tData = tSnap.data();
        teamScores[s.teamId] = {
          teamId: s.teamId,
          teamName: tData?.name || 'Unknown',
          score: 0,
          lastSolveAt: s.solvedAt,
        };
      }
      teamScores[s.teamId].score += s.pointsAwarded;
      if (s.solvedAt > teamScores[s.teamId].lastSolveAt) {
        teamScores[s.teamId].lastSolveAt = s.solvedAt;
      }
    }
  }

  // Sort: score desc, then lastSolveAt asc
  const sortFn = (a: any, b: any) =>
    b.score - a.score || new Date(a.lastSolveAt).getTime() - new Date(b.lastSolveAt).getTime();

  const individualRows = Object.values(userScores).sort(sortFn);
  const teamRows = Object.values(teamScores).sort(sortFn);

  const batch = db.batch();
  const indRef = db.doc(`events/${eventId}/leaderboards/individual`);
  const teamRef = db.doc(`events/${eventId}/leaderboards/teams`);

  batch.set(indRef, { rows: individualRows, updatedAt: new Date().toISOString() });
  batch.set(teamRef, { rows: teamRows, updatedAt: new Date().toISOString() });
  await batch.commit();

  // If event belongs to a league, update league standings
  if (event.leagueId) {
    await updateLeagueStandings(db, event.leagueId);
  }
}

async function updateLeagueStandings(
  db: FirebaseFirestore.Firestore,
  leagueId: string,
) {
  const leagueSnap = await db.collection('leagues').doc(leagueId).get();
  if (!leagueSnap.exists) return;
  const league = leagueSnap.data()!;
  const eventIds: string[] = league.eventIds || [];

  const userTotals: Record<
    string,
    { uid: string; displayName: string; score: number; lastSolveAt: string }
  > = {};
  const teamTotals: Record<
    string,
    { teamId: string; teamName: string; score: number; lastSolveAt: string }
  > = {};

  for (const eid of eventIds) {
    const indSnap = await db.doc(`events/${eid}/leaderboards/individual`).get();
    if (indSnap.exists) {
      const rows = indSnap.data()!.rows || [];
      for (const r of rows) {
        if (!userTotals[r.uid]) {
          userTotals[r.uid] = { ...r };
        } else {
          userTotals[r.uid].score += r.score;
          if (r.lastSolveAt > userTotals[r.uid].lastSolveAt) {
            userTotals[r.uid].lastSolveAt = r.lastSolveAt;
          }
        }
      }
    }

    const teamSnap = await db.doc(`events/${eid}/leaderboards/teams`).get();
    if (teamSnap.exists) {
      const rows = teamSnap.data()!.rows || [];
      for (const r of rows) {
        if (!teamTotals[r.teamId]) {
          teamTotals[r.teamId] = { ...r };
        } else {
          teamTotals[r.teamId].score += r.score;
          if (r.lastSolveAt > teamTotals[r.teamId].lastSolveAt) {
            teamTotals[r.teamId].lastSolveAt = r.lastSolveAt;
          }
        }
      }
    }
  }

  const sortFn = (a: any, b: any) =>
    b.score - a.score || new Date(a.lastSolveAt).getTime() - new Date(b.lastSolveAt).getTime();

  const batch = db.batch();
  batch.set(db.doc(`leagues/${leagueId}/standings/individual`), {
    rows: Object.values(userTotals).sort(sortFn),
    updatedAt: new Date().toISOString(),
  });
  batch.set(db.doc(`leagues/${leagueId}/standings/teams`), {
    rows: Object.values(teamTotals).sort(sortFn),
    updatedAt: new Date().toISOString(),
  });
  await batch.commit();

  // League analytics
  const participantsByEvent: Record<string, Set<string>> = {};
  for (const eid of eventIds) {
    participantsByEvent[eid] = new Set();
    const solvesSnap = await db.collection(`events/${eid}/solves`).get();
    solvesSnap.docs.forEach((d) => participantsByEvent[eid].add(d.data().uid));
  }

  const allUsers = new Set<string>();
  const userEventCounts: Record<string, number> = {};
  for (const [eid, uids] of Object.entries(participantsByEvent)) {
    for (const u of uids) {
      allUsers.add(u);
      userEventCounts[u] = (userEventCounts[u] || 0) + 1;
    }
  }

  let one = 0, two = 0, threePlus = 0;
  for (const c of Object.values(userEventCounts)) {
    if (c === 1) one++;
    else if (c === 2) two++;
    else threePlus++;
  }

  const participationByEvent: Record<string, number> = {};
  for (const [eid, uids] of Object.entries(participantsByEvent)) {
    participationByEvent[eid] = uids.size;
  }

  await db.doc(`leagues/${leagueId}/analytics/summary`).set({
    participantsTotal: allUsers.size,
    participationByEvent,
    retentionBuckets: { one, two, threePlus },
    updatedAt: new Date().toISOString(),
  });
}

async function updateAnalytics(
  db: FirebaseFirestore.Firestore,
  eventId: string,
  challengeId: string,
  isCorrect: boolean,
) {
  const ref = db.doc(`events/${eventId}/analytics/summary`);
  const snap = await ref.get();
  const now = new Date();
  const minuteKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}T${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`;

  if (!snap.exists) {
    await ref.set({
      activeUsersLast15m: 0,
      submissionsTotal: 1,
      solvesTotal: isCorrect ? 1 : 0,
      solvesByChallenge: isCorrect ? { [challengeId]: 1 } : {},
      wrongByChallenge: isCorrect ? {} : { [challengeId]: 1 },
      submissionsByMinute: [{ minuteKey, count: 1 }],
      updatedAt: now.toISOString(),
    });
  } else {
    const data = snap.data()!;
    const submissionsTotal = (data.submissionsTotal || 0) + 1;
    const solvesTotal = (data.solvesTotal || 0) + (isCorrect ? 1 : 0);

    const solvesByChallenge = { ...(data.solvesByChallenge || {}) };
    const wrongByChallenge = { ...(data.wrongByChallenge || {}) };

    if (isCorrect) {
      solvesByChallenge[challengeId] = (solvesByChallenge[challengeId] || 0) + 1;
    } else {
      wrongByChallenge[challengeId] = (wrongByChallenge[challengeId] || 0) + 1;
    }

    // Submissions by minute - keep last 60
    let submissionsByMinute = [...(data.submissionsByMinute || [])];
    const existing = submissionsByMinute.find((b: any) => b.minuteKey === minuteKey);
    if (existing) {
      existing.count++;
    } else {
      submissionsByMinute.push({ minuteKey, count: 1 });
    }
    if (submissionsByMinute.length > 60) {
      submissionsByMinute = submissionsByMinute.slice(-60);
    }

    await ref.set({
      activeUsersLast15m: data.activeUsersLast15m || 0,
      submissionsTotal,
      solvesTotal,
      solvesByChallenge,
      wrongByChallenge,
      submissionsByMinute,
      updatedAt: now.toISOString(),
    });
  }
}
