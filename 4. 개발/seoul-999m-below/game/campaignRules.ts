export const CAMPAIGN1_WAVE_COUNTS = { 1: 36, 2: 48 } as const;
export const CAMPAIGN1_MAX_ACTIVE_INVADERS = 18;
export const CAMPAIGN1_REGROUP_AFTER_MS = 3500;
export const CAMPAIGN1_RETREAT_AFTER_MS = 8000;

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

export const shouldRemoveSpawnOrder = (
  spawned: boolean,
  delay: number,
  preserveUntilSpawned: boolean,
) => spawned || (!preserveUntilSpawned && delay <= -5000);

export const campaign1BossShouldEnter = (
  phase: number,
  reserveReady: boolean,
  remainingWaveMinions: number,
) => phase === 2 && reserveReady && remainingWaveMinions <= 8;

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
