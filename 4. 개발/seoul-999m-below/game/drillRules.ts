export const DRILL_RANGE_MULTIPLIER = 1.5;
export const DRILL_ACTION_LOCK_MS = 120;

export const expandedDrillReach = (reach: number) => {
  if (!Number.isFinite(reach) || reach < 0)
    throw new RangeError("Drill reach must be finite and non-negative");
  if (reach === 0) return 0;
  return Math.max(Math.floor(reach) + 1, Math.round(reach * DRILL_RANGE_MULTIPLIER));
};

export const radialDrillOffsets = (radius = 1) => {
  const width = Math.max(1, Math.floor(radius)),
    offsets: Array<{ x: number; y: number }> = [];
  for (let y = -width; y <= width; y++)
    for (let x = -width; x <= width; x++)
      if (x !== 0 || y !== 0) offsets.push({ x, y });
  return offsets;
};
