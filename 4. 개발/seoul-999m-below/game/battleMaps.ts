import type { BattleMapId, BattleRuleset } from "./matchConfig";

export type BattleMapDefinition = {
  id: BattleMapId;
  name: string;
  subtitle: string;
  description: string;
  tacticalTags: string[];
  bpm: number;
  hazard: "none" | "water" | "roots" | "split" | "steam" | "maze";
  spawns: {
    blue: { x: number; y: number };
    red: { x: number; y: number };
  };
  spawnPairs: readonly {
    blue: { x: number; y: number };
    red: { x: number; y: number };
  }[];
};

export type BattleMapTile = {
  type: number;
  hp: number;
  max: number;
  ore?: number;
  surface?: "shallowWater" | "platform" | "ramp";
  obstacle?: "root" | "deepWater" | "ledge";
  hazard?: "steam";
};

const STANDARD_SPAWNS = {
  blue: { x: 6, y: 18 },
  red: { x: 49, y: 18 },
} as const;

const RANDOM_SPAWN_PAIRS = [
  { blue: { x: 6, y: 18 }, red: { x: 49, y: 18 } },
  { blue: { x: 10, y: 7 }, red: { x: 45, y: 29 } },
  { blue: { x: 10, y: 29 }, red: { x: 45, y: 7 } },
  { blue: { x: 27, y: 6 }, red: { x: 28, y: 30 } },
] as const;

const SECRET_SPAWN_PAIRS = [STANDARD_SPAWNS] as const;

export const SECRET_TUNNEL_MAPS: readonly BattleMapDefinition[] = [
  {
    id: "secret-crossroads",
    name: "폐쇄 환승광장",
    subtitle: "중앙 공용홀 · 상하 대합실",
    description: "넓은 중앙 환승광장과 떨어진 공용 대합실을 먼저 연결해 정면전과 우회를 설계하는 전장",
    tacticalTags: ["입문", "공용 광장", "우회 굴착"],
    bpm: 92,
    hazard: "none",
    spawns: STANDARD_SPAWNS,
    spawnPairs: SECRET_SPAWN_PAIRS,
  },
  {
    id: "secret-reservoir",
    name: "침수 배수환",
    subtitle: "상하 펌프실 · 중앙 점검실",
    description: "느린 침수 공용실과 마른 비밀 지선 사이에서 접촉 시점과 공격 방향을 고르는 전장",
    tacticalTags: ["침수", "양면 압박", "지역 통제"],
    bpm: 78,
    hazard: "water",
    spawns: STANDARD_SPAWNS,
    spawnPairs: SECRET_SPAWN_PAIRS,
  },
  {
    id: "secret-cache",
    name: "붕괴 보급고",
    subtitle: "세 공용 보급실 · 고밀도 광맥",
    description: "서로 떨어진 세 보급실 중 어느 곳을 먼저 연결할지 선택하고 광석 지선을 경쟁하는 전장",
    tacticalTags: ["자원 경쟁", "세 갈래", "기만로"],
    bpm: 84,
    hazard: "maze",
    spawns: STANDARD_SPAWNS,
    spawnPairs: SECRET_SPAWN_PAIRS,
  },
] as const;

export const OPEN_FRONT_BATTLE_MAPS: readonly BattleMapDefinition[] = [
  {
    id: "central-exchange",
    name: "서울 중앙 환승로",
    subtitle: "기준형 삼중 통로",
    description: "짧은 중앙 돌파와 상·하 우회가 같은 비용으로 맞물리는 균형 전장",
    tacticalTags: ["균형", "삼중 진입", "초보 추천"],
    bpm: 92,
    hazard: "none",
    spawns: STANDARD_SPAWNS,
    spawnPairs: RANDOM_SPAWN_PAIRS,
  },
  {
    id: "flooded-pump",
    name: "침수 펌프장",
    subtitle: "느린 중앙·빠른 측면",
    description: "얕은 물 중앙을 점유하거나 마른 정비로를 빠르게 순환하는 전장",
    tacticalTags: ["원거리", "지역 통제", "측면 회전"],
    bpm: 78,
    hazard: "water",
    spawns: STANDARD_SPAWNS,
    spawnPairs: RANDOM_SPAWN_PAIRS,
  },
  {
    id: "root-lab",
    name: "뿌리 잠식 연구구",
    subtitle: "재생 통로·짧은 시야",
    description: "다시 자라는 잔뿌리 때문에 이미 뚫은 길도 계속 관리해야 하는 매복 전장",
    tacticalTags: ["근접", "매복", "기동"],
    bpm: 86,
    hazard: "roots",
    spawns: STANDARD_SPAWNS,
    spawnPairs: RANDOM_SPAWN_PAIRS,
  },
  {
    id: "freight-fork",
    name: "붕괴 화물 분기점",
    subtitle: "완전히 갈라진 A/B 목",
    description: "중앙 거대 잔해가 두 전선을 갈라 집중 돌파와 분할 압박이 충돌하는 전장",
    tacticalTags: ["2:2", "공성", "역할 분담"],
    bpm: 104,
    hazard: "split",
    spawns: STANDARD_SPAWNS,
    spawnPairs: RANDOM_SPAWN_PAIRS,
  },
  {
    id: "thermal-shaft",
    name: "지열 환기 수직갱",
    subtitle: "예고형 증기 분출",
    description: "압력 경고 뒤 통로를 덮는 증기를 읽고 공격 시간을 맞추는 고속 전장",
    tacticalTags: ["타이밍", "밀치기", "고난도"],
    bpm: 112,
    hazard: "steam",
    spawns: STANDARD_SPAWNS,
    spawnPairs: RANDOM_SPAWN_PAIRS,
  },
  {
    id: "sealed-bunker",
    name: "봉쇄 방공호",
    subtitle: "고밀도 벽·교차 굴착전",
    description: "거의 모든 공간이 막힌 채 시작해 소리와 시야 단서로 적 코어를 추적하는 전장",
    tacticalTags: ["굴착", "은폐 거점", "기습"],
    bpm: 96,
    hazard: "maze",
    spawns: STANDARD_SPAWNS,
    spawnPairs: RANDOM_SPAWN_PAIRS,
  },
  {
    id: "ore-catacomb",
    name: "광맥 카타콤",
    subtitle: "자원벽·봉쇄실 연쇄전",
    description: "광맥을 캐며 전투실을 연결하고 잘못 뚫은 통로를 다시 봉쇄하는 장기 전략 전장",
    tacticalTags: ["고밀도 벽", "자원 경쟁", "장기전"],
    bpm: 84,
    hazard: "maze",
    spawns: STANDARD_SPAWNS,
    spawnPairs: RANDOM_SPAWN_PAIRS,
  },
] as const;

export const BATTLE_MAPS: readonly BattleMapDefinition[] = [
  ...SECRET_TUNNEL_MAPS,
  ...OPEN_FRONT_BATTLE_MAPS,
];

export const battleMapsForRuleset = (ruleset: BattleRuleset) =>
  ruleset === "secret-tunnel" ? SECRET_TUNNEL_MAPS : OPEN_FRONT_BATTLE_MAPS;

export const defaultBattleMapForRuleset = (ruleset: BattleRuleset): BattleMapId =>
  battleMapsForRuleset(ruleset)[0].id;

export const resolveBattleSpawns = (definition: BattleMapDefinition, seed: number) => {
  const mixed = Math.imul((seed ^ 0x9e3779b9) >>> 0, 2654435761) >>> 0,
    pair = definition.spawnPairs[mixed % definition.spawnPairs.length],
    swap = ((mixed >>> 7) & 1) === 1;
  return swap
    ? { blue: { ...pair.red }, red: { ...pair.blue } }
    : { blue: { ...pair.blue }, red: { ...pair.red } };
};

export const resolveLocalBattleSpawns = (
  definition: BattleMapDefinition,
  seed: number,
  canonicalLocalTeam: "blue" | "red",
) => {
  const canonical = resolveBattleSpawns(definition, seed);
  return canonicalLocalTeam === "blue"
    ? { ally: canonical.blue, enemy: canonical.red, canonical }
    : { ally: canonical.red, enemy: canonical.blue, canonical };
};

export const battleExplorationSectors = (
  definition: BattleMapDefinition,
  ownCore: { x: number; y: number },
) => {
  const candidates = [
      ...definition.spawnPairs.flatMap((pair) => [pair.blue, pair.red]),
      { x: 17, y: 18 },
      { x: 38, y: 18 },
      { x: 28, y: 18 },
    ],
    unique = new Map<string, { x: number; y: number }>();
  for (const point of candidates)
    if (Math.hypot(point.x - ownCore.x, point.y - ownCore.y) > 8)
      unique.set(`${point.x},${point.y}`, { ...point });
  return [...unique.values()];
};

export const battleMap = (id: BattleMapId) => {
  const definition = BATTLE_MAPS.find((map) => map.id === id);
  if (!definition) throw new Error(`Unknown battle map: ${id}`);
  return definition;
};

export const applyBattleMapLayout = (
  grid: BattleMapTile[][],
  id: BattleMapId,
) => {
  const rows = grid.length,
    cols = grid[0]?.length ?? 0,
    clear: BattleMapTile = { type: 0, hp: 0, max: 0 },
    put = (x: number, y: number, tile: BattleMapTile) => {
      if (x > 0 && y > 0 && x < cols - 1 && y < rows - 1)
        grid[y][x] = { ...tile };
    },
    carveRect = (x0: number, y0: number, x1: number, y1: number, tile = clear) => {
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) put(x, y, tile);
    },
    wallRect = (x0: number, y0: number, x1: number, y1: number, obstacle: "ledge" | "root") => {
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++)
          put(x, y, { type: 4, hp: 99, max: 99, obstacle });
    },
    carveLane = (points: Array<[number, number]>, width = 1, tile = clear) => {
      for (let index = 0; index < points.length - 1; index++) {
        const [x0, y0] = points[index], [x1, y1] = points[index + 1],
          steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
        for (let step = 0; step <= steps; step++) {
          const x = Math.round(x0 + ((x1 - x0) * step) / Math.max(1, steps)),
            y = Math.round(y0 + ((y1 - y0) * step) / Math.max(1, steps));
          carveRect(x - width, y - width, x + width, y + width, tile);
        }
      }
    },
    openBases = () => {
      for (const core of [STANDARD_SPAWNS.blue, STANDARD_SPAWNS.red])
        carveRect(core.x - 4, core.y - 4, core.x + 4, core.y + 4);
    },
    seedSecretOreVeins = () => {
      const salt = id === "secret-crossroads" ? 3 : id === "secret-reservoir" ? 7 : 11,
        placed = new Set<string>();
      for (let y = 4; y <= rows - 5; y++)
        for (let x = 8; x < Math.floor(cols / 2); x++) {
          if ((x * 13 + y * 17 + x * y + salt) % 17 !== 0) continue;
          for (const [oreX, oreY] of [[x, y], [cols - 1 - x, rows - 1 - y]] as const) {
            const tile = grid[oreY]?.[oreX],
              outsideCoreRooms = [STANDARD_SPAWNS.blue, STANDARD_SPAWNS.red].every(
                (core) => Math.max(Math.abs(oreX - core.x), Math.abs(oreY - core.y)) > 5,
              ),
              key = `${oreX},${oreY}`;
            if (
              !tile ||
              placed.has(key) ||
              !outsideCoreRooms ||
              tile.type === 0 ||
              tile.type === 4
            ) continue;
            placed.add(key);
            put(oreX, oreY, {
              type: 3,
              hp: 5,
              max: 5,
              ore: 26 + ((oreX + oreY + salt) % 3) * 6,
            });
          }
        }
    };

  if (id === "secret-crossroads") {
    carveRect(24, 14, 31, 21, { type: 0, hp: 0, max: 0, surface: "platform" });
    for (const [x0, y0, x1, y1] of [
      [17, 7, 22, 11], [33, 7, 38, 11], [17, 24, 22, 28], [33, 24, 38, 28],
    ] as const) carveRect(x0, y0, x1, y1);
    wallRect(25, 10, 30, 11, "ledge");
    wallRect(25, 24, 30, 25, "ledge");
  } else if (id === "secret-reservoir") {
    carveRect(19, 6, 36, 11, { type: 0, hp: 0, max: 0, surface: "shallowWater" });
    carveRect(19, 24, 36, 29, { type: 0, hp: 0, max: 0, surface: "shallowWater" });
    carveRect(25, 15, 30, 20, { type: 0, hp: 0, max: 0, surface: "platform" });
    carveRect(24, 12, 31, 13, { type: 4, hp: 99, max: 99, obstacle: "deepWater" });
    carveRect(24, 22, 31, 23, { type: 4, hp: 99, max: 99, obstacle: "deepWater" });
  } else if (id === "secret-cache") {
    carveRect(24, 15, 31, 20, { type: 0, hp: 0, max: 0, surface: "platform" });
    carveRect(16, 8, 21, 13, { type: 0, hp: 0, max: 0, surface: "platform" });
    carveRect(34, 22, 39, 27, { type: 0, hp: 0, max: 0, surface: "platform" });
    for (const [x, y] of [
      [13, 15], [14, 16], [20, 18], [22, 21], [27, 12], [28, 23],
      [33, 14], [35, 17], [41, 19], [42, 20], [18, 25], [37, 10],
    ] as const) put(x, y, { type: 3, hp: 5, max: 5, ore: 34 });
    wallRect(26, 7, 29, 9, "ledge");
    wallRect(26, 27, 29, 29, "ledge");
  } else if (id === "central-exchange") {
    carveLane([[6, 18], [49, 18]], 2);
    carveLane([[6, 18], [14, 9], [41, 9], [49, 18]], 1);
    carveLane([[6, 18], [14, 27], [41, 27], [49, 18]], 1);
    wallRect(24, 12, 31, 14, "ledge");
    wallRect(24, 22, 31, 24, "ledge");
    carveRect(26, 8, 29, 10, { type: 0, hp: 0, max: 0, surface: "platform" });
    carveRect(26, 26, 29, 28, { type: 0, hp: 0, max: 0, surface: "platform" });
  } else if (id === "flooded-pump") {
    carveLane([[6, 18], [49, 18]], 3, { type: 0, hp: 0, max: 0, surface: "shallowWater" });
    carveLane([[6, 18], [15, 8], [40, 8], [49, 18]], 1, { type: 0, hp: 0, max: 0, surface: "platform" });
    carveLane([[6, 18], [15, 28], [40, 28], [49, 18]], 1, { type: 0, hp: 0, max: 0, surface: "platform" });
    for (const [x0, x1, y] of [[20, 23, 16], [32, 35, 20]] as const)
      carveRect(x0, y - 1, x1, y + 1, { type: 4, hp: 99, max: 99, obstacle: "deepWater" });
    wallRect(25, 5, 30, 6, "ledge");
    wallRect(25, 30, 30, 31, "ledge");
  } else if (id === "root-lab") {
    carveLane([[6, 18], [15, 12], [27, 16], [40, 12], [49, 18]], 1);
    carveLane([[6, 18], [15, 24], [28, 20], [40, 24], [49, 18]], 1);
    carveLane([[14, 12], [14, 24]], 1);
    carveLane([[41, 12], [41, 24]], 1);
    for (const [x, y] of [[19, 14], [25, 17], [30, 19], [36, 22], [19, 22], [36, 14]] as const)
      carveRect(x - 1, y - 1, x + 1, y + 1, { type: 7, hp: 5, max: 5 });
    wallRect(26, 8, 29, 13, "root");
    wallRect(26, 23, 29, 28, "root");
  } else if (id === "freight-fork") {
    carveLane([[6, 18], [14, 9], [41, 9], [49, 18]], 2);
    carveLane([[6, 18], [14, 27], [41, 27], [49, 18]], 2);
    wallRect(24, 6, 31, 30, "ledge");
    carveRect(24, 7, 31, 11, { type: 0, hp: 0, max: 0, surface: "platform" });
    carveRect(24, 25, 31, 29, { type: 0, hp: 0, max: 0, surface: "platform" });
    wallRect(26, 13, 29, 23, "ledge");
  } else if (id === "thermal-shaft") {
    carveLane([[6, 18], [49, 18]], 1);
    carveLane([[6, 18], [15, 9], [40, 9], [49, 18]], 1);
    carveLane([[6, 18], [15, 27], [40, 27], [49, 18]], 1);
    const vents: Array<[number, number, number, number]> = [
      [18, 16, 20, 20], [27, 7, 29, 11], [27, 25, 29, 29], [36, 16, 38, 20],
    ];
    for (const [x0, y0, x1, y1] of vents)
      carveRect(x0, y0, x1, y1, { type: 0, hp: 0, max: 0, hazard: "steam" });
    wallRect(23, 13, 25, 15, "ledge");
    wallRect(30, 21, 32, 23, "ledge");
  } else if (id === "sealed-bunker") {
    // 열린 고속도로 대신 작은 방과 끊긴 굴착선만 제공한다.
    for (const [x, y] of [[10, 8], [27, 8], [45, 8], [10, 27], [27, 27], [45, 27]] as const)
      carveRect(x - 3, y - 2, x + 3, y + 2);
    carveLane([[8, 18], [17, 18]], 1);
    carveLane([[38, 18], [47, 18]], 1);
    wallRect(25, 12, 30, 15, "ledge");
    wallRect(25, 21, 30, 24, "ledge");
  } else {
    for (const [x, y] of [[9, 7], [27, 6], [46, 8], [8, 28], [28, 29], [46, 27], [18, 18], [37, 18]] as const)
      carveRect(x - 2, y - 2, x + 2, y + 2, { type: 0, hp: 0, max: 0, surface: "platform" });
    for (let y = 5; y < rows - 5; y += 6)
      for (let x = 6 + (y % 12); x < cols - 6; x += 9)
        put(x, y, { type: 3, hp: 7, max: 7, ore: 28 });
    wallRect(25, 12, 30, 16, "ledge");
    wallRect(25, 20, 30, 24, "ledge");
  }
  if (id.startsWith("secret-")) seedSecretOreVeins();
  openBases();
  for (const pair of battleMap(id).spawnPairs)
    for (const core of [pair.blue, pair.red]) carveRect(core.x - 3, core.y - 3, core.x + 3, core.y + 3);
};
