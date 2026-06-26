"use client";

import { useEffect, useRef } from "react";
import { Application, Graphics, Text, TextStyle, Container } from "pixi.js";
import { WorldRoom } from "@/hooks/useWorldRoom";

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

function drawTile(g: Graphics, x: number, y: number, type: number, col: number, row: number) {
  if (type === 2) {
    const dark = (col + row) % 2 === 0;
    g.rect(x, y, TILE_SIZE, TILE_SIZE).fill(dark ? C.waterDark : C.water);
    return;
  }
  const biome = getBiome(col, row);
  const [light, dark] = BIOME_COLORS[biome];
  const checker = (col + row) % 2 === 0;
  if (type === 1) {
    g.rect(x, y, TILE_SIZE, TILE_SIZE).fill(checker ? C.dirtDark : C.dirt);
  } else {
    g.rect(x, y, TILE_SIZE, TILE_SIZE).fill(checker ? dark : light);
  }
}


function drawCactus(world: Container, cx: number, cy: number) {
  const g = new Graphics();
  g.ellipse(cx, cy + 2, 7, 3).fill({ color: C.shadow, alpha: 0.15 });
  g.roundRect(cx - 4, cy - 28, 8, 30, 4).fill(0x5aab55);
  g.roundRect(cx - 14, cy - 20, 12, 6, 3).fill(0x5aab55);
  g.roundRect(cx + 4, cy - 15, 10, 6, 3).fill(0x5aab55);
  g.circle(cx, cy - 28, 5).fill(0x7acc77);
  world.addChild(g);
}

function drawPalmTree(world: Container, cx: number, cy: number) {
  const g = new Graphics();
  g.ellipse(cx, cy + 2, 9, 4).fill({ color: C.shadow, alpha: 0.15 });
  // tronc courbé
  g.roundRect(cx - 3, cy - 26, 7, 28, 3).fill(0xa0784a);
  // feuilles
  const leafColor = 0x4db848;
  g.poly([cx, cy - 28, cx - 22, cy - 24, cx - 8, cy - 32]).fill(leafColor);
  g.poly([cx, cy - 28, cx + 22, cy - 24, cx + 8, cy - 32]).fill(leafColor);
  g.poly([cx, cy - 28, cx - 14, cy - 38, cx + 2, cy - 36]).fill(leafColor);
  g.poly([cx, cy - 28, cx + 14, cy - 38, cx - 2, cy - 36]).fill(leafColor);
  g.poly([cx, cy - 28, cx, cy - 40, cx - 6, cy - 34]).fill(leafColor);
  // noix de coco
  g.circle(cx + 3, cy - 27, 4).fill(0x8b6914);
  g.circle(cx - 4, cy - 26, 3).fill(0x7a5c10);
  world.addChild(g);
}

function drawSnowTree(world: Container, cx: number, cy: number) {
  const g = new Graphics();
  g.ellipse(cx, cy + 2, 9, 4).fill({ color: C.shadow, alpha: 0.12 });
  g.roundRect(cx - 3, cy - 14, 7, 16, 2).fill(C.treeTrunk);
  // sapin (couches)
  g.poly([cx, cy - 44, cx - 14, cy - 24, cx + 14, cy - 24]).fill(0x2d6e35);
  g.poly([cx, cy - 38, cx - 11, cy - 20, cx + 11, cy - 20]).fill(0x357a3e);
  g.poly([cx, cy - 30, cx - 13, cy - 10, cx + 13, cy - 10]).fill(0x2d6e35);
  // neige
  g.poly([cx, cy - 44, cx - 7, cy - 30, cx + 7, cy - 30]).fill(0xe8f0f8);
  g.poly([cx, cy - 38, cx - 5, cy - 26, cx + 5, cy - 26]).fill(0xe0eaf5);
  g.circle(cx, cy - 44, 3).fill(0xf0f6ff);
  world.addChild(g);
}

function drawSwampTree(world: Container, cx: number, cy: number) {
  const g = new Graphics();
  g.ellipse(cx, cy + 2, 9, 4).fill({ color: C.shadow, alpha: 0.15 });
  g.roundRect(cx - 3, cy - 18, 7, 20, 2).fill(0x5a4a2a);
  // racines
  g.poly([cx - 3, cy - 2, cx - 14, cy + 4, cx - 8, cy]).fill(0x4a3a1e);
  g.poly([cx + 3, cy - 2, cx + 14, cy + 4, cx + 8, cy]).fill(0x4a3a1e);
  // feuillage épars
  g.circle(cx, cy - 30, 13).fill(0x4a7a30);
  g.circle(cx - 8, cy - 26, 9).fill(0x3d6a26);
  g.circle(cx + 8, cy - 26, 9).fill(0x3d6a26);
  g.circle(cx, cy - 22, 8).fill(0x4a7a30);
  // mousse
  g.ellipse(cx, cy - 18, 10, 4).fill({ color: 0x5aaa40, alpha: 0.5 });
  world.addChild(g);
}

function drawMountainRock(world: Container, cx: number, cy: number) {
  const g = new Graphics();
  g.ellipse(cx, cy + 3, 22, 8).fill({ color: C.shadow, alpha: 0.18 });
  g.poly([cx, cy - 40, cx - 22, cy, cx + 22, cy]).fill(0x888f60);
  g.poly([cx - 6, cy - 40, cx - 26, cy - 2, cx + 10, cy - 2]).fill(0x9a9e72);
  g.poly([cx, cy - 40, cx - 10, cy - 18, cx + 10, cy - 18]).fill(0xdde8f0);
  g.poly([cx - 18, cy, cx - 26, cy - 8, cx - 8, cy]).fill(0x777a50);
  world.addChild(g);
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

const PLACED_ROCKS = [
  [8,20],[15,35],[25,18],[35,55],[45,30],[55,20],[65,38],[75,22],[85,55],[95,35],[105,20],[115,42],[125,28],[135,55],[145,35],
  [8,100],[15,85],[25,102],[35,65],[45,90],[55,100],[65,82],[75,98],[85,65],[95,85],[105,100],[115,78],[125,92],[135,65],[145,85],
  [30,58],[50,62],[70,58],[90,62],[110,58],[130,62],
];

const PLACED_HOUSES = [
  // Village centre
  [55,50],[68,50],[81,50],[55,65],[68,65],[81,65],
  // Village nord-ouest
  [15,20],[28,20],[15,32],[28,32],
  // Village nord-est
  [115,20],[128,20],[115,32],[128,32],
  // Village sud-ouest
  [15,88],[28,88],[15,100],[28,100],
  // Village sud-est
  [115,88],[128,88],[115,100],[128,100],
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
      app.stage.addChild(world);

      // Sol
      const ground = new Graphics();
      const mapData = generateMap();
      for (let r = 0; r < MAP_ROWS; r++)
        for (let c = 0; c < MAP_COLS; c++)
          drawTile(ground, c * TILE_SIZE, r * TILE_SIZE, mapData[r][c], c, r);
      world.addChild(ground);

      // Arbres — fonction selon biome
      for (const [c, r] of PLACED_TREES) {
        const px = c * TILE_SIZE + TILE_SIZE / 2;
        const py = r * TILE_SIZE + TILE_SIZE / 2;
        const biome = getBiome(c, r);
        if (biome === "desert")   drawCactus(world, px, py);
        else if (biome === "beach")    drawPalmTree(world, px, py);
        else if (biome === "snow")     drawSnowTree(world, px, py);
        else if (biome === "swamp")    drawSwampTree(world, px, py);
        else                           drawTree(world, px, py);
      }

      // Rochers — montagne = gros rocher stylisé
      for (const [c, r] of PLACED_ROCKS) {
        const px = c * TILE_SIZE + TILE_SIZE / 2;
        const py = r * TILE_SIZE + TILE_SIZE / 2;
        if (getBiome(c, r) === "mountain") drawMountainRock(world, px, py);
        else drawRock(world, px, py);
      }

      // Maisons
      for (const [c, r] of PLACED_HOUSES)
        drawHouse(world, c, r);

      // Joueurs
      const playerSprites = new Map<string, Container>();
      const playerParts   = new Map<string, { legL: Container; legR: Container; armL: Container; armR: Container; upper: Container; walkTime: number; moving: boolean; }>();

      function createPlayerSprite(id: string, name: string, isLocal: boolean) {
        const container = new Container();
        const color    = isLocal ? 0x6c63ff : 0x43aa8b;
        const pantsCol = isLocal ? 0x4a4080 : 0x2d6a55;
        const skin     = 0xffd6a5;

        // Shadow
        const shadow = new Graphics();
        shadow.ellipse(10, 30, 9, 4).fill({ color: C.shadow, alpha: 0.18 });
        container.addChild(shadow);

        // Jambes — chaque jambe dans son propre Container pour animer via y
        const legL = new Container();
        const legLg = new Graphics().roundRect(0, 0, 6, 10, 2).fill(pantsCol);
        legL.addChild(legLg);
        legL.x = 3; legL.y = 18;
        container.addChild(legL);

        const legR = new Container();
        const legRg = new Graphics().roundRect(0, 0, 6, 10, 2).fill(pantsCol);
        legR.addChild(legRg);
        legR.x = 11; legR.y = 18;
        container.addChild(legR);

        // Upper body (corps + bras + tête) dans un Container pour le bob
        const upper = new Container();

        const body = new Graphics().roundRect(2, 8, 16, 12, 3).fill(color);
        upper.addChild(body);

        const collar = new Graphics().roundRect(6, 7, 8, 4, 2).fill(isLocal ? 0x9b8fff : 0x5ecba1);
        upper.addChild(collar);

        const armL = new Container();
        const armLg = new Graphics().roundRect(0, 0, 4, 9, 2).fill(color);
        armL.addChild(armLg);
        armL.x = 0; armL.y = 9;
        upper.addChild(armL);

        const armR = new Container();
        const armRg = new Graphics().roundRect(0, 0, 4, 9, 2).fill(color);
        armR.addChild(armRg);
        armR.x = 16; armR.y = 9;
        upper.addChild(armR);

        const head = new Graphics().roundRect(3, -10, 14, 14, 5).fill(skin);
        upper.addChild(head);
        const eyeL = new Graphics().circle(7, -4, 1.5).fill(0x333333);
        upper.addChild(eyeL);
        const eyeR = new Graphics().circle(13, -4, 1.5).fill(0x333333);
        upper.addChild(eyeR);
        const hair = new Graphics().roundRect(3, -12, 14, 6, 4).fill(isLocal ? 0x3d2b1f : 0x2b3d1f);
        upper.addChild(hair);

        container.addChild(upper);

        const label = new Text({ text: name, style: new TextStyle({ fontSize: 9, fill: 0xffffff, fontFamily: "monospace", dropShadow: { color: 0x000000, blur: 2, distance: 1 } }) });
        label.x = 10 - label.width / 2;
        label.y = -24;
        container.addChild(label);

        playerParts.set(id, { legL, legR, armL, armR, upper, walkTime: 0, moving: false });
        world.addChild(container);
        playerSprites.set(id, container);
        return container;
      }

      // ticker global d'animation
      app.ticker.add((ticker) => {
        const deltaMS = ticker.deltaMS;
        playerParts.forEach((parts) => {
          if (parts.moving) {
            parts.walkTime += deltaMS * 0.007;
            const swing = Math.sin(parts.walkTime);
            parts.legL.y  = 18 + swing * 6;
            parts.legR.y  = 18 - swing * 6;
            parts.armL.y  = 9  - swing * 5;
            parts.armR.y  = 9  + swing * 5;
            parts.upper.y = -Math.abs(swing) * 2;
          } else {
            parts.walkTime = 0;
            parts.legL.y  = 18;
            parts.legR.y  = 18;
            parts.armL.y  = 9;
            parts.armR.y  = 9;
            parts.upper.y = 0;
          }
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

      const localSprite = createPlayerSprite(room.id, username, true);
      localSprite.x = startX;
      localSprite.y = startY;
      const localParts = playerParts.get(room.id)!;

      room.players.forEach((p) => {
        if (p.id === room.id) return; // ne pas recréer le joueur local
        const s = createPlayerSprite(p.id, p.username, false);
        s.x = p.x; s.y = p.y;
      });

      room.onMessage((msg) => {
        if (msg.type === "player_join") {
          if (msg.player.id === room.id) return;
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
          const p = playerParts.get(msg.id);
          if (p) p.moving = msg.moving ?? true;
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

      let localX = startX;
      let localY = startY;
      let wasMoving = false;

      app.ticker.add(() => {
        let dx = 0, dy = 0, direction = "down";
        if (isDown("arrowup")    || isDown("z")) { dy = -1; direction = "up"; }
        if (isDown("arrowdown")  || isDown("s")) { dy =  1; direction = "down"; }
        if (isDown("arrowleft")  || isDown("q")) { dx = -1; direction = "left"; }
        if (isDown("arrowright") || isDown("d")) { dx =  1; direction = "right"; }

        const speed = isDown("shift") ? RUN_SPEED : WALK_SPEED;
        dx *= speed; dy *= speed;

        const isMoving = dx !== 0 || dy !== 0;
        localParts.moving = isMoving;

        if (isMoving) {
          localX = Math.max(0, Math.min(MAP_COLS * TILE_SIZE - 20, localX + dx));
          localY = Math.max(0, Math.min(MAP_ROWS * TILE_SIZE - 24, localY + dy));
          localSprite.x = localX;
          localSprite.y = localY;
          room.send("move", { x: localX, y: localY, direction, moving: true });
        } else if (wasMoving) {
          // envoie une seule fois le stop
          room.send("move", { x: localX, y: localY, direction, moving: false });
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
