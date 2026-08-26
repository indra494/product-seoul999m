export type GridPoint = { x: number; y: number };

export const CARDINAL_DIRECTIONS = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
] as const;

export const gridPointKey = (point: GridPoint) => `${point.x},${point.y}`;

export type GridRoute = {
  cells: GridPoint[];
  distance: number;
  goal: GridPoint;
  step: GridPoint | null;
};

export type DiverseGridRoute = GridRoute & {
  overlapRatio: number;
  baselineOverlapRatio: number;
  separationDistance: number;
  pathMode: "direct" | "flank" | "shared";
};

export const shortestRouteToAny = (
  start: GridPoint,
  goals: readonly GridPoint[],
  isOpen: (x: number, y: number) => boolean,
  maxNodes = 2000,
  directions: readonly GridPoint[] = CARDINAL_DIRECTIONS,
): GridRoute | null => {
  const validGoals = new Map(
    goals
      .filter((goal) => isOpen(goal.x, goal.y))
      .map((goal) => [gridPointKey(goal), goal]),
  );
  if (!validGoals.size || !isOpen(start.x, start.y)) return null;

  const startKey = gridPointKey(start),
    queue = [{ ...start }],
    parent = new Map<string, string | null>([[startKey, null]]);
  let reachedKey: string | null = validGoals.has(startKey) ? startKey : null;

  for (let head = 0; reachedKey === null && head < queue.length && head < maxNodes; head++) {
    const point = queue[head],
      pointKey = gridPointKey(point);
    for (const direction of directions) {
      const next = { x: point.x + direction.x, y: point.y + direction.y },
        nextKey = gridPointKey(next);
      if (parent.has(nextKey) || !isOpen(next.x, next.y)) continue;
      parent.set(nextKey, pointKey);
      queue.push(next);
      if (validGoals.has(nextKey)) {
        reachedKey = nextKey;
        break;
      }
    }
  }
  if (reachedKey === null) return null;

  const cells: GridPoint[] = [];
  let cursor: string | null = reachedKey;
  while (cursor) {
    const [x, y] = cursor.split(",").map(Number);
    cells.push({ x, y });
    cursor = parent.get(cursor) ?? null;
  }
  cells.reverse();
  const goal = validGoals.get(reachedKey)!;
  return {
    cells,
    distance: cells.length - 1,
    goal: { ...goal },
    step: cells.length > 1
      ? { x: cells[1].x - start.x, y: cells[1].y - start.y }
      : null,
  };
};

export const advanceRouteCursor = (
  position: GridPoint,
  cells: readonly GridPoint[],
  cursor = 0,
  arrivalDistance = 1,
) => {
  if (!cells.length)
    return { index: 0, goal: null as GridPoint | null, atEnd: true };
  let index = Math.max(0, Math.min(cursor, cells.length - 1));
  // A unit may sidestep around congestion and land beside a later route cell.
  // Recover forward only so it never walks back to an obsolete waypoint.
  const lookaheadEnd = Math.min(cells.length - 1, index + 10);
  for (let candidate = lookaheadEnd; candidate > index; candidate--)
    if (
      Math.abs(cells[candidate].x - position.x) +
        Math.abs(cells[candidate].y - position.y) <= arrivalDistance
    ) {
      index = candidate;
      break;
    }
  while (
    index < cells.length - 1 &&
    Math.abs(cells[index].x - position.x) + Math.abs(cells[index].y - position.y) <= arrivalDistance
  ) index++;
  const goal = cells[index],
    atEnd = index === cells.length - 1 &&
      Math.abs(goal.x - position.x) + Math.abs(goal.y - position.y) <= arrivalDistance;
  return { index, goal: { ...goal }, atEnd };
};

export const forwardRouteRejoin = (
  position: GridPoint,
  cells: readonly GridPoint[],
  cursor: number,
  isOpen: (x: number, y: number) => boolean,
) => {
  if (!cells.length)
    return { index: 0, plan: null as GridRoute | null };
  const progress = advanceRouteCursor(position, cells, cursor),
    firstForwardIndex = Math.max(0, Math.min(progress.index, cells.length - 1)),
    forwardCells = cells.slice(firstForwardIndex),
    plan = shortestRouteToAny(position, forwardCells, isOpen);
  if (!plan) return { index: firstForwardIndex, plan: null as GridRoute | null };
  const relativeIndex = forwardCells.findIndex(
    (cell) => cell.x === plan.goal.x && cell.y === plan.goal.y,
  );
  return {
    index: relativeIndex < 0 ? firstForwardIndex : firstForwardIndex + relativeIndex,
    plan,
  };
};

export const reachableFrontierGoal = (
  start: GridPoint,
  desired: GridPoint,
  isOpen: (x: number, y: number) => boolean,
  maxNodes = 2000,
) => {
  if (!isOpen(start.x, start.y)) return null;
  const startKey = gridPointKey(start),
    queue = [{ ...start }],
    distances = new Map<string, number>([[startKey, 0]]);
  let best = { ...start },
    bestRemaining = Math.hypot(start.x - desired.x, start.y - desired.y),
    bestTravel = 0;

  for (let head = 0; head < queue.length && head < maxNodes; head++) {
    const point = queue[head],
      travel = distances.get(gridPointKey(point))!,
      remaining = Math.hypot(point.x - desired.x, point.y - desired.y);
    if (
      remaining < bestRemaining - 0.001 ||
      (Math.abs(remaining - bestRemaining) <= 0.001 && travel > bestTravel)
    ) {
      best = point;
      bestRemaining = remaining;
      bestTravel = travel;
    }
    for (const direction of CARDINAL_DIRECTIONS) {
      const next = { x: point.x + direction.x, y: point.y + direction.y },
        key = gridPointKey(next);
      if (distances.has(key) || !isOpen(next.x, next.y)) continue;
      distances.set(key, travel + 1);
      queue.push(next);
    }
  }

  return {
    goal: { ...best },
    travelDistance: bestTravel,
    remainingDistance: bestRemaining,
    reachedDesired: best.x === desired.x && best.y === desired.y,
  };
};

const effectiveRouteCells = (
  cells: readonly GridPoint[],
  start: GridPoint,
  goal: GridPoint,
  sharedStartRadius: number,
  sharedGoalRadius: number,
) => cells.filter((cell) =>
    Math.abs(cell.x - start.x) + Math.abs(cell.y - start.y) > sharedStartRadius &&
    Math.abs(cell.x - goal.x) + Math.abs(cell.y - goal.y) > sharedGoalRadius,
  );

const routeOverlapRatio = (
  cells: readonly GridPoint[],
  avoided: ReadonlySet<string>,
  start: GridPoint,
  goal: GridPoint,
  sharedStartRadius: number,
  sharedGoalRadius: number,
) => {
  const effective = effectiveRouteCells(
    cells,
    start,
    goal,
    sharedStartRadius,
    sharedGoalRadius,
  );
  if (!effective.length) return 0;
  return effective.filter((cell) => avoided.has(gridPointKey(cell))).length / effective.length;
};

const routeSeparationDistance = (
  cells: readonly GridPoint[],
  avoidCells: readonly GridPoint[],
  start: GridPoint,
  goal: GridPoint,
  sharedStartRadius: number,
  sharedGoalRadius: number,
) => {
  const effective = effectiveRouteCells(
      cells,
      start,
      goal,
      sharedStartRadius,
      sharedGoalRadius,
    ),
    effectiveAvoided = effectiveRouteCells(
      avoidCells,
      start,
      goal,
      sharedStartRadius,
      sharedGoalRadius,
    );
  if (!effective.length || !effectiveAvoided.length) return 0;
  return effective.reduce((sum, cell) => sum + Math.min(
    ...effectiveAvoided.map((avoided) =>
      Math.abs(cell.x - avoided.x) + Math.abs(cell.y - avoided.y)),
  ), 0) / effective.length;
};

const routeSideSign = (
  cells: readonly GridPoint[],
  start: GridPoint,
  goal: GridPoint,
  sharedStartRadius: number,
  sharedGoalRadius: number,
) => {
  const axisX = goal.x - start.x,
    axisY = goal.y - start.y,
    effective = effectiveRouteCells(
      cells,
      start,
      goal,
      sharedStartRadius,
      sharedGoalRadius,
    ),
    sideSum = effective.reduce(
      (sum, cell) => sum + Math.sign(axisX * (cell.y - start.y) - axisY * (cell.x - start.x)),
      0,
    );
  return Math.sign(sideSum);
};

export const diverseRouteToGoal = (
  start: GridPoint,
  goal: GridPoint,
  isOpen: (x: number, y: number) => boolean,
  avoidCells: readonly GridPoint[] = [],
  options: {
    exactPenalty?: number;
    adjacentPenalty?: number;
    nearPenalty?: number;
    oppositeSidePenalty?: number;
    sharedStartRadius?: number;
    sharedGoalRadius?: number;
    hardAvoidRadius?: number;
    maxDetourRatio?: number;
    detourSlack?: number;
    maxNodes?: number;
    preferredVerticalDirection?: -1 | 1;
  } = {},
): DiverseGridRoute | null => {
  const exactPenalty = options.exactPenalty ?? 24,
    adjacentPenalty = options.adjacentPenalty ?? 8,
    nearPenalty = options.nearPenalty ?? 3.5,
    oppositeSidePenalty = options.oppositeSidePenalty ?? 6,
    sharedStartRadius = options.sharedStartRadius ?? 4,
    sharedGoalRadius = options.sharedGoalRadius ?? 2,
    hardAvoidRadius = options.hardAvoidRadius ?? 2,
    maxDetourRatio = options.maxDetourRatio ?? 2.35,
    detourSlack = options.detourSlack ?? 8,
    maxNodes = options.maxNodes ?? 4000,
    preferredVerticalDirection = options.preferredVerticalDirection,
    preferredDirections: readonly GridPoint[] = preferredVerticalDirection === 1
      ? [{ x: 0, y: 1 }, { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: -1 }]
      : preferredVerticalDirection === -1
        ? [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }]
        : CARDINAL_DIRECTIONS,
    baseline = shortestRouteToAny(start, [goal], isOpen, maxNodes, preferredDirections);
  if (!baseline) return null;

  const avoided = new Set(avoidCells.map(gridPointKey));
  if (!avoided.size)
    return {
      ...baseline,
      overlapRatio: 0,
      baselineOverlapRatio: 0,
      separationDistance: 0,
      pathMode: "direct",
    };

  // Prefer a genuinely separate corridor before falling back to weighted reuse.
  // Endpoint cells may be shared, but the middle of the other route and its
  // nearby parallel lane are treated as closed whenever a connected flank exists.
  const hardBlocked = new Set<string>();
  for (const cell of effectiveRouteCells(
    avoidCells,
    start,
    goal,
    sharedStartRadius,
    sharedGoalRadius,
  ))
    for (let offsetY = -hardAvoidRadius; offsetY <= hardAvoidRadius; offsetY++)
      for (let offsetX = -hardAvoidRadius; offsetX <= hardAvoidRadius; offsetX++) {
        if (Math.abs(offsetX) + Math.abs(offsetY) > hardAvoidRadius) continue;
        hardBlocked.add(gridPointKey({ x: cell.x + offsetX, y: cell.y + offsetY }));
      }
  const axisX = goal.x - start.x,
    axisY = goal.y - start.y,
    hardDirections = preferredDirections,
    hardRouteOpen = (x: number, y: number, enforcePreferredSide: boolean) => {
      const sharedEndpoint =
        Math.abs(x - start.x) + Math.abs(y - start.y) <= sharedStartRadius ||
        Math.abs(x - goal.x) + Math.abs(y - goal.y) <= sharedGoalRadius;
      if (!isOpen(x, y) || (!sharedEndpoint && hardBlocked.has(gridPointKey({ x, y }))))
        return false;
      if (
        !enforcePreferredSide ||
        !preferredVerticalDirection ||
        Math.abs(axisX) < Math.abs(axisY) ||
        sharedEndpoint
      ) return true;
      const progress = axisX === 0 ? 0 : (x - start.x) / axisX,
        axisLineY = start.y + axisY * progress,
        verticalSide = Math.sign(y - axisLineY);
      return verticalSide === 0 || verticalSide === preferredVerticalDirection;
    },
    preferredHardFlank = preferredVerticalDirection
      ? shortestRouteToAny(
          start,
          [goal],
          (x, y) => hardRouteOpen(x, y, true),
          maxNodes,
          hardDirections,
        )
      : null,
    unrestrictedHardFlank = shortestRouteToAny(
    start,
    [goal],
    (x, y) => hardRouteOpen(x, y, false),
    maxNodes,
    hardDirections,
  ),
    preferredWithinDetour = preferredHardFlank &&
      preferredHardFlank.distance <= baseline.distance * maxDetourRatio + detourSlack,
    hardFlank = preferredWithinDetour ? preferredHardFlank : unrestrictedHardFlank;
  if (
    hardFlank &&
    hardFlank.distance <= baseline.distance * maxDetourRatio + detourSlack
  ) {
    const overlapRatio = routeOverlapRatio(
        hardFlank.cells,
        avoided,
        start,
        goal,
        sharedStartRadius,
        sharedGoalRadius,
      ),
      baselineOverlapRatio = routeOverlapRatio(
        baseline.cells,
        avoided,
        start,
        goal,
        sharedStartRadius,
        sharedGoalRadius,
      ),
      separationDistance = routeSeparationDistance(
        hardFlank.cells,
        avoidCells,
        start,
        goal,
        sharedStartRadius,
        sharedGoalRadius,
      );
    if (overlapRatio <= 0.15 && separationDistance >= hardAvoidRadius)
      return {
        ...hardFlank,
        overlapRatio,
        baselineOverlapRatio,
        separationDistance,
        pathMode: "flank",
      };
  }

  const proximity = new Map<string, number>();
  for (const cell of avoidCells)
    for (let offsetY = -2; offsetY <= 2; offsetY++)
      for (let offsetX = -2; offsetX <= 2; offsetX++) {
        const distance = Math.abs(offsetX) + Math.abs(offsetY);
        if (distance > 2) continue;
        const key = gridPointKey({ x: cell.x + offsetX, y: cell.y + offsetY }),
          previous = proximity.get(key);
        if (previous === undefined || distance < previous) proximity.set(key, distance);
      }

  const avoidedSide = routeSideSign(
      avoidCells,
      start,
      goal,
      sharedStartRadius,
      sharedGoalRadius,
    );

  const startKey = gridPointKey(start),
    goalKey = gridPointKey(goal),
    frontier = [{ point: { ...start }, cost: 0, distance: 0 }],
    costs = new Map<string, number>([[startKey, 0]]),
    distances = new Map<string, number>([[startKey, 0]]),
    parent = new Map<string, string | null>([[startKey, null]]);
  let reached = false,
    expanded = 0;

  while (frontier.length && expanded < maxNodes) {
    frontier.sort(
      (a, b) =>
        a.cost - b.cost ||
        a.distance - b.distance ||
        a.point.y - b.point.y ||
        a.point.x - b.point.x,
    );
    const current = frontier.shift()!,
      currentKey = gridPointKey(current.point);
    if (current.cost > (costs.get(currentKey) ?? Number.POSITIVE_INFINITY) + 0.0001) continue;
    expanded++;
    if (currentKey === goalKey) {
      reached = true;
      break;
    }
    for (const direction of CARDINAL_DIRECTIONS) {
      const next = { x: current.point.x + direction.x, y: current.point.y + direction.y },
        nextKey = gridPointKey(next);
      if (!isOpen(next.x, next.y)) continue;
      const sharedEndpoint =
          Math.abs(next.x - start.x) + Math.abs(next.y - start.y) <= sharedStartRadius ||
          Math.abs(next.x - goal.x) + Math.abs(next.y - goal.y) <= sharedGoalRadius,
        proximityDistance = proximity.get(nextKey),
        nextSide = Math.sign(
          axisX * (next.y - start.y) - axisY * (next.x - start.x),
        ),
        proximityPenalty = proximityDistance === 0
          ? exactPenalty
          : proximityDistance === 1
            ? adjacentPenalty
            : proximityDistance === 2
              ? nearPenalty
              : 0,
        sidePenalty = avoidedSide === 0
          ? 0
          : nextSide === avoidedSide
            ? oppositeSidePenalty
            : nextSide === 0
              ? oppositeSidePenalty * 0.4
              : 0,
        progress = axisX === 0 ? 0 : (next.x - start.x) / axisX,
        axisLineY = start.y + axisY * progress,
        verticalSide = Math.sign(next.y - axisLineY),
        verticalPenalty = preferredVerticalDirection && Math.abs(axisX) >= Math.abs(axisY) &&
          verticalSide !== 0 && verticalSide !== preferredVerticalDirection
          ? oppositeSidePenalty * 1.5
          : 0,
        penalty = sharedEndpoint ? 0 : proximityPenalty + sidePenalty + verticalPenalty,
        nextCost = current.cost + 1 + penalty,
        nextDistance = current.distance + 1,
        oldCost = costs.get(nextKey),
        oldDistance = distances.get(nextKey) ?? Number.POSITIVE_INFINITY;
      if (
        oldCost !== undefined &&
        (nextCost > oldCost + 0.0001 ||
          (Math.abs(nextCost - oldCost) <= 0.0001 && nextDistance >= oldDistance))
      )
        continue;
      costs.set(nextKey, nextCost);
      distances.set(nextKey, nextDistance);
      parent.set(nextKey, currentKey);
      frontier.push({ point: next, cost: nextCost, distance: nextDistance });
    }
  }

  let weighted: GridRoute | null = null;
  if (reached) {
    const cells: GridPoint[] = [];
    let cursor: string | null = goalKey;
    while (cursor) {
      const [x, y] = cursor.split(",").map(Number);
      cells.push({ x, y });
      cursor = parent.get(cursor) ?? null;
    }
    cells.reverse();
    weighted = {
      cells,
      distance: cells.length - 1,
      goal: { ...goal },
      step: cells.length > 1
        ? { x: cells[1].x - start.x, y: cells[1].y - start.y }
        : null,
    };
  }

  const baselineOverlapRatio = routeOverlapRatio(
      baseline.cells,
      avoided,
      start,
      goal,
      sharedStartRadius,
      sharedGoalRadius,
    ),
    weightedOverlapRatio = weighted
      ? routeOverlapRatio(
          weighted.cells,
          avoided,
          start,
          goal,
          sharedStartRadius,
          sharedGoalRadius,
        )
      : 1,
    baselineSeparationDistance = routeSeparationDistance(
      baseline.cells,
      avoidCells,
      start,
      goal,
      sharedStartRadius,
      sharedGoalRadius,
    ),
    weightedSeparationDistance = weighted
      ? routeSeparationDistance(
          weighted.cells,
          avoidCells,
          start,
          goal,
          sharedStartRadius,
          sharedGoalRadius,
        )
      : 0,
    overlapImproved = weightedOverlapRatio + 0.001 < baselineOverlapRatio,
    separationImproved = weightedSeparationDistance >= baselineSeparationDistance + 0.75,
    acceptsFlank = Boolean(
      weighted &&
      weighted.distance <= baseline.distance * maxDetourRatio + detourSlack &&
      (
        overlapImproved ||
        (weightedOverlapRatio <= baselineOverlapRatio + 0.001 && separationImproved)
      ),
    ),
    chosen = acceptsFlank ? weighted! : baseline,
    overlapRatio = acceptsFlank ? weightedOverlapRatio : baselineOverlapRatio,
    separationDistance = acceptsFlank
      ? weightedSeparationDistance
      : baselineSeparationDistance,
    sameAsAvoided = chosen.cells.length === avoidCells.length &&
      chosen.cells.every((cell, index) =>
        cell.x === avoidCells[index]?.x && cell.y === avoidCells[index]?.y,
      ),
    sufficientlySeparated = !sameAsAvoided && overlapRatio <= 0.45 && (
      separationDistance >= 1.75 || separationImproved
    );
  return {
    ...chosen,
    overlapRatio,
    baselineOverlapRatio,
    separationDistance,
    pathMode: sufficientlySeparated ? "flank" : "shared",
  };
};

export const stitchRoutePoints = (
  start: GridPoint,
  points: readonly GridPoint[],
  isOpen: (x: number, y: number) => boolean,
  maxNodes = 2000,
) => {
  if (!points.length)
    return { cells: [] as GridPoint[], complete: true, brokenAt: -1 };

  const cells: GridPoint[] = [{ ...start }];
  let cursor = { ...start };
  for (let index = 0; index < points.length; index++) {
    const segment = shortestRouteToAny(cursor, [points[index]], isOpen, maxNodes);
    if (!segment)
      return { cells, complete: false, brokenAt: index };
    cells.push(...segment.cells.slice(1));
    cursor = { ...points[index] };
  }
  return { cells, complete: true, brokenAt: -1 };
};

export const attackPositionCandidates = (
  target: GridPoint,
  range: number,
  canStand: (x: number, y: number) => boolean,
  hasLineOfSight: (from: GridPoint, to: GridPoint) => boolean,
) => {
  const reach = Math.ceil(range),
    candidates: GridPoint[] = [];
  for (let y = target.y - reach; y <= target.y + reach; y++)
    for (let x = target.x - reach; x <= target.x + reach; x++) {
      if (x === target.x && y === target.y) continue;
      if (Math.hypot(x - target.x, y - target.y) > range + 0.001) continue;
      const point = { x, y };
      if (canStand(x, y) && hasLineOfSight(point, target)) candidates.push(point);
    }
  return candidates;
};
