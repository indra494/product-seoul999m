import type { FactionId, MinionLevel } from "./content";
import type { BattleMapId, TeamSize } from "./matchConfig";
import type { TacticalRole } from "./tacticalSupport";

export type OnlineRoomPlayer = {
  id: string;
  token: string;
  nickname: string;
  team: "blue" | "red";
  index: 0 | 1;
  heroId: string;
  faction: FactionId;
  ready: boolean;
  connected: boolean;
  lastSeen: number;
  aiControlled: boolean;
};

export type OnlineRoomPlayerView = Omit<OnlineRoomPlayer, "token">;

export type OnlineRoomState = {
  code: string;
  revision: number;
  hostId: string;
  teamSize: TeamSize;
  mapId: BattleMapId;
  status: "lobby" | "countdown" | "playing" | "finished";
  seed: number;
  countdownAt?: number;
  winner?: "blue" | "red";
  finishReason?: "core-destroyed" | "player-left";
  departedPlayerId?: string;
  players: OnlineRoomPlayer[];
  createdAt: number;
  updatedAt: number;
  commandSequence: number;
  commands: OnlineBattleCommand[];
  snapshot?: OnlineBattleSnapshot;
};

export type OnlineRoomView = Omit<OnlineRoomState, "players"> & { players: OnlineRoomPlayerView[] };

export type OnlineBattleSnapshot = {
  sequence: number;
  issuedAt: number;
  wave: number;
  teamMinionLevels: Record<"blue" | "red", MinionLevel>;
  teamCredits: Record<"blue" | "red", number>;
  allyCore: { hp: number; shield: number };
  enemyCore: { hp: number; shield: number };
  heroes: Array<{
    playerId: string;
    x: number;
    y: number;
    hp: number;
    maxHp: number;
    alive: boolean;
    dir: { x: number; y: number };
  }>;
  minions: Array<{
    syncId: string;
    team: "blue" | "red";
    x: number;
    y: number;
    name: string;
    hp: number;
    maxHp: number;
    alive: boolean;
    dir: { x: number; y: number };
    attack: number;
    attackInterval: number;
    armor: number;
    critChance: number;
    critMultiplier: number;
    moveSpeed: number;
    faction: FactionId;
    minionRole: "breaker" | "escort" | "shooter" | "elite";
    level: number;
    shieldDamage?: number;
  }>;
  installations: Array<{
    team: "blue" | "red";
    x: number;
    y: number;
    kind: string;
    hp: number;
    maxHp: number;
    cool: number;
    starter?: boolean;
    cost: number;
    invested: number;
    level: number;
  }>;
  terrain: Array<{
    x: number;
    y: number;
    type: number;
    hp: number;
    max: number;
    ore?: number;
    filledBy?: "blue" | "red";
    surface?: "shallowWater" | "platform" | "ramp";
    obstacle?: "root" | "deepWater" | "ledge";
    hazard?: "steam";
  }>;
};

export type OnlineBattleCommand = {
  sequence: number;
  playerId: string;
  type: "move" | "attack" | "skill" | "drill" | "route" | "build" | "fill" | "tactical" | "research" | "elite";
  x?: number;
  y?: number;
  slot?: 1 | 2 | 4;
  route?: "A" | "B";
  kind?: string;
  tacticalRole?: TacticalRole;
  issuedAt: number;
};

export type RoomCreateRequest = {
  nickname: string;
  heroId: string;
  faction: FactionId;
  teamSize: TeamSize;
  mapId: BattleMapId;
};

export type RoomJoinRequest = {
  nickname: string;
  heroId: string;
  faction: FactionId;
  token?: string;
};

export type RoomClientIdentity = { playerId: string; token: string };

export const ONLINE_SNAPSHOT_INTERVAL_MS = 250;
export const ONLINE_REMOTE_INTERPOLATION_MS = 300;
export const ONLINE_SOCKET_HEARTBEAT_MS = 8_000;
export const ONLINE_SOCKET_RECONNECT_MAX_MS = 5_000;

export const roomCapacity = (teamSize: TeamSize) => teamSize * 2;

export const roomCanStart = (room: OnlineRoomState | OnlineRoomView) =>
  room.players.length === roomCapacity(room.teamSize) &&
  room.players.every((player) => player.ready && player.connected);

export const opponentTeam = (team: "blue" | "red") =>
  team === "blue" ? "red" : "blue";

export const shouldApplyAuthoritativeHeroPosition = (
  isHost: boolean,
  snapshotPlayerId: string,
  localPlayerId: string,
) => isHost || snapshotPlayerId !== localPlayerId;

export const newestOnlineRoomView = (
  current: OnlineRoomView | null,
  incoming: OnlineRoomView,
) => !current || current.code !== incoming.code || incoming.revision >= current.revision
  ? incoming
  : current;
