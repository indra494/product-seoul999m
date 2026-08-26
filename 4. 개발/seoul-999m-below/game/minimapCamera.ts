export type RatioPoint = { x: number; y: number };

const clampRatio = (value: number) => Math.max(0, Math.min(1, value));

export const minimapDragAnchor = (
  pointer: RatioPoint,
  cameraCenter: RatioPoint,
  viewport: { width: number; height: number },
): RatioPoint => {
  const grabsViewport =
    Math.abs(pointer.x - cameraCenter.x) <= viewport.width / 2 &&
    Math.abs(pointer.y - cameraCenter.y) <= viewport.height / 2;
  return grabsViewport
    ? { x: pointer.x - cameraCenter.x, y: pointer.y - cameraCenter.y }
    : { x: 0, y: 0 };
};

export const minimapDragTarget = (
  pointer: RatioPoint,
  anchor: RatioPoint,
): RatioPoint => ({
  x: clampRatio(pointer.x - anchor.x),
  y: clampRatio(pointer.y - anchor.y),
});
