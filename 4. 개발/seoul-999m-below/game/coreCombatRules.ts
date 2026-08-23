import type { MinionRole } from "./content";
import type { Role } from "./runtimeEntities";

export type CoreAttackContext = {
  role?: Role;
  minionRole?: MinionRole;
  isCampaign: boolean;
  campaignChapter: number;
};

export const canDamageCore = ({
  role,
  isCampaign,
  campaignChapter,
}: CoreAttackContext) =>
  role === "minion" ||
  (isCampaign && campaignChapter === 4 && role === "hero");

export const exposedCoreDamage = (
  damage: number,
  { role, minionRole }: Pick<CoreAttackContext, "role" | "minionRole">,
) => {
  if (role !== "minion") return damage;
  const roleMultiplier =
    minionRole === "breaker" ? 2.5 : minionRole === "shooter" ? 0.8 : 1;
  return damage * roleMultiplier * 1.25;
};
