"use client";

import { useEffect, useRef } from "react";
import { Application, Assets, Texture, Rectangle, Sprite, Graphics, Text, TextStyle, Container } from "pixi.js";
import { WorldRoom } from "@/hooks/useWorldRoom";

interface Props {
  room: WorldRoom;
  username: string;
}

const TILE_SIZE = 32;
const MAP_COLS = 50;
const MAP_ROWS = 40;
const WALK_SPEED = 0.8;
const RUN_SPEED = 1.4;

const TILES = {
  GRASS: { col: 4, row: 1 },
  DIRT:  { col: 6, row: 3 },
};

// Objets décoratifs : position en pixels dans le tileset + taille
const OBJECTS = [
  { name: "rock",      px: 0, py: 448, pw: 64, ph: 64  },
  { name: "house_red", px: 0, py: 672, pw: 96, ph: 128 },
];

const PLACED_OBJECTS = [
  // Rochers
  { obj: "rock", col: 6,  row: 15 },
  { obj: "rock", col: 42, row: 18 },
  { obj: "rock", col: 5,  row: 28 },
  { obj: "rock", col: 20, row: 15 },
  // Maisons
  { obj: "house_red", col: 18, row: 8  },
  { obj: "house_red", col: 30, row: 8  },
  { obj: "house_red", col: 18, row: 28 },
  { obj: "house_red", col: 30, row: 28 },
];

// Map simple : 0=herbe, 1=chemin
function generateMap(cols: number, rows: number): number[][] {
  const map: number[][] = [];
  for (let r = 0; r < rows; r++) {
    map[r] = [];
    for (let c = 0; c < cols; c++) {
      if (r === Math.floor(rows / 2) || c === Math.floor(cols / 2)) {
        map[r][c] = 1;
      } else {
        map[r][c] = 0;
      }
    }
  }
  return map;
}

function getTileTexture(tileset: Texture, col: number, row: number): Texture {
  return new Texture({
    source: tileset.source,
    frame: new Rectangle(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE),
  });
}

export default function GameCanvas({ room, username }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let app: Application | null = null;
    let destroyed = false;

    const keys = new Set<string>();
    const onKeyDown = (e: KeyboardEvent) => keys.add(e.key);
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    (async () => {
      app = new Application();
      await app.init({
        width: window.innerWidth,
        height: window.innerHeight,
        antialias: false,
        resizeTo: window,
      });

      if (destroyed || !containerRef.current) { app.destroy(true); return; }
      containerRef.current.appendChild(app.canvas);

      const tileset = await Assets.load<Texture>("/tiles/tileset.png");

      const textures = {
        [0]: getTileTexture(tileset, TILES.GRASS.col, TILES.GRASS.row),
        [1]: getTileTexture(tileset, TILES.DIRT.col,  TILES.DIRT.row),
      } as Record<number, Texture>;

      const world = new Container();
      app.stage.addChild(world);

      // tilemap
      const mapData = generateMap(MAP_COLS, MAP_ROWS);
      for (let row = 0; row < MAP_ROWS; row++) {
        for (let col = 0; col < MAP_COLS; col++) {
          const tile = new Sprite(textures[mapData[row][col]]);
          tile.x = col * TILE_SIZE;
          tile.y = row * TILE_SIZE;
          world.addChild(tile);
        }
      }

      // objets décoratifs
      const objMap = new Map(OBJECTS.map(o => [o.name, o]));
      for (const placed of PLACED_OBJECTS) {
        const def = objMap.get(placed.obj);
        if (!def) continue;
        const tex = new Texture({
          source: tileset.source,
          frame: new Rectangle(def.px, def.py, def.pw, def.ph),
        });
        const sprite = new Sprite(tex);
        sprite.x = placed.col * TILE_SIZE;
        sprite.y = placed.row * TILE_SIZE - (def.ph - 32); // ancre en bas
        world.addChild(sprite);
      }

      const playerSprites = new Map<string, Container>();

      function createPlayerSprite(id: string, name: string, isLocal: boolean) {
        const container = new Container();
        const body = new Graphics();
        body.rect(0, 0, 20, 24).fill(isLocal ? 0xe63946 : 0x457b9d);
        container.addChild(body);
        const head = new Graphics();
        head.circle(10, -8, 8).fill(0xf4a261);
        container.addChild(head);
        const label = new Text({ text: name, style: new TextStyle({ fontSize: 10, fill: 0xffffff, fontFamily: "monospace" }) });
        label.x = 10 - label.width / 2;
        label.y = -22;
        container.addChild(label);
        world.addChild(container);
        playerSprites.set(id, container);
        return container;
      }

      const startX = (MAP_COLS * TILE_SIZE) / 2;
      const startY = (MAP_ROWS * TILE_SIZE) / 2;

      const localSprite = createPlayerSprite(room.id, username, true);
      localSprite.x = startX;
      localSprite.y = startY;

      room.players.forEach((p) => {
        const s = createPlayerSprite(p.id, p.username, false);
        s.x = p.x; s.y = p.y;
      });

      room.onMessage((msg) => {
        if (msg.type === "player_join") {
          const s = createPlayerSprite(msg.player.id, msg.player.username, false);
          s.x = msg.player.x; s.y = msg.player.y;
        }
        if (msg.type === "player_leave") {
          const s = playerSprites.get(msg.id);
          if (s) { world.removeChild(s); playerSprites.delete(msg.id); }
        }
        if (msg.type === "player_move") {
          const s = playerSprites.get(msg.id);
          if (s) { s.x = msg.x; s.y = msg.y; }
        }
      });

      let localX = startX;
      let localY = startY;

      app.ticker.add(() => {
        let dx = 0; let dy = 0; let direction = "down";
        if (keys.has("ArrowUp") || keys.has("z")) { dy = -1; direction = "up"; }
        if (keys.has("ArrowDown") || keys.has("s")) { dy = 1; direction = "down"; }
        if (keys.has("ArrowLeft") || keys.has("q")) { dx = -1; direction = "left"; }
        if (keys.has("ArrowRight") || keys.has("d")) { dx = 1; direction = "right"; }

        const speed = keys.has("Shift") ? RUN_SPEED : WALK_SPEED;
        dx *= speed; dy *= speed;

        if (dx !== 0 || dy !== 0) {
          localX = Math.max(0, Math.min(MAP_COLS * TILE_SIZE - 20, localX + dx));
          localY = Math.max(0, Math.min(MAP_ROWS * TILE_SIZE - 24, localY + dy));
          localSprite.x = localX;
          localSprite.y = localY;
          room.send("move", { x: localX, y: localY, direction, moving: true });
        }

        const vw = app!.screen.width;
        const vh = app!.screen.height;
        world.x = Math.min(0, Math.max(vw - MAP_COLS * TILE_SIZE, vw / 2 - localX - 10));
        world.y = Math.min(0, Math.max(vh - MAP_ROWS * TILE_SIZE, vh / 2 - localY - 12));
      });
    })();

    return () => {
      destroyed = true;
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      if (app && app.renderer) app.destroy(true);
    };
  }, [room]);

  return (
    <div ref={containerRef} style={{ width: "100vw", height: "100vh", overflow: "hidden", imageRendering: "pixelated" }} />
  );
}
