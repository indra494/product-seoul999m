import type {
  OnlineBattleCommand,
  OnlineBattleSnapshot,
  OnlineRoomView,
  RoomClientIdentity,
  RoomCreateRequest,
  RoomJoinRequest,
} from "./onlineRoom";

const jsonRequest = async <T>(url: string, method: string, body?: unknown): Promise<T> => {
  const response = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? `Room request failed: ${response.status}`);
  return payload;
};

export const createOnlineRoom = (request: RoomCreateRequest) =>
  jsonRequest<{ room: OnlineRoomView; identity: RoomClientIdentity }>("/api/rooms", "POST", request);

export const joinOnlineRoom = (code: string, request: RoomJoinRequest) =>
  jsonRequest<{ room: OnlineRoomView; identity: RoomClientIdentity }>(`/api/rooms/${code}`, "POST", request);

export const readOnlineRoom = (code: string, identity: RoomClientIdentity) =>
  jsonRequest<{ room: OnlineRoomView }>(`/api/rooms/${code}?playerId=${identity.playerId}&token=${identity.token}`, "GET");

export const updateOnlineRoom = (
  code: string,
  identity: RoomClientIdentity,
  action: "ready" | "unready" | "start" | "leave" | "heartbeat" | "command" | "snapshot" | "finish" | "rematch",
  data?: Record<string, unknown>,
) => jsonRequest<{ room: OnlineRoomView }>(`/api/rooms/${code}`, "PATCH", { ...identity, action, ...data });

export const sendOnlineBattleCommand = (
  code: string,
  identity: RoomClientIdentity,
  command: Omit<OnlineBattleCommand, "sequence" | "playerId" | "issuedAt">,
) => updateOnlineRoom(code, identity, "command", { command });

export const sendOnlineBattleSnapshot = (
  code: string,
  identity: RoomClientIdentity,
  snapshot: Omit<OnlineBattleSnapshot, "sequence" | "issuedAt">,
) => updateOnlineRoom(code, identity, "snapshot", { snapshot });
