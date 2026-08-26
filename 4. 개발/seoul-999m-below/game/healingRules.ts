export const ENERGY_DRINK_HEAL_RATIO = 0.6;
export const EMERGENCY_REPAIR_RATIO = 1;
export const CORE_REGEN_RADIUS = 4.5;
export const CORE_REGEN_DELAY_MS = 4000;
export const CORE_REGEN_PER_SECOND = 0.06;

export const emergencyRepairAmount = (maxHp: number) =>
  Math.round(maxHp * EMERGENCY_REPAIR_RATIO);

export const coreRegenAmount = (
  maxHp: number,
  deltaMs: number,
  distanceToOwnCore: number,
  timeSinceDamageMs: number,
) =>
  distanceToOwnCore <= CORE_REGEN_RADIUS && timeSinceDamageMs >= CORE_REGEN_DELAY_MS
    ? maxHp * CORE_REGEN_PER_SECOND * (deltaMs / 1000)
    : 0;
