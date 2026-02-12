/* ─── User ─── */
export interface UserStats {
  solvesTotal?: number;
  correctSubmissions?: number;
  wrongSubmissions?: number;
  solvesByCategory?: Record<string, number>;
}

export type UserRole = 'participant' | 'instructor' | 'admin';

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
