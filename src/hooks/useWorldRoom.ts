import { useEffect, useRef, useState } from "react";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:2567";

export interface PlayerState {
  id: string;
  username: string;
  x: number;
  y: number;
  direction: string;
  moving: boolean;
  charCfg?: object;
}

export interface WorldRoom {
  id: string;
  players: Map<string, PlayerState>;
  send: (type: string, data?: object) => void;
  onMessage: (handler: (msg: any) => void) => void;
}

export function useWorldRoom(username: string, roomName: string = "main", charCfg?: object) {
  const [room, setRoom] = useState<WorldRoom | null>(null);
  const [connected, setConnected] = useState(false);
  const [onlinePlayers, setOnlinePlayers] = useState<Map<string, PlayerState>>(new Map());
  const handlersRef = useRef<((msg: any) => void)[]>([]);

  useEffect(() => {
    if (!username) return;
    // Flag/timers LOCAUX à cette exécution d'effet (= à cette room).
    // Évite qu'une ancienne connexion (ex: maison) reconnecte après changement de room.
    let active = true;
    let currentWs: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let pingTimer: ReturnType<typeof setInterval> | null = null;

    setConnected(false);
    handlersRef.current = [];

    function connect() {
      if (!active) return;

      const url = `${WS_URL}?room=${encodeURIComponent(roomName)}`;
      const ws = new WebSocket(url);
      currentWs = ws;

      const players = new Map<string, PlayerState>();
      let localId = "";

      function syncPlayers() { if (active) setOnlinePlayers(new Map(players)); }

      const roomObj: WorldRoom = {
        get id() { return localId; },
        players,
        send: (type, data = {}) => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type, ...data }));
        },
        onMessage: (handler) => { handlersRef.current.push(handler); },
      };

      ws.onopen = () => {
        if (!active) { try { ws.close(1000); } catch {} return; }
        // rejoint à la dernière position connue (continuité après reconnexion)
        let pos: { x: number; y: number } | null = null;
        try {
          const raw = localStorage.getItem(`void_pos_${roomName}`);
          if (raw) pos = JSON.parse(raw);
        } catch {}
        ws.send(JSON.stringify({ type: "join", username, x: pos?.x, y: pos?.y, charCfg }));

        // keepalive : évite la coupure des connexions inactives (auto-réponse serveur)
        if (pingTimer) clearInterval(pingTimer);
        pingTimer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send("ping");
        }, 25000);
      };

      ws.onmessage = (event) => {
        if (!active) return;
        // ignore les réponses keepalive non-JSON ("pong")
        if (typeof event.data === "string" && event.data[0] !== "{") return;
        let msg: any;
        try { msg = JSON.parse(event.data); } catch { return; }

        if (msg.type === "init") {
          localId = msg.id;
          msg.players.forEach((p: PlayerState) => players.set(p.id, p));
          const self = msg.self ?? { x: 0, y: 0 };
          players.set(localId, { id: localId, username, x: self.x, y: self.y, direction: "down", moving: false });
          setConnected(true);
          setRoom({ ...roomObj });
          syncPlayers();
        }

        if (msg.type === "player_join") { players.set(msg.player.id, msg.player); syncPlayers(); }
        if (msg.type === "player_leave") { players.delete(msg.id); syncPlayers(); }
        if (msg.type === "player_move") {
          const p = players.get(msg.id);
          if (p) { p.x = msg.x; p.y = msg.y; p.direction = msg.direction; p.moving = msg.moving; }
        }

        handlersRef.current.forEach((h) => h(msg));
      };

      ws.onerror = console.error;

      ws.onclose = (e) => {
        if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
        if (!active) return;               // cette room n'est plus active → on abandonne
        setConnected(false);
        if (e.code === 1000) return;       // fermeture volontaire → pas de reconnexion
        reconnectTimer = setTimeout(connect, 3000);
      };
    }

    connect();

    return () => {
      active = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (pingTimer) clearInterval(pingTimer);
      try { currentWs?.close(1000); } catch {}
    };
  }, [username, roomName]);

  return { room, connected, onlinePlayers };
}
