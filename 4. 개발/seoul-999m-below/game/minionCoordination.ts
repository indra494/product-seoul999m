export type CombatApproachSlotCandidate = {
  x: number;
  y: number;
  routeDistance: number;
  targetDistance: number;
  crowd: number;
  occupied: boolean;
  reserved: boolean;
};

export type CoordinatedMinionRole = "breaker" | "escort" | "shooter" | "elite";

export const MINION_COMBAT_SLOT_MEMORY_MS = 2200;
export const MINION_FLANK_REPLAN_MS = 420;

const circularDistance = (a: number, b: number, size: number) => {
  const direct = Math.abs(a - b);
  return Math.min(direct, size - direct);
};

export const chooseCombatApproachSlot = (
  attackerId: number,
  role: CoordinatedMinionRole,
  range: number,
  target: { x: number; y: number },
  candidates: readonly CombatApproachSlotCandidate[],
) => {
  if (!candidates.length) return null;
  const angular = [...candidates].sort(
      (a, b) =>
        Math.atan2(a.y - target.y, a.x - target.x) -
          Math.atan2(b.y - target.y, b.x - target.x) ||
        a.routeDistance - b.routeDistance,
    ),
    roleOffset = role === "escort" ? 0 : role === "breaker" ? 3 : 7,
    preferredIndex = Math.abs(attackerId * 5 + roleOffset) % angular.length,
    desiredRange = role === "shooter" || (role === "elite" && range > 2)
      ? Math.max(2.25, range - 0.35)
      : Math.min(1.42, range);

  return angular
    .map((candidate, index) => ({
      candidate,
      score:
        (candidate.reserved ? 4000 : 0) +
        (candidate.occupied ? 2500 : 0) +
        candidate.routeDistance * 14 +
        candidate.crowd * 24 +
        Math.abs(candidate.targetDistance - desiredRange) *
          (role === "shooter" || (role === "elite" && range > 2) ? 22 : 10) +
        circularDistance(index, preferredIndex, angular.length) * 1.5,
    }))
    .sort((a, b) => a.score - b.score)[0]?.candidate ?? null;
};

export const minionCombatDetourAllowance = (
  role: CoordinatedMinionRole | undefined,
  blockedMs: number,
) => role && blockedMs >= MINION_FLANK_REPLAN_MS ? 1 : 0;
