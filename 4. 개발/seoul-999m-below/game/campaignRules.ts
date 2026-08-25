export const CAMPAIGN1_WAVE_COUNTS = { 1: 18, 2: 24 } as const;
export const CAMPAIGN1_MAX_ACTIVE_INVADERS = 9;
export const CAMPAIGN1_REGROUP_AFTER_MS = 3500;
export const CAMPAIGN1_RETREAT_AFTER_MS = 8000;
export const CAMPAIGN1_SCOUT_EXIT_MS = 3200;
export const CAMPAIGN1_VENT_DELAY_MS = 5000;
export const CAMPAIGN2_SCIENTIST_START_DELAY_MS = 5000;
export const CAMPAIGN_COMPANION_LEASH_DISTANCE = 8;
export const CAMPAIGN_COMPANION_AGGRO_DISTANCE = 24;
export const CAMPAIGN_ASSIST_RADIUS = 20;
export const CAMPAIGN_COMPANION_ASSIST_DISTANCE = 160;
export const CAMPAIGN_ASSIST_MEMORY_MS = 9000;
export const CAMPAIGN_COMPANION_ASSIST_MEMORY_MS = 20000;
export const CAMPAIGN_SENTRY_AGGRO_DISTANCE = 9;
export const CAMPAIGN_COMPANION_BLOCKED_RECOVERY_MS = 1800;
export const CAMPAIGN_COMPANION_DISCONNECTED_RECOVERY_MS = 2600;
export const CAMPAIGN_COMPANION_STALL_RECOVERY_MS = 2200;
export const CAMPAIGN_COMPANION_HARD_RECOVERY_MS = 10000;
export const CAMPAIGN_COMPANION_RECOVERY_DISTANCE = 5;

export const campaignCompanionGoalOffsets = (radius: 1 | 2 = 1) => {
  const offsets: Array<{ x: number; y: number }> = [];
  for (let y = -radius; y <= radius; y++)
    for (let x = -radius; x <= radius; x++)
      if ((x !== 0 || y !== 0) && Math.max(Math.abs(x), Math.abs(y)) <= radius)
        offsets.push({ x, y });
  return offsets.sort((a, b) => {
    const ringA = Math.max(Math.abs(a.x), Math.abs(a.y)),
      ringB = Math.max(Math.abs(b.x), Math.abs(b.y)),
      diagonalA = Math.abs(a.x) + Math.abs(a.y),
      diagonalB = Math.abs(b.x) + Math.abs(b.y);
    return ringA - ringB || diagonalA - diagonalB || a.y - b.y || a.x - b.x;
  });
};

export const isCampaignSentryChapter = (chapter: number) =>
  chapter === 2 || chapter === 4 || chapter === 5;

export const campaignCompanionMode = (
  distanceToHero: number,
  distanceToEnemy: number,
  enemyReachable: boolean,
  sharedThreat = false,
) => {
  if (!enemyReachable) return "follow";
  if (sharedThreat)
    return distanceToEnemy <= CAMPAIGN_COMPANION_ASSIST_DISTANCE ? "engage" : "follow";
  return distanceToHero <= CAMPAIGN_COMPANION_LEASH_DISTANCE &&
    distanceToEnemy <= CAMPAIGN_COMPANION_AGGRO_DISTANCE
    ? "engage"
    : "follow";
};

export const campaignShouldEngageLocalObjective = (
  routeDistance: number,
  forcedRejoin = false,
  engagementDistance = CAMPAIGN_COMPANION_AGGRO_DISTANCE,
) => !forcedRejoin && Number.isFinite(routeDistance) && routeDistance <= engagementDistance;

export const campaignCompanionMoveDuration = (
  routeDistance: number,
  terrainFactor = 1,
) => {
  const catchUpDistance = Number.isFinite(routeDistance)
    ? Math.max(0, routeDistance - 2)
    : 0;
  const baseDuration = Math.max(120, 260 - catchUpDistance * 28);
  return baseDuration / Math.max(0.55, terrainFactor);
};

export const campaignCompanionShouldEmergencyRejoin = (
  hasRoute: boolean,
  hasStep: boolean,
  blockedMs: number,
  noPathMs: number,
  routeGap: number,
  stationaryMs = 0,
  activelyFighting = false,
) => {
  if (routeGap < CAMPAIGN_COMPANION_RECOVERY_DISTANCE || activelyFighting) return false;
  if (stationaryMs >= CAMPAIGN_COMPANION_STALL_RECOVERY_MS) return true;
  return hasRoute
    ? !hasStep && blockedMs >= CAMPAIGN_COMPANION_BLOCKED_RECOVERY_MS
    : noPathMs >= CAMPAIGN_COMPANION_DISCONNECTED_RECOVERY_MS;
};

export const campaignCompanionShouldHardRejoin = (
  forcedRejoin: boolean,
  stationaryMs: number,
  routeGap: number,
  canAdvanceNow: boolean,
) => forcedRejoin &&
  stationaryMs >= CAMPAIGN_COMPANION_HARD_RECOVERY_MS &&
  routeGap >= CAMPAIGN_COMPANION_RECOVERY_DISTANCE &&
  !canAdvanceNow;

export const campaign1AdvanceWatch = (
  previousBestX: number | undefined,
  currentX: number,
  stalledMs: number | undefined,
  elapsedMs: number,
) => {
  const advanced = previousBestX === undefined || currentX < previousBestX;
  const bestX = advanced ? currentX : previousBestX;
  const nextStalledMs = advanced ? 0 : (stalledMs ?? 0) + elapsedMs;
  return {
    bestX,
    stalledMs: nextStalledMs,
    shouldRegroup: nextStalledMs >= CAMPAIGN1_REGROUP_AFTER_MS,
    shouldRetreat: nextStalledMs >= CAMPAIGN1_RETREAT_AFTER_MS,
  };
};

export const campaign1ShouldForceExit = (
  regroupCount: number,
  lastProgressAt: number,
  now: number,
) => regroupCount >= 2 || now - lastProgressAt >= CAMPAIGN1_RETREAT_AFTER_MS;

export const shouldRemoveSpawnOrder = (
  spawned: boolean,
  delay: number,
  preserveUntilSpawned: boolean,
) => spawned || (!preserveUntilSpawned && delay <= -5000);

export const campaign1BossShouldEnter = (
  phase: number,
  reserveReady: boolean,
  remainingWaveMinions: number,
) => phase === 2 && reserveReady && remainingWaveMinions <= CAMPAIGN1_WAVE_COUNTS[2];

export const campaign1VictoryReady = (
  phase: number,
  bossReserveCleared: boolean,
  queuedEnemies: number,
  aliveEnemies: number,
) => phase === 2 && bossReserveCleared && queuedEnemies === 0 && aliveEnemies === 0;

export const shouldUseCampaign1GuardGoal = (
  isCampaign: boolean,
  chapter: number,
  hasAssignedRoute: boolean,
) => isCampaign && chapter === 1 && !hasAssignedRoute;

export const campaign2EscortOutcome = (
  totalScientists: number,
  aliveScientists: number,
  arrivedScientists: number,
) => ({
  failed: totalScientists > 0 && aliveScientists === 0,
  won: aliveScientists > 0 && arrivedScientists >= 1,
});

export const campaign3ArenaHeal = (uses: number, maxHp: number) =>
  uses >= 2 ? 0 : maxHp * 0.1;

export const campaign5FirstGateReady = (
  heroDistanceToGate: number,
  livingFollowers: number,
  followersNearHero: number,
) => heroDistanceToGate <= 4 && livingFollowers >= 2 && followersNearHero === livingFollowers;

export const campaignStageIsActive = (requiredStage: number | undefined, currentStage: number) =>
  requiredStage === undefined || requiredStage <= currentStage;
