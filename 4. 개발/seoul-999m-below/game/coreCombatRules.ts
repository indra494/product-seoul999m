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
}: CoreAttackContext) => role === "minion" || role === "hero";

export const canDamageShield = ({ role }: Pick<CoreAttackContext, "role">) =>
  role === "minion" || role === "hero";

export const exposedCoreDamage = (
  damage: number,
  { role, minionRole }: Pick<CoreAttackContext, "role" | "minionRole">,
) => {
  if (role === "hero") return damage * 0.35;
  if (role !== "minion") return 0;
  const roleMultiplier =
    minionRole === "breaker"
      ? 2.5
      : minionRole === "elite"
        ? 1.35
        : minionRole === "shooter"
          ? 0.8
          : 1;
  return damage * roleMultiplier * 1.25;
};
