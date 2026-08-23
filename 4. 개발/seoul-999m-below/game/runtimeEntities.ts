import {
  BUILDABLES,
  HEROES,
  type FactionId,
  type MinionRole,
} from "./content";

export type Team = "blue" | "red";
export type Role = "hero" | "minion" | "scientist";
export type RouteId = "A" | "B";
export type CampaignController = "arena" | "companion" | "battle";

export type Unit = {
  id: number;
  x: number;
  y: number;
  team: Team;
  role: Role;
  name: string;
  hp: number;
  maxHp: number;
  alive: boolean;
  respawn: number;
  dir: { x: number; y: number };
  act: number;
  shot: number;
  attack: number;
  attackInterval: number;
  armor: number;
  critChance: number;
  critMultiplier: number;
  moveSpeed: number;
  faction: FactionId;
  heroId?: string;
  minionRole?: MinionRole;
  campaignThreat?: "runner" | "vanguard" | "boss";
  campaignPower?: 1 | 2;
  scientistIndex?: 0 | 1 | 2;
  escortPointIndex?: number;
  campaignAi?: CampaignController;
  campaignHeroId?: string;
  arenaTargetId?: number;
  arenaTargetUntil?: number;
  arenaSkillReadyAt?: number;
  arenaUltimateReadyAt?: number;
  arenaActionSlot?: 0 | 1 | 2 | 3 | 4;
  arenaActionStartedAt?: number;
  arenaActionDuration?: number;
  arenaActionUntil?: number;
  ultimateLabelUntil?: number;
  arenaMoveUntil?: number;
  arenaMoveFromX?: number;
  arenaMoveFromY?: number;
  arenaMoveToX?: number;
  arenaMoveToY?: number;
  arenaMoveStartedAt?: number;
  arenaMoveDuration?: number;
  arenaFacingX?: -1 | 1;
  arenaLastAttackerId?: number;
  arenaThreatUntil?: number;
  arenaPushImmuneUntil?: number;
  campaignGuard?: "pyeongtaek";
  campaignActivated?: boolean;
  campaignScout?: boolean;
  campaignAdvanceX?: number;
  campaignAdvanceStallMs?: number;
  campaignRegroups?: number;
  level: number;
  shieldDamage?: number;
  minionVisual?: "idle" | "move" | "attack" | "hurt" | "down";
  minionVisualUntil?: number;
  blockedMs?: number;
  noPathMs?: number;
  congestionDigCd?: number;
  vulnerableUntil?: number;
  routeId?: RouteId;
  routePointIndex?: number;
  routeWaitMs?: number;
  routeRetreating?: boolean;
  routeResumeIndex?: number;
  formationSide?: -1 | 0 | 1;
  aiCooldowns?: [number, number, number, number];
  aiComboLockUntil?: number;
  aiPreviousAction?: string;
  aiTargetId?: number;
  aiDecisionReason?: string;
  aiSearchGoal?: { x: number; y: number };
  aiSearchUntil?: number;
  onlinePlayerId?: string;
  networkController?: "remote" | "ai";
  remoteGoal?: { x: number; y: number };
  lastDamagedAt?: number;
};

export type Turret = {
  id: number;
  x: number;
  y: number;
  team: Team;
  faction: FactionId;
  kind: string;
  hp: number;
  maxHp: number;
  cool: number;
  built: boolean;
  starter?: boolean;
  cost: number;
  invested: number;
  level: number;
  demolish?: number;
  upgrade?: { remaining: number; cost: number };
};

export const heroDefinition = (heroId: string) => {
  const definition = HEROES.find((hero) => hero.id === heroId);
  if (!definition) throw new Error(`Unknown hero: ${heroId}`);
  return definition;
};

type HeroUnitOptions = {
  id: number;
  heroId: string;
  team: Team;
  x: number;
  y: number;
  controller?: CampaignController;
  act?: number;
  hp?: number;
  attack?: number;
  armor?: number;
  onlinePlayerId?: string;
  networkController?: "remote" | "ai";
};

export const createHeroUnit = (options: HeroUnitOptions): Unit => {
  const definition = heroDefinition(options.heroId),
    hp = options.hp ?? definition.stats.maxHp;
  return {
    id: options.id,
    x: options.x,
    y: options.y,
    team: options.team,
    role: "hero",
    name: definition.name,
    hp,
    maxHp: hp,
    alive: true,
    respawn: 0,
    dir: { x: options.team === "blue" ? 1 : -1, y: 0 },
    act: options.act ?? 0,
    shot: 0,
    attack: options.attack ?? definition.stats.damage,
    attackInterval: definition.stats.attackInterval,
    armor: options.armor ?? definition.stats.armor,
    critChance: definition.stats.critChance,
    critMultiplier: definition.stats.critMultiplier,
    moveSpeed: definition.stats.moveSpeed,
    faction: definition.faction,
    heroId: definition.id,
    campaignHeroId: definition.id,
    campaignAi: options.controller,
    level: 1,
    onlinePlayerId: options.onlinePlayerId,
    networkController: options.networkController,
  };
};

type MinionUnitOptions = Omit<
  Unit,
  "role" | "alive" | "respawn" | "shot" | "level"
> & { level?: number };

export const createMinionUnit = (options: MinionUnitOptions): Unit => ({
  ...options,
  role: "minion",
  alive: true,
  respawn: 0,
  shot: 0,
  level: options.level ?? 1,
});

type CivilianUnitOptions = {
  id: number;
  name: string;
  x: number;
  y: number;
  scientistIndex: 0 | 1 | 2;
  act?: number;
};

export const createCivilianUnit = (options: CivilianUnitOptions): Unit => ({
  id: options.id,
  x: options.x,
  y: options.y,
  team: "blue",
  role: "scientist",
  name: options.name,
  hp: 86,
  maxHp: 86,
  alive: true,
  respawn: 0,
  dir: { x: 1, y: 0 },
  act: options.act ?? 0,
  shot: 0,
  attack: 0,
  attackInterval: 1,
  armor: 2,
  critChance: 0,
  critMultiplier: 1,
  moveSpeed: 1.45,
  faction: "human",
  level: 1,
  scientistIndex: options.scientistIndex,
  escortPointIndex: 0,
});

type BuildableUnitOptions = {
  id: number;
  kind: string;
  team: Team;
  x: number;
  y: number;
  level?: number;
  hp?: number;
  cool?: number;
  cost?: number;
  starter?: boolean;
};

export const createBuildableUnit = (options: BuildableUnitOptions): Turret => {
  const definition = BUILDABLES.find((buildable) => buildable.id === options.kind);
  if (!definition) throw new Error(`Unknown buildable: ${options.kind}`);
  const hp = options.hp ?? definition.hp,
    cost = options.cost ?? definition.cost;
  return {
    id: options.id,
    x: options.x,
    y: options.y,
    team: options.team,
    faction: definition.faction,
    kind: definition.id,
    hp,
    maxHp: hp,
    cool: options.cool ?? 0,
    built: true,
    starter: options.starter,
    cost,
    invested: cost,
    level: options.level ?? 1,
  };
};
