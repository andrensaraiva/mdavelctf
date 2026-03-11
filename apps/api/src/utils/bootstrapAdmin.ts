/**
 * Bootstrap Admin
 * Creates the initial admin user on first startup.
 * Reads BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD from env.
 * Idempotent: skips if an admin user already exists.
 */

import { getAuth, getDb } from '../firebase';

export async function bootstrapAdmin(): Promise<void> {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

  if (!email || !password) {
    console.log('[Bootstrap] No BOOTSTRAP_ADMIN_EMAIL/PASSWORD set — skipping admin bootstrap.');
    return;
  }

  const db = getDb();
  const auth = getAuth();

  // Check if any admin/superadmin already exists in Firestore
  const adminSnap = await db
    .collection('users')
    .where('role', 'in', ['admin', 'superadmin'])
    .limit(1)
    .get();

  if (!adminSnap.empty) {
    console.log('[Bootstrap] Admin/superadmin user already exists — skipping bootstrap.');
    return;
  }

  console.log(`[Bootstrap] No admin found. Creating superadmin: ${email}`);

  try {
    // Create or find the Firebase Auth user
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(email);
      console.log('[Bootstrap] Auth user already exists, syncing Firestore doc...');
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        userRecord = await auth.createUser({
          email,
          password,
          displayName: 'Admin',
          emailVerified: true,
        });
        console.log('[Bootstrap] Auth user created.');
      } else {
        throw err;
      }
    }

    // Set admin custom claims
    await auth.setCustomUserClaims(userRecord.uid, { admin: true, superadmin: true });

    // Create Firestore user doc — superadmin if it's the bootstrap email
    const isSuperAdmin = email === 'andrensaraiva@hotmail.com';
    await db.collection('users').doc(userRecord.uid).set({
      displayName: userRecord.displayName || 'Admin',
      role: isSuperAdmin ? 'superadmin' : 'admin',
      disabled: false,
      teamId: null,
      theme: { accent: '#00f0ff', accent2: '#0077ff' },
      createdAt: new Date().toISOString(),
      avatarUrl: null,
      bio: 'Platform admin.',
      course: '',
      classGroup: '',
      unit: '',
      xp: 0,
      level: 1,
      badges: [],
      stats: { solvesTotal: 0, correctSubmissions: 0, wrongSubmissions: 0, solvesByCategory: {} },
    });

    console.log(`[Bootstrap] Admin user created successfully: ${email} (uid: ${userRecord.uid})`);
  } catch (err) {
    console.error('[Bootstrap] Failed to create admin:', err);
  }
}
