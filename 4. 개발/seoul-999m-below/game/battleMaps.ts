import type { BattleMapId } from "./matchConfig";

export type BattleMapDefinition = {
  id: BattleMapId;
  name: string;
  subtitle: string;
  description: string;
  tacticalTags: string[];
  bpm: number;
  hazard: "none" | "water" | "roots" | "split" | "steam";
  spawns: {
    blue: { x: number; y: number };
    red: { x: number; y: number };
  };
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

export const BATTLE_MAPS: readonly BattleMapDefinition[] = [
  {
    id: "central-exchange",
    name: "서울 중앙 환승로",
    subtitle: "기준형 삼중 통로",
    description: "짧은 중앙 돌파와 상·하 우회가 같은 비용으로 맞물리는 균형 전장",
    tacticalTags: ["균형", "삼중 진입", "초보 추천"],
    bpm: 92,
    hazard: "none",
    spawns: STANDARD_SPAWNS,
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
  },
] as const;

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
    };

  if (id === "central-exchange") {
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
  } else {
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
  }
  openBases();
};
