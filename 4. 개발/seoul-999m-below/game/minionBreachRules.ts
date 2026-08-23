import type { MinionRole } from "./content";
import type { Team } from "./runtimeEntities";

export const EMERGENCY_BREACH_DELAY_MS = 2200;

export type BreachTile = {
  type: number;
  filledBy?: Team;
};

export const canEmergencyBreach = ({
  minionRole,
  campaignThreat,
  noPathMs,
  team,
  tile,
}: {
  minionRole?: MinionRole;
  campaignThreat?: "runner" | "vanguard" | "boss";
  noPathMs: number;
  team: Team;
  tile?: BreachTile;
}) =>
  (minionRole === "breaker" || campaignThreat === "runner") &&
  noPathMs >= EMERGENCY_BREACH_DELAY_MS &&
  tile?.type === 5 &&
  Boolean(tile.filledBy) &&
  tile?.filledBy !== team;
