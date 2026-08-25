/** Cloudflare Worker entry point for SEOUL: 999M BELOW. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { DurableObject } from "cloudflare:workers";
import { HEROES } from "../game/content";
import {
  roomCanStart,
  roomCapacity,
  type OnlineRoomPlayer,
  type OnlineRoomState,
  type OnlineRoomView,
  type OnlineBattleSnapshot,
  opponentTeam,
  type RoomCreateRequest,
  type RoomJoinRequest,
} from "../game/onlineRoom";
import type { TacticalRole } from "../game/tacticalSupport";

interface Env {
  ASSETS: Fetcher;
  DB?: D1Database;
  IMAGES?: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
  ROOMS: DurableObjectNamespace;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

type RoomDurableState = DurableObjectState;
type RoomActionBody = {
  playerId?: string;
  token?: string;
  action: string;
  command?: {
    type: "move" | "attack" | "skill" | "drill" | "route" | "build" | "fill" | "tactical" | "research";
    x?: number;
    y?: number;
    slot?: 1 | 2 | 4;
    route?: "A" | "B";
    kind?: string;
    tacticalRole?: TacticalRole;
  };
  snapshot?: Omit<OnlineBattleSnapshot, "sequence" | "issuedAt">;
  winner?: "blue" | "red";
};

const responseJson = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const randomCode = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  for (const byte of bytes) code += alphabet[byte % alphabet.length];
  return code;
};

const randomToken = () => crypto.randomUUID().replaceAll("-", "");

const publicRoom = (room: OnlineRoomState): OnlineRoomView => ({
  ...room,
  players: room.players.map((player) => ({
    id: player.id,
    nickname: player.nickname,
    team: player.team,
    index: player.index,
    heroId: player.heroId,
    faction: player.faction,
    ready: player.ready,
    connected: player.connected,
    lastSeen: player.lastSeen,
    aiControlled: player.aiControlled,
  })),
});

export class RoomHub extends DurableObject<Env> {
  constructor(private roomState: RoomDurableState, env: Env) {
    super(roomState, env);
  }

  private async load() {
    return (await this.roomState.storage.get<OnlineRoomState>("room")) ?? null;
  }

  private async save(room: OnlineRoomState) {
    room.revision++;
    room.updatedAt = Date.now();
    await this.roomState.storage.put("room", room);
    this.broadcast(room);
    return room;
  }

  private broadcast(room: OnlineRoomState) {
    const message = JSON.stringify({ type: "room", room: publicRoom(room) });
    for (const socket of this.roomState.getWebSockets()) {
      try { socket.send(message); } catch { /* 닫히는 중인 연결은 close 핸들러가 정리한다. */ }
    }
  }

  private socketError(socket: WebSocket, error: string) {
    try { socket.send(JSON.stringify({ type: "error", error })); } catch { /* 연결 종료 중 */ }
  }

  private slotFor(room: OnlineRoomState) {
    for (const team of ["blue", "red"] as const)
      for (let index = 0; index < room.teamSize; index++)
        if (!room.players.some((player) => player.team === team && player.index === index))
          return { team, index: index as 0 | 1 };
    return null;
  }

  private validateHero(heroId: string, faction: string) {
    return HEROES.some((hero) => hero.id === heroId && hero.faction === faction);
  }

  private scheduleRoomAlarm(room: OnlineRoomState, now: number) {
    const deadlines: number[] = [];
    if (room.status === "countdown" && room.countdownAt) deadlines.push(room.countdownAt);
    if (room.status === "playing")
      for (const player of room.players)
        if (!player.connected) deadlines.push(player.lastSeen + 10_000);
    if (deadlines.length) void this.roomState.storage.setAlarm(Math.max(now + 100, Math.min(...deadlines)));
  }

  private async applyAction(room: OnlineRoomState, player: OnlineRoomPlayer, body: RoomActionBody, now: number): Promise<{ error?: string; status?: number }> {
    player.lastSeen = now;
    player.connected = true;
    if (body.action === "ready") player.ready = true;
    else if (body.action === "unready") player.ready = false;
    else if (body.action === "leave") {
      if (room.status === "playing" || room.status === "countdown") {
        player.connected = false;
        player.aiControlled = false;
        room.status = "finished";
        room.winner = opponentTeam(player.team);
        room.finishReason = "player-left";
        room.departedPlayerId = player.id;
      } else {
        room.players = room.players.filter((candidate) => candidate.id !== player.id);
        if (player.id === room.hostId && room.players[0]) room.hostId = room.players[0].id;
      }
    } else if (body.action === "start") {
      if (player.id !== room.hostId) return { error: "방장만 시작할 수 있습니다.", status: 403 };
      if (!roomCanStart(room)) return { error: "모든 슬롯과 준비 상태를 확인하세요.", status: 409 };
      room.status = "countdown";
      room.countdownAt = now + 3000;
    } else if (body.action === "command") {
      if (room.status !== "playing" || !body.command)
        return { error: "진행 중인 전투 명령만 전송할 수 있습니다.", status: 409 };
      const command = body.command;
      if (!( ["move", "attack", "skill", "drill", "route", "build", "fill", "tactical", "research"] as string[]).includes(command.type))
        return { error: "잘못된 전투 명령입니다.", status: 400 };
      room.commands.push({ ...command, sequence: ++room.commandSequence, playerId: player.id, issuedAt: now });
      if (room.commands.length > 96) room.commands.splice(0, room.commands.length - 96);
    } else if (body.action === "snapshot") {
      if (room.status !== "playing" || player.id !== room.hostId || !body.snapshot)
        return { error: "방장 전투 상태만 동기화할 수 있습니다.", status: 403 };
      room.snapshot = { ...body.snapshot, sequence: (room.snapshot?.sequence ?? 0) + 1, issuedAt: now };
    } else if (body.action === "finish") {
      if (room.status !== "playing" || player.id !== room.hostId || !body.winner)
        return { error: "방장만 전투 결과를 확정할 수 있습니다.", status: 403 };
      room.status = "finished";
      room.winner = body.winner;
      room.finishReason = "core-destroyed";
      room.departedPlayerId = undefined;
    } else if (body.action === "rematch") {
      if (room.status !== "finished" || player.id !== room.hostId)
        return { error: "방장만 재대전을 준비할 수 있습니다.", status: 403 };
      room.status = "lobby";
      room.winner = undefined;
      room.finishReason = undefined;
      room.departedPlayerId = undefined;
      room.countdownAt = undefined;
      room.seed = crypto.getRandomValues(new Uint32Array(1))[0];
      room.commandSequence = 0;
      room.commands = [];
      room.snapshot = undefined;
      for (const member of room.players) member.ready = false;
    } else if (body.action !== "heartbeat") return { error: "알 수 없는 방 명령입니다.", status: 400 };
    if (room.status === "countdown" && room.countdownAt && now >= room.countdownAt) room.status = "playing";
    await this.save(room);
    this.scheduleRoomAlarm(room, now);
    return {};
  }

  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer) {
    let body: RoomActionBody;
    try { body = JSON.parse(typeof message === "string" ? message : new TextDecoder().decode(message)) as RoomActionBody; }
    catch { this.socketError(socket, "방 명령 형식이 올바르지 않습니다."); return; }
    const attachment = socket.deserializeAttachment() as { playerId?: string; token?: string } | null,
      room = await this.load(),
      player = room?.players.find((candidate) => candidate.id === attachment?.playerId && candidate.token === attachment?.token);
    if (!room || !player) { this.socketError(socket, "방 참가 인증이 만료되었습니다."); socket.close(4003, "expired"); return; }
    const result = await this.applyAction(room, player, body, Date.now());
    if (result.error) this.socketError(socket, result.error);
  }

  async webSocketClose(socket: WebSocket) {
    const attachment = socket.deserializeAttachment() as { playerId?: string } | null,
      room = await this.load(),
      player = room?.players.find((candidate) => candidate.id === attachment?.playerId);
    if (!room || !player || !player.connected) return;
    player.connected = false;
    player.aiControlled = false;
    player.lastSeen = Date.now();
    await this.save(room);
    this.scheduleRoomAlarm(room, player.lastSeen);
  }

  async alarm() {
    const room = await this.load();
    if (!room) return;
    const now = Date.now();
    if (room.status === "countdown" && room.countdownAt && now >= room.countdownAt)
      room.status = "playing";
    if (room.status === "playing") {
      const departed = room.players.find((player) => !player.connected && now - player.lastSeen >= 10_000);
      if (departed) {
        room.status = "finished";
        room.winner = opponentTeam(departed.team);
        room.finishReason = "player-left";
        room.departedPlayerId = departed.id;
      }
    }
    await this.save(room);
    this.scheduleRoomAlarm(room, now);
  }

  async fetch(request: Request): Promise<Response> {
    const method = request.method, now = Date.now(), url = new URL(request.url);
    if (method === "PUT") {
      if (await this.load()) return responseJson({ error: "이미 존재하는 방입니다." }, 409);
      const body = await request.json<RoomCreateRequest & { code: string }>();
      if (!this.validateHero(body.heroId, body.faction)) return responseJson({ error: "영웅과 종족이 일치하지 않습니다." }, 400);
      const token = randomToken(), playerId = crypto.randomUUID(), player: OnlineRoomPlayer = {
        id: playerId, token, nickname: body.nickname.trim().slice(0, 12) || "굴착자",
        team: "blue", index: 0, heroId: body.heroId, faction: body.faction,
        ready: false, connected: true, lastSeen: now, aiControlled: false,
      };
      const room: OnlineRoomState = {
        code: body.code, revision: 0, hostId: playerId, teamSize: body.teamSize,
        mapId: body.mapId, status: "lobby", seed: crypto.getRandomValues(new Uint32Array(1))[0],
        players: [player], createdAt: now, updatedAt: now, commandSequence: 0, commands: [],
      };
      await this.save(room);
      return responseJson({ room: publicRoom(room), identity: { playerId, token } }, 201);
    }
    const room = await this.load();
    if (!room) return responseJson({ error: "방을 찾을 수 없습니다." }, 404);
    if (url.pathname.endsWith("/socket")) {
      if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket")
        return responseJson({ error: "WebSocket 업그레이드가 필요합니다." }, 426);
      const playerId = url.searchParams.get("playerId"), token = url.searchParams.get("token"),
        player = room.players.find((candidate) => candidate.id === playerId && candidate.token === token);
      if (!player) return responseJson({ error: "방 참가 인증이 만료되었습니다." }, 403);
      const pair = new WebSocketPair(), [client, server] = Object.values(pair);
      this.roomState.acceptWebSocket(server, [player.id]);
      server.serializeAttachment({ playerId: player.id, token: player.token });
      player.connected = true;
      player.aiControlled = false;
      player.lastSeen = now;
      await this.save(room);
      return new Response(null, { status: 101, webSocket: client });
    }
    if (method === "POST") {
      const body = await request.json<RoomJoinRequest>();
      const reconnect = body.token ? room.players.find((player) => player.token === body.token) : undefined;
      if (reconnect) {
        reconnect.connected = true;
        reconnect.aiControlled = false;
        reconnect.lastSeen = now;
        await this.save(room);
        return responseJson({ room: publicRoom(room), identity: { playerId: reconnect.id, token: reconnect.token } });
      }
      if (room.status !== "lobby") return responseJson({ error: "이미 시작된 방입니다." }, 409);
      if (room.players.length >= roomCapacity(room.teamSize)) return responseJson({ error: "방이 가득 찼습니다." }, 409);
      if (!this.validateHero(body.heroId, body.faction)) return responseJson({ error: "영웅과 종족이 일치하지 않습니다." }, 400);
      const slot = this.slotFor(room);
      if (!slot) return responseJson({ error: "빈 슬롯이 없습니다." }, 409);
      const sameTeam = room.players.filter((player) => player.team === slot.team);
      if (sameTeam.length && sameTeam[0].faction !== body.faction)
        return responseJson({ error: "같은 팀은 같은 종족만 선택할 수 있습니다." }, 409);
      if (sameTeam.some((player) => player.heroId === body.heroId))
        return responseJson({ error: "같은 팀에서 동일 영웅을 중복 선택할 수 없습니다." }, 409);
      const token = randomToken(), playerId = crypto.randomUUID();
      room.players.push({
        id: playerId, token, nickname: body.nickname.trim().slice(0, 12) || "굴착자",
        ...slot, heroId: body.heroId, faction: body.faction, ready: false,
        connected: true, lastSeen: now, aiControlled: false,
      });
      await this.save(room);
      return responseJson({ room: publicRoom(room), identity: { playerId, token } }, 201);
    }
      if (method === "GET") {
      const playerId = url.searchParams.get("playerId"), token = url.searchParams.get("token"),
        player = room.players.find((candidate) => candidate.id === playerId && candidate.token === token);
      if (!player) return responseJson({ error: "방 참가 인증이 만료되었습니다." }, 403);
      player.connected = true;
      player.aiControlled = false;
      player.lastSeen = now;
      for (const member of room.players)
        if (now - member.lastSeen > 10_000) {
          member.connected = false;
          member.aiControlled = false;
          if (room.status === "playing") {
            room.status = "finished";
            room.winner = opponentTeam(member.team);
            room.finishReason = "player-left";
            room.departedPlayerId = member.id;
          }
        }
      if (room.status === "countdown" && room.countdownAt && now >= room.countdownAt)
        room.status = "playing";
      await this.save(room);
      return responseJson({ room: publicRoom(room) });
    }
    if (method === "PATCH") {
      const body = await request.json<RoomActionBody & { playerId: string; token: string }>();
      const player = room.players.find((candidate) => candidate.id === body.playerId && candidate.token === body.token);
      if (!player) return responseJson({ error: "방 참가 인증이 만료되었습니다." }, 403);
      const result = await this.applyAction(room, player, body, now);
      if (result.error) return responseJson({ error: result.error }, result.status ?? 400);
      return responseJson({ room: publicRoom(room) });
    }
    return responseJson({ error: "지원하지 않는 요청입니다." }, 405);
  }
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/rooms" && request.method === "POST") {
      const code = randomCode(), id = env.ROOMS.idFromName(code), stub = env.ROOMS.get(id),
        body = await request.text();
      return stub.fetch(new Request(`https://room.internal/${code}`, {
        method: "PUT", headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...JSON.parse(body), code }),
      }));
    }
    const roomMatch = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]{6})(\/socket)?$/);
    if (roomMatch) {
      const code = roomMatch[1], id = env.ROOMS.idFromName(code), stub = env.ROOMS.get(id);
      return stub.fetch(new Request(`https://room.internal/${code}${roomMatch[2] ?? ""}${url.search}`, request));
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          if (!env.IMAGES) return new Response(body);
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
