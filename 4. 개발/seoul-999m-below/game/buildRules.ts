export type BuildPlacement = {
  x: number;
  y: number;
  isBlocker: boolean;
};

export const nearbyAttackFacilityCount = (
  candidateIsBlocker: boolean,
  x: number,
  y: number,
  existing: BuildPlacement[],
) =>
  candidateIsBlocker
    ? 0
    : existing.filter(
        (build) =>
          !build.isBlocker &&
          Math.max(Math.abs(build.x - x), Math.abs(build.y - y)) <= 2,
      ).length;

/** 공격 시설을 2칸 안에 밀집할 수는 있지만 둘째부터 20%, 최대 40%를 더 낸다. */
export const buildPlacementCost = (
  baseCost: number,
  candidateIsBlocker: boolean,
  x: number,
  y: number,
  existing: BuildPlacement[],
) => {
  const nearby = nearbyAttackFacilityCount(candidateIsBlocker, x, y, existing);
  return Math.ceil(baseCost * (1 + Math.min(0.4, nearby * 0.2)));
};
