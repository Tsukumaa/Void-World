"use client";

import { useEffect, useRef } from "react";
import { Application, Graphics, Text, TextStyle, Container } from "pixi.js";
import { drawPixelCharBody, drawPixelLeg, LEG_L_X, LEG_R_X, LEG_Y, CHAR_ABOVE } from "@/lib/pixelChar";
import { type CharConfig, loadCharConfig } from "@/lib/charConfig";
import { loadDoll, tickDoll, unloadDollTextures, type PlayerDoll, type Dir as DollDir } from "@/lib/charSprite";
import { WorldRoom } from "@/hooks/useWorldRoom";
import {
  drawTree as pxTree,
  drawRock as pxRock,
  drawHouse as pxHouse,
  getHouseHitbox,
  drawFountain,
  animateFountain,
  drawLamp,
  drawBench,
  drawStatue,
  drawPortalFull as drawPortal,
  animatePortal,
  BIOME_COLORS as PORTAL_BIOME_COLORS,
  type BiomeKey,
  decorBush,
  decorFlowers,
  decorGrassTuft,
  decorPebble,
  decorSparkle,
} from "@/lib/pixelArt";

interface Props {
  room: WorldRoom;
  username: string;
  charCfg: CharConfig;
  onEnterBiome?: (biome: BiomeKey) => void;
}

const TILE_SIZE  = 32;
const MAP_COLS   = 80;
const MAP_ROWS   = 60;
const WALK_SPEED = 0.8;
const RUN_SPEED  = 1.4;

// Centre du hub
const HUB_CX = Math.floor(MAP_COLS / 2); // 40
const HUB_CY = Math.floor(MAP_ROWS / 2); // 30

const C = {
  grass:     0x7ec87a,
  grassDark: 0x6db86a,
  dirt:      0xc9a86c,
  dirtDark:  0xb8966a,
  stone:     0xb8a888,
  stoneDark: 0xa09878,
  water:     0x4a90d9,
  waterDark: 0x3a80c9,
};

type Biome = "village";
function getBiome(_col: number, _row: number): Biome { return "village"; }

const TEX = {
  village: { shades: [0x7ec87a, 0x77c073, 0x88d084], dark: 0x63ab60, tuft: 0x9bdc95, flower: [0xffffff, 0xf5d23b, 0xe96b9c, 0xb98cf0] },
};

// Map : 0=herbe, 1=chemin terre, 2=eau, 3=dalle pierre (plaza)
function generateMap(): number[][] {
  const map: number[][] = Array.from({ length: MAP_ROWS }, () => new Array(MAP_COLS).fill(0));

  // --- Plaza centrale (dalles) ---
  for (let r = HUB_CY - 5; r <= HUB_CY + 5; r++)
    for (let c = HUB_CX - 5; c <= HUB_CX + 5; c++)
      map[r][c] = 3;


  // Helper : tracer un chemin de (r0,c0) à (r1,c1) largeur w
  function path(r0: number, c0: number, r1: number, c1: number, w = 2) {
    const steps = Math.max(Math.abs(r1 - r0), Math.abs(c1 - c0));
    for (let i = 0; i <= steps; i++) {
      const r = Math.round(r0 + (r1 - r0) * i / steps);
      const cc = Math.round(c0 + (c1 - c0) * i / steps);
      for (let dr = -Math.floor(w / 2); dr <= Math.floor(w / 2); dr++)
        for (let dc = -Math.floor(w / 2); dc <= Math.floor(w / 2); dc++) {
          const tr = r + dr, tc = cc + dc;
          if (tr >= 0 && tr < MAP_ROWS && tc >= 0 && tc < MAP_COLS && map[tr][tc] !== 2)
            map[tr][tc] = 1;
        }
    }
  }

  // 4 grandes allées depuis la plaza vers chaque portail
  path(HUB_CY, HUB_CX - 5, HUB_CY, 2,          3); // W → portail Forêt
  path(HUB_CY, HUB_CX + 5, HUB_CY, MAP_COLS-3,  3); // E → portail Neige
  path(HUB_CY - 5, HUB_CX, 2,          HUB_CX,  3); // N → portail Montagne
  path(HUB_CY + 5, HUB_CX, MAP_ROWS-3, HUB_CX,  3); // S → portail Marécage

  // Allées diagonales vers les 2 autres portails (NW Désert, SE Plage)
  path(HUB_CY - 4, HUB_CX - 4, 3,          3,          2); // NW
  path(HUB_CY + 4, HUB_CX + 4, MAP_ROWS-4, MAP_COLS-4, 2); // SE

  // Petits chemins vers les groupes de maisons
  path(HUB_CY - 3, HUB_CX + 6, HUB_CY - 8, HUB_CX + 14, 2);
  path(HUB_CY + 3, HUB_CX - 6, HUB_CY + 8, HUB_CX - 14, 2);
  path(HUB_CY - 3, HUB_CX - 6, HUB_CY - 8, HUB_CX - 14, 2);
  path(HUB_CY + 3, HUB_CX + 6, HUB_CY + 8, HUB_CX + 14, 2);

  return map;
}

// Bruit déterministe 0..1
function rnd(c: number, r: number, salt: number): number {
  let h = (c * 374761393 + r * 668265263 + salt * 2246822519) >>> 0;
  h = ((h ^ (h >>> 13)) * 1274126177) >>> 0;
  return (h >>> 0) / 4294967295;
}

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


function drawTree(world: Container, cx: number, cy: number, s: number)  { pxTree(world, cx, cy, s); }
function drawRock(world: Container, cx: number, cy: number, s: number)  { pxRock(world, cx, cy, s); }
function drawHouse(world: Container, col: number, row: number, _s: number, seed: number) { pxHouse(world, col, row, TILE_SIZE, seed); }

// Arbres — bordure + bosquets autour des allées du hub (80×60)
const PLACED_TREES: [number, number][] = [
  // Bordure nord
  [1,1],[4,0],[7,1],[11,0],[14,1],[18,0],[22,1],[26,0],[30,1],[34,0],[38,1],[42,0],[46,1],[50,0],[54,1],[58,0],[62,1],[66,0],[70,1],[74,0],[78,1],
  // Bordure sud
  [1,58],[4,59],[8,58],[12,59],[16,58],[20,59],[24,58],[28,59],[32,58],[36,59],[40,58],[44,59],[48,58],[52,59],[56,58],[60,59],[64,58],[68,59],[72,58],[76,59],
  // Bordure ouest
  [0,4],[1,8],[0,13],[1,18],[0,23],[1,28],[0,33],[1,38],[0,43],[1,48],[0,53],
  // Bordure est
  [78,4],[79,8],[78,13],[79,18],[78,23],[79,28],[78,33],[79,38],[78,43],[79,48],[78,53],
  // Bosquets NW (quartier résidentiel)
  [8,8],[10,6],[13,9],[7,11],[11,12],[15,7],[9,14],
  // Bosquets NE
  [65,8],[68,6],[71,9],[67,11],[70,13],[73,7],[66,14],
  // Bosquets SW
  [8,46],[10,48],[13,51],[7,49],[11,53],[15,47],[9,52],
  // Bosquets SE
  [65,46],[68,48],[71,51],[67,49],[70,53],[73,47],[66,52],
  // Arbres le long des allées N et S
  [37,10],[43,10],[37,50],[43,50],
  [37,8],[43,8],[37,52],[43,52],
  // Petits bosquets autour de la plaza
  [28,22],[30,20],[28,24],[30,26],[50,22],[52,20],[50,24],[52,26],
  [28,38],[30,36],[28,40],[30,42],[50,38],[52,36],[50,40],[52,42],
];

const PLACED_ROCKS: [number, number][] = [
  [5,25],[6,35],[74,25],[73,35],[5,28],[74,32],
];

// Maisons groupées dans 4 quartiers autour du hub
const PLACED_HOUSES: [number, number][] = [
  // Quartier NW
  [8,10],[14,10],[8,16],
  // Quartier NE
  [56,10],[62,10],[62,16],
  // Quartier SW
  [8,42],[14,42],[8,48],
  // Quartier SE
  [56,42],[62,42],[62,48],
];

export default function GameCanvas({ room, username, charCfg, onEnterBiome }: Props) {
  const containerRef    = useRef<HTMLDivElement>(null);
  const chatInputRef    = useRef<HTMLInputElement>(null);
  const chatOpenRef     = useRef(false);
  const appRef          = useRef<Application | null>(null);
  const onEnterBiomeRef = useRef(onEnterBiome);
  const fadeRef         = useRef<{ active: boolean; alpha: number; biome: BiomeKey | null }>({ active: false, alpha: 0, biome: null });

  useEffect(() => { onEnterBiomeRef.current = onEnterBiome; }, [onEnterBiome]);

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

      // Overlay de fondu (toujours par-dessus tout)
      const fadeOverlay = new Graphics();
      app.stage.addChild(fadeOverlay);

      type Dir = "down" | "up" | "right" | "left";

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

      // Arbres hub — tous village
      for (const [c, r] of PLACED_TREES) {
        const cx   = c * TILE_SIZE + TILE_SIZE / 2;
        const cy   = r * TILE_SIZE + TILE_SIZE;
        const seed = (c * 131 + r * 73) >>> 0;
        drawTree(world, cx, cy, seed);
        world.children[world.children.length - 1].zIndex = cy;
        hitboxes.push({ kind: "circle", cx, cy: cy - 4, r: TILE_SIZE * 0.55 });
      }

      // Rochers décoratifs
      for (const [c, r] of PLACED_ROCKS) {
        const cx = c * TILE_SIZE + TILE_SIZE / 2, cy = r * TILE_SIZE + TILE_SIZE;
        const seed = (c * 197 + r * 41) >>> 0;
        drawRock(world, cx, cy, seed);
        world.children[world.children.length - 1].zIndex = cy;
        hitboxes.push({ kind: "circle", cx, cy: cy - 4, r: TILE_SIZE * 0.4 });
      }

      // Décorations de sol : buissons, fleurs, touffes
      const bushG = new Graphics();
      bushG.zIndex = 1;
      world.addChild(bushG);
      for (let r = 0; r < MAP_ROWS; r++) {
        for (let c = 0; c < MAP_COLS; c++) {
          if (mapData[r][c] !== 0) continue;
          const seed = (c * 131 + r * 97) >>> 0;
          const roll = rnd(c, r, 51);
          if (roll < 0.03) {
            decorBush(bushG, c * TILE_SIZE + 8 + Math.floor(rnd(c, r, 55) * 16), r * TILE_SIZE + 22 + Math.floor(rnd(c, r, 57) * 8), seed);
          } else if (roll < 0.09) {
            decorFlowers(bushG, c * TILE_SIZE + 4 + Math.floor(rnd(c, r, 60) * 24), r * TILE_SIZE + 8 + Math.floor(rnd(c, r, 62) * 16), seed);
          } else if (roll < 0.13) {
            decorGrassTuft(bushG, c * TILE_SIZE + 4 + Math.floor(rnd(c, r, 70) * 24), r * TILE_SIZE + 10 + Math.floor(rnd(c, r, 72) * 14), seed);
          }
        }
      }

      // Maisons pixel art — 4 quartiers
      for (const [c, r] of PLACED_HOUSES) {
        const seed = (c * 37 + r * 53) >>> 0;
        drawHouse(world, c, r, TILE_SIZE, seed);
        world.children[world.children.length - 1].zIndex = (r + 1) * TILE_SIZE;
      }

      // --- Décorations de la plaza centrale ---
      const plazaCX = HUB_CX * TILE_SIZE + TILE_SIZE / 2;
      const plazaCY = HUB_CY * TILE_SIZE + TILE_SIZE / 2;

      // Fontaine centrale
      const fountainWater = drawFountain(world, plazaCX, plazaCY);
      world.children[world.children.length - 2].zIndex = plazaCY - 1;
      world.children[world.children.length - 1].zIndex = plazaCY;
      hitboxes.push({ kind: "circle", cx: plazaCX, cy: plazaCY - 10, r: 52 });

      // 4 lampadaires aux coins de la plaza
      const lampOffsets: [number, number][] = [[-5,-5],[5,-5],[-5,5],[5,5]];
      for (const [dc, dr] of lampOffsets) {
        const lx = (HUB_CX + dc) * TILE_SIZE + TILE_SIZE / 2;
        const ly = (HUB_CY + dr) * TILE_SIZE + TILE_SIZE;
        drawLamp(world, lx, ly);
        world.children[world.children.length - 1].zIndex = ly;
        hitboxes.push({ kind: "circle", cx: lx, cy: ly - 4, r: 10 });
      }

      // Bancs le long des allées (horizontaux N/S de la plaza, verticaux E/W)
      const benchDefs: [number, number, boolean][] = [
        [HUB_CX - 9, HUB_CY - 2, true ],  // allée ouest, côté nord
        [HUB_CX - 9, HUB_CY + 2, true ],  // allée ouest, côté sud
        [HUB_CX + 9, HUB_CY - 2, true ],  // allée est, côté nord
        [HUB_CX + 9, HUB_CY + 2, true ],  // allée est, côté sud
        [HUB_CX - 2, HUB_CY - 8, false],  // allée nord, côté ouest
        [HUB_CX + 2, HUB_CY - 8, false],  // allée nord, côté est
        [HUB_CX - 2, HUB_CY + 8, false],  // allée sud, côté ouest
        [HUB_CX + 2, HUB_CY + 8, false],  // allée sud, côté est
      ];
      for (const [bc, br, horiz] of benchDefs) {
        const bx = bc * TILE_SIZE + TILE_SIZE / 2;
        const by = br * TILE_SIZE + TILE_SIZE;
        drawBench(world, bx, by, horiz);
        world.children[world.children.length - 1].zIndex = by;
        hitboxes.push({ kind: "circle", cx: bx, cy: by - 4, r: 14 });
      }

      // Urnes décoratives aux 4 coins de la plaza
      const statueDefs: [number, number][] = [
        [HUB_CX - 6, HUB_CY - 6],
        [HUB_CX + 6, HUB_CY - 6],
        [HUB_CX - 6, HUB_CY + 5],
        [HUB_CX + 6, HUB_CY + 5],
      ];
      for (const [sc, sr] of statueDefs) {
        const sx = sc * TILE_SIZE + TILE_SIZE / 2;
        const sy = sr * TILE_SIZE + TILE_SIZE;
        drawStatue(world, sx, sy);
        world.children[world.children.length - 1].zIndex = sy;
        hitboxes.push({ kind: "circle", cx: sx, cy: sy - 8, r: 16 });
      }

      // --- Portails de biomes — aux bords du hub ---
      const PORTAL_DEFS: { biome: BiomeKey; col: number; row: number }[] = [
        { biome: "forest",   col: 1,  row: 27 }, // W
        { biome: "snow",     col: 75, row: 27 }, // E
        { biome: "mountain", col: 37, row: 1  }, // N
        { biome: "swamp",    col: 37, row: 55 }, // S
        { biome: "desert",   col: 3,  row: 3  }, // NW
        { biome: "beach",    col: 73, row: 53 }, // SE
      ];

      type PortalRef = { biome: BiomeKey; cx: number; cy: number; inner: import("pixi.js").Graphics };
      const portals: PortalRef[] = [];

      for (const { biome, col, row } of PORTAL_DEFS) {
        const cx = col * TILE_SIZE + TILE_SIZE / 2;
        const cy = row * TILE_SIZE + TILE_SIZE;
        const { inner } = drawPortal(world, cx, cy, biome);
        // zIndex = cy pour la profondeur
        world.children[world.children.length - 2].zIndex = cy - 1; // outer
        world.children[world.children.length - 1].zIndex = cy;     // inner
        portals.push({ biome, cx, cy, inner });

        // Label du biome au-dessus du portail
        const lbl = new Text({
          text: PORTAL_BIOME_COLORS[biome].label,
          style: new TextStyle({ fontSize: 10, fill: 0xffffff, fontFamily: "monospace",
            dropShadow: { color: 0x000000, blur: 3, distance: 1 } }),
        });
        lbl.x = cx - lbl.width / 2;
        // Si proche du bord nord, mettre le label sous le portail, sinon au-dessus
        const portalH = 17 * 3; // PORTAL_GRID height × scale
        lbl.y = cy - portalH > 16 ? cy - portalH - 14 : cy + 8;
        lbl.zIndex = cy + 1;
        world.addChild(lbl);
      }

      // Tooltip de proximité portail
      const portalTooltip = new Container();
      portalTooltip.visible = false;
      const ttBg = new Graphics();
      ttBg.roundRect(0, 0, 120, 28, 5).fill({ color: 0x000000, alpha: 0.75 });
      const ttText = new Text({ text: "", style: new TextStyle({ fontSize: 10, fill: 0xffffff, fontFamily: "monospace" }) });
      ttText.x = 8; ttText.y = 7;
      portalTooltip.addChild(ttBg, ttText);
      app.stage.addChild(portalTooltip);

      // Joueurs — paper doll Mana Seed
      const playerSprites = new Map<string, Container>();
      const playerDolls   = new Map<string, PlayerDoll>();
      // Fallback pixel art pour les joueurs dont on ne connaît pas le perso
      type PlayerAnim = { legL: Graphics; legR: Graphics; body: Graphics; walkTime: number; step: number };
      const playerAnims = new Map<string, PlayerAnim>();

      function createFallbackSprite(id: string, name: string, isLocal = false): Container {
        const container = new Container();
        const shadow = new Graphics();
        shadow.ellipse(0, 2, 12, 5).fill({ color: 0x000000, alpha: 0.22 });
        container.addChild(shadow);
        const body = new Graphics(); drawPixelCharBody(body, isLocal); container.addChild(body);
        const legL = new Graphics(); drawPixelLeg(legL, isLocal, false); legL.x = LEG_L_X; legL.y = LEG_Y; container.addChild(legL);
        const legR = new Graphics(); drawPixelLeg(legR, isLocal, true);  legR.x = LEG_R_X; legR.y = LEG_Y; container.addChild(legR);
        const label = new Text({ text: name, style: new TextStyle({ fontSize: 9, fill: 0xffffff, fontFamily: "monospace", dropShadow: { color: 0x000000, blur: 2, distance: 1 } }) });
        label.x = -label.width / 2; label.y = -(CHAR_ABOVE + 4);
        container.addChild(label);
        playerAnims.set(id, { legL, legR, body, walkTime: 0, step: 0 });
        world.addChild(container);
        playerSprites.set(id, container);
        return container;
      }

      // ticker global : animation portails + fontaine + walk cycle
      let portalTime = 0;
      app.ticker.add((ticker) => {
        portalTime += ticker.deltaMS;
        animateFountain(fountainWater, plazaCX, plazaCY, portalTime);
        for (const p of portals) animatePortal(p.inner, p.cx, p.cy, p.biome, portalTime);
      });

      app.ticker.add((ticker) => {
        playerAnims.forEach((anim, id) => {
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
      const maxX = MAP_COLS * TILE_SIZE - 20;
      const maxY = MAP_ROWS * TILE_SIZE - 24;
      const rawX = selfState?.x ?? (MAP_COLS * TILE_SIZE) / 2;
      const rawY = selfState?.y ?? (MAP_ROWS * TILE_SIZE) / 2;
      const startX = Math.min(Math.max(rawX, 20), maxX);
      const startY = Math.min(Math.max(rawY, 20), maxY);

      // Perso local — paper doll Mana Seed
      const localDoll = await loadDoll(charCfg, username, true, world, app);
      if (destroyed) { app.destroy(true); return; }
      playerDolls.set(room.id, localDoll);
      playerSprites.set(room.id, localDoll.container);
      localDoll.container.x = startX;
      localDoll.container.y = startY;

      // Autres joueurs — pixel art fallback (on ne connaît pas leur config)
      room.players.forEach((p) => {
        if (p.id === room.id) return;
        const s = createFallbackSprite(p.id, p.username, false);
        s.x = p.x; s.y = p.y;
      });

      room.onMessage((msg) => {
        if (msg.type === "player_join") {
          if (msg.player.id === room.id) return;
          const s = createFallbackSprite(msg.player.id, msg.player.username, false);
          s.x = msg.player.x; s.y = msg.player.y;
        }
        if (msg.type === "player_leave") {
          const s = playerSprites.get(msg.id);
          if (s) { world.removeChild(s); playerSprites.delete(msg.id); playerAnims.delete(msg.id); playerDolls.delete(msg.id); }
        }
        if (msg.type === "player_move") {
          const s = playerSprites.get(msg.id);
          if (s) { s.x = msg.x; s.y = msg.y; s.zIndex = msg.y; }
        }
        if (msg.type === "chat") {
          const s = msg.id === room.id ? localDoll.container : playerSprites.get(msg.id);
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

      const BIOME_MM_COLOR: Record<Biome, number> = { village: 0x6ab36a };

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

      let localDir: Dir = "down";
      app.ticker.add((ticker) => {
        let dx = 0, dy = 0;
        let dir: Dir = localDir;
        if (isDown("arrowup")    || isDown("z")) { dy = -1; dir = "up"; }
        if (isDown("arrowdown")  || isDown("s")) { dy =  1; dir = "down"; }
        if (isDown("arrowleft")  || isDown("q")) { dx = -1; dir = "left"; }
        if (isDown("arrowright") || isDown("d")) { dx =  1; dir = "right"; }
        localDir = dir;

        const speed = isDown("shift") ? RUN_SPEED : WALK_SPEED;
        dx *= speed; dy *= speed;

        const isMoving = dx !== 0 || dy !== 0;

        if (isMoving) {
          // tentative axe X puis Y séparément (sliding le long des obstacles)
          const nx = Math.max(0, Math.min(MAP_COLS * TILE_SIZE - 20, localX + dx));
          const ny = Math.max(0, Math.min(MAP_ROWS * TILE_SIZE - 24, localY + dy));
          if (!collidesAt(nx, localY)) localX = nx;
          if (!collidesAt(localX, ny)) localY = ny;
          localDoll.container.x = localX;
          localDoll.container.y = localY;
          localDoll.container.zIndex = localY;
          tickDoll(localDoll, true, dir as DollDir, ticker.deltaMS);
          room.send("move", { x: localX, y: localY, direction: dir, moving: true });
          try { localStorage.setItem("void_pos_main", JSON.stringify({ x: localX, y: localY })); } catch {}
        } else {
          localDoll.container.zIndex = localY;
          tickDoll(localDoll, false, dir as DollDir, ticker.deltaMS);
        }
        if (wasMoving && !isMoving) {
          room.send("move", { x: localX, y: localY, direction: dir, moving: false });
          try { localStorage.setItem("void_pos_main", JSON.stringify({ x: localX, y: localY })); } catch {}
        }
        wasMoving = isMoving;

        // Proximité portail → tooltip
        const PORTAL_R = 48;
        let nearPortal: PortalRef | null = null;
        for (const p of portals) {
          const ddx = localX - p.cx, ddy = localY - p.cy;
          if (ddx * ddx + ddy * ddy < PORTAL_R * PORTAL_R) { nearPortal = p; break; }
        }
        if (nearPortal && !fadeRef.current.active) {
          ttText.text = `Entrer : ${PORTAL_BIOME_COLORS[nearPortal.biome].label} [E]`;
          ttBg.clear().roundRect(0, 0, ttText.width + 16, 28, 5).fill({ color: 0x000000, alpha: 0.78 });
          portalTooltip.visible = true;
          portalTooltip.x = app!.screen.width / 2 - ttText.width / 2;
          portalTooltip.y = app!.screen.height - 100;
          if (keys.has("e")) {
            keys.delete("e"); // consomme la touche
            fadeRef.current = { active: true, alpha: 0, biome: nearPortal.biome };
          }
        } else if (!fadeRef.current.active) {
          portalTooltip.visible = false;
        }

        // Fondu de transition
        if (fadeRef.current.active) {
          portalTooltip.visible = false;
          fadeRef.current.alpha = Math.min(1, fadeRef.current.alpha + 0.025);
          fadeOverlay.clear()
            .rect(0, 0, app!.screen.width, app!.screen.height)
            .fill({ color: 0x000000, alpha: fadeRef.current.alpha });
          if (fadeRef.current.alpha >= 1 && fadeRef.current.biome) {
            onEnterBiomeRef.current?.(fadeRef.current.biome);
          }
        }

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
      if (app && app.renderer) {
        // Unload les textures du doll AVANT de détruire le contexte WebGL
        // → BiomeCanvas pourra les recharger dans son nouveau contexte
        unloadDollTextures(charCfg).finally(() => { if (app?.renderer) app.destroy(true); });
      }
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
