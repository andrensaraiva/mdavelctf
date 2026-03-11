/* ─── User ─── */
export interface UserStats {
  solvesTotal?: number;
  correctSubmissions?: number;
  wrongSubmissions?: number;
  solvesByCategory?: Record<string, number>;
}

export type UserRole = 'participant' | 'instructor' | 'admin' | 'superadmin';

export interface UserDoc {
  displayName: string;
  role: UserRole;
  disabled: boolean;
  teamId: string | null;
  theme: UserTheme;
  createdAt: string; // ISO
  // Extended profile fields (optional, backward-compatible)
  avatarUrl?: string;
  bio?: string;
  course?: string;
  classGroup?: string;
  unit?: string;
  xp?: number;
  level?: number;
  badges?: string[];
  stats?: UserStats;
  // i18n
  locale?: 'pt-BR' | 'en';
  // Classes & teams
  classIds?: string[];
  publicTeamId?: string;
  // Course theme preference
  preferredClassId?: string;
  themeSource?: 'class' | 'custom'; // default 'custom'
}

export interface UserTheme {
  accent: string;
  accent2: string;
  panelBg?: string;
}

/* ─── Team ─── */
export type TeamScope = 'public' | 'event';

export interface TeamDoc {
  name: string;
  joinCode: string;
  captainUid: string;
  memberCount: number;
  createdAt: string;
  // Extended fields
  avatarUrl?: string;
  description?: string;
  tagline?: string;
  stats?: {
    scoreEvent?: number;
    scoreLeague?: number;
    solvesTotal?: number;
  };
  // Scope (optional, backward-compatible default 'public')
  scope?: TeamScope;     // default 'public'
  eventId?: string;      // required if scope='event'
  classId?: string;      // optional, for class-linked event teams
}

/* ─── Class (Turma) ─── */
export interface ClassDoc {
  name: string;
  description?: string;
  createdAt: string;
  ownerInstructorId: string;
  inviteCode: string;
  published?: boolean;
  classType?: string;       // e.g. 'TI', 'Administração', 'Mecânica', 'Robótica'
  themeId?: string;          // one of COURSE_THEME_PRESETS keys
  icon?: string;
  tags?: string[];           // free-form tags
  settings?: {
    defaultEventVisibility?: EventVisibility;
    allowStudentPublicTeams?: boolean;
  };
}

export interface ClassMemberDoc {
  uid: string;
  roleInClass: 'student' | 'assistant' | 'instructor';
  joinedAt: string;
  displayNameSnapshot: string;
}

export interface TeamMemberDoc {
  role: 'captain' | 'member';
  joinedAt: string;
}

/* ─── Team Chat Message ─── */
export interface TeamMessageDoc {
  uid: string;
  displayName: string;
  avatarUrl?: string;
  text: string;
  createdAt: string;
}

/* ─── Badge ─── */
export type BadgeRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface BadgeDoc {
  name: string;
  description: string;
  icon: string;
  rarity: BadgeRarity;
  criteriaKey: string;
  xpReward: number;
}

/* ─── Quest ─── */
export type QuestRuleType = 'solve_category' | 'solve_total' | 'participate_event';

export interface QuestRules {
  type: QuestRuleType;
  target: number;
  category?: string;
}

export interface QuestDoc {
  title: string;
  description: string;
  activeFrom: string;
  activeTo: string;
  xpReward: number;
  badgeReward?: string;
  rules: QuestRules;
}

/* ─── Quest Progress ─── */
export interface QuestProgressDoc {
  progress: number;
  completed: boolean;
  updatedAt: string;
}

/* ─── Event ─── */
export type EventStatus = 'UPCOMING' | 'LIVE' | 'ENDED';

export type EventVisibility = 'public' | 'private';
export type EventTeamMode = 'publicTeams' | 'eventTeams';

export interface EventDoc {
  name: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  published: boolean;
  leagueId: string | null;
  createdAt: string;
  // Visibility & ownership (optional, backward-compatible defaults)
  visibility?: EventVisibility;        // default 'public'
  classId?: string;                    // if private event tied to a class
  ownerId?: string;                    // creator uid (instructor or admin)
  teamMode?: EventTeamMode;            // default 'publicTeams'
  requireClassMembership?: boolean;    // true for private class events
  classType?: string;                  // mandatory class type tag
}

/* ─── Challenge ─── */
/**
 * flagMode:
 *  - 'standard' (default): multiple users/teams can solve, fixed points
 *  - 'unique': only the first person to solve gets points, then it locks
 *  - 'decay': multiple solves allowed, but points decrease per solve.
 *             Same team cannot solve twice (different member of same team blocked).
 */
export type ChallengeFlagMode = 'standard' | 'unique' | 'decay';

export interface ChallengeDecayConfig {
  minPoints: number;   // Minimum points (floor)
  decayPercent: number; // Percentage lost per solve (e.g. 10 = loses 10% each solve)
}

export interface ChallengeDoc {
  title: string;
  category: string;
  difficulty: number; // 1-5
  pointsFixed: number;
  tags: string[];
  descriptionMd: string;
  attachments: AttachmentMeta[];
  published: boolean;
  createdAt: string;
  updatedAt: string;
  // Challenge mode (optional, defaults to 'standard')
  flagMode?: ChallengeFlagMode;
  decayConfig?: ChallengeDecayConfig;
  // Runtime counters (updated on solve)
  solveCount?: number;
  lockedBy?: string; // uid of solver when flagMode='unique'
  // Class type tag (mandatory)
  classType?: string;
  // Inline hints
  hints?: ChallengeHint[];
}

/** Hint defined inline when creating a challenge */
export interface ChallengeHint {
  title: string;          // e.g. 'Hint 1'
  description: string;    // hint content
  penaltyPercent: number;  // % of challenge points lost (e.g. 10 = 10%)
}

export interface AttachmentMeta {
  path: string;
  name: string;
  size: number;
  contentType: string;
}

/* ─── Server Secrets (never sent to client) ─── */
export interface ChallengeSecretDoc {
  flagHash: string;
  caseSensitive: boolean;
  createdAt: string;
}

/* ─── Submission ─── */
export interface SubmissionDoc {
  uid: string;
  teamId: string | null;
  challengeId: string;
  submittedAt: string;
  isCorrect: boolean;
  attemptNumber: number;
  ipHash?: string;
  userAgentHash?: string;
}

/* ─── Solve ─── */
export interface SolveDoc {
  solveId: string; // `${uid}_${challengeId}`
  uid: string;
  teamId: string | null;
  challengeId: string;
  solvedAt: string;
  pointsAwarded: number;
}

/* ─── Leaderboard ─── */
export interface LeaderboardRow {
  uid?: string;
  teamId?: string;
  displayName?: string;
  teamName?: string;
  score: number;
  lastSolveAt: string;
}

export interface LeaderboardDoc {
  rows: LeaderboardRow[];
  updatedAt: string;
}

/* ─── League ─── */
export interface LeagueDoc {
  name: string;
  startsAt: string;
  endsAt: string;
  published: boolean;
  eventIds: string[];
  createdAt: string;
}

/* ─── Analytics ─── */
export interface EventAnalyticsSummary {
  activeUsersLast15m: number;
  submissionsTotal: number;
  solvesTotal: number;
  solvesByChallenge: Record<string, number>;
  wrongByChallenge: Record<string, number>;
  submissionsByMinute: { minuteKey: string; count: number }[];
  updatedAt: string;
}

export interface LeagueAnalyticsSummary {
  participantsTotal: number;
  participationByEvent: Record<string, number>;
  retentionBuckets: { one: number; two: number; threePlus: number };
  updatedAt: string;
}

/* ─── Audit ─── */
export interface AuditLogDoc {
  adminUid: string;
  action: string;
  entityPath: string;
  before: unknown;
  after: unknown;
  createdAt: string;
}

/* ─── API payloads ─── */
export interface SubmitFlagRequest {
  eventId: string;
  challengeId: string;
  flagText: string;
}

export interface SubmitFlagResponse {
  correct: boolean;
  alreadySolved: boolean;
  attemptsLeft: number;
  cooldownRemaining: number;
  scoreAwarded?: number;
  locked?: boolean;      // true when unique challenge already solved by someone else
  teamBlocked?: boolean; // true when decay challenge already solved by a teammate
}

export interface CreateTeamRequest {
  name: string;
}

export interface JoinTeamRequest {
  joinCode: string;
}

/* ─── Team Activity ─── */
export interface TeamActivityEntry {
  uid: string;
  displayName: string;
  challengeId: string;
  challengeTitle?: string;
  category?: string;
  pointsAwarded: number;
  solvedAt: string;
  eventId: string;
}

/* ─── Admin Dashboard Summary ─── */
export interface AdminDashboardSummary {
  activeUsersLast15m: number;
  submissionsLast60m: number;
  solvesLast60m: number;
  solveRate: number;
  totalUsers: number;
  totalEvents: number;
  liveEventName?: string;
  liveEventEndsAt?: string;
  topHardChallenges: { challengeId: string; title?: string; category?: string; difficulty?: number; points?: number; wrong: number; solves: number }[];
  topActiveUsers: { uid: string; displayName?: string; submissionCount: number }[];
  recentSubmissions: any[];
  recentSolves: any[];
}

/* ─── Theme Presets ─── */
export const THEME_PRESETS: Record<string, UserTheme & { label: string }> = {
  cyan:    { accent: '#00f0ff', accent2: '#0077ff', label: 'Neon Cyan' },
  green:   { accent: '#39ff14', accent2: '#00b300', label: 'Matrix Green' },
  magenta: { accent: '#ff00ff', accent2: '#b300b3', label: 'Magenta Punk' },
  amber:   { accent: '#ffbf00', accent2: '#ff8c00', label: 'Amber Terminal' },
  red:     { accent: '#ff003c', accent2: '#cc0000', label: 'Red Alert' },
};

export const DEFAULT_THEME: UserTheme = { accent: THEME_PRESETS.cyan.accent, accent2: THEME_PRESETS.cyan.accent2 };

/** Checks if accent colors have enough contrast against dark bg */
export function isThemeReadable(theme: UserTheme): boolean {
  const lum = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  try {
    return lum(theme.accent) > 0.15 && lum(theme.accent2) > 0.08;
  } catch {
    return false;
  }
}

/** Compute level from XP: level = 1 + floor(sqrt(xp / 200)) */
export function xpToLevel(xp: number): number {
  return 1 + Math.floor(Math.sqrt(Math.max(0, xp) / 200));
}

/** XP needed for a given level */
export function levelToXp(level: number): number {
  return Math.pow(Math.max(0, level - 1), 2) * 200;
}

/** Badge rarity color */
export function rarityColor(rarity: BadgeRarity): string {
  switch (rarity) {
    case 'common': return '#aaaaaa';
    case 'rare': return '#00aaff';
    case 'epic': return '#aa00ff';
    case 'legendary': return '#ffaa00';
  }
}

/** Default badge catalog */
export const DEFAULT_BADGES: Record<string, Omit<BadgeDoc, 'criteriaKey'> & { criteriaKey: string }> = {
  first_solve:       { name: 'First Blood', description: 'Solve your first challenge', icon: '🩸', rarity: 'common', criteriaKey: 'first_solve', xpReward: 50 },
  five_solves:       { name: 'Pentakill', description: 'Solve 5 challenges', icon: '⚔️', rarity: 'common', criteriaKey: 'five_solves', xpReward: 100 },
  ten_solves:        { name: 'Veteran Hacker', description: 'Solve 10 challenges', icon: '🎖️', rarity: 'rare', criteriaKey: 'ten_solves', xpReward: 200 },
  twenty_solves:     { name: 'Elite Operator', description: 'Solve 20 challenges', icon: '💀', rarity: 'epic', criteriaKey: 'twenty_solves', xpReward: 500 },
  three_categories:  { name: 'Versatile', description: 'Solve challenges in 3 different categories', icon: '🔀', rarity: 'rare', criteriaKey: 'three_categories', xpReward: 150 },
  five_categories:   { name: 'Full-Spectrum', description: 'Solve challenges in 5 different categories', icon: '🌈', rarity: 'epic', criteriaKey: 'five_categories', xpReward: 300 },
  team_player:       { name: 'Team Player', description: 'Solve 2+ challenges while in a team', icon: '🤝', rarity: 'common', criteriaKey: 'team_player', xpReward: 75 },
  web_master:        { name: 'Web Master', description: 'Solve 5 WEB challenges', icon: '🌐', rarity: 'rare', criteriaKey: 'web_master', xpReward: 200 },
  crypto_breaker:    { name: 'Crypto Breaker', description: 'Solve 5 CRYPTO challenges', icon: '🔐', rarity: 'rare', criteriaKey: 'crypto_breaker', xpReward: 200 },
  forensics_expert:  { name: 'Forensics Expert', description: 'Solve 5 FORENSICS challenges', icon: '🔍', rarity: 'rare', criteriaKey: 'forensics_expert', xpReward: 200 },
  speed_demon:       { name: 'Speed Demon', description: 'Solve a challenge on first attempt', icon: '⚡', rarity: 'common', criteriaKey: 'speed_demon', xpReward: 50 },
  night_owl:         { name: 'Night Owl', description: 'Submit a flag after midnight', icon: '🦉', rarity: 'common', criteriaKey: 'night_owl', xpReward: 50 },
};

/* ─── Hint ─── */
export interface HintDoc {
  title: string;
  content: string;
  order: number;
  penaltyPercent: number;  // % of challenge points lost
  createdAt: string;
  updatedAt: string;
}

export interface HintUnlockDoc {
  uid: string;
  challengeId: string;
  hintId: string;
  eventId: string;
  unlockedAt: string;
  penaltyApplied: number;  // actual points deducted
}

/* ─── Class Type Tags ─── */
export const DEFAULT_CLASS_TYPES: { value: string; label: string; icon: string }[] = [
  { value: 'TI', label: 'Tecnologia da Informação', icon: '💻' },
  { value: 'Administração', label: 'Administração', icon: '📊' },
  { value: 'Mecânica', label: 'Mecânica', icon: '⚙️' },
  { value: 'Robótica', label: 'Robótica', icon: '🤖' },
  { value: 'Redes', label: 'Redes de Computadores', icon: '🌐' },
  { value: 'Segurança', label: 'Segurança da Informação', icon: '🔒' },
  { value: 'Multimídia', label: 'Multimídia', icon: '🎬' },
  { value: 'Jogos', label: 'Desenvolvimento de Jogos', icon: '🎮' },
  { value: 'Outro', label: 'Outro', icon: '📁' },
];

/* ─── Course Theme Presets ─── */
export interface CourseThemePreset {
  id: string;
  name: string;
  bg: string;
  panelBg: string;
  accent: string;
  accent2: string;
  text: string;
  textDim: string;
  success: string;
  warning: string;
  danger: string;
  gridOpacity?: number;
  vibe?: string;
}

export const COURSE_THEME_PRESETS: Record<string, CourseThemePreset> = {
  'neon-cyber': {
    id: 'neon-cyber', name: 'Neon Cyber',
    bg: '#0a0e17', panelBg: '#111827', accent: '#00f0ff', accent2: '#0077ff',
    text: '#e0e6f0', textDim: '#607090', success: '#39ff14', warning: '#ffbf00', danger: '#ff003c',
    gridOpacity: 0.06, vibe: 'Classic cyberpunk HUD'
  },
  'matrix-green': {
    id: 'matrix-green', name: 'Matrix Green',
    bg: '#0b0f0a', panelBg: '#0f1a0f', accent: '#39ff14', accent2: '#00b300',
    text: '#c8f0c0', textDim: '#4a7040', success: '#39ff14', warning: '#b3ff00', danger: '#ff3333',
    gridOpacity: 0.08, vibe: 'Digital rain terminal'
  },
  'magenta-punk': {
    id: 'magenta-punk', name: 'Magenta Punk',
    bg: '#120812', panelBg: '#1a0f1a', accent: '#ff00ff', accent2: '#b300b3',
    text: '#f0d0f0', textDim: '#804080', success: '#00ff88', warning: '#ffaa00', danger: '#ff2255',
    gridOpacity: 0.06, vibe: 'Bold neon rebellion'
  },
  'amber-terminal': {
    id: 'amber-terminal', name: 'Amber Terminal',
    bg: '#0f0d08', panelBg: '#1a1608', accent: '#ffbf00', accent2: '#ff8c00',
    text: '#f0e0c0', textDim: '#806830', success: '#88ff00', warning: '#ffbf00', danger: '#ff4444',
    gridOpacity: 0.05, vibe: 'Retro CRT warmth'
  },
  'red-alert': {
    id: 'red-alert', name: 'Red Alert',
    bg: '#100808', panelBg: '#1a0f0f', accent: '#ff003c', accent2: '#cc0000',
    text: '#f0c8c8', textDim: '#804040', success: '#00ff66', warning: '#ff9900', danger: '#ff003c',
    gridOpacity: 0.06, vibe: 'High-stakes emergency'
  },
  'royal-violet': {
    id: 'royal-violet', name: 'Royal Violet',
    bg: '#0d0a14', panelBg: '#150f20', accent: '#aa77ff', accent2: '#6633cc',
    text: '#ddd0f0', textDim: '#604890', success: '#33ff99', warning: '#ffcc33', danger: '#ff4466',
    gridOpacity: 0.05, vibe: 'Elegant digital royalty'
  },
  'deep-ocean': {
    id: 'deep-ocean', name: 'Deep Ocean',
    bg: '#060d14', panelBg: '#0a1520', accent: '#00b4d8', accent2: '#0077b6',
    text: '#c0dde8', textDim: '#406878', success: '#00e676', warning: '#ffc107', danger: '#ef5350',
    gridOpacity: 0.06, vibe: 'Calm deep-sea exploration'
  },
  'lava-core': {
    id: 'lava-core', name: 'Lava Core',
    bg: '#100804', panelBg: '#1a0e08', accent: '#ff6600', accent2: '#cc3300',
    text: '#f0d8c0', textDim: '#805830', success: '#66ff33', warning: '#ff9900', danger: '#ff2200',
    gridOpacity: 0.07, vibe: 'Volcanic inferno energy'
  },
  'synthwave': {
    id: 'synthwave', name: 'Synthwave',
    bg: '#0f0820', panelBg: '#180e30', accent: '#f72585', accent2: '#7209b7',
    text: '#e8d0f0', textDim: '#705090', success: '#4cc9f0', warning: '#fca311', danger: '#ff006e',
    gridOpacity: 0.06, vibe: 'Retro-future vibes'
  },
  'clean-academy': {
    id: 'clean-academy', name: 'Clean Academy',
    bg: '#0f1318', panelBg: '#161c24', accent: '#4ea8de', accent2: '#2b6cb0',
    text: '#d0dce8', textDim: '#607080', success: '#38b000', warning: '#f0a500', danger: '#d00000',
    gridOpacity: 0.04, vibe: 'Clean educational interface'
  },
};
