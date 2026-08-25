import type { Team } from "./runtimeEntities";

export type MinionLevel = 1 | 2 | 3 | 4 | 5;

export const MINION_RESEARCH_COSTS: Readonly<Record<Exclude<MinionLevel, 1>, number>> = {
  2: 90,
  3: 140,
  4: 210,
  5: 300,
};

export const MINION_RESEARCH_UNLOCK_WAVES: Readonly<Record<Exclude<MinionLevel, 1>, number>> = {
  2: 3,
  3: 9,
  4: 17,
  5: 25,
};

export const nextMinionResearch = (level: MinionLevel) => {
  if (level >= 5) return null;
  const next = (level + 1) as Exclude<MinionLevel, 1>;
  return { level: next, cost: MINION_RESEARCH_COSTS[next] };
};

export const minionResearchReady = (targetLevel: MinionLevel, wave: number) =>
  targetLevel <= 1 || wave >= MINION_RESEARCH_UNLOCK_WAVES[targetLevel];

export const minionResearchUnlockWave = (targetLevel: MinionLevel) =>
  targetLevel <= 1 ? null : MINION_RESEARCH_UNLOCK_WAVES[targetLevel];

export const teamMinionLevels = (blue: MinionLevel = 1, red: MinionLevel = 1): Record<Team, MinionLevel> => ({
  blue,
  red,
});

export const guaranteedMinionLevelForWave = (wave: number): MinionLevel => {
  if (wave >= 31) return 5;
  if (wave >= 23) return 4;
  if (wave >= 15) return 3;
  if (wave >= 7) return 2;
  return 1;
};
