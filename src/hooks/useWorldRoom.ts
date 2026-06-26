import { useEffect, useRef, useState } from "react";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:2567";

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

export function useWorldRoom(username: string, roomName: string = "main") {
  const [room, setRoom] = useState<WorldRoom | null>(null);
  const [connected, setConnected] = useState(false);
  const [onlinePlayers, setOnlinePlayers] = useState<Map<string, PlayerState>>(new Map());
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<((msg: any) => void)[]>([]);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopped = useRef(false);

  useEffect(() => {
    if (!username) return;
    stopped.current = false;
    setConnected(false);
    // les handlers sont propres à une connexion/room
    handlersRef.current = [];

    function connect() {
      if (stopped.current) return;

      const url = `${WS_URL}?room=${encodeURIComponent(roomName)}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      const players = new Map<string, PlayerState>();
      let localId = "";

      function syncPlayers() { setOnlinePlayers(new Map(players)); }

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
        if (stopped.current) return;
        setConnected(false);
        // Fermeture volontaire (ex: éjecté par le serveur car doublon de pseudo)
        // → ne pas reconnecter, sinon boucle infinie de reconnexion
        if (e.code === 1000) return;
        // reconnexion automatique après 3 secondes (coupure réseau / serveur endormi)
        reconnectTimer.current = setTimeout(connect, 3000);
      };
    }

    connect();

    return () => {
      stopped.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [username, roomName]);

  return { room, connected, onlinePlayers };
}
