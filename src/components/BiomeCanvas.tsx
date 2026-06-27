"use client";

import { useEffect, useRef } from "react";
import { Application, Graphics, Container, Text, TextStyle } from "pixi.js";
import { WorldRoom } from "@/hooks/useWorldRoom";
import { drawPortalFull, animatePortal, BIOME_COLORS, type BiomeKey } from "@/lib/pixelArt";
import { drawPixelCharBody, drawPixelLeg, LEG_L_X, LEG_R_X, LEG_Y, CHAR_ABOVE } from "@/lib/pixelChar";
import { type CharConfig, loadCharConfig } from "@/lib/charConfig";
import { loadDoll, tickDoll, unloadDollTextures, type PlayerDoll, type Dir as DollDir } from "@/lib/charSprite";

interface Props {
  room: WorldRoom;
  username: string;
  biome: BiomeKey;
  charCfg?: CharConfig;
  onExit: () => void;
}

const TILE_SIZE  = 32;
const MAP_COLS   = 80;
const MAP_ROWS   = 60;
const WALK_SPEED = 0.8;
const RUN_SPEED  = 1.4;
const PLAYER_R   = 7;

const BIOME_THEME: Record<BiomeKey, { bg: number; ground: number; groundDark: number; accent: number; label: string }> = {
  forest:   { bg: 0x2d5a27, ground: 0x3a7a32, groundDark: 0x2e6228, accent: 0x1a3d18, label: "Forêt" },
  snow:     { bg: 0xb8d4e8, ground: 0xd8eef8, groundDark: 0xc0d8ec, accent: 0xa0c0d8, label: "Neige" },
  desert:   { bg: 0xc8a050, ground: 0xe0b868, groundDark: 0xc8a050, accent: 0xa87838, label: "Désert" },
  beach:    { bg: 0x4a90d9, ground: 0xe8d878, groundDark: 0xd0c060, accent: 0x3a80c9, label: "Plage" },
  swamp:    { bg: 0x3a5a28, ground: 0x4a6a38, groundDark: 0x384e28, accent: 0x2a4020, label: "Marécage" },
  mountain: { bg: 0x7a8898, ground: 0x9aa8b8, groundDark: 0x7a8898, accent: 0x5a6878, label: "Montagne" },
};

// Simple pseudo-random
function rnd(x: number, y: number) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

export default function BiomeCanvas({ room, username, biome, charCfg, onExit }: Props) {
  const resolvedCfg = charCfg ?? loadCharConfig();
  const containerRef    = useRef<HTMLDivElement>(null);
  const appRef          = useRef<Application | null>(null);
  const onExitRef       = useRef(onExit);
  const fadeRef         = useRef<{ active: boolean; alpha: number; dir: "in" | "out" }>({ active: true, alpha: 1, dir: "in" });

  useEffect(() => { onExitRef.current = onExit; }, [onExit]);

  useEffect(() => {
    let app: Application | null = null;
    let destroyed = false;

    const keys = new Set<string>();
    const isDown = (k: string) => keys.has(k);
    const onKeyDown = (e: KeyboardEvent) => { keys.add(e.key.toLowerCase()); };
    const onKeyUp   = (e: KeyboardEvent) => { keys.delete(e.key.toLowerCase()); };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup",   onKeyUp);

    const theme = BIOME_THEME[biome];

    (async () => {
      app = new Application();
      appRef.current = app;
      await app.init({
        width: window.innerWidth, height: window.innerHeight,
        antialias: false, resizeTo: window,
        backgroundColor: theme.bg,
      });
      if (destroyed || !containerRef.current) { app.destroy(true); return; }
      containerRef.current.appendChild(app.canvas);

      const world = new Container();
      world.sortableChildren = true;
      app.stage.addChild(world);

      const fadeOverlay = new Graphics();
      app.stage.addChild(fadeOverlay);

      type Dir = "down" | "up" | "right" | "left";

      // ---- Sol procédural ----
      const groundG = new Graphics();
      groundG.zIndex = 0;
      for (let r = 0; r < MAP_ROWS; r++) {
        for (let c = 0; c < MAP_COLS; c++) {
          const v = rnd(c, r);
          const color = v < 0.3 ? theme.groundDark : v < 0.7 ? theme.ground : theme.accent;
          groundG.rect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE).fill(color);
        }
      }
      world.addChild(groundG);

      // Portail de retour Hub — même rendu que dans le hub
      const exitX = Math.floor(MAP_COLS / 2) * TILE_SIZE + TILE_SIZE / 2;
      const exitY = Math.floor(MAP_ROWS / 2) * TILE_SIZE;
      const { inner: exitInner } = drawPortalFull(world, exitX, exitY, biome);
      world.children[world.children.length - 2].zIndex = exitY - 1;
      world.children[world.children.length - 1].zIndex = exitY;

      // Label au-dessus
      const exitLbl = new Text({
        text: `${BIOME_COLORS[biome].label}  [E] → Hub`,
        style: new TextStyle({ fontSize: 10, fill: 0xffffff, fontFamily: "monospace",
          dropShadow: { color: 0x000000, blur: 3, distance: 1 } }),
      });
      exitLbl.x = exitX - exitLbl.width / 2;
      exitLbl.y = exitY - 17 * 3 - 18;
      exitLbl.zIndex = exitY - 2;
      world.addChild(exitLbl);

      // Label biome (HUD)
      const biomeLbl = new Text({
        text: theme.label,
        style: new TextStyle({ fontSize: 18, fill: 0xffffff, fontFamily: "monospace", fontWeight: "bold",
          dropShadow: { color: 0x000000, blur: 4, distance: 2 } }),
      });
      biomeLbl.x = 20; biomeLbl.y = 20;
      app.stage.addChild(biomeLbl);

      // Joueurs — paper doll Mana Seed (local) + pixel art fallback (autres)
      const playerSprites = new Map<string, Container>();
      const playerDolls   = new Map<string, PlayerDoll>();
      type PlayerAnim = { legL: Graphics; legR: Graphics; body: Graphics; walkTime: number; step: number };
      const playerAnims = new Map<string, PlayerAnim>();

      function createFallbackSprite(id: string, name: string, isLocal = false): Container {
        const c = new Container();
        const shadow = new Graphics();
        shadow.ellipse(0, 2, 12, 5).fill({ color: 0x000000, alpha: 0.22 });
        c.addChild(shadow);
        const body = new Graphics(); drawPixelCharBody(body, isLocal); c.addChild(body);
        const legL = new Graphics(); drawPixelLeg(legL, isLocal, false); legL.x = LEG_L_X; legL.y = LEG_Y; c.addChild(legL);
        const legR = new Graphics(); drawPixelLeg(legR, isLocal, true);  legR.x = LEG_R_X; legR.y = LEG_Y; c.addChild(legR);
        const lbl = new Text({ text: name, style: new TextStyle({ fontSize: 8, fill: 0xffffff, fontFamily: "monospace",
          dropShadow: { color: 0x000000, blur: 2, distance: 1 } }) });
        lbl.x = -lbl.width / 2; lbl.y = -(CHAR_ABOVE + 4);
        c.addChild(lbl);
        world.addChild(c);
        playerSprites.set(id, c);
        playerAnims.set(id, { legL, legR, body, walkTime: 0, step: 0 });
        return c;
      }

      // Joueur local
      const startX = exitX + 80;
      const startY = exitY;
      const localDoll = await loadDoll(resolvedCfg, username, true, world, app);
      if (destroyed) { app.destroy(true); return; }
      playerDolls.set(room.id, localDoll);
      playerSprites.set(room.id, localDoll.container);
      localDoll.container.x = startX; localDoll.container.y = startY;

      // Autres joueurs existants
      room.players.forEach((p, id) => {
        if (id === room.id) return;
        const c = createFallbackSprite(id, p.username, false);
        c.x = p.x; c.y = p.y;
      });

      room.onMessage((msg) => {
        if (msg.type === "player_join") {
          if (msg.player.id === room.id) return;
          const c = createFallbackSprite(msg.player.id, msg.player.username, false);
          c.x = msg.player.x; c.y = msg.player.y;
        }
        if (msg.type === "player_leave") {
          const c = playerSprites.get(msg.id);
          if (c) { world.removeChild(c); playerSprites.delete(msg.id); playerAnims.delete(msg.id); playerDolls.delete(msg.id); }
        }
        if (msg.type === "player_move") {
          const c = playerSprites.get(msg.id);
          if (c && msg.id !== room.id) { c.x = msg.x; c.y = msg.y; }
        }
      });

      const EXIT_R = 52;
      let localX = startX, localY = startY;
      let moveTimer = 0;
      let portalTime = 0;
      let exitTriggered = false;

      app.ticker.add((ticker) => {
        portalTime += ticker.deltaMS;
        animatePortal(exitInner, exitX, exitY, biome, portalTime);
        // Fondu d'entrée/sortie
        const fd = fadeRef.current;
        if (fd.dir === "in" && fd.alpha > 0) {
          fd.alpha = Math.max(0, fd.alpha - 0.03);
          fadeOverlay.clear().rect(0, 0, app!.screen.width, app!.screen.height).fill({ color: 0x000000, alpha: fd.alpha });
          if (fd.alpha <= 0) fd.active = false;
          return; // ne pas bouger pendant le fondu d'entrée
        }
        if (fd.dir === "out") {
          fd.alpha = Math.min(1, fd.alpha + 0.025);
          fadeOverlay.clear().rect(0, 0, app!.screen.width, app!.screen.height).fill({ color: 0x000000, alpha: fd.alpha });
          if (fd.alpha >= 1 && !exitTriggered) { exitTriggered = true; onExitRef.current(); }
          return;
        }

        // Mouvement
        let dx = 0, dy = 0;
        if (isDown("arrowup")    || isDown("z")) dy = -1;
        if (isDown("arrowdown")  || isDown("s")) dy =  1;
        if (isDown("arrowleft")  || isDown("q")) dx = -1;
        if (isDown("arrowright") || isDown("d")) dx =  1;
        const speed = isDown("shift") ? RUN_SPEED : WALK_SPEED;
        dx *= speed; dy *= speed;

        const nx = Math.max(PLAYER_R, Math.min(MAP_COLS * TILE_SIZE - PLAYER_R, localX + dx));
        const ny = Math.max(PLAYER_R, Math.min(MAP_ROWS * TILE_SIZE - PLAYER_R, localY + dy));
        localX = nx; localY = ny;

        // Animation perso local
        localDoll.container.x = localX; localDoll.container.y = localY;
        localDoll.container.zIndex = localY;

        // Walk animation (paper doll)
        let dir: DollDir = 'down';
        if (dy < 0) dir = 'up'; else if (dy > 0) dir = 'down';
        else if (dx < 0) dir = 'left'; else if (dx > 0) dir = 'right';
        tickDoll(localDoll, dx !== 0 || dy !== 0, dir, ticker.deltaMS);

        // Envoi mouvement (throttlé)
        moveTimer += ticker.deltaMS;
        if (moveTimer > 50) {
          room.send("move", { x: localX, y: localY, direction: "down", moving: dx !== 0 || dy !== 0 });
          moveTimer = 0;
        }

        // Proximité portail de sortie
        const dex = localX - exitX, dey = localY - (exitY - 40);
        if (dex * dex + dey * dey < EXIT_R * EXIT_R && isDown("e")) {
          keys.delete("e");
          fadeRef.current = { active: true, alpha: 0, dir: "out" };
        }

        // Caméra
        const vw = app!.screen.width, vh = app!.screen.height;
        world.x = Math.min(0, Math.max(vw - MAP_COLS * TILE_SIZE, vw / 2 - localX));
        world.y = Math.min(0, Math.max(vh - MAP_ROWS * TILE_SIZE, vh / 2 - localY));
      });

      // Fondu d'entrée initial
      fadeOverlay.rect(0, 0, app.screen.width, app.screen.height).fill({ color: 0x000000, alpha: 1 });
    })();

    return () => {
      destroyed = true;
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup",   onKeyUp);
      appRef.current?.destroy(true);
      appRef.current = null;
    };
  }, [room, username, biome]);

  return <div ref={containerRef} style={{ width: "100vw", height: "100vh" }} />;
}
