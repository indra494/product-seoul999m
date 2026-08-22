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
  type RoomCreateRequest,
  type RoomJoinRequest,
} from "../game/onlineRoom";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  IMAGES: {
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
    return room;
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

  async fetch(request: Request): Promise<Response> {
    const method = request.method, now = Date.now();
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
      const url = new URL(request.url), playerId = url.searchParams.get("playerId"), token = url.searchParams.get("token"),
        player = room.players.find((candidate) => candidate.id === playerId && candidate.token === token);
      if (!player) return responseJson({ error: "방 참가 인증이 만료되었습니다." }, 403);
      player.connected = true;
      player.aiControlled = false;
      player.lastSeen = now;
      for (const member of room.players)
        if (now - member.lastSeen > 10_000) {
          member.connected = false;
          if (room.status === "playing") member.aiControlled = true;
        }
      if (room.status === "countdown" && room.countdownAt && now >= room.countdownAt)
        room.status = "playing";
      await this.save(room);
      return responseJson({ room: publicRoom(room) });
    }
    if (method === "PATCH") {
      const body = await request.json<{
        playerId: string;
        token: string;
        action: string;
        command?: { type: "move" | "attack" | "skill" | "drill" | "route"; x?: number; y?: number; slot?: 1 | 2 | 4; route?: "A" | "B" };
        snapshot?: Omit<OnlineBattleSnapshot, "sequence" | "issuedAt">;
        winner?: "blue" | "red";
      }>();
      const player = room.players.find((candidate) => candidate.id === body.playerId && candidate.token === body.token);
      if (!player) return responseJson({ error: "방 참가 인증이 만료되었습니다." }, 403);
      player.lastSeen = now;
      player.connected = true;
      if (body.action === "ready") player.ready = true;
      else if (body.action === "unready") player.ready = false;
      else if (body.action === "leave") {
        if (room.status === "playing") {
          player.connected = false;
          player.aiControlled = true;
        } else room.players = room.players.filter((candidate) => candidate.id !== player.id);
      } else if (body.action === "start") {
        if (player.id !== room.hostId) return responseJson({ error: "방장만 시작할 수 있습니다." }, 403);
        if (!roomCanStart(room)) return responseJson({ error: "모든 슬롯과 준비 상태를 확인하세요." }, 409);
        room.status = "countdown";
        room.countdownAt = now + 3000;
      } else if (body.action === "command") {
        if (room.status !== "playing" || !body.command)
          return responseJson({ error: "진행 중인 전투 명령만 전송할 수 있습니다." }, 409);
        const command = body.command;
        if (!(["move", "attack", "skill", "drill", "route"] as string[]).includes(command.type))
          return responseJson({ error: "잘못된 전투 명령입니다." }, 400);
        room.commands.push({
          ...command,
          sequence: ++room.commandSequence,
          playerId: player.id,
          issuedAt: now,
        });
        if (room.commands.length > 96) room.commands.splice(0, room.commands.length - 96);
      } else if (body.action === "snapshot") {
        if (room.status !== "playing" || player.id !== room.hostId || !body.snapshot)
          return responseJson({ error: "방장 전투 상태만 동기화할 수 있습니다." }, 403);
        room.snapshot = {
          ...body.snapshot,
          sequence: (room.snapshot?.sequence ?? 0) + 1,
          issuedAt: now,
        };
      } else if (body.action === "finish") {
        if (room.status !== "playing" || player.id !== room.hostId || !body.winner)
          return responseJson({ error: "방장만 전투 결과를 확정할 수 있습니다." }, 403);
        room.status = "finished";
        room.winner = body.winner;
      } else if (body.action === "rematch") {
        if (room.status !== "finished" || player.id !== room.hostId)
          return responseJson({ error: "방장만 재대전을 준비할 수 있습니다." }, 403);
        room.status = "lobby";
        room.winner = undefined;
        room.countdownAt = undefined;
        room.seed = crypto.getRandomValues(new Uint32Array(1))[0];
        room.commandSequence = 0;
        room.commands = [];
        room.snapshot = undefined;
        for (const member of room.players) member.ready = false;
      } else if (body.action !== "heartbeat") return responseJson({ error: "알 수 없는 방 명령입니다." }, 400);
      if (room.status === "countdown" && room.countdownAt && now >= room.countdownAt) room.status = "playing";
      await this.save(room);
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
    const roomMatch = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]{6})$/);
    if (roomMatch) {
      const code = roomMatch[1], id = env.ROOMS.idFromName(code), stub = env.ROOMS.get(id);
      return stub.fetch(new Request(`https://room.internal/${code}${url.search}`, request));
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
