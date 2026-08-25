import type { MinionRole } from "./content";
import type { Team } from "./runtimeEntities";

export type CoreScout = {
  alive: boolean;
  team: Team;
  x: number;
  y: number;
};

export const teamHasSpottedCore = (
  scouts: readonly CoreScout[],
  team: Team,
  core: { x: number; y: number },
  radius = 7,
) => scouts.some(
  (scout) => scout.alive && scout.team === team && Math.hypot(scout.x - core.x, scout.y - core.y) <= radius,
);

export const retainCoreDiscovery = (known: boolean, spottedNow: boolean) =>
  known || spottedNow;

export const SKIRMISH_HERO_PURSUIT_DISTANCE = 28;
export const SKIRMISH_CORE_TRIANGULATION_MS = 24_000;
export const AUTONOMOUS_FRONTIER_REPLAN_MS = 3_500;
export const MINION_ENGAGEMENT_RADIUS = 8;
export const MINION_PURSUIT_DISTANCE = 12;
export const MINION_TARGET_MEMORY_MS = 4_200;

export const minionExplorationCohort = (
  aiCohort: number | undefined,
  unitId: number,
) => aiCohort ?? Math.floor(unitId / 4);

export const triangulateCoreAfterTimeout = (
  known: boolean,
  elapsedMs: number,
) => known || elapsedMs >= SKIRMISH_CORE_TRIANGULATION_MS;

export const skirmishHeroAggroRadius = (vision: number) =>
  Math.max(12, vision + 5);

export const skirmishHeroShouldPursue = (input: {
  directDistance: number;
  routeDistance: number | null;
  aggroRadius: number;
  locked: boolean;
  forced?: boolean;
}) =>
  Boolean(input.forced) ||
  input.directDistance <= input.aggroRadius ||
  (
    input.locked &&
    input.routeDistance !== null &&
    input.routeDistance <= SKIRMISH_HERO_PURSUIT_DISTANCE
  );

export const computerWaveFormation = (input: {
  coreDiscovered: boolean;
  ownCoreDanger: boolean;
  wave: number;
}): MinionRole[] => {
  if (input.ownCoreDanger) return ["escort", "escort", "breaker", "shooter"];
  if (input.coreDiscovered)
    return input.wave % 3 === 0
      ? ["escort", "breaker", "shooter", "shooter"]
      : ["escort", "breaker", "breaker", "breaker"];
  return input.wave % 2 === 0
    ? ["escort", "breaker", "shooter", "breaker"]
    : ["breaker", "shooter", "breaker", "shooter"];
};

export const frontLineScreenGoal = (
  front: { x: number; y: number },
  ownCore: { x: number; y: number },
  role: "support" | "artillery",
) => {
  const distance = Math.hypot(ownCore.x - front.x, ownCore.y - front.y) || 1,
    spacing = role === "artillery" ? 3 : 2;
  return {
    x: Math.round(front.x + ((ownCore.x - front.x) / distance) * spacing),
    y: Math.round(front.y + ((ownCore.y - front.y) / distance) * spacing),
  };
};
