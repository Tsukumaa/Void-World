"use client";

import { useEffect, useRef } from "react";
import { Application, Graphics, Text, TextStyle, Container } from "pixi.js";
import { WorldRoom } from "@/hooks/useWorldRoom";

interface Props {
  room: WorldRoom;
  username: string;
}

const TILE_SIZE = 32;
const MAP_COLS  = 50;
const MAP_ROWS  = 40;
const WALK_SPEED = 0.8;
const RUN_SPEED  = 1.4;

// Palette
const C = {
  grass:      0x7ec87a,
  grassDark:  0x6db86a,
  dirt:       0xc9a86c,
  dirtDark:   0xb8966a,
  treeTrunk:  0x8b5e3c,
  treeTop:    0x4a9e4f,
  treeTop2:   0x3d8f42,
  rock:       0x9e9e9e,
  rockDark:   0x7a7a7a,
  housWall:   0xf5e6c8,
  housWall2:  0xe8d5b0,
  housRoof:   0xc0392b,
  housRoof2:  0xa93226,
  housDoor:   0x8b5e3c,
  housWin:    0x87ceeb,
  path:       0xc9a86c,
  shadow:     0x000000,
};

// Map : 0=herbe, 1=chemin
function generateMap(): number[][] {
  const map: number[][] = [];
  const midR = Math.floor(MAP_ROWS / 2);
  const midC = Math.floor(MAP_COLS / 2);
  for (let r = 0; r < MAP_ROWS; r++) {
    map[r] = [];
    for (let c = 0; c < MAP_COLS; c++) {
      map[r][c] = (r === midR || c === midC) ? 1 : 0;
    }
  }
  return map;
}

function drawTile(g: Graphics, x: number, y: number, type: number) {
  if (type === 0) {
    // herbe avec variation
    const dark = (Math.floor(x / TILE_SIZE) + Math.floor(y / TILE_SIZE)) % 2 === 0;
    g.rect(x, y, TILE_SIZE, TILE_SIZE).fill(dark ? C.grassDark : C.grass);
  } else {
    const dark = (Math.floor(x / TILE_SIZE) + Math.floor(y / TILE_SIZE)) % 2 === 0;
    g.rect(x, y, TILE_SIZE, TILE_SIZE).fill(dark ? C.dirtDark : C.dirt);
  }
}

function drawTree(world: Container, cx: number, cy: number) {
  const g = new Graphics();
  // ombre
  g.ellipse(cx, cy + 2, 10, 5).fill({ color: C.shadow, alpha: 0.15 });
  // tronc
  g.roundRect(cx - 4, cy - 14, 8, 16, 2).fill(C.treeTrunk);
  // feuillage couche 3 (fond)
  g.circle(cx, cy - 28, 14).fill(C.treeTop2);
  // feuillage couche 2
  g.circle(cx - 6, cy - 32, 11).fill(C.treeTop2);
  g.circle(cx + 6, cy - 32, 11).fill(C.treeTop2);
  // feuillage couche 1 (devant)
  g.circle(cx, cy - 36, 13).fill(C.treeTop);
  // reflet lumineux
  g.circle(cx - 3, cy - 40, 4).fill({ color: 0xffffff, alpha: 0.12 });
  world.addChild(g);
}

function drawRock(world: Container, cx: number, cy: number) {
  const g = new Graphics();
  // ombre
  g.ellipse(cx, cy + 2, 16, 6).fill({ color: C.shadow, alpha: 0.15 });
  // gros rocher
  g.ellipse(cx, cy - 8, 18, 13).fill(C.rockDark);
  g.ellipse(cx - 2, cy - 10, 16, 12).fill(C.rock);
  // petit rocher à droite
  g.ellipse(cx + 14, cy - 3, 9, 7).fill(C.rockDark);
  g.ellipse(cx + 13, cy - 4, 8, 6).fill(C.rock);
  // reflet
  g.ellipse(cx - 4, cy - 14, 5, 3).fill({ color: 0xffffff, alpha: 0.25 });
  world.addChild(g);
}

function drawHouse(world: Container, col: number, row: number) {
  const x = col * TILE_SIZE;
  const y = row * TILE_SIZE;
  const g = new Graphics();
  const w = 80, h = 60, roofH = 40;
  // ombre portée
  g.ellipse(x + w / 2, y + h + 6, w / 2, 10).fill({ color: C.shadow, alpha: 0.15 });
  // mur côté (ombre)
  g.rect(x + w, y + roofH / 2, 12, h).fill(C.housWall2);
  // mur face
  g.rect(x, y + roofH / 2, w, h).fill(C.housWall);
  // toit côté
  g.poly([x + w, y + roofH / 2, x + w + 12, y + roofH / 2 + 8, x + w + 12, y + roofH / 2]).fill(C.housRoof2);
  // toit face
  g.poly([x - 6, y + roofH / 2, x + w / 2, y, x + w + 6, y + roofH / 2]).fill(C.housRoof);
  // fenêtre gauche
  g.roundRect(x + 8, y + roofH / 2 + 10, 20, 16, 2).fill(C.housWin);
  g.rect(x + 17, y + roofH / 2 + 10, 2, 16).fill({ color: 0xffffff, alpha: 0.5 });
  g.rect(x + 8, y + roofH / 2 + 17, 20, 2).fill({ color: 0xffffff, alpha: 0.5 });
  // fenêtre droite
  g.roundRect(x + w - 28, y + roofH / 2 + 10, 20, 16, 2).fill(C.housWin);
  g.rect(x + w - 19, y + roofH / 2 + 10, 2, 16).fill({ color: 0xffffff, alpha: 0.5 });
  g.rect(x + w - 28, y + roofH / 2 + 17, 20, 2).fill({ color: 0xffffff, alpha: 0.5 });
  // porte
  g.roundRect(x + w / 2 - 10, y + roofH / 2 + h - 28, 20, 28, 3).fill(C.housDoor);
  g.circle(x + w / 2 + 6, y + roofH / 2 + h - 14, 2).fill(0xf0c040);
  // cheminée
  g.rect(x + w - 20, y - 4, 10, roofH / 2 + 4).fill(C.rockDark);
  g.rect(x + w - 22, y - 8, 14, 6).fill(C.rock);
  world.addChild(g);
}

const PLACED_TREES = [
  [3,3],[7,5],[12,2],[16,5],[2,18],[46,10],[44,8],
  [3,30],[8,35],[12,33],[38,33],[40,32],[45,36],
  [36,4],[40,4],[48,2],[1,8],[48,15],[1,25],[48,30],
];

const PLACED_ROCKS = [
  [6,15],[42,18],[5,28],[20,15],[35,30],[10,10],[44,25],
];

const PLACED_HOUSES = [
  [16,6],[28,6],[16,26],[28,26],
];

export default function GameCanvas({ room, username }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let app: Application | null = null;
    let destroyed = false;

    const keys = new Set<string>();
    const isDown = (k: string) => keys.has(k);
    const onKeyDown = (e: KeyboardEvent) => keys.add(e.key.toLowerCase());
    const onKeyUp   = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    const onBlur    = () => keys.clear();
    window.addEventListener("keydown",  onKeyDown);
    window.addEventListener("keyup",    onKeyUp);
    document.addEventListener("keyup",  onKeyUp);
    window.addEventListener("blur",     onBlur);

    (async () => {
      app = new Application();
      await app.init({
        width: window.innerWidth,
        height: window.innerHeight,
        antialias: false,
        resizeTo: window,
        backgroundColor: C.grass,
      });

      if (destroyed || !containerRef.current) { app.destroy(true); return; }
      containerRef.current.appendChild(app.canvas);

      const world = new Container();
      app.stage.addChild(world);

      // Sol
      const ground = new Graphics();
      const mapData = generateMap();
      for (let r = 0; r < MAP_ROWS; r++)
        for (let c = 0; c < MAP_COLS; c++)
          drawTile(ground, c * TILE_SIZE, r * TILE_SIZE, mapData[r][c]);
      world.addChild(ground);

      // Arbres
      for (const [c, r] of PLACED_TREES)
        drawTree(world, c * TILE_SIZE + TILE_SIZE / 2, r * TILE_SIZE + TILE_SIZE / 2);

      // Rochers
      for (const [c, r] of PLACED_ROCKS)
        drawRock(world, c * TILE_SIZE + TILE_SIZE / 2, r * TILE_SIZE + TILE_SIZE / 2);

      // Maisons
      for (const [c, r] of PLACED_HOUSES)
        drawHouse(world, c, r);

      // Joueurs
      const playerSprites = new Map<string, Container>();

      function createPlayerSprite(id: string, name: string, isLocal: boolean) {
        const container = new Container();
        const color     = isLocal ? 0x6c63ff : 0x43aa8b;
        const pantsCol  = isLocal ? 0x4a4080 : 0x2d6a55;
        const skin      = 0xffd6a5;

        const shadow = new Graphics();
        shadow.ellipse(10, 30, 9, 4).fill({ color: C.shadow, alpha: 0.18 });
        container.addChild(shadow);
        const legL = new Graphics();
        legL.roundRect(3, 18, 6, 10, 2).fill(pantsCol);
        container.addChild(legL);
        const legR = new Graphics();
        legR.roundRect(11, 18, 6, 10, 2).fill(pantsCol);
        container.addChild(legR);
        const body = new Graphics();
        body.roundRect(2, 8, 16, 12, 3).fill(color);
        container.addChild(body);
        const collar = new Graphics();
        collar.roundRect(6, 7, 8, 4, 2).fill(isLocal ? 0x9b8fff : 0x5ecba1);
        container.addChild(collar);
        const armL = new Graphics();
        armL.roundRect(0, 9, 4, 9, 2).fill(color);
        container.addChild(armL);
        const armR = new Graphics();
        armR.roundRect(16, 9, 4, 9, 2).fill(color);
        container.addChild(armR);
        const head = new Graphics();
        head.roundRect(3, -10, 14, 14, 5).fill(skin);
        container.addChild(head);
        const eyeL = new Graphics();
        eyeL.circle(7, -4, 1.5).fill(0x333333);
        container.addChild(eyeL);
        const eyeR = new Graphics();
        eyeR.circle(13, -4, 1.5).fill(0x333333);
        container.addChild(eyeR);
        const hair = new Graphics();
        hair.roundRect(3, -12, 14, 6, 4).fill(isLocal ? 0x3d2b1f : 0x2b3d1f);
        container.addChild(hair);
        const label = new Text({ text: name, style: new TextStyle({ fontSize: 9, fill: 0xffffff, fontFamily: "monospace", dropShadow: { color: 0x000000, blur: 2, distance: 1 } }) });
        label.x = 10 - label.width / 2;
        label.y = -24;
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
        let dx = 0, dy = 0, direction = "down";
        if (isDown("arrowup")    || isDown("z")) { dy = -1; direction = "up"; }
        if (isDown("arrowdown")  || isDown("s")) { dy =  1; direction = "down"; }
        if (isDown("arrowleft")  || isDown("q")) { dx = -1; direction = "left"; }
        if (isDown("arrowright") || isDown("d")) { dx =  1; direction = "right"; }

        const speed = isDown("shift") ? RUN_SPEED : WALK_SPEED;
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
      window.removeEventListener("keydown",   onKeyDown);
      window.removeEventListener("keyup",     onKeyUp);
      document.removeEventListener("keyup",   onKeyUp);
      window.removeEventListener("blur",      onBlur);
      if (app && app.renderer) app.destroy(true);
    };
  }, [room]);

  return (
    <div ref={containerRef} style={{ width: "100vw", height: "100vh", overflow: "hidden" }} />
  );
}
