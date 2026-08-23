import type { FactionId } from "./content";
import type { BattleMapId, TeamSize } from "./matchConfig";

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
  minionLevel: 1 | 2 | 3;
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
};

export type OnlineBattleCommand = {
  sequence: number;
  playerId: string;
  type: "move" | "attack" | "skill" | "drill" | "route";
  x?: number;
  y?: number;
  slot?: 1 | 2 | 4;
  route?: "A" | "B";
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

export const roomCapacity = (teamSize: TeamSize) => teamSize * 2;

export const roomCanStart = (room: OnlineRoomState | OnlineRoomView) =>
  room.players.length === roomCapacity(room.teamSize) &&
  room.players.every((player) => player.ready && player.connected);
