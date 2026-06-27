"use client";

import { useEffect, useRef } from "react";
import { Application, Graphics, Text, TextStyle, Container, Assets, Texture, Rectangle, Sprite } from "pixi.js";
import { WorldRoom } from "@/hooks/useWorldRoom";
import {
  drawTree as pxTree,
  drawCactus as pxCactus,
  drawPalmTree as pxPalm,
  drawSnowTree as pxSnowTree,
  drawSwampTree as pxSwampTree,
  drawRock as pxRock,
  drawMountainRock as pxMountainRock,
  drawHouse as pxHouse,
  getHouseHitbox,
  drawMountain as pxMountain,
  decorBush,
  decorFlowers,
  decorGrassTuft,
  decorPebble,
  decorSparkle,
} from "@/lib/pixelArt";

interface Props {
  room: WorldRoom;
  username: string;
}

const TILE_SIZE = 32;
const MAP_COLS  = 150;
const MAP_ROWS  = 120;
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
  // Biomes
  forest:     0x4a8c3f,
  forestDark: 0x3d7a33,
  snow:       0xe8f0f8,
  snowDark:   0xd0dded,
  desert:     0xe8c97a,
  desertDark: 0xd4b865,
  beach:      0xf0e08a,
  beachDark:  0xdecf70,
  water:      0x4a90d9,
  waterDark:  0x3a80c9,
  swamp:      0x5a7a40,
  swampDark:  0x4a6a32,
  mountain:   0xa0a878,
  mountainDk: 0x888f60,
};

// Biomes : village, forest, snow, desert, beach, swamp, mountain
type Biome = "village" | "forest" | "snow" | "desert" | "beach" | "swamp" | "mountain";

function getBiome(col: number, row: number): Biome {
  const cx = MAP_COLS / 2, cy = MAP_ROWS / 2;
  const dx = col - cx, dy = row - cy;
  // Centre = village
  if (Math.abs(dx) < 30 && Math.abs(dy) < 25) return "village";
  // Quadrants
  if (dx < -30 && dy < -20) return "forest";    // NW
  if (dx >  30 && dy < -20) return "snow";       // NE
  if (dx < -30 && dy >  20) return "desert";     // SW
  if (dx >  30 && dy >  20) return "beach";      // SE
  // Bandes
  if (dy < -20) return "mountain";               // bande nord
  if (dy >  20) return "swamp";                  // bande sud
  return "village";
}

const BIOME_COLORS: Record<Biome, [number, number]> = {
  village:  [C.grass,    C.grassDark],
  forest:   [C.forest,   C.forestDark],
  snow:     [C.snow,     C.snowDark],
  desert:   [C.desert,   C.desertDark],
  beach:    [C.beach,    C.beachDark],
  swamp:    [C.swamp,    C.swampDark],
  mountain: [C.mountain, C.mountainDk],
};

// Map : 0=sol, 1=chemin, 2=eau
function generateMap(): number[][] {
  const map: number[][] = [];
  const midR = Math.floor(MAP_ROWS / 2);
  const midC = Math.floor(MAP_COLS / 2);
  for (let r = 0; r < MAP_ROWS; r++) {
    map[r] = [];
    for (let c = 0; c < MAP_COLS; c++) {
      const biome = getBiome(c, r);
      // lac au milieu de la plage (SE)
      const inBeachLake = biome === "beach" && Math.hypot(c - (MAP_COLS * 0.83), r - (MAP_ROWS * 0.79)) < 10;
      // marais = eau par endroits
      const inSwampWater = biome === "swamp" && ((c + r * 3) % 11 < 2);
      if (inBeachLake || inSwampWater) { map[r][c] = 2; continue; }
      map[r][c] = (r === midR || c === midC) ? 1 : 0;
    }
  }
  return map;
}

// Bruit déterministe 0..1 (stable par tuile)
function rnd(c: number, r: number, salt: number): number {
  let h = (c * 374761393 + r * 668265263 + salt * 2246822519) >>> 0;
  h = ((h ^ (h >>> 13)) * 1274126177) >>> 0;
  return (h >>> 0) / 4294967295;
}

// Texture par biome : nuances de base, ombre (taches), touffe d'herbe, fleurs
const TEX: Record<Biome, { shades: number[]; dark: number; tuft?: number; flower?: number[] }> = {
  village:  { shades: [0x7ec87a, 0x77c073, 0x88d084], dark: 0x63ab60, tuft: 0x9bdc95, flower: [0xffffff, 0xf5d23b, 0xe96b9c, 0xb98cf0] },
  forest:   { shades: [0x4a8c3f, 0x437f39, 0x539646], dark: 0x376b30, tuft: 0x66a85a, flower: [0xf5e84a, 0xffffff] },
  swamp:    { shades: [0x5a7a40, 0x527238, 0x63824a], dark: 0x42602e, tuft: 0x6f9050 },
  snow:     { shades: [0xe8f0f8, 0xe1eaf4, 0xeff5fc], dark: 0xd2dfee, flower: [0xffffff, 0xc5dcf2] },
  desert:   { shades: [0xe8c97a, 0xe1c06f, 0xefd488], dark: 0xccab5c },
  beach:    { shades: [0xf0e08a, 0xe9d77f, 0xf6e99b], dark: 0xd7c46b },
  mountain: { shades: [0xa0a878, 0x98a06f, 0xaab083], dark: 0x848c5e },
};

function drawTile(g: Graphics, x: number, y: number, type: number, col: number, row: number) {
  // Eau : base + ondulations
  if (type === 2) {
    g.rect(x, y, TILE_SIZE, TILE_SIZE).fill(C.water);
    const ry1 = y + 6 + Math.floor(rnd(col, row, 1) * 4) * 2;
    const ry2 = y + 20 + Math.floor(rnd(col, row, 2) * 4) * 2;
    g.rect(x + 4, ry1, 10, 2).fill(0x6aa6e0);
    g.rect(x + 18, ry2, 8, 2).fill(0x6aa6e0);
    g.rect(x + 2, y, TILE_SIZE, 2).fill({ color: C.waterDark, alpha: 0.5 });
    return;
  }

  // Chemin de terre texturé
  if (type === 1) {
    g.rect(x, y, TILE_SIZE, TILE_SIZE).fill(rnd(col, row, 1) < 0.5 ? C.dirt : C.dirtDark);
    for (let i = 0; i < 4; i++) {
      const px = x + Math.floor(rnd(col, row, 10 + i) * 15) * 2;
      const py = y + Math.floor(rnd(col, row, 20 + i) * 15) * 2;
      g.rect(px, py, 2, 2).fill(0xb8966a);
    }
    // petit caillou occasionnel
    if (rnd(col, row, 5) < 0.15) {
      const px = x + Math.floor(rnd(col, row, 6) * 13) * 2;
      const py = y + Math.floor(rnd(col, row, 7) * 13) * 2;
      g.rect(px, py, 4, 3).fill(0x9e9e9e);
      g.rect(px, py, 4, 1).fill(0xbcbcbc);
    }
    return;
  }

  // Sol naturel texturé
  const biome = getBiome(col, row);
  const tex = TEX[biome];
  const base = tex.shades[Math.floor(rnd(col, row, 1) * tex.shades.length)];
  g.rect(x, y, TILE_SIZE, TILE_SIZE).fill(base);

  // taches d'ombre
  const specks = 2 + Math.floor(rnd(col, row, 2) * 2);
  for (let i = 0; i < specks; i++) {
    const px = x + Math.floor(rnd(col, row, 30 + i) * 15) * 2;
    const py = y + Math.floor(rnd(col, row, 40 + i) * 15) * 2;
    g.rect(px, py, 2, 2).fill(tex.dark);
  }

  // touffe d'herbe
  if (tex.tuft && rnd(col, row, 3) < 0.4) {
    const tx = x + 6 + Math.floor(rnd(col, row, 4) * 8) * 2;
    const ty = y + 14 + Math.floor(rnd(col, row, 5) * 5) * 2;
    g.rect(tx, ty, 2, 6).fill(tex.tuft);
    g.rect(tx - 2, ty + 2, 2, 4).fill(tex.tuft);
    g.rect(tx + 2, ty + 2, 2, 4).fill(tex.tuft);
  }

  // fleur / éclat rare
  if (tex.flower && rnd(col, row, 6) < 0.05) {
    const fc = tex.flower[Math.floor(rnd(col, row, 7) * tex.flower.length)];
    const fx = x + 6 + Math.floor(rnd(col, row, 8) * 8) * 2;
    const fy = y + 8 + Math.floor(rnd(col, row, 9) * 8) * 2;
    g.rect(fx - 2, fy, 2, 2).fill(fc);
    g.rect(fx + 2, fy, 2, 2).fill(fc);
    g.rect(fx, fy - 2, 2, 2).fill(fc);
    g.rect(fx, fy + 2, 2, 2).fill(fc);
    g.rect(fx, fy, 2, 2).fill(0xffe08a);
  }
}


// Décor en pixel art (voir src/lib/pixelArt.ts). seed = variété (forme/couleur/taille)
function drawCactus(world: Container, cx: number, cy: number, s: number)      { pxCactus(world, cx, cy, s); }
function drawPalmTree(world: Container, cx: number, cy: number, s: number)    { pxPalm(world, cx, cy, s); }
function drawSnowTree(world: Container, cx: number, cy: number, s: number)    { pxSnowTree(world, cx, cy, s); }
function drawSwampTree(world: Container, cx: number, cy: number, s: number)   { pxSwampTree(world, cx, cy, s); }
function drawMountainRock(world: Container, cx: number, cy: number, s: number){ pxMountainRock(world, cx, cy, s); }
function drawTree(world: Container, cx: number, cy: number, s: number)        { pxTree(world, cx, cy, s); }
function drawRock(world: Container, cx: number, cy: number, s: number)        { pxRock(world, cx, cy, s); }
function drawHouse(world: Container, col: number, row: number, s: number)     { pxHouse(world, col, row, TILE_SIZE, s); }

const PLACED_TREES = [
  // Bordure nord
  [2,2],[5,1],[9,3],[13,2],[17,1],[22,3],[27,2],[32,1],[37,3],[42,2],[47,1],[52,3],[57,2],[62,1],[67,3],[72,2],[77,1],[82,3],[87,2],[92,1],[97,3],[102,2],[107,1],[112,3],[117,2],[122,1],[127,3],[132,2],[137,1],[142,3],[147,2],
  // Bordure sud
  [2,117],[6,118],[11,116],[16,118],[21,117],[26,116],[31,118],[36,117],[41,116],[46,118],[51,117],[56,116],[61,118],[66,117],[71,116],[76,118],[81,117],[86,116],[91,118],[96,117],[101,116],[106,118],[111,117],[116,116],[121,118],[126,117],[131,116],[136,118],[141,117],[146,116],
  // Bordure ouest
  [1,7],[2,12],[1,17],[2,22],[1,27],[2,32],[1,37],[2,42],[1,47],[2,52],[1,57],[2,62],[1,67],[2,72],[1,77],[2,82],[1,87],[2,92],[1,97],[2,102],[1,107],[2,112],
  // Bordure est
  [147,7],[148,12],[147,17],[148,22],[147,27],[148,32],[147,37],[148,42],[147,47],[148,52],[147,57],[148,62],[147,67],[148,72],[147,77],[148,82],[147,87],[148,92],[147,97],[148,102],[147,107],[148,112],
  // Bosquets intérieurs
  [10,10],[14,8],[18,12],[8,15],[25,8],[29,10],[33,7],[22,15],[38,10],[43,8],[50,12],[55,9],[60,11],[65,8],[70,10],[75,9],[80,12],[85,8],[90,11],[95,9],[100,12],[105,8],[110,11],[115,9],[120,12],[125,8],[130,11],[135,9],[140,12],[145,8],
  [10,110],[14,112],[18,108],[8,105],[25,112],[29,110],[33,107],[38,110],[43,112],[50,108],[55,111],[60,109],[65,112],[70,110],[75,109],[80,108],[85,111],[90,109],[95,112],[100,108],[105,111],[110,109],[115,112],[120,108],[125,111],[130,109],[135,112],[140,108],[145,111],
  // Clusters milieu
  [20,45],[22,47],[18,48],[15,43],[25,50],[30,42],[35,48],[40,45],[45,50],[50,43],[55,47],[60,44],[65,48],[70,45],[75,50],[80,43],[85,47],[90,44],[95,48],[100,45],[105,50],[110,43],[115,47],[120,44],[125,48],[130,45],[135,50],[140,43],
  [20,75],[22,73],[18,72],[15,77],[25,70],[30,78],[35,72],[40,75],[45,70],[50,77],[55,73],[60,76],[65,72],[70,75],[75,70],[80,77],[85,73],[90,76],[95,72],[100,75],[105,70],[110,77],[115,73],[120,76],[125,72],[130,75],[135,70],[140,77],
];

// Rochers générés procéduralement dans le biome montagne (voir boucle dans useEffect)

const PLACED_HOUSES = [
  // Village centre (biome "village" garanti : |dx|<30, |dy|<25 depuis centre 75,60)
  [60,48],[72,48],[84,48],
  [60,60],[72,60],[84,60],
  [60,72],[72,72],[84,72],
];

export default function GameCanvas({ room, username }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const chatOpenRef  = useRef(false);
  const appRef       = useRef<Application | null>(null);

  useEffect(() => {
    let app: Application | null = null;
    let destroyed = false;

    const keys = new Set<string>();
    const isDown = (k: string) => keys.has(k);
    const onKeyDown = (e: KeyboardEvent) => {
      if (chatOpenRef.current) return;
      if (e.key === "Enter") { chatOpenRef.current = true; chatInputRef.current?.focus(); return; }
      keys.add(e.key.toLowerCase());
    };
    const onKeyUp   = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    const onBlur    = () => keys.clear();
    window.addEventListener("keydown",  onKeyDown);
    window.addEventListener("keyup",    onKeyUp);
    document.addEventListener("keyup",  onKeyUp);
    window.addEventListener("blur",     onBlur);

    (async () => {
      app = new Application();
      appRef.current = app;
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
      world.sortableChildren = true;
      app.stage.addChild(world);

      // ----- Chargement du pack Sprout Lands -----
      const charTex = await Assets.load("/tiles/sl_char.png") as Texture;
      if (destroyed) { app.destroy(true); return; }
      charTex.source.scaleMode = "nearest";

      // Frames du personnage : 4 directions × 4 frames (idle + 3 walk)
      type Dir = "down" | "up" | "right" | "left";
      const CHAR_SCALE = TILE_SIZE / 8; // 4× → sprite 56×64px
      const mkFrames = (y: number, x0: number, w: number) =>
        [0, 1, 2, 3].map(i => new Texture({ source: charTex.source, frame: new Rectangle(x0 + i * 48, y, w, 16) }));
      const CHAR_FRAMES: Record<Dir, Texture[]> = {
        down:  mkFrames(16,  17, 14),
        up:    mkFrames(64,  17, 14),
        right: mkFrames(160, 19, 10),
        left:  mkFrames(112, 19, 10),
      };

      const SCALE = TILE_SIZE / 16; // art 16px -> tuiles 32px
      const mapData = generateMap();

      // Sol pixel art custom (drawTile — biome + texture + fleurs + touffes)
      const groundG = new Graphics();
      groundG.zIndex = 0;
      for (let r = 0; r < MAP_ROWS; r++) {
        for (let c = 0; c < MAP_COLS; c++) {
          drawTile(groundG, c * TILE_SIZE, r * TILE_SIZE, mapData[r][c], c, r);
        }
      }
      world.addChild(groundG);

      // --- Hitboxes des objets ---
      type CircleHit = { kind: "circle"; cx: number; cy: number; r: number };
      type RectHit   = { kind: "rect";   x: number;  y: number;  w: number; h: number };
      type Hit = CircleHit | RectHit;
      const hitboxes: Hit[] = [];

      // Maisons : rectangle précis sur la zone murs/façade
      for (const [c, r] of PLACED_HOUSES) {
        const seed = (c * 37 + r * 53) >>> 0;
        const hb = getHouseHitbox(c, r, TILE_SIZE, seed);
        hitboxes.push({ kind: "rect", ...hb });
      }

      // Arbres pixel art selon biome — zIndex = baseY pour tri de profondeur
      for (const [c, r] of PLACED_TREES) {
        const cx   = c * TILE_SIZE + TILE_SIZE / 2;
        const cy   = r * TILE_SIZE + TILE_SIZE;
        const seed = (c * 131 + r * 73) >>> 0;
        const biome = getBiome(c, r);
        if      (biome === "snow")     drawSnowTree(world, cx, cy, seed);
        else if (biome === "desert")   drawCactus(world, cx, cy, seed);
        else if (biome === "beach")    drawPalmTree(world, cx, cy, seed);
        else if (biome === "swamp")    drawSwampTree(world, cx, cy, seed);
        else if (biome === "mountain") drawMountainRock(world, cx, cy, seed);
        else                           drawTree(world, cx, cy, seed);
        world.children[world.children.length - 1].zIndex = cy;
        hitboxes.push({ kind: "circle", cx, cy: cy - 4, r: TILE_SIZE * 0.55 });
      }

      // Décorations de sol : buissons, fleurs, touffes d'herbe
      const bushG = new Graphics();
      bushG.zIndex = 1;
      world.addChild(bushG);
      for (let r = 0; r < MAP_ROWS; r++) {
        for (let c = 0; c < MAP_COLS; c++) {
          if (mapData[r][c] !== 0) continue;
          const seed = (c * 131 + r * 97) >>> 0;
          const biome = getBiome(c, r);
          const roll = rnd(c, r, 51);
          if (roll < 0.04) {
            // buisson
            const px = c * TILE_SIZE + 6 + Math.floor(rnd(c, r, 55) * 20);
            const py = r * TILE_SIZE + 22 + Math.floor(rnd(c, r, 57) * 8);
            decorBush(bushG, px, py, seed);
          } else if (roll < 0.10 && (biome === "village" || biome === "forest")) {
            // fleurs (village et forêt seulement)
            const px = c * TILE_SIZE + 4 + Math.floor(rnd(c, r, 60) * 24);
            const py = r * TILE_SIZE + 8 + Math.floor(rnd(c, r, 62) * 16);
            decorFlowers(bushG, px, py, seed);
          } else if (roll < 0.14 && biome !== "desert" && biome !== "beach") {
            // touffe d'herbe
            const px = c * TILE_SIZE + 4 + Math.floor(rnd(c, r, 70) * 24);
            const py = r * TILE_SIZE + 10 + Math.floor(rnd(c, r, 72) * 14);
            decorGrassTuft(bushG, px, py, seed);
          }
        }
      }

      // Rochers de montagne — procéduraux, uniquement dans le biome montagne
      for (let r = 0; r < MAP_ROWS; r++) {
        for (let c = 0; c < MAP_COLS; c++) {
          if (mapData[r][c] !== 0) continue;
          if (getBiome(c, r) !== "mountain") continue;
          const roll1 = rnd(c, r, 80);
          const roll2 = rnd(c, r, 81);
          if (roll1 < 0.06 || (roll1 < 0.12 && roll2 < 0.4)) {
            const seed = (c * 197 + r * 41) >>> 0;
            const cx = c * TILE_SIZE + TILE_SIZE / 2 + Math.floor(rnd(c, r, 82) * 8 - 4);
            const cy = r * TILE_SIZE + TILE_SIZE;
            drawMountainRock(world, cx, cy, seed);
            world.children[world.children.length - 1].zIndex = cy;
            hitboxes.push({ kind: "circle", cx, cy: cy - 6, r: TILE_SIZE * 0.7 });
          }
        }
      }

      // Maisons pixel art — zIndex = pied de la façade (bas du mur avant)
      for (const [c, r] of PLACED_HOUSES) {
        const seed = (c * 37 + r * 53) >>> 0;
        drawHouse(world, c, r, TILE_SIZE, seed);
        world.children[world.children.length - 1].zIndex = (r + 1) * TILE_SIZE;
      }

      // Joueurs
      const playerSprites = new Map<string, Container>();
      const playerParts   = new Map<string, { sprite: Sprite; walkTime: number; moving: boolean; dir: Dir }>();

      function createPlayerSprite(id: string, name: string) {
        const container = new Container();

        const shadow = new Graphics();
        shadow.ellipse(0, 2, 10, 4).fill({ color: 0x000000, alpha: 0.2 });
        container.addChild(shadow);

        const sprite = new Sprite(CHAR_FRAMES.down[0]);
        sprite.anchor.set(0.5, 1);
        sprite.scale.set(CHAR_SCALE);
        container.addChild(sprite);

        const label = new Text({ text: name, style: new TextStyle({ fontSize: 9, fill: 0xffffff, fontFamily: "monospace", dropShadow: { color: 0x000000, blur: 2, distance: 1 } }) });
        label.x = -label.width / 2;
        label.y = -CHAR_SCALE * 16 - 12;
        container.addChild(label);

        playerParts.set(id, { sprite, walkTime: 0, moving: false, dir: "down" });
        world.addChild(container);
        playerSprites.set(id, container);
        return container;
      }

      // ticker global : animation + tri z des joueurs
      app.ticker.add((ticker) => {
        playerParts.forEach((parts, id) => {
          if (parts.moving) {
            parts.walkTime += ticker.deltaMS;
            const frame = Math.floor(parts.walkTime / 120) % 4;
            parts.sprite.texture = CHAR_FRAMES[parts.dir][frame];
          } else {
            parts.walkTime = 0;
            parts.sprite.texture = CHAR_FRAMES[parts.dir][0];
          }
          // mise à jour du zIndex pour la profondeur
          const container = playerSprites.get(id);
          if (container) container.zIndex = container.y;
        });
      });

      function showChatBubble(sprite: Container, text: string) {
        const existing = sprite.getChildByLabel("bubble");
        if (existing) sprite.removeChild(existing);

        const bubble = new Container();
        bubble.label = "bubble";

        const style = new TextStyle({ fontSize: 10, fill: 0x222222, fontFamily: "monospace", wordWrap: true, wordWrapWidth: 120 });
        const txt = new Text({ text, style });
        const pad = 5;
        const bw = txt.width + pad * 2;
        const bh = txt.height + pad * 2;
        const bg = new Graphics();
        bg.roundRect(0, 0, bw, bh, 4).fill({ color: 0xffffff, alpha: 0.92 });
        // petite flèche en bas
        bg.moveTo(bw / 2 - 4, bh).lineTo(bw / 2 + 4, bh).lineTo(bw / 2, bh + 6).fill({ color: 0xffffff, alpha: 0.92 });
        txt.x = pad;
        txt.y = pad;
        bubble.addChild(bg);
        bubble.addChild(txt);
        bubble.x = 10 - bw / 2;
        bubble.y = -bh - 42;

        sprite.addChild(bubble);

        let elapsed = 0;
        const tickFn = (t: { deltaMS: number }) => {
          elapsed += t.deltaMS;
          if (elapsed > 4000) bubble.alpha = Math.max(0, 1 - (elapsed - 4000) / 800);
          if (elapsed > 4800) { sprite.removeChild(bubble); appRef.current?.ticker.remove(tickFn); }
        };
        appRef.current?.ticker.add(tickFn);
      }

      // Position initiale = position sauvegardée renvoyée par le serveur (sinon centre)
      const selfState = room.players.get(room.id);
      const startX = selfState?.x ?? (MAP_COLS * TILE_SIZE) / 2;
      const startY = selfState?.y ?? (MAP_ROWS * TILE_SIZE) / 2;

      const localSprite = createPlayerSprite(room.id, username);
      localSprite.x = startX;
      localSprite.y = startY;
      const localParts = playerParts.get(room.id)!;

      room.players.forEach((p) => {
        if (p.id === room.id) return;
        const s = createPlayerSprite(p.id, p.username);
        s.x = p.x; s.y = p.y;
      });

      room.onMessage((msg) => {
        if (msg.type === "player_join") {
          if (msg.player.id === room.id) return;
          const s = createPlayerSprite(msg.player.id, msg.player.username);
          s.x = msg.player.x; s.y = msg.player.y;
        }
        if (msg.type === "player_leave") {
          const s = playerSprites.get(msg.id);
          if (s) { world.removeChild(s); playerSprites.delete(msg.id); playerParts.delete(msg.id); }
        }
        if (msg.type === "player_move") {
          const s = playerSprites.get(msg.id);
          const p = playerParts.get(msg.id);
          if (s && p) {
            const dx = msg.x - s.x, dy = msg.y - s.y;
            if (Math.abs(dx) > Math.abs(dy)) p.dir = dx > 0 ? "right" : "left";
            else if (dy !== 0) p.dir = dy > 0 ? "down" : "up";
            s.x = msg.x; s.y = msg.y;
            s.zIndex = msg.y;
            p.moving = msg.moving ?? true;
          }
        }
        if (msg.type === "chat") {
          const s = msg.id === room.id ? localSprite : playerSprites.get(msg.id);
          if (s) showChatBubble(s, msg.text);
        }
      });

      // --- Minimap ---
      const MM_W = 220, MM_H = 176, MM_PAD = 14;
      // On dessine 1 pixel par "bloc" de STEP tiles pour éviter des milliers de rects
      const MM_STEP = 3; // 1 rect = 3x3 tiles
      const MM_BW = Math.ceil(MAP_COLS / MM_STEP);
      const MM_BH = Math.ceil(MAP_ROWS / MM_STEP);
      const MM_PW = MM_W / MM_BW;
      const MM_PH = MM_H / MM_BH;

      const BIOME_MM_COLOR: Record<Biome, number> = {
        village:  0x6ab36a,
        forest:   0x2d6e35,
        snow:     0xd8e8f5,
        desert:   0xd4b040,
        beach:    0xe8d060,
        swamp:    0x3d5e28,
        mountain: 0x8a9060,
      };

      const minimap = new Container();
      app.stage.addChild(minimap);

      // terrain biomes (statique, dessiné une fois)
      const mmTerrain = new Graphics();
      // bordure/fond
      mmTerrain.roundRect(-2, -2, MM_W + 4, MM_H + 4, 5).fill({ color: 0x000000, alpha: 0.5 });
      for (let br = 0; br < MM_BH; br++) {
        for (let bc = 0; bc < MM_BW; bc++) {
          const col = bc * MM_STEP + Math.floor(MM_STEP / 2);
          const row = br * MM_STEP + Math.floor(MM_STEP / 2);
          const biome = getBiome(col, row);
          mmTerrain.rect(bc * MM_PW, br * MM_PH, MM_PW + 0.5, MM_PH + 0.5).fill(BIOME_MM_COLOR[biome]);
        }
      }
      // eau lac plage
      mmTerrain.circle(MM_W * 0.83, MM_H * 0.79, 8).fill(0x4a90d9);
      // chemins
      const midR = Math.floor(MAP_ROWS / 2);
      const midC = Math.floor(MAP_COLS / 2);
      mmTerrain.rect(0, (midR / MAP_ROWS) * MM_H - 1, MM_W, 2).fill({ color: 0xc9a86c, alpha: 0.8 });
      mmTerrain.rect((midC / MAP_COLS) * MM_W - 1, 0, 2, MM_H).fill({ color: 0xc9a86c, alpha: 0.8 });
      // bordure
      mmTerrain.roundRect(0, 0, MM_W, MM_H, 4).stroke({ color: 0xffffff, width: 1, alpha: 0.3 });
      minimap.addChild(mmTerrain);

      // maisons sur minimap
      const mmHouses = new Graphics();
      for (const [c, r] of PLACED_HOUSES) {
        mmHouses.rect((c / MAP_COLS) * MM_W, (r / MAP_ROWS) * MM_H, 4, 3).fill(0xffffff);
      }
      minimap.addChild(mmHouses);

      // dot joueurs autres
      const mmOtherDots = new Graphics();
      minimap.addChild(mmOtherDots);

      // dot local
      const mmLocalDot = new Graphics();
      mmLocalDot.circle(0, 0, 3).fill(0xffffff).circle(0, 0, 3).stroke({ color: 0x6c63ff, width: 2 });
      minimap.addChild(mmLocalDot);

      const PLAYER_R = 7; // rayon de collision du joueur
      function collidesAt(px: number, py: number): boolean {
        for (const h of hitboxes) {
          if (h.kind === "circle") {
            const ddx = px - h.cx, ddy = py - h.cy;
            if (ddx * ddx + ddy * ddy < (PLAYER_R + h.r) * (PLAYER_R + h.r)) return true;
          } else {
            // cercle-rectangle : point le plus proche du centre joueur dans le rect
            const nearX = Math.max(h.x, Math.min(px, h.x + h.w));
            const nearY = Math.max(h.y, Math.min(py, h.y + h.h));
            const ddx = px - nearX, ddy = py - nearY;
            if (ddx * ddx + ddy * ddy < PLAYER_R * PLAYER_R) return true;
          }
        }
        return false;
      }

      let localX = startX;
      let localY = startY;
      let wasMoving = false;

      app.ticker.add(() => {
        let dx = 0, dy = 0;
        let dir: Dir = localParts.dir;
        if (isDown("arrowup")    || isDown("z")) { dy = -1; dir = "up"; }
        if (isDown("arrowdown")  || isDown("s")) { dy =  1; dir = "down"; }
        if (isDown("arrowleft")  || isDown("q")) { dx = -1; dir = "left"; }
        if (isDown("arrowright") || isDown("d")) { dx =  1; dir = "right"; }

        const speed = isDown("shift") ? RUN_SPEED : WALK_SPEED;
        dx *= speed; dy *= speed;

        const isMoving = dx !== 0 || dy !== 0;
        localParts.moving = isMoving;
        localParts.dir = dir;

        if (isMoving) {
          // tentative axe X puis Y séparément (sliding le long des obstacles)
          const nx = Math.max(0, Math.min(MAP_COLS * TILE_SIZE - 20, localX + dx));
          const ny = Math.max(0, Math.min(MAP_ROWS * TILE_SIZE - 24, localY + dy));
          if (!collidesAt(nx, localY)) localX = nx;
          if (!collidesAt(localX, ny)) localY = ny;
          localSprite.x = localX;
          localSprite.y = localY;
          room.send("move", { x: localX, y: localY, direction: dir, moving: true });
          try { localStorage.setItem("void_pos_main", JSON.stringify({ x: localX, y: localY })); } catch {}
        } else if (wasMoving) {
          room.send("move", { x: localX, y: localY, direction: dir, moving: false });
          try { localStorage.setItem("void_pos_main", JSON.stringify({ x: localX, y: localY })); } catch {}
        }
        wasMoving = isMoving;

        const vw = app!.screen.width;
        const vh = app!.screen.height;
        world.x = Math.min(0, Math.max(vw - MAP_COLS * TILE_SIZE, vw / 2 - localX - 10));
        world.y = Math.min(0, Math.max(vh - MAP_ROWS * TILE_SIZE, vh / 2 - localY - 12));

        // update minimap position
        minimap.x = vw - MM_W - MM_PAD;
        minimap.y = vh - MM_H - MM_PAD;

        // dot local
        mmLocalDot.x = (localX / (MAP_COLS * TILE_SIZE)) * MM_W;
        mmLocalDot.y = (localY / (MAP_ROWS * TILE_SIZE)) * MM_H;

        // dots autres joueurs
        mmOtherDots.clear();
        playerSprites.forEach((s, pid) => {
          if (pid === room.id) return;
          const mx = (s.x / (MAP_COLS * TILE_SIZE)) * MM_W;
          const my = (s.y / (MAP_ROWS * TILE_SIZE)) * MM_H;
          mmOtherDots.circle(mx, my, 2.5).fill(0x43aa8b);
        });
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
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", position: "relative" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      <div style={{ position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", width: 320 }}>
        <input
          ref={chatInputRef}
          maxLength={100}
          placeholder="Appuie sur Entrée pour chatter..."
          onFocus={() => { chatOpenRef.current = true; }}
          onBlur={() => { chatOpenRef.current = false; }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Escape") { chatOpenRef.current = false; e.currentTarget.blur(); e.currentTarget.value = ""; }
            if (e.key === "Enter") {
              const text = e.currentTarget.value.trim();
              if (text) room.send("chat", { text });
              e.currentTarget.value = "";
              chatOpenRef.current = false;
              e.currentTarget.blur();
            }
          }}
          style={{
            width: "100%", padding: "8px 12px", borderRadius: 20,
            background: "rgba(0,0,0,0.55)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)",
            outline: "none", fontSize: 13, fontFamily: "monospace",
            backdropFilter: "blur(4px)",
          }}
        />
      </div>
    </div>
  );
}
