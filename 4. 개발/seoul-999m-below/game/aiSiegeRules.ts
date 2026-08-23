export type SiegeResponse = "continue" | "approach" | "attack";

export const siegeResponse = ({
  adjacentEnemyInstallation,
  pathBlockedByEnemyInstallation,
  reachableEnemyInstallation,
}: {
  adjacentEnemyInstallation: boolean;
  pathBlockedByEnemyInstallation: boolean;
  reachableEnemyInstallation: boolean;
}): SiegeResponse => {
  if (adjacentEnemyInstallation || pathBlockedByEnemyInstallation) return "attack";
  if (reachableEnemyInstallation) return "approach";
  return "continue";
};
