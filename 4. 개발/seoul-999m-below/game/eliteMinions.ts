import type { MinionRole } from "./content";

export const ELITE_RESERVATION_COST = 150;
export const ELITE_UNLOCK_WAVE = 6;
export const ELITE_WAVE_COOLDOWN = 4;
export const REGULAR_MINION_CAP = 12;
export const REINFORCEMENT_MINION_CAP = 17;

export type EliteDeploymentState = {
  reserved: boolean;
  lastSpawnWave: number;
};

export const createEliteDeploymentState = (): EliteDeploymentState => ({
  reserved: false,
  lastSpawnWave: -ELITE_WAVE_COOLDOWN,
});

export const eliteReadyInWaves = (wave: number, lastSpawnWave: number) =>
  Math.max(0, lastSpawnWave + ELITE_WAVE_COOLDOWN - wave);

export const canReserveElite = (input: {
  wave: number;
  credits: number;
  activeElites: number;
  state: EliteDeploymentState;
}) =>
  input.wave >= ELITE_UNLOCK_WAVE &&
  input.credits >= ELITE_RESERVATION_COST &&
  input.activeElites === 0 &&
  !input.state.reserved &&
  eliteReadyInWaves(input.wave, input.state.lastSpawnWave) === 0;

export const withReservedElite = (
  formation: readonly MinionRole[],
  reserved: boolean,
): MinionRole[] => {
  if (!reserved || !formation.length) return [...formation];
  const next = [...formation],
    replaceIndex = Math.max(0, next.lastIndexOf("shooter"));
  next[replaceIndex] = "elite";
  return next;
};

export const reinforcementFormation = (): MinionRole[] => [
  "escort",
  "breaker",
  "breaker",
  "shooter",
  "shooter",
];

