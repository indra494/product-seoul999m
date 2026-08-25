export type BattleTeam = "blue" | "red";

export type TunnelAccessMask = 0 | 1 | 2 | 3;

export const TUNNEL_ACCESS = {
  none: 0,
  blue: 1,
  red: 2,
  shared: 3,
} as const satisfies Record<"none" | BattleTeam | "shared", TunnelAccessMask>;

export type BattlePhase = "prepare" | "assault" | "finished";

export const SECRET_TUNNEL_PREPARE_SECONDS = 120,
  SECRET_TUNNEL_ASSAULT_SECONDS = 240,
  SECRET_TUNNEL_PREPARE_MS = SECRET_TUNNEL_PREPARE_SECONDS * 1000,
  SECRET_TUNNEL_ASSAULT_MS = SECRET_TUNNEL_ASSAULT_SECONDS * 1000,
  SECRET_TUNNEL_MATCH_MS = SECRET_TUNNEL_PREPARE_MS + SECRET_TUNNEL_ASSAULT_MS,
  DEFAULT_TUNNEL_DURABILITY = 3;

export type TunnelPoint = { x: number; y: number };

export type SecretTunnelTileOverlay = {
  durability: Record<BattleTeam, number>;
  maxDurability: Record<BattleTeam, number>;
  access: TunnelAccessMask;
  /** Records actual excavation, unlike access granted by a shared backbone. */
  excavatedBy: TunnelAccessMask;
  /** Team that opened the cell first; used to privatize non-selected contacts. */
  owner: BattleTeam | null;
  /** True only for the selected core-to-contact-to-core assault route. */
  sharedBackbone: boolean;
};

export type SecretTunnelOverlay = {
  width: number;
  height: number;
  tiles: SecretTunnelTileOverlay[][];
};

export type CreateSecretTunnelOverlayOptions = {
  width: number;
  height: number;
  durability?: number;
  durabilityAt?: (point: TunnelPoint, team: BattleTeam) => number;
  initialAccessAt?: (point: TunnelPoint) => TunnelAccessMask;
  initialExcavatedByAt?: (point: TunnelPoint) => TunnelAccessMask;
};

const TEAM_BITS: Record<BattleTeam, 1 | 2> = {
    blue: TUNNEL_ACCESS.blue,
    red: TUNNEL_ACCESS.red,
  },
  CARDINAL_DIRECTIONS = [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 0, y: -1 },
  ] as const;

export const opposingBattleTeam = (team: BattleTeam): BattleTeam =>
  team === "blue" ? "red" : "blue";

export const tunnelAccessIncludesTeam = (access: TunnelAccessMask, team: BattleTeam) =>
  (access & TEAM_BITS[team]) !== 0;

const isTunnelAccessMask = (value: number): value is TunnelAccessMask =>
  value === 0 || value === 1 || value === 2 || value === 3;

const checkedDurability = (value: number, point: TunnelPoint, team: BattleTeam) => {
  if (!Number.isFinite(value) || value < 0)
    throw new RangeError(`Invalid ${team} tunnel durability at ${point.x},${point.y}`);
  return value;
};

export const createSecretTunnelOverlay = ({
  width,
  height,
  durability = DEFAULT_TUNNEL_DURABILITY,
  durabilityAt,
  initialAccessAt,
  initialExcavatedByAt,
}: CreateSecretTunnelOverlayOptions): SecretTunnelOverlay => {
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0)
    throw new RangeError("Secret tunnel overlay dimensions must be positive integers");

  const tiles = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x): SecretTunnelTileOverlay => {
      const point = { x, y },
        access = initialAccessAt?.(point) ?? TUNNEL_ACCESS.none,
        requestedExcavatedBy = initialExcavatedByAt?.(point) ?? TUNNEL_ACCESS.none;
      if (!isTunnelAccessMask(access) || !isTunnelAccessMask(requestedExcavatedBy))
        throw new RangeError(`Invalid tunnel access mask at ${x},${y}`);

      const blueMax = checkedDurability(durabilityAt?.(point, "blue") ?? durability, point, "blue"),
        redMax = checkedDurability(durabilityAt?.(point, "red") ?? durability, point, "red"),
        excavatedBy = (requestedExcavatedBy & access) as TunnelAccessMask;
      return {
        durability: {
          blue: tunnelAccessIncludesTeam(access, "blue") ? 0 : blueMax,
          red: tunnelAccessIncludesTeam(access, "red") ? 0 : redMax,
        },
        maxDurability: { blue: blueMax, red: redMax },
        access,
        excavatedBy,
        owner: access === TUNNEL_ACCESS.blue
          ? "blue"
          : access === TUNNEL_ACCESS.red
            ? "red"
            : null,
        sharedBackbone: false,
      };
    }),
  );
  return { width, height, tiles };
};

const inOverlayBounds = (overlay: SecretTunnelOverlay, point: TunnelPoint) =>
  Number.isInteger(point.x) && Number.isInteger(point.y) &&
  point.x >= 0 && point.y >= 0 && point.x < overlay.width && point.y < overlay.height;

export const secretTunnelTileAt = (
  overlay: SecretTunnelOverlay,
  point: TunnelPoint,
): SecretTunnelTileOverlay | null =>
  inOverlayBounds(overlay, point) ? overlay.tiles[point.y][point.x] : null;

export type SecretTunnelDigResult = {
  overlay: SecretTunnelOverlay;
  tile: SecretTunnelTileOverlay;
  remainingDurability: number;
  didDamage: boolean;
  opened: boolean;
  becameShared: boolean;
};

export const digSecretTunnelTile = (
  overlay: SecretTunnelOverlay,
  point: TunnelPoint,
  team: BattleTeam,
  damage: number,
): SecretTunnelDigResult => {
  const tile = secretTunnelTileAt(overlay, point);
  if (!tile) throw new RangeError(`Tunnel dig is outside the overlay at ${point.x},${point.y}`);
  if (!Number.isFinite(damage) || damage < 0)
    throw new RangeError("Tunnel dig damage must be a finite non-negative number");

  const previousAccess = tile.access,
    alreadyOpen = tunnelAccessIncludesTeam(previousAccess, team),
    remainingDurability = alreadyOpen
      ? 0
      : Math.max(0, tile.durability[team] - damage),
    opened = !alreadyOpen && damage > 0 && remainingDurability === 0;
  if (alreadyOpen || damage === 0)
    return {
      overlay,
      tile,
      remainingDurability,
      didDamage: false,
      opened: false,
      becameShared: false,
    };

  const access = opened
      ? (previousAccess | TEAM_BITS[team]) as TunnelAccessMask
      : previousAccess,
    nextTile: SecretTunnelTileOverlay = {
      ...tile,
      durability: { ...tile.durability, [team]: remainingDurability },
      access,
      excavatedBy: opened
        ? (tile.excavatedBy | TEAM_BITS[team]) as TunnelAccessMask
        : tile.excavatedBy,
      owner: opened && previousAccess === TUNNEL_ACCESS.none ? team : tile.owner,
      sharedBackbone: false,
    },
    nextRow = overlay.tiles[point.y].slice(),
    nextTiles = overlay.tiles.slice();
  nextRow[point.x] = nextTile;
  nextTiles[point.y] = nextRow;
  return {
    overlay: { ...overlay, tiles: nextTiles },
    tile: nextTile,
    remainingDurability,
    didDamage: damage > 0,
    opened,
    becameShared: previousAccess !== TUNNEL_ACCESS.shared && access === TUNNEL_ACCESS.shared,
  };
};

export const canTraverseSecretTunnel = (
  overlay: SecretTunnelOverlay,
  point: TunnelPoint,
  team: BattleTeam,
) => {
  const tile = secretTunnelTileAt(overlay, point);
  return Boolean(tile && tunnelAccessIncludesTeam(tile.access, team));
};

/**
 * A cell excavated by both teams is a contact bulkhead during preparation.
 * It remains valid for connection evaluation, but nobody can cross it until
 * the assault phase opens the selected shared backbone.
 */
export const canTraverseSecretTunnelInPhase = (
  overlay: SecretTunnelOverlay,
  point: TunnelPoint,
  team: BattleTeam,
  phase: BattlePhase,
) => {
  const tile = secretTunnelTileAt(overlay, point);
  if (!tile || !tunnelAccessIncludesTeam(tile.access, team)) return false;
  if (phase === "finished") return false;
  return !(
    tile.access === TUNNEL_ACCESS.shared &&
    !tile.sharedBackbone
  );
};

export type SecretTunnelVisibility = "hidden" | "digging" | "private" | "shared";

export type SecretTunnelTileView = {
  visibility: SecretTunnelVisibility;
  visibleAccess: TunnelAccessMask;
  durability: number | null;
  maxDurability: number | null;
  canTraverse: boolean;
};

export const secretTunnelTileViewForTeam = (
  overlay: SecretTunnelOverlay,
  point: TunnelPoint,
  team: BattleTeam,
): SecretTunnelTileView => {
  const tile = secretTunnelTileAt(overlay, point),
    bit = TEAM_BITS[team];
  if (!tile)
    return {
      visibility: "hidden",
      visibleAccess: TUNNEL_ACCESS.none,
      durability: null,
      maxDurability: null,
      canTraverse: false,
    };

  const canTraverse = tunnelAccessIncludesTeam(tile.access, team),
    visibility: SecretTunnelVisibility = tile.access === TUNNEL_ACCESS.shared
      ? "shared"
      : canTraverse
        ? "private"
        : tile.durability[team] < tile.maxDurability[team]
          ? "digging"
          : "hidden";
  return {
    visibility,
    visibleAccess: visibility === "shared"
      ? TUNNEL_ACCESS.shared
      : canTraverse
        ? bit
        : TUNNEL_ACCESS.none,
    durability: visibility === "hidden" ? null : tile.durability[team],
    maxDurability: visibility === "hidden" ? null : tile.maxDurability[team],
    canTraverse,
  };
};

const pointKey = (point: TunnelPoint) => `${point.x},${point.y}`,
  pointFromKey = (key: string): TunnelPoint => {
    const [x, y] = key.split(",").map(Number);
    return { x, y };
  };

type TunnelReachability = {
  order: TunnelPoint[];
  parent: Map<string, string | null>;
  distance: Map<string, number>;
};

const tunnelReachability = (
  overlay: SecretTunnelOverlay,
  start: TunnelPoint,
  team: BattleTeam,
): TunnelReachability | null => {
  if (!canTraverseSecretTunnel(overlay, start, team)) return null;
  const startKey = pointKey(start),
    order = [{ ...start }],
    parent = new Map<string, string | null>([[startKey, null]]),
    distance = new Map<string, number>([[startKey, 0]]);
  for (let head = 0; head < order.length; head++) {
    const point = order[head],
      currentDistance = distance.get(pointKey(point))!;
    for (const direction of CARDINAL_DIRECTIONS) {
      const next = { x: point.x + direction.x, y: point.y + direction.y },
        key = pointKey(next);
      if (parent.has(key) || !canTraverseSecretTunnel(overlay, next, team)) continue;
      parent.set(key, pointKey(point));
      distance.set(key, currentDistance + 1);
      order.push(next);
    }
  }
  return { order, parent, distance };
};

const pathFromReachability = (
  reachability: TunnelReachability,
  goal: TunnelPoint,
): TunnelPoint[] | null => {
  let cursor: string | null = pointKey(goal);
  if (!reachability.parent.has(cursor)) return null;
  const path: TunnelPoint[] = [];
  while (cursor) {
    path.push(pointFromKey(cursor));
    cursor = reachability.parent.get(cursor) ?? null;
  }
  return path.reverse();
};

export const findSecretTunnelPath = (
  overlay: SecretTunnelOverlay,
  start: TunnelPoint,
  goal: TunnelPoint,
  team: BattleTeam,
) => {
  const reachability = tunnelReachability(overlay, start, team);
  return reachability ? pathFromReachability(reachability, goal) : null;
};

export type SharedTunnelBackboneResult = {
  overlay: SecretTunnelOverlay;
  connected: boolean;
  bluePath: TunnelPoint[];
  redPath: TunnelPoint[];
  backbone: TunnelPoint[];
  changed: TunnelPoint[];
};

export type SecretTunnelContactSelection = {
  contact: TunnelPoint;
  bluePath: TunnelPoint[];
  redPath: TunnelPoint[];
  totalDistance: number;
};

/**
 * Selects a contact without mutating or sharing the overlay. Only cells that
 * both teams can reach qualify, including a team's excavation touching the
 * opponent's initial core room. A promoted backbone cannot become a new
 * contact. The shortest combined core distance wins, followed by coordinates.
 */
export const selectSecretTunnelContact = (
  overlay: SecretTunnelOverlay,
  cores: Readonly<Record<BattleTeam, TunnelPoint>>,
): SecretTunnelContactSelection | null => {
  const blueReachability = tunnelReachability(overlay, cores.blue, "blue"),
    redReachability = tunnelReachability(overlay, cores.red, "red");
  if (!blueReachability || !redReachability) return null;

  const candidates = blueReachability.order.flatMap((contact) => {
    const key = pointKey(contact),
      tile = secretTunnelTileAt(overlay, contact);
    if (
      tile.access !== TUNNEL_ACCESS.shared ||
      tile.sharedBackbone ||
      tile.excavatedBy === TUNNEL_ACCESS.none ||
      !redReachability.parent.has(key)
    ) return [];

    const bluePath = pathFromReachability(blueReachability, contact),
      redPath = pathFromReachability(redReachability, contact);
    if (!bluePath || !redPath) return [];
    return [{
      contact: { ...contact },
      bluePath,
      redPath,
      totalDistance: (blueReachability.distance.get(key) ?? Infinity) +
        (redReachability.distance.get(key) ?? Infinity),
    }];
  });
  candidates.sort((left, right) =>
    left.totalDistance - right.totalDistance ||
    left.contact.y - right.contact.y ||
    left.contact.x - right.contact.x);
  return candidates[0] ?? null;
};

/**
 * Promotes only the two deterministic shortest core-to-contact paths. Branches
 * remain private even when they hang off a newly shared backbone.
 */
export const shareSecretTunnelBackbone = (
  overlay: SecretTunnelOverlay,
  cores: Record<BattleTeam, TunnelPoint>,
  contact: TunnelPoint,
): SharedTunnelBackboneResult => {
  const bluePath = findSecretTunnelPath(overlay, cores.blue, contact, "blue") ?? [],
    redPath = findSecretTunnelPath(overlay, cores.red, contact, "red") ?? [];
  if (!bluePath.length || !redPath.length)
    return { overlay, connected: false, bluePath, redPath, backbone: [], changed: [] };

  const backbone = [
      ...bluePath,
      ...redPath.slice(0, -1).reverse(),
    ],
    backboneKeys = new Set(backbone.map(pointKey)),
    changed: TunnelPoint[] = [],
    nextTiles = overlay.tiles.map((row, y) => row.map((tile, x) => {
      const point = { x, y }, onBackbone = backboneKeys.has(pointKey(point));
      if (onBackbone) {
        if (tile.access === TUNNEL_ACCESS.shared && tile.sharedBackbone) return tile;
        changed.push(point);
        return {
          ...tile,
          durability: { blue: 0, red: 0 },
          access: TUNNEL_ACCESS.shared,
          sharedBackbone: true,
        };
      }
      if (
        tile.access !== TUNNEL_ACCESS.shared ||
        tile.sharedBackbone
      ) return tile;
      const owner = tile.owner ?? "blue",
        opponent = opposingBattleTeam(owner);
      changed.push(point);
      return {
        ...tile,
        durability: {
          ...tile.durability,
          [owner]: 0,
          [opponent]: tile.maxDurability[opponent],
        },
        access: TEAM_BITS[owner],
        excavatedBy: TEAM_BITS[owner],
        owner,
        sharedBackbone: false,
      };
    }));
  return {
    overlay: changed.length ? { ...overlay, tiles: nextTiles } : overlay,
    connected: true,
    bluePath,
    redPath,
    backbone,
    changed,
  };
};

export type SecretTunnelSealResult = {
  overlay: SecretTunnelOverlay;
  tile: SecretTunnelTileOverlay;
  sealed: boolean;
  blockedReason: "core" | null;
  previousAccess: TunnelAccessMask;
  remainingAccess: TunnelAccessMask;
};

/**
 * Removes only the acting team's access, excavation record, and partial dig
 * progress. Core coordinates are required so neither stronghold cell can ever
 * be sealed through this public primitive.
 */
export const sealSecretTunnelTileForTeam = (
  overlay: SecretTunnelOverlay,
  point: TunnelPoint,
  team: BattleTeam,
  cores: Readonly<Record<BattleTeam, TunnelPoint>>,
): SecretTunnelSealResult => {
  const tile = secretTunnelTileAt(overlay, point);
  if (!tile) throw new RangeError(`Tunnel seal is outside the overlay at ${point.x},${point.y}`);

  if (samePoint(point, cores.blue) || samePoint(point, cores.red))
    return {
      overlay,
      tile,
      sealed: false,
      blockedReason: "core",
      previousAccess: tile.access,
      remainingAccess: tile.access,
    };

  const bit = TEAM_BITS[team],
    remainingAccess = (tile.access & ~bit) as TunnelAccessMask,
    remainingExcavatedBy = (tile.excavatedBy & ~bit) as TunnelAccessMask,
    resetDurability = tile.maxDurability[team],
    sealed = remainingAccess !== tile.access ||
      remainingExcavatedBy !== tile.excavatedBy ||
      tile.durability[team] !== resetDurability;
  if (!sealed)
    return {
      overlay,
      tile,
      sealed: false,
      blockedReason: null,
      previousAccess: tile.access,
      remainingAccess,
    };

  const nextTile: SecretTunnelTileOverlay = {
      ...tile,
      durability: { ...tile.durability, [team]: resetDurability },
      access: remainingAccess,
      excavatedBy: remainingExcavatedBy,
      owner: remainingAccess === TUNNEL_ACCESS.blue
        ? "blue"
        : remainingAccess === TUNNEL_ACCESS.red
          ? "red"
          : null,
      sharedBackbone: false,
    },
    nextRow = overlay.tiles[point.y].slice(),
    nextTiles = overlay.tiles.slice();
  nextRow[point.x] = nextTile;
  nextTiles[point.y] = nextRow;
  return {
    overlay: { ...overlay, tiles: nextTiles },
    tile: nextTile,
    sealed: true,
    blockedReason: null,
    previousAccess: tile.access,
    remainingAccess,
  };
};

export type TunnelConnectionKind = "none" | "direct-core" | "shared-contact";

export type TeamTunnelConnection = {
  team: BattleTeam;
  valid: boolean;
  kind: TunnelConnectionKind;
  contact: TunnelPoint | null;
  path: TunnelPoint[];
  opponentPath: TunnelPoint[];
};

const pathContainsTeamExcavation = (
  overlay: SecretTunnelOverlay,
  path: readonly TunnelPoint[],
  team: BattleTeam,
) => path.some((point) => {
  const tile = secretTunnelTileAt(overlay, point);
  return Boolean(tile && tunnelAccessIncludesTeam(tile.excavatedBy, team));
});

const samePoint = (left: TunnelPoint, right: TunnelPoint) =>
  left.x === right.x && left.y === right.y;

/**
 * A granted shared route alone does not satisfy preparation: the team must
 * have excavated at least one cell on its own path to the enemy core/contact.
 */
export const evaluateTeamTunnelConnection = (
  overlay: SecretTunnelOverlay,
  cores: Record<BattleTeam, TunnelPoint>,
  team: BattleTeam,
): TeamTunnelConnection => {
  const opponent = opposingBattleTeam(team),
    ownReachability = tunnelReachability(overlay, cores[team], team),
    opponentReachability = tunnelReachability(overlay, cores[opponent], opponent);
  if (!ownReachability)
    return { team, valid: false, kind: "none", contact: null, path: [], opponentPath: [] };

  const directPath = pathFromReachability(ownReachability, cores[opponent]);
  if (directPath && pathContainsTeamExcavation(overlay, directPath, team))
    return {
      team,
      valid: true,
      kind: "direct-core",
      contact: { ...cores[opponent] },
      path: directPath,
      opponentPath: [],
    };

  if (!opponentReachability)
    return { team, valid: false, kind: "none", contact: null, path: [], opponentPath: [] };

  const candidates = ownReachability.order
    .filter((point) => {
      if (samePoint(point, cores.blue) || samePoint(point, cores.red)) return false;
      const tile = secretTunnelTileAt(overlay, point);
      return tile?.access === TUNNEL_ACCESS.shared &&
        opponentReachability.parent.has(pointKey(point));
    })
    .sort((left, right) => {
      const leftKey = pointKey(left),
        rightKey = pointKey(right),
        leftDistance = (ownReachability.distance.get(leftKey) ?? Infinity) +
          (opponentReachability.distance.get(leftKey) ?? Infinity),
        rightDistance = (ownReachability.distance.get(rightKey) ?? Infinity) +
          (opponentReachability.distance.get(rightKey) ?? Infinity);
      return leftDistance - rightDistance || left.y - right.y || left.x - right.x;
    });
  for (const contact of candidates) {
    const path = pathFromReachability(ownReachability, contact) ?? [];
    if (!pathContainsTeamExcavation(overlay, path, team)) continue;
    return {
      team,
      valid: true,
      kind: "shared-contact",
      contact: { ...contact },
      path,
      opponentPath: pathFromReachability(opponentReachability, contact) ?? [],
    };
  }
  return { team, valid: false, kind: "none", contact: null, path: [], opponentPath: [] };
};

export const evaluateSecretTunnelConnections = (
  overlay: SecretTunnelOverlay,
  cores: Record<BattleTeam, TunnelPoint>,
) => ({
  blue: evaluateTeamTunnelConnection(overlay, cores, "blue"),
  red: evaluateTeamTunnelConnection(overlay, cores, "red"),
});

type ConnectionInput = boolean | Pick<TeamTunnelConnection, "valid">;

const isConnected = (connection: ConnectionInput) =>
  typeof connection === "boolean" ? connection : connection.valid;

export type SecretTunnelPreparationResolution = {
  phase: "assault" | "finished";
  winner: BattleTeam | null;
  reason: "both-connected" | "blue-isolated" | "red-isolated" | "both-isolated";
};

export const resolveSecretTunnelPreparation = (connections: {
  blue: ConnectionInput;
  red: ConnectionInput;
}): SecretTunnelPreparationResolution => {
  const blueConnected = isConnected(connections.blue),
    redConnected = isConnected(connections.red);
  if (blueConnected && redConnected)
    return { phase: "assault", winner: null, reason: "both-connected" };
  if (blueConnected)
    return { phase: "finished", winner: "blue", reason: "red-isolated" };
  if (redConnected)
    return { phase: "finished", winner: "red", reason: "blue-isolated" };
  return { phase: "finished", winner: null, reason: "both-isolated" };
};

export type SecretTunnelStrongholdState = {
  coreHp: number;
  shieldHp: number;
};

export type SecretTunnelTimeoutResolution = {
  phase: "finished";
  winner: BattleTeam | null;
  reason: "core-hp" | "shield-hp" | "draw";
};

export const resolveSecretTunnelTimeout = (strongholds: Record<
  BattleTeam,
  SecretTunnelStrongholdState
>): SecretTunnelTimeoutResolution => {
  if (strongholds.blue.coreHp !== strongholds.red.coreHp)
    return {
      phase: "finished",
      winner: strongholds.blue.coreHp > strongholds.red.coreHp ? "blue" : "red",
      reason: "core-hp",
    };
  if (strongholds.blue.shieldHp !== strongholds.red.shieldHp)
    return {
      phase: "finished",
      winner: strongholds.blue.shieldHp > strongholds.red.shieldHp ? "blue" : "red",
      reason: "shield-hp",
    };
  return { phase: "finished", winner: null, reason: "draw" };
};

export const secretTunnelPhaseAt = (elapsedMs: number): BattlePhase => {
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  if (elapsed >= SECRET_TUNNEL_MATCH_MS) return "finished";
  if (elapsed >= SECRET_TUNNEL_PREPARE_MS) return "assault";
  return "prepare";
};

export type TunnelRouteAllocation = "50:50" | "75:25" | "25:75";
export type TunnelRoute = "A" | "B";

const ROUTE_PATTERNS: Record<TunnelRouteAllocation, readonly TunnelRoute[]> = {
  "50:50": ["A", "B"],
  "75:25": ["A", "A", "A", "B"],
  "25:75": ["A", "B", "B", "B"],
};

export const chooseSecretTunnelRoute = (
  unitIndex: number,
  allocation: TunnelRouteAllocation,
): TunnelRoute => {
  if (!Number.isInteger(unitIndex) || unitIndex < 0)
    throw new RangeError("Tunnel route unit index must be a non-negative integer");
  const pattern = ROUTE_PATTERNS[allocation];
  return pattern[unitIndex % pattern.length];
};

export const allocateSecretTunnelWave = <Unit>(
  units: readonly Unit[],
  allocation: TunnelRouteAllocation,
) => {
  const routes: Record<TunnelRoute, Unit[]> = { A: [], B: [] };
  units.forEach((unit, index) => routes[chooseSecretTunnelRoute(index, allocation)].push(unit));
  return routes;
};
