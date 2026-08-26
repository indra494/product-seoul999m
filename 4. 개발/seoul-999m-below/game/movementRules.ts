export const GLOBAL_UNIT_MOVEMENT_MULTIPLIER = 1.3;

export const unitMovementSpeed = (baseSpeed: number) =>
  baseSpeed * GLOBAL_UNIT_MOVEMENT_MULTIPLIER;

export const unitMovementDuration = (baseDurationMs: number) =>
  baseDurationMs / GLOBAL_UNIT_MOVEMENT_MULTIPLIER;
