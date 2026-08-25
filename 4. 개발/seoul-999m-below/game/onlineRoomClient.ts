import type {
  OnlineBattleCommand,
  OnlineBattleSnapshot,
  OnlineRoomView,
  RoomClientIdentity,
  RoomCreateRequest,
  RoomJoinRequest,
} from "./onlineRoom";
import { ONLINE_SOCKET_HEARTBEAT_MS, ONLINE_SOCKET_RECONNECT_MAX_MS } from "./onlineRoom";

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

export type OnlineRoomSocket = {
  send(action: "ready" | "unready" | "start" | "leave" | "heartbeat" | "command" | "snapshot" | "finish" | "rematch", data?: Record<string, unknown>): boolean;
  close(): void;
  isOpen(): boolean;
};

export const onlineRoomSocketUrl = (
  origin: Pick<Location, "protocol" | "host">,
  code: string,
  identity: RoomClientIdentity,
) => `${origin.protocol === "https:" ? "wss:" : "ws:"}//${origin.host}/api/rooms/${code}/socket?playerId=${encodeURIComponent(identity.playerId)}&token=${encodeURIComponent(identity.token)}`;

export const connectOnlineRoomSocket = ({
  code,
  identity,
  onRoom,
  onStatus,
  onError,
}: {
  code: string;
  identity: RoomClientIdentity;
  onRoom: (room: OnlineRoomView) => void;
  onStatus?: (status: "connected" | "reconnecting") => void;
  onError?: (message: string) => void;
}): OnlineRoomSocket => {
  let socket: WebSocket | null = null,
    stopped = false,
    retry = 0,
    reconnectTimer = 0,
    heartbeatTimer = 0;

  const stopHeartbeat = () => window.clearInterval(heartbeatTimer);
  const connect = () => {
    if (stopped) return;
    socket = new WebSocket(onlineRoomSocketUrl(window.location, code, identity));
    socket.addEventListener("open", () => {
      retry = 0;
      onStatus?.("connected");
      stopHeartbeat();
      heartbeatTimer = window.setInterval(() => {
        if (socket?.readyState === WebSocket.OPEN)
          socket.send(JSON.stringify({ action: "heartbeat" }));
      }, ONLINE_SOCKET_HEARTBEAT_MS);
    });
    socket.addEventListener("message", (event) => {
      try {
        const message = JSON.parse(String(event.data)) as { type?: string; room?: OnlineRoomView; error?: string };
        if (message.type === "room" && message.room) onRoom(message.room);
        else if (message.error) onError?.(message.error);
      } catch {
        onError?.("방 동기화 응답을 읽지 못했습니다.");
      }
    });
    socket.addEventListener("close", () => {
      stopHeartbeat();
      if (stopped) return;
      onStatus?.("reconnecting");
      const delay = Math.min(ONLINE_SOCKET_RECONNECT_MAX_MS, 600 * 2 ** Math.min(4, retry++));
      reconnectTimer = window.setTimeout(connect, delay);
    });
    socket.addEventListener("error", () => socket?.close());
  };
  connect();
  return {
    send(action, data) {
      if (socket?.readyState !== WebSocket.OPEN) return false;
      socket.send(JSON.stringify({ action, ...data }));
      return true;
    },
    close() {
      stopped = true;
      window.clearTimeout(reconnectTimer);
      stopHeartbeat();
      socket?.close(1000, "client-close");
    },
    isOpen: () => socket?.readyState === WebSocket.OPEN,
  };
};
