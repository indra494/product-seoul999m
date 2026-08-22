import { HEROES, type FactionId } from "./content";

export type TeamSize = 1 | 2;
export type MatchKind = "computer" | "online";
export type ControllerKind = "local" | "remote" | "ai";
export type BattleMapId =
  | "central-exchange"
  | "flooded-pump"
  | "root-lab"
  | "freight-fork"
  | "thermal-shaft";

export type MatchSlot = {
  id: string;
  team: "blue" | "red";
  index: 0 | 1;
  controller: ControllerKind;
  heroId: string;
  route: "A" | "B";
};

export type TeamConfig = {
  faction: FactionId;
  slots: MatchSlot[];
};

export type MatchConfig = {
  kind: MatchKind;
  teamSize: TeamSize;
  mapId: BattleMapId;
  seed: number;
  teams: [TeamConfig, TeamConfig];
};

const hashSeed = (seed: number) => {
  let value = seed | 0;
  return () => {
    value |= 0;
    value = (value + 0x6d2b79f5) | 0;
    let mixed = Math.imul(value ^ (value >>> 15), 1 | value);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
};

const factionHeroes = (faction: FactionId) =>
  HEROES.filter((hero) => hero.faction === faction);

export const validateMatchConfig = (config: MatchConfig) => {
  const errors: string[] = [];
  for (const team of config.teams) {
    if (team.slots.length !== config.teamSize)
      errors.push(`${team.faction} 팀의 슬롯 수가 ${config.teamSize}명이 아닙니다.`);
    const ids = new Set<string>();
    for (const slot of team.slots) {
      const hero = HEROES.find((candidate) => candidate.id === slot.heroId);
      if (!hero) errors.push(`알 수 없는 영웅: ${slot.heroId}`);
      else if (hero.faction !== team.faction)
        errors.push(`${hero.name}은 ${team.faction} 팀에 편성할 수 없습니다.`);
      if (ids.has(slot.heroId)) errors.push(`같은 팀 영웅 중복: ${slot.heroId}`);
      ids.add(slot.heroId);
    }
  }
  return errors;
};

export const createComputerMatch = (input: {
  teamSize: TeamSize;
  mapId: BattleMapId;
  playerHeroId: string;
  allyHeroId?: string;
  seed?: number;
}): MatchConfig => {
  const seed = input.seed ?? (Date.now() >>> 0),
    random = hashSeed(seed),
    player = HEROES.find((hero) => hero.id === input.playerHeroId);
  if (!player) throw new Error(`Unknown player hero: ${input.playerHeroId}`);
  const ally = input.teamSize === 2
    ? HEROES.find((hero) => hero.id === input.allyHeroId)
    : undefined;
  if (input.teamSize === 2 && (!ally || ally.faction !== player.faction || ally.id === player.id))
    throw new Error("2:2 AI 동료는 플레이어와 같은 종족의 다른 영웅이어야 합니다.");

  const enemyFactions = (["human", "bugborn", "ai"] as FactionId[]).filter(
      (faction) => faction !== player.faction,
    ),
    enemyFaction = enemyFactions[Math.floor(random() * enemyFactions.length)],
    enemyPool = [...factionHeroes(enemyFaction)];
  for (let index = enemyPool.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1));
    [enemyPool[index], enemyPool[swap]] = [enemyPool[swap], enemyPool[index]];
  }

  const config: MatchConfig = {
    kind: "computer",
    teamSize: input.teamSize,
    mapId: input.mapId,
    seed,
    teams: [
      {
        faction: player.faction,
        slots: [
          { id: "blue-1", team: "blue", index: 0, controller: "local", heroId: player.id, route: "A" },
          ...(ally
            ? [{ id: "blue-2", team: "blue" as const, index: 1 as const, controller: "ai" as const, heroId: ally.id, route: "B" as const }]
            : []),
        ],
      },
      {
        faction: enemyFaction,
        slots: enemyPool.slice(0, input.teamSize).map((hero, index) => ({
          id: `red-${index + 1}`,
          team: "red" as const,
          index: index as 0 | 1,
          controller: "ai" as const,
          heroId: hero.id,
          route: (index === 0 ? "A" : "B") as "A" | "B",
        })),
      },
    ],
  };
  const errors = validateMatchConfig(config);
  if (errors.length) throw new Error(errors.join("\n"));
  return config;
};

export const createOnlineMatch = (input: {
  teamSize: TeamSize;
  mapId: BattleMapId;
  seed: number;
  localPlayerId: string;
  players: Array<{
    id: string;
    team: "blue" | "red";
    index: 0 | 1;
    heroId: string;
    faction: FactionId;
    aiControlled?: boolean;
  }>;
}): MatchConfig => {
  const local = input.players.find((player) => player.id === input.localPlayerId);
  if (!local) throw new Error("Local online player is not in the room.");
  const own = input.players
      .filter((player) => player.team === local.team)
      .sort((a, b) => (a.id === local.id ? -1 : b.id === local.id ? 1 : a.index - b.index)),
    enemy = input.players
      .filter((player) => player.team !== local.team)
      .sort((a, b) => a.index - b.index),
    toSlots = (players: typeof input.players, team: "blue" | "red") =>
      players.map((player, index) => ({
        id: player.id,
        team,
        index: index as 0 | 1,
        controller: (player.id === local.id ? "local" : player.aiControlled ? "ai" : "remote") as ControllerKind,
        heroId: player.heroId,
        route: (index === 0 ? "A" : "B") as "A" | "B",
      }));
  const config: MatchConfig = {
    kind: "online",
    teamSize: input.teamSize,
    mapId: input.mapId,
    seed: input.seed,
    teams: [
      { faction: own[0].faction, slots: toSlots(own, "blue") },
      { faction: enemy[0].faction, slots: toSlots(enemy, "red") },
    ],
  };
  const errors = validateMatchConfig(config);
  if (errors.length) throw new Error(errors.join("\n"));
  return config;
};
