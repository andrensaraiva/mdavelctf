/**
 * Seed Data Module
 * Contains the logic to populate demo data, callable from API routes.
 * Mirrors the logic of scripts/seed.ts but runs inside the API process.
 */

import * as admin from 'firebase-admin';
import { getDb, getAuth } from '../firebase';
import { normalizeFlag, hashFlag } from './crypto';
import { SUPERADMIN_EMAIL } from '../middleware/auth';
import crypto from 'crypto';
import { UserRole } from '@mdavelctf/shared';

function generateJoinCode(): string {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

async function ensureUser(
  email: string,
  password: string,
  displayName: string,
  role: UserRole,
  themePreset: { accent: string; accent2: string },
): Promise<string> {
  const auth = getAuth();
  const db = getDb();

  let userRecord;
  try {
    userRecord = await auth.createUser({ email, password, displayName, emailVerified: true });
  } catch (err: any) {
    if (err.code === 'auth/email-already-exists') {
      userRecord = await auth.getUserByEmail(email);
    } else {
      throw err;
    }
  }

  const isSuperAdmin = role === 'superadmin';
  const isAdmin = role === 'admin' || isSuperAdmin;
  await auth.setCustomUserClaims(userRecord.uid, { admin: isAdmin, superadmin: isSuperAdmin });

  await db.collection('users').doc(userRecord.uid).set({
    displayName, role, disabled: false, teamId: null,
    theme: themePreset, createdAt: new Date().toISOString(),
    avatarUrl: null, bio: '', course: '', classGroup: '', unit: '',
    xp: 0, level: 1, badges: [],
    stats: { solvesTotal: 0, correctSubmissions: 0, wrongSubmissions: 0, solvesByCategory: {} },
  });

  return userRecord.uid;
}

/** Delete all docs in a collection (and optionally sub-collections). */
async function deleteCollection(collectionPath: string, subcollections?: string[]) {
  const db = getDb();
  const snap = await db.collection(collectionPath).get();
  if (snap.empty) return;

  for (const doc of snap.docs) {
    if (subcollections) {
      for (const sub of subcollections) {
        const subSnap = await doc.ref.collection(sub).get();
        const batch = db.batch();
        subSnap.docs.forEach((d) => batch.delete(d.ref));
        if (!subSnap.empty) await batch.commit();
      }
    }
    await doc.ref.delete();
  }
}

/**
 * Clear ALL data except the admin account.
 * Returns a summary of what was deleted.
 */
export async function clearSeedData(): Promise<{ deleted: string[] }> {
  const db = getDb();
  const auth = getAuth();
  const deleted: string[] = [];

  // 1. Delete all non-admin/superadmin users from Auth + Firestore
  const usersSnap = await db.collection('users').get();
  for (const doc of usersSnap.docs) {
    const data = doc.data();
    if (data.role === 'admin' || data.role === 'superadmin') continue; // keep admins
    try { await auth.deleteUser(doc.id); } catch { /* may not exist */ }
    await doc.ref.delete();
    deleted.push(`user:${data.displayName || doc.id}`);
  }

  // 2. Delete teams (with members + chat subcollections)
  const teamsSnap = await db.collection('teams').get();
  for (const doc of teamsSnap.docs) {
    for (const sub of ['members', 'chat']) {
      const subSnap = await doc.ref.collection(sub).get();
      for (const s of subSnap.docs) await s.ref.delete();
    }
    await doc.ref.delete();
    deleted.push(`team:${doc.data().name || doc.id}`);
  }

  // Update admin/superadmin teamId to null
  const adminSnap = await db.collection('users').where('role', 'in', ['admin', 'superadmin']).get();
  for (const doc of adminSnap.docs) {
    await doc.ref.update({ teamId: null });
  }

  // 3. Delete events (with challenges, challengeSecrets, submissions, solves, leaderboards, analytics)
  const eventsSnap = await db.collection('events').get();
  for (const doc of eventsSnap.docs) {
    for (const sub of ['challenges', 'challengeSecrets', 'submissions', 'solves']) {
      const subSnap = await doc.ref.collection(sub).get();
      for (const s of subSnap.docs) await s.ref.delete();
    }
    // leaderboards + analytics are single docs
    for (const path of ['leaderboards/individual', 'leaderboards/teams', 'analytics/summary']) {
      try { await doc.ref.collection(path.split('/')[0]).doc(path.split('/')[1]).delete(); } catch { /* ok */ }
    }
    await doc.ref.delete();
    deleted.push(`event:${doc.data().name || doc.id}`);
  }

  // 4. Delete leagues (with standings + analytics subcollections)
  const leaguesSnap = await db.collection('leagues').get();
  for (const doc of leaguesSnap.docs) {
    for (const path of ['standings/individual', 'standings/teams', 'analytics/summary']) {
      try { await doc.ref.collection(path.split('/')[0]).doc(path.split('/')[1]).delete(); } catch { /* ok */ }
    }
    await doc.ref.delete();
    deleted.push(`league:${doc.data().name || doc.id}`);
  }

  // 5. Delete badges
  await deleteCollection('badges');
  deleted.push('badges:all');

  // 6. Delete quests (with progress subcollection)
  const questsSnap = await db.collection('quests').get();
  for (const doc of questsSnap.docs) {
    const progSnap = await doc.ref.collection('progress').get();
    for (const p of progSnap.docs) await p.ref.delete();
    await doc.ref.delete();
  }
  deleted.push('quests:all');

  // 7. Delete classes (with members subcollection)
  const classesSnap = await db.collection('classes').get();
  for (const doc of classesSnap.docs) {
    const membersSnap = await doc.ref.collection('members').get();
    for (const m of membersSnap.docs) await m.ref.delete();
    await doc.ref.delete();
    deleted.push(`class:${doc.data().name || doc.id}`);
  }

  // 8. Delete audit_logs
  await deleteCollection('audit_logs');
  deleted.push('audit_logs:all');

  // 9. Delete hintUnlocks
  await deleteCollection('hintUnlocks');
  deleted.push('hintUnlocks:all');

  return { deleted };
}

/**
 * Re-seed all demo data (same as scripts/seed.ts).
 * Supports 'minimal' mode (2 teams, 4 users, 1 league, 3 events, 12 challenges)
 * and 'full' mode (everything including gameplay data, chat, classes, etc.)
 */
export async function runSeed(mode: 'minimal' | 'full' = 'full'): Promise<{ summary: string[] }> {
  const db = getDb();
  const summary: string[] = [];

  const now = Date.now();
  const DAY = 86400000;
  const HOUR = 3600000;
  const MIN = 60000;

  // ── Users ──
  const superAdminUid = await ensureUser(SUPERADMIN_EMAIL, 'SuperAdmin#12345', 'Super Admin', 'superadmin', { accent: '#ff0055', accent2: '#cc0044' });
  const adminUid = await ensureUser('admin@mdavelctf.local', 'Admin#12345', 'Admin Mdavel', 'admin', { accent: '#00f0ff', accent2: '#0077ff' });
  const user1Uid = await ensureUser('user1@mdavelctf.local', 'User#12345', 'NeoByte', 'participant', { accent: '#00f0ff', accent2: '#0077ff' });
  const user2Uid = await ensureUser('user2@mdavelctf.local', 'User#12345', 'CipherCat', 'participant', { accent: '#39ff14', accent2: '#00b300' });
  const user3Uid = await ensureUser('user3@mdavelctf.local', 'User#12345', 'RootRaven', 'participant', { accent: '#ff00ff', accent2: '#b300b3' });
  const user4Uid = await ensureUser('user4@mdavelctf.local', 'User#12345', 'PacketPixie', 'participant', { accent: '#ffbf00', accent2: '#ff8c00' });
  const instructorUid = await ensureUser('instructor@mdavelctf.local', 'Instructor#12345', 'Prof. Mdavel', 'instructor', { accent: '#ff6600', accent2: '#cc5200' });
  summary.push('7 users created (1 superadmin, 1 admin, 1 instructor, 4 participants)');

  // ── Teams ──
  const teamAId = 'teamSynapse';
  const teamACode = generateJoinCode();
  await db.collection('teams').doc(teamAId).set({
    name: 'SYNAPSE', joinCode: teamACode, captainUid: user1Uid, memberCount: 2,
    createdAt: new Date().toISOString(), avatarUrl: null,
    description: 'Especialistas em segurança web e criptografia. Focados em vulnerabilidades de aplicações e análise de código.',
    tagline: 'Conectando os pontos, um byte por vez.',
    stats: { scoreEvent: 0, scoreLeague: 0, solvesTotal: 0 },
  });
  await db.collection('teams').doc(teamAId).collection('members').doc(user1Uid).set({ role: 'captain', joinedAt: new Date().toISOString() });
  await db.collection('teams').doc(teamAId).collection('members').doc(user2Uid).set({ role: 'member', joinedAt: new Date().toISOString() });
  await db.collection('users').doc(user1Uid).update({ teamId: teamAId });
  await db.collection('users').doc(user2Uid).update({ teamId: teamAId });

  const teamBId = 'teamNullpulse';
  const teamBCode = generateJoinCode();
  await db.collection('teams').doc(teamBId).set({
    name: 'NULLPULSE', joinCode: teamBCode, captainUid: user3Uid, memberCount: 2,
    createdAt: new Date().toISOString(), avatarUrl: null,
    description: 'Engenheiros reversos e especialistas em exploração binária. Dominam análise forense e pwn.',
    tagline: 'De zero a root em 60 segundos.',
    stats: { scoreEvent: 0, scoreLeague: 0, solvesTotal: 0 },
  });
  await db.collection('teams').doc(teamBId).collection('members').doc(user3Uid).set({ role: 'captain', joinedAt: new Date().toISOString() });
  await db.collection('teams').doc(teamBId).collection('members').doc(user4Uid).set({ role: 'member', joinedAt: new Date().toISOString() });
  await db.collection('users').doc(user3Uid).update({ teamId: teamBId });
  await db.collection('users').doc(user4Uid).update({ teamId: teamBId });
  summary.push('2 public teams created');

  // ── Events ──
  const event1Id = 'evt-warmup';
  const event2Id = 'evt-weekly1';
  const event3Id = 'evt-weekly2';
  const leagueId = 'league-s01';

  await db.collection('leagues').doc(leagueId).set({
    name: 'Mdavel League — Season 01',
    startsAt: new Date(now - 7 * DAY).toISOString(),
    endsAt: new Date(now + 60 * DAY).toISOString(),
    published: true, eventIds: [event1Id, event2Id, event3Id],
    createdAt: new Date().toISOString(),
  });
  summary.push('1 league created');

  // Event 1: Warmup CTF (ENDED)
  await db.collection('events').doc(event1Id).set({
    name: 'Warmup CTF', startsAt: new Date(now - 2 * DAY).toISOString(),
    endsAt: new Date(now - 1 * DAY).toISOString(), timezone: 'UTC',
    published: true, leagueId, classType: 'Segurança', createdAt: new Date().toISOString(),
  });

  const e1Challenges = [
    { id: 'e1c1', title: 'Código Escondido', category: 'Segurança', difficulty: 1, pointsFixed: 50, tags: ['web', 'html', 'beginner'], classType: 'Segurança',
      descriptionMd: '## Código Escondido\n\nUm desenvolvedor esqueceu de remover informações sensíveis do código-fonte de uma página web.\n\n**Missão:** Inspecione o HTML da página e encontre a flag escondida nos comentários.\n\n```\nhttp://challenge.local/welcome\n```\n\n> Nem tudo que é invisível está realmente oculto. Comentários HTML (`<!-- -->`) podem revelar segredos.',
      flag: 'CTF{mdavel_warmup_web_01}', hints: [{ title: 'Inspecionar Código', content: 'Use Ctrl+U ou clique direito → "Ver código-fonte". Procure por <!-- comentários HTML -->.', cost: 5 }] },
    { id: 'e1c2', title: 'Cifra de César', category: 'Segurança', difficulty: 1, pointsFixed: 75, tags: ['crypto', 'caesar', 'classical'], classType: 'Segurança',
      descriptionMd: '## Cifra de César\n\nInterceptamos uma mensagem cifrada durante um exercício de reconhecimento:\n\n```\nPGS{zqniry_jnezhc_pelcgb_02}\n```\n\nA cifra usada é uma das mais antigas da história — atribuída a Júlio César. Cada letra é deslocada um número fixo de posições no alfabeto.\n\n**Missão:** Decifre a mensagem e submeta a flag original.',
      flag: 'CTF{mdavel_warmup_crypto_02}', hints: [{ title: 'ROT13', content: 'Rotacione o alfabeto 13 posições. Observe: PGS → CTF (P+13=C, G+13=T, S+13=F).', cost: 15 }] },
    { id: 'e1c3', title: 'Cabeçalho Mágico', category: 'Segurança', difficulty: 2, pointsFixed: 100, tags: ['forensics', 'magic-bytes', 'file-analysis'], classType: 'Segurança',
      descriptionMd: '## Cabeçalho Mágico\n\nTodo arquivo digital possui **magic bytes** (assinatura) nos primeiros bytes que identificam seu formato.\n\nIdentifique o tipo de arquivo:\n\n```\n89 50 4E 47 0D 0A 1A 0A\n```\n\n**Missão:** A flag é a extensão do arquivo no formato `CTF{extensao}`.\n\n> Consulte: https://en.wikipedia.org/wiki/List_of_file_signatures',
      flag: 'CTF{mdavel_warmup_forensics_03}', hints: [{ title: 'Formato Known', content: 'Os bytes 89 50 4E 47 correspondem à string .PNG — assinatura de imagens PNG.', cost: 20 }] },
  ];
  for (const c of e1Challenges) {
    await db.collection('events').doc(event1Id).collection('challenges').doc(c.id).set({
      title: c.title, category: c.category, difficulty: c.difficulty, pointsFixed: c.pointsFixed,
      tags: c.tags, classType: c.classType, descriptionMd: c.descriptionMd, attachments: [], published: true,
      hints: c.hints, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    await db.collection('events').doc(event1Id).collection('challengeSecrets').doc(c.id).set({
      flagHash: hashFlag(normalizeFlag(c.flag, false)), caseSensitive: false, createdAt: new Date().toISOString(),
    });
  }

  // Event 2: Weekly CTF #1 (LIVE)
  await db.collection('events').doc(event2Id).set({
    name: 'Weekly CTF #1', startsAt: new Date(now - 30 * MIN).toISOString(),
    endsAt: new Date(now + 2 * HOUR).toISOString(), timezone: 'UTC',
    published: true, leagueId, classType: 'TI', createdAt: new Date().toISOString(),
  });

  const e2Challenges = [
    { id: 'e2c1', title: 'Login Bypass', category: 'TI', difficulty: 2, pointsFixed: 100, tags: ['web', 'sqli', 'auth-bypass'], classType: 'TI',
      descriptionMd: '## Login Bypass\n\nO formulário de login deste sistema é vulnerável a injeção SQL.\n\n**Cenário:** Você encontrou um painel administrativo com autenticação. Sem credenciais válidas, tente manipular a query SQL para obter acesso.\n\n```\nhttp://challenge.local:8080/login\n```\n\n> SQL Injection ocorre quando dados do usuário são inseridos diretamente em queries SQL sem sanitização.',
      flag: 'CTF{mdavel_weekly1_web_01}', hints: [
      { title: 'Aspas Simples', content: 'Digite uma aspa simples (\') no campo de login. Se der erro SQL, é vulnerável!', cost: 10 },
      { title: 'Payload Clássico', content: 'Tente: admin\' OR 1=1 -- no campo de usuário. O -- comenta o resto da query.', cost: 25 },
    ]},
    { id: 'e2c2', title: 'Fator Primo', category: 'TI', difficulty: 3, pointsFixed: 150, tags: ['crypto', 'rsa', 'factoring'], classType: 'TI',
      descriptionMd: '## Fator Primo\n\nVocê interceptou uma mensagem cifrada com RSA usando parâmetros fracos:\n\n```\nn = 3233\ne = 17\nciphertext = 2790\n```\n\n**Missão:** Fatore `n` em dois primos, calcule a chave privada `d` e decifre a mensagem.\n\n> RSA é seguro quando n é grande (2048+ bits). Com n pequeno, podemos fatorar facilmente.',
      flag: 'CTF{mdavel_weekly1_crypto_02}', hints: [
      { title: 'Primos Pequenos', content: 'n=3233 é produto de dois primos pequenos. Tente dividir por primos: 2, 3, 5, 7, 11...53.', cost: 20 },
      { title: 'Calcular d', content: 'p=53, q=61. Calcule φ(n)=(p-1)(q-1)=3120. Encontre d tal que d·e ≡ 1 (mod 3120).', cost: 45 },
    ]},
    { id: 'e2c3', title: 'Pixel Secreto', category: 'Multimídia', difficulty: 2, pointsFixed: 100, tags: ['stego', 'image', 'lsb'], classType: 'TI',
      descriptionMd: '## Pixel Secreto\n\nUma imagem PNG aparentemente normal contém uma mensagem oculta nos bits menos significativos (LSB) dos pixels.\n\n**Missão:** Extraia a mensagem escondida.\n\n> Esteganografia é a arte de esconder informações dentro de outros dados. Ferramentas: `zsteg`, `stegsolve`, `binwalk`.',
      flag: 'CTF{mdavel_weekly1_stego_03}', hints: [
      { title: 'Ferramenta', content: 'Execute: zsteg imagem.png — ele analisa automaticamente vários canais de bits.', cost: 20 },
    ]},
    { id: 'e2c4', title: 'Rastreio Digital', category: 'Administração', difficulty: 2, pointsFixed: 100, tags: ['osint', 'geolocation', 'metadata'], classType: 'TI',
      descriptionMd: '## Rastreio Digital\n\nUma foto foi publicada anonimamente em um fórum. Precisamos identificar a localização onde foi tirada.\n\n**Missão:** Analise os metadados EXIF da imagem e identifique a cidade.\n\n> Fotos de câmeras e celulares frequentemente contêm metadados com GPS, modelo do dispositivo e data. Use `exiftool` para extrair.',
      flag: 'CTF{mdavel_weekly1_osint_04}', hints: [
      { title: 'EXIF Data', content: 'Execute: exiftool foto.jpg — procure por GPS Position nos metadados.', cost: 15 },
    ]},
    { id: 'e2c5', title: 'Stack Smash', category: 'Segurança', difficulty: 4, pointsFixed: 200, tags: ['pwn', 'bof', 'stack', 'x86'], classType: 'TI',
      descriptionMd: '## Stack Smash\n\nUm binário vulnerável usa `gets()` para ler entrada do usuário:\n\n```c\nvoid vulnerable() {\n  char buf[64];\n  gets(buf); // sem limite de tamanho!\n}\n\nvoid win() {\n  system("/bin/sh");\n}\n```\n\n**Missão:** Faça buffer overflow para sobrescrever o endereço de retorno e chamar `win()`.\n\n> Buffer overflow ocorre quando dados excedem o tamanho do buffer, sobrescrevendo dados adjacentes na stack.',
      flag: 'CTF{mdavel_weekly1_pwn_05}', hints: [
      { title: 'Tamanho do Buffer', content: 'O buffer tem 64 bytes. Após ele na stack está o saved RBP (8 bytes) e o return address.', cost: 20 },
      { title: 'Endereço de Retorno', content: 'Sobrescreva o return address com o endereço de win(). Use `objdump -d binary | grep win`.', cost: 40 },
      { title: 'Offset Exato', content: 'Offset: 72 bytes (64 buffer + 8 RBP). Payload: python -c "print(\"A\"*72 + addr_win)" | ./binary', cost: 70 },
    ]},
  ];
  for (const c of e2Challenges) {
    await db.collection('events').doc(event2Id).collection('challenges').doc(c.id).set({
      title: c.title, category: c.category, difficulty: c.difficulty, pointsFixed: c.pointsFixed,
      tags: c.tags, classType: c.classType, descriptionMd: c.descriptionMd, attachments: [], published: true,
      hints: c.hints, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    await db.collection('events').doc(event2Id).collection('challengeSecrets').doc(c.id).set({
      flagHash: hashFlag(normalizeFlag(c.flag, false)), caseSensitive: false, createdAt: new Date().toISOString(),
    });
  }

  // Event 3: Weekly CTF #2 (UPCOMING)
  await db.collection('events').doc(event3Id).set({
    name: 'Weekly CTF #2', startsAt: new Date(now + 3 * DAY).toISOString(),
    endsAt: new Date(now + 3 * DAY + 3 * HOUR).toISOString(), timezone: 'UTC',
    published: true, leagueId, classType: 'Redes', createdAt: new Date().toISOString(),
  });

  const e3Challenges = [
    { id: 'e3c1', title: 'Cookie Thief', category: 'Redes', difficulty: 3, pointsFixed: 150, tags: ['web', 'xss', 'dom', 'cookies'], classType: 'Redes',
      descriptionMd: '## Cookie Thief\n\nUma aplicação web não sanitiza a entrada do usuário em um campo de busca, permitindo XSS refletido.\n\n**Cenário:** O admin acessa periodicamente a página de resultados. Injete JavaScript para roubar o cookie dele.\n\n```\nhttp://challenge.local:9090/search?q=\n```\n\n> Cross-Site Scripting (XSS) permite executar JavaScript no navegador da vítima. Tipos: Reflected, Stored, DOM-based.',
      flag: 'CTF{mdavel_weekly2_web_01}', hints: [{ title: 'Tag Script', content: 'Tente inserir <script>alert(1)</script> no parâmetro q. Se executar, é vulnerável!', cost: 20 }] },
    { id: 'e3c2', title: 'Cofre Polialfabético', category: 'Redes', difficulty: 3, pointsFixed: 150, tags: ['crypto', 'vigenere', 'frequency-analysis'], classType: 'Redes',
      descriptionMd: '## Cofre Polialfabético\n\nUma mensagem foi cifrada com a cifra de Vigenère, uma cifra polialfabética que usa uma palavra-chave para variar o deslocamento.\n\n**Dados:**\n- Texto cifrado fornecido no arquivo anexo\n- Comprimento da chave: 5 caracteres\n\n**Missão:** Quebre a cifra e encontre a flag no texto decifrado.\n\n> Use análise de frequência e o método Kasiski para determinar a chave.',
      flag: 'CTF{mdavel_weekly2_crypto_02}', hints: [{ title: 'Ferramentas Online', content: 'Use dcode.fr/vigenere-cipher — ele pode tentar quebrar automaticamente com análise de frequência.', cost: 25 }] },
    { id: 'e3c3', title: 'CrackMe', category: 'Mecânica', difficulty: 4, pointsFixed: 200, tags: ['rev', 'binary', 'x86', 'disassembly'], classType: 'Redes',
      descriptionMd: '## CrackMe\n\nUm binário ELF pede uma senha. Se a senha estiver correta, ele revela a flag.\n\n**Missão:** Faça engenharia reversa para descobrir a lógica de validação e a senha correta.\n\n```bash\n$ ./crackme\nDigite a senha: ???\n```\n\n> Ferramentas: Ghidra, IDA Free, radare2, ou até `strings` e `ltrace` para início rápido.',
      flag: 'CTF{mdavel_weekly2_rev_03}', hints: [
      { title: 'Strings', content: 'Execute: strings crackme | grep CTF — às vezes a flag está em texto plano no binário.', cost: 20 },
      { title: 'Desmontar', content: 'Use Ghidra para descompilar. Procure a função main e a lógica de comparação de strings.', cost: 50 },
    ]},
    { id: 'e3c4', title: 'Tráfego Capturado', category: 'Redes', difficulty: 3, pointsFixed: 150, tags: ['forensics', 'network', 'pcap', 'wireshark'], classType: 'Redes',
      descriptionMd: '## Tráfego Capturado\n\nUm arquivo .pcap contém tráfego de rede capturado durante um ataque. A flag foi transmitida em texto plano.\n\n**Missão:** Analise o tráfego e encontre a flag entre os pacotes.\n\n> Use Wireshark ou tshark. Filtre por protocolos específicos (HTTP, FTP, SMTP) e siga os streams TCP.',
      flag: 'CTF{mdavel_weekly2_forensics_04}', hints: [
      { title: 'Follow TCP Stream', content: 'No Wireshark: clique direito em um pacote → Follow → TCP Stream. Procure por texto legível.', cost: 20 },
    ]},
  ];
  for (const c of e3Challenges) {
    await db.collection('events').doc(event3Id).collection('challenges').doc(c.id).set({
      title: c.title, category: c.category, difficulty: c.difficulty, pointsFixed: c.pointsFixed,
      tags: c.tags, classType: c.classType, descriptionMd: c.descriptionMd, attachments: [], published: true,
      hints: c.hints, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    await db.collection('events').doc(event3Id).collection('challengeSecrets').doc(c.id).set({
      flagHash: hashFlag(normalizeFlag(c.flag, false)), caseSensitive: false, createdAt: new Date().toISOString(),
    });
  }
  summary.push('3 public events + 12 challenges created');

  // ── Minimal mode stops here ──
  if (mode === 'minimal') {
    // Create leaderboards with empty data for minimal mode
    await db.doc(`events/${event2Id}/leaderboards/individual`).set({ rows: [], updatedAt: new Date().toISOString() });
    await db.doc(`events/${event2Id}/leaderboards/teams`).set({ rows: [], updatedAt: new Date().toISOString() });
    await db.doc(`leagues/${leagueId}/standings/individual`).set({ rows: [], updatedAt: new Date().toISOString() });
    await db.doc(`leagues/${leagueId}/standings/teams`).set({ rows: [], updatedAt: new Date().toISOString() });
    summary.push('Minimal seed complete (no gameplay data, no classes, no badges/quests)');
    return { summary };
  }

  // ── Gameplay data (Event 2) ──
  const baseTime = new Date(now - 20 * MIN);
  async function addSub(uid: string, teamId: string | null, cid: string, ok: boolean, att: number, mOff: number) {
    const at = new Date(baseTime.getTime() + mOff * MIN).toISOString();
    await db.collection('events').doc(event2Id).collection('submissions').add({ uid, teamId, challengeId: cid, submittedAt: at, isCorrect: ok, attemptNumber: att });
    return at;
  }
  async function addSolve(uid: string, teamId: string | null, cid: string, pts: number, at: string) {
    await db.collection('events').doc(event2Id).collection('solves').doc(`${uid}_${cid}`).set({ solveId: `${uid}_${cid}`, uid, teamId, challengeId: cid, solvedAt: at, pointsAwarded: pts });
  }

  await addSub(user1Uid, teamAId, 'e2c1', false, 1, 1);
  const neo1 = await addSub(user1Uid, teamAId, 'e2c1', true, 2, 3);
  await addSolve(user1Uid, teamAId, 'e2c1', 100, neo1);
  const neo2 = await addSub(user1Uid, teamAId, 'e2c2', true, 1, 5);
  await addSolve(user1Uid, teamAId, 'e2c2', 150, neo2);
  await addSub(user2Uid, teamAId, 'e2c3', false, 1, 2);
  const cc1 = await addSub(user2Uid, teamAId, 'e2c3', true, 2, 6);
  await addSolve(user2Uid, teamAId, 'e2c3', 100, cc1);
  const rr1 = await addSub(user3Uid, teamBId, 'e2c1', true, 1, 2);
  await addSolve(user3Uid, teamBId, 'e2c1', 100, rr1);
  const rr2 = await addSub(user3Uid, teamBId, 'e2c2', true, 1, 4);
  await addSolve(user3Uid, teamBId, 'e2c2', 150, rr2);
  await addSub(user3Uid, teamBId, 'e2c5', false, 1, 7);
  const rr3 = await addSub(user3Uid, teamBId, 'e2c5', true, 2, 10);
  await addSolve(user3Uid, teamBId, 'e2c5', 200, rr3);
  const pp1 = await addSub(user4Uid, teamBId, 'e2c4', true, 1, 8);
  await addSolve(user4Uid, teamBId, 'e2c4', 100, pp1);
  summary.push('10 submissions + 7 solves created');

  // ── Leaderboards ──
  const individualRows = [
    { uid: user3Uid, displayName: 'RootRaven', score: 450, lastSolveAt: rr3 },
    { uid: user1Uid, displayName: 'NeoByte', score: 250, lastSolveAt: neo2 },
    { uid: user2Uid, displayName: 'CipherCat', score: 100, lastSolveAt: cc1 },
    { uid: user4Uid, displayName: 'PacketPixie', score: 100, lastSolveAt: pp1 },
  ];
  const teamRows = [
    { teamId: teamBId, teamName: 'NULLPULSE', score: 550, lastSolveAt: rr3 },
    { teamId: teamAId, teamName: 'SYNAPSE', score: 350, lastSolveAt: cc1 },
  ];
  await db.doc(`events/${event2Id}/leaderboards/individual`).set({ rows: individualRows, updatedAt: new Date().toISOString() });
  await db.doc(`events/${event2Id}/leaderboards/teams`).set({ rows: teamRows, updatedAt: new Date().toISOString() });
  await db.doc(`leagues/${leagueId}/standings/individual`).set({ rows: individualRows, updatedAt: new Date().toISOString() });
  await db.doc(`leagues/${leagueId}/standings/teams`).set({ rows: teamRows, updatedAt: new Date().toISOString() });
  summary.push('Leaderboards + standings built');

  // ── Analytics ──
  await db.doc(`events/${event2Id}/analytics/summary`).set({
    activeUsersLast15m: 4, submissionsTotal: 10, solvesTotal: 7,
    solvesByChallenge: { e2c1: 2, e2c2: 2, e2c3: 1, e2c4: 1, e2c5: 1 },
    wrongByChallenge: { e2c1: 1, e2c3: 1, e2c5: 1 },
    submissionsByMinute: [], updatedAt: new Date().toISOString(),
  });
  await db.doc(`leagues/${leagueId}/analytics/summary`).set({
    participantsTotal: 4, participationByEvent: { [event2Id]: 4 },
    retentionBuckets: { one: 4, two: 0, threePlus: 0 }, updatedAt: new Date().toISOString(),
  });
  summary.push('Analytics built');

  // ── User profiles ──
  await db.collection('users').doc(user1Uid).update({
    bio: 'Entusiasta de segurança web e CTFs. Comecei em 2024 e não parei mais! Foco em SQLi e XSS.', course: 'Cybersecurity B.Sc.', classGroup: 'CS-2026-A', unit: 'Engenharia',
    xp: 700, level: 2, badges: ['first_solve', 'team_player'], stats: { solvesTotal: 2, correctSubmissions: 2, wrongSubmissions: 1, solvesByCategory: { TI: 2 } },
  });
  await db.collection('users').doc(user2Uid).update({
    bio: 'Forense digital é minha paixão. Vejo hex em todo lugar. Especialista em análise de imagens e metadados.', course: 'Ciência da Computação B.Sc.', classGroup: 'CS-2026-B', unit: 'Engenharia',
    xp: 250, level: 2, badges: ['first_solve'], stats: { solvesTotal: 1, correctSubmissions: 1, wrongSubmissions: 1, solvesByCategory: { Multimídia: 1 } },
  });
  await db.collection('users').doc(user3Uid).update({
    bio: 'Exploração binária é meu zen. Engenharia reversa é minha terapia. Mestre em pwn e rev.', course: 'Segurança da Informação M.Sc.', classGroup: 'IS-2025-A', unit: 'Engenharia',
    xp: 1400, level: 3, badges: ['first_solve', 'five_solves', 'three_categories', 'team_player', 'speed_demon'],
    stats: { solvesTotal: 3, correctSubmissions: 3, wrongSubmissions: 1, solvesByCategory: { TI: 2, Segurança: 1 } },
  });
  await db.collection('users').doc(user4Uid).update({
    bio: 'OSINT geek. Adoro encontrar agulhas em palheiros digitais. Pesquisa e análise de fontes abertas.', course: 'Forense Digital B.Sc.', classGroup: 'DF-2026-A', unit: 'Engenharia',
    xp: 250, level: 2, badges: ['first_solve'], stats: { solvesTotal: 1, correctSubmissions: 1, wrongSubmissions: 0, solvesByCategory: { Administração: 1 } },
  });
  await db.collection('users').doc(adminUid).update({ bio: 'Administrador da plataforma MdavelCTF.', course: 'Staff', unit: 'Departamento de TI' });
  summary.push('User profiles extended');

  // Team stats
  await db.collection('teams').doc(teamAId).update({ stats: { scoreEvent: 350, scoreLeague: 350, solvesTotal: 3 } });
  await db.collection('teams').doc(teamBId).update({ stats: { scoreEvent: 550, scoreLeague: 550, solvesTotal: 4 } });

  // ── Badges ──
  const badges: Record<string, any> = {
    first_solve: { name: 'First Blood', description: 'Solve your first challenge', icon: '🩸', rarity: 'common', criteriaKey: 'first_solve', xpReward: 50 },
    five_solves: { name: 'Pentakill', description: 'Solve 5 challenges', icon: '⚔️', rarity: 'common', criteriaKey: 'five_solves', xpReward: 100 },
    ten_solves: { name: 'Veteran Hacker', description: 'Solve 10 challenges', icon: '🎖️', rarity: 'rare', criteriaKey: 'ten_solves', xpReward: 200 },
    twenty_solves: { name: 'Elite Operator', description: 'Solve 20 challenges', icon: '💀', rarity: 'epic', criteriaKey: 'twenty_solves', xpReward: 500 },
    three_categories: { name: 'Versatile', description: 'Solve in 3 tags', icon: '🔀', rarity: 'rare', criteriaKey: 'three_categories', xpReward: 150 },
    five_categories: { name: 'Full-Spectrum', description: 'Solve in 5 tags', icon: '🌈', rarity: 'epic', criteriaKey: 'five_categories', xpReward: 300 },
    team_player: { name: 'Team Player', description: 'Solve 2+ in a team', icon: '🤝', rarity: 'common', criteriaKey: 'team_player', xpReward: 75 },
    web_master: { name: 'Web Master', description: 'Resolva 5 desafios de WEB', icon: '🌐', rarity: 'rare', criteriaKey: 'web_master', xpReward: 200 },
    crypto_breaker: { name: 'Crypto Breaker', description: 'Resolva 5 desafios de CRYPTO', icon: '🔐', rarity: 'rare', criteriaKey: 'crypto_breaker', xpReward: 200 },
    forensics_expert: { name: 'Forensics Expert', description: 'Resolva 5 desafios de FORENSICS', icon: '🔍', rarity: 'rare', criteriaKey: 'forensics_expert', xpReward: 200 },
    speed_demon: { name: 'Speed Demon', description: 'Solve on first attempt', icon: '⚡', rarity: 'common', criteriaKey: 'speed_demon', xpReward: 50 },
    night_owl: { name: 'Night Owl', description: 'Submit after midnight', icon: '🦉', rarity: 'common', criteriaKey: 'night_owl', xpReward: 50 },
  };
  for (const [key, badge] of Object.entries(badges)) {
    await db.collection('badges').doc(key).set(badge);
  }
  summary.push('12 badges seeded');

  // ── Quests ──
  const weekEnd = new Date(now + 7 * DAY);
  const quests = [
    { id: 'quest-weekly-warrior', title: 'Guerreiro Semanal', description: 'Resolva 3 desafios esta semana para provar sua consistência', activeFrom: new Date(now - 1 * DAY).toISOString(), activeTo: weekEnd.toISOString(), xpReward: 150, rules: { type: 'solve_total', target: 3 } },
    { id: 'quest-web-hunter', title: 'Caçador Web', description: 'Resolva 2 desafios com tag WEB esta semana', activeFrom: new Date(now - 1 * DAY).toISOString(), activeTo: weekEnd.toISOString(), xpReward: 100, rules: { type: 'solve_category', target: 2, category: 'Segurança' } },
    { id: 'quest-crypto-starter', title: 'Iniciante em Crypto', description: 'Resolva pelo menos 1 desafio de criptografia esta semana', activeFrom: new Date(now - 1 * DAY).toISOString(), activeTo: weekEnd.toISOString(), xpReward: 75, rules: { type: 'solve_category', target: 1, category: 'TI' } },
  ];
  for (const q of quests) {
    const { id, ...data } = q;
    await db.collection('quests').doc(id).set(data);
  }
  // Quest progress
  await db.collection('quests').doc('quest-weekly-warrior').collection('progress').doc(user3Uid).set({ progress: 3, completed: true, updatedAt: new Date().toISOString() });
  await db.collection('quests').doc('quest-weekly-warrior').collection('progress').doc(user1Uid).set({ progress: 2, completed: false, updatedAt: new Date().toISOString() });
  await db.collection('quests').doc('quest-web-hunter').collection('progress').doc(user1Uid).set({ progress: 1, completed: false, updatedAt: new Date().toISOString() });
  await db.collection('quests').doc('quest-crypto-starter').collection('progress').doc(user1Uid).set({ progress: 1, completed: true, updatedAt: new Date().toISOString() });
  await db.collection('quests').doc('quest-crypto-starter').collection('progress').doc(user3Uid).set({ progress: 1, completed: true, updatedAt: new Date().toISOString() });
  summary.push('3 quests + progress seeded');

  // ── Chat messages ──
  const chatMessages = [
    { teamId: teamAId, uid: user1Uid, displayName: 'NeoByte', text: 'Bora time! Vamos dominar esse CTF 💪', offset: -15 },
    { teamId: teamAId, uid: user2Uid, displayName: 'CipherCat', text: 'Tô focando no desafio de esteganografia, parece ter algo nos LSB', offset: -12 },
    { teamId: teamAId, uid: user1Uid, displayName: 'NeoByte', text: 'Login Bypass resolvido! Era SQLi clássico com OR 1=1', offset: -10 },
    { teamId: teamAId, uid: user2Uid, displayName: 'CipherCat', text: 'Achei a flag do Pixel Secreto! zsteg salvou 🎉', offset: -6 },
    { teamId: teamBId, uid: user3Uid, displayName: 'RootRaven', text: 'Vamos liderar esse placar 🔥 já comecei pelo web', offset: -18 },
    { teamId: teamBId, uid: user4Uid, displayName: 'PacketPixie', text: 'Fico com o OSINT, adoro análise de metadados', offset: -16 },
    { teamId: teamBId, uid: user3Uid, displayName: 'RootRaven', text: 'Web e crypto feitos. Partindo pro buffer overflow agora', offset: -8 },
    { teamId: teamBId, uid: user4Uid, displayName: 'PacketPixie', text: 'OSINT resolvido! exiftool mostrou as coordenadas GPS 🏆', offset: -5 },
  ];
  for (const msg of chatMessages) {
    await db.collection('teams').doc(msg.teamId).collection('chat').add({
      uid: msg.uid, displayName: msg.displayName, avatarUrl: null,
      text: msg.text, createdAt: new Date(now + msg.offset * MIN).toISOString(),
    });
  }
  summary.push('8 chat messages seeded');

  // ── Class + Private Event + Event Teams ──
  const classId = 'class-cyber101';
  const classCode = generateJoinCode();
  await db.collection('classes').doc(classId).set({
    name: 'Cybersecurity 101', description: 'Introdução a técnicas de segurança cibernética e competições CTF. Cobre vulnerabilidades web, criptografia básica, análise forense e OSINT.',
    createdAt: new Date().toISOString(), ownerInstructorId: instructorUid, inviteCode: classCode, published: true,
    classType: 'Segurança', themeId: 'neon-cyber', icon: '🛡️', tags: ['security', 'beginner', 'web'],
    settings: { defaultEventVisibility: 'private', allowStudentPublicTeams: true },
  });
  await db.collection('classes').doc(classId).collection('members').doc(instructorUid).set({ uid: instructorUid, roleInClass: 'instructor', joinedAt: new Date().toISOString(), displayNameSnapshot: 'Prof. Mdavel' });
  for (const stuUid of [user1Uid, user2Uid, user3Uid]) {
    await db.collection('classes').doc(classId).collection('members').doc(stuUid).set({ uid: stuUid, roleInClass: 'student', joinedAt: new Date().toISOString(), displayNameSnapshot: '' });
  }
  for (const uid of [instructorUid, user1Uid, user2Uid, user3Uid]) {
    await db.collection('users').doc(uid).update({ classIds: admin.firestore.FieldValue.arrayUnion(classId) });
  }
  summary.push('1 class created (Cybersecurity 101)');

  const event4Id = 'evt-class-lab1';
  await db.collection('events').doc(event4Id).set({
    name: 'Class Lab #1 — Intro Challenges', startsAt: new Date(now - 1 * HOUR).toISOString(),
    endsAt: new Date(now + 4 * HOUR).toISOString(), timezone: 'UTC', published: true,
    leagueId: null, visibility: 'private', classId, ownerId: instructorUid,
    teamMode: 'eventTeams', requireClassMembership: true, classType: 'Segurança',
    createdAt: new Date().toISOString(),
  });
  const e4c1flag = normalizeFlag('CTF{mdavel_classlab_osint_01}', false);
  await db.collection('events').doc(event4Id).collection('challenges').doc('e4c1').set({
    title: 'Recon 101', category: 'OSINT', difficulty: 1, pointsFixed: 50,
    tags: ['osint', 'recon', 'beginner'], classType: 'Segurança', descriptionMd: '## Recon 101\n\nO primeiro passo de qualquer pentest é o **reconhecimento**. Neste desafio, você vai explorar um servidor web em busca de informações que deveriam estar ocultas.\n\n**Missão:** Encontre a flag verificando os arquivos de configuração públicos do servidor.\n\n> Dica: Desenvolvedores frequentemente esquecem de proteger arquivos como robots.txt, .env, sitemap.xml.',
    attachments: [], published: true, hints: [{ title: 'Robots', content: 'Navigate to /robots.txt on the target.', cost: 10 }],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  await db.collection('events').doc(event4Id).collection('challengeSecrets').doc('e4c1').set({
    flagHash: hashFlag(e4c1flag), caseSensitive: false, createdAt: new Date().toISOString(),
  });
  summary.push('1 private event + 1 challenge created');

  // Event teams
  const evtTeam1Id = 'evt-team-alpha';
  const evtTeam1Code = generateJoinCode();
  await db.collection('teams').doc(evtTeam1Id).set({
    name: 'Team Alpha', joinCode: evtTeam1Code, captainUid: user1Uid, memberCount: 2,
    createdAt: new Date().toISOString(), scope: 'event', eventId: event4Id, classId,
    avatarUrl: null, description: null, tagline: null, stats: { scoreEvent: 0, solvesTotal: 0 },
  });
  await db.collection('teams').doc(evtTeam1Id).collection('members').doc(user1Uid).set({ role: 'captain', joinedAt: new Date().toISOString() });
  await db.collection('teams').doc(evtTeam1Id).collection('members').doc(user2Uid).set({ role: 'member', joinedAt: new Date().toISOString() });

  const evtTeam2Id = 'evt-team-bravo';
  const evtTeam2Code = generateJoinCode();
  await db.collection('teams').doc(evtTeam2Id).set({
    name: 'Team Bravo', joinCode: evtTeam2Code, captainUid: user3Uid, memberCount: 1,
    createdAt: new Date().toISOString(), scope: 'event', eventId: event4Id, classId,
    avatarUrl: null, description: null, tagline: null, stats: { scoreEvent: 0, solvesTotal: 0 },
  });
  await db.collection('teams').doc(evtTeam2Id).collection('members').doc(user3Uid).set({ role: 'captain', joinedAt: new Date().toISOString() });
  summary.push('2 event teams created');

  await db.collection('users').doc(superAdminUid).update({ bio: 'Super administrador da plataforma MdavelCTF.', course: 'Staff', unit: 'Departamento de TI' });
  await db.collection('users').doc(adminUid).update({ bio: 'Administrador da plataforma MdavelCTF.', course: 'Staff', unit: 'Departamento de TI' });

  // ── Second class for variety ──
  const class2Id = 'class-networks';
  const class2Code = generateJoinCode();
  await db.collection('classes').doc(class2Id).set({
    name: 'Redes e Infraestrutura', description: 'Análise de tráfego de rede, captura de pacotes com Wireshark, protocolos TCP/IP e segurança de infraestrutura.',
    createdAt: new Date().toISOString(), ownerInstructorId: instructorUid, inviteCode: class2Code, published: true,
    classType: 'Redes', themeId: 'deep-ocean', icon: '🌊', tags: ['networking', 'infrastructure'],
    settings: { defaultEventVisibility: 'private', allowStudentPublicTeams: true },
  });
  await db.collection('classes').doc(class2Id).collection('members').doc(instructorUid).set({ uid: instructorUid, roleInClass: 'instructor', joinedAt: new Date().toISOString(), displayNameSnapshot: 'Prof. Mdavel' });
  summary.push('2 classes created');

  return { summary };
}
