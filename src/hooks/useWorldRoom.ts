import { useEffect, useRef, useState } from "react";

const WS_URL = process.env.NEXT_PUBLIC_COLYSEUS_URL ?? "ws://localhost:2567";

export interface PlayerState {
  id: string;
  username: string;
  x: number;
  y: number;
  direction: string;
  moving: boolean;
}

export interface WorldRoom {
  id: string;
  players: Map<string, PlayerState>;
  send: (type: string, data?: object) => void;
  onMessage: (handler: (msg: any) => void) => void;
}

export function useWorldRoom(username: string) {
  const [room, setRoom] = useState<WorldRoom | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<((msg: any) => void)[]>([]);

  useEffect(() => {
    if (!username) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    const players = new Map<string, PlayerState>();
    let localId = "";

    const roomObj: WorldRoom = {
      get id() { return localId; },
      players,
      send: (type, data = {}) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type, ...data }));
      },
      onMessage: (handler) => { handlersRef.current.push(handler); },
    };

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "join", username }));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      if (msg.type === "init") {
        localId = msg.id;
        msg.players.forEach((p: PlayerState) => players.set(p.id, p));
        setConnected(true);
        setRoom({ ...roomObj });
      }

      if (msg.type === "player_join") players.set(msg.player.id, msg.player);
      if (msg.type === "player_leave") players.delete(msg.id);
      if (msg.type === "player_move") {
        const p = players.get(msg.id);
        if (p) { p.x = msg.x; p.y = msg.y; p.direction = msg.direction; p.moving = msg.moving; }
      }

      handlersRef.current.forEach((h) => h(msg));
    };

    ws.onerror = console.error;

    return () => ws.close();
  }, [username]);

  return { room, connected };
}
