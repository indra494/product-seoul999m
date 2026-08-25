export const radialDrillOffsets = (radius = 1) => {
  const width = Math.max(1, Math.floor(radius)),
    offsets: Array<{ x: number; y: number }> = [];
  for (let y = -width; y <= width; y++)
    for (let x = -width; x <= width; x++)
      if (x !== 0 || y !== 0) offsets.push({ x, y });
  return offsets;
};
