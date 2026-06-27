"use client";

import { useEffect, useRef } from "react";
import { Application, Graphics, Text, TextStyle, Container, Assets, Texture, Rectangle, TilingSprite } from "pixi.js";
import { WorldRoom } from "@/hooks/useWorldRoom";
import { drawPixelCharBody, drawPixelLeg, LEG_L_X, LEG_R_X, LEG_Y, CHAR_ABOVE } from "@/lib/pixelChar";
import { type CharConfig, loadCharConfig } from "@/lib/charConfig";
import { loadDoll, tickDoll, type PlayerDoll, type Dir as DollDir } from "@/lib/charSprite";

interface Props {
  room: WorldRoom;
  username: string;
  ownerName: string;
  charCfg?: CharConfig;
  onExit: () => void;
  onChangeChar?: () => void;
}

const TILE = 32;
const WALK = 1.0;
const RUN  = 1.8;

// Dimensions de la scène (tiles)
const COLS = 46;
const ROWS = 28;

// Intérieur (anneau de murs)
const INT = { left: 2, right: 19, top: 2, bottom: 22 };
// Jardin (anneau de clôture)
const GARD = { left: 23, right: 43, top: 3, bottom: 23 };
// Couloir reliant intérieur ↔ jardin (porte)
const LINK = { left: 19, right: 23, top: 11, bottom: 13 };
// Parcelle de terre cultivable (jardin)
const SOIL = { left: 26, right: 31, top: 7, bottom: 11 };
// Porte de sortie (vers le monde) sur le mur bas de l'intérieur
const EXIT_COL = 10;

const C = {
  wood:      0xb98a5a,
  woodDark:  0xa87a4c,
  wall:      0xe8dcc0,
  wallDark:  0xcdbf9e,
  wallTop:   0x8a7a5a,
  grass:     0x7ec87a,
  grassDark: 0x6db86a,
  path:      0xc9a86c,
  pathDark:  0xb8966a,
  fence:     0x9c6b3f,
  fenceDark: 0x7e5430,
  soil:      0x6b4a2c,
  soilDark:  0x5a3d22,
  door:      0x7a4f2a,
  shadow:    0x000000,
};

function walkable(c: number, r: number): boolean {
  // intérieur (sol)
  if (c >= INT.left + 1 && c <= INT.right - 1 && r >= INT.top + 1 && r <= INT.bottom - 1) return true;
  // jardin (herbe)
  if (c >= GARD.left + 1 && c <= GARD.right - 1 && r >= GARD.top + 1 && r <= GARD.bottom - 1) return true;
  // couloir
  if (c >= LINK.left && c <= LINK.right && r >= LINK.top && r <= LINK.bottom) return true;
  return false;
}

export default function HouseCanvas({ room, username, ownerName, charCfg, onExit, onChangeChar }: Props) {
  const resolvedCfg = charCfg ?? loadCharConfig();
  const containerRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const chatOpenRef  = useRef(false);
  const appRef       = useRef<Application | null>(null);
  const exitedRef    = useRef(false);

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
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    const onBlur  = () => keys.clear();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup",   onKeyUp);
    document.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur",    onBlur);

    (async () => {
      app = new Application();
      appRef.current = app;
      await app.init({
        width: window.innerWidth,
        height: window.innerHeight,
        antialias: false,
        resizeTo: window,
        backgroundColor: 0x2a2a35,
      });
      if (destroyed || !containerRef.current) { app.destroy(true); return; }
      containerRef.current.appendChild(app.canvas);

      const world = new Container();
      app.stage.addChild(world);

      // ---- Herbe Sprout Lands (fond jardin + couloir) ----
      const grassTex = await Assets.load("/tiles/sl_grass.png") as Texture;
      grassTex.source.scaleMode = "nearest";
      const grassTile = new Texture({ source: grassTex.source, frame: new Rectangle(16, 16, 16, 16) });
      const SL = TILE / 16;

      // Fond global herbe (élimine le noir)
      const bgGrass = new TilingSprite({ texture: grassTile, width: COLS * TILE, height: ROWS * TILE });
      bgGrass.tileScale.set(SL);
      world.addChild(bgGrass);

      // ---- Sol parquet intérieur ----
      const floor = new Graphics();
      // planches de bois (barres horizontales alternées)
      for (let r = INT.top + 1; r <= INT.bottom - 1; r++) {
        for (let c = INT.left + 1; c <= INT.right - 1; c++) {
          const x = c * TILE, y = r * TILE;
          const plank = Math.floor(r / 2) % 2 === 0;
          floor.rect(x, y, TILE, TILE).fill(plank ? 0xc8924e : 0xb8804a);
          // lignes de planches horizontales
          floor.rect(x, y, TILE, 2).fill(0x8a5a2e);
          if ((c - INT.left) % 3 === 0) floor.rect(x, y + 2, 2, TILE - 4).fill(0x8a5a2e);
        }
      }
      // couloir (dalle de pierre)
      for (let r = LINK.top; r <= LINK.bottom; r++) {
        for (let c = LINK.left; c <= LINK.right; c++) {
          const x = c * TILE, y = r * TILE, ck = (c + r) % 2 === 0;
          floor.rect(x, y, TILE, TILE).fill(ck ? 0xc8a870 : 0xb89860);
          floor.rect(x, y, TILE, 2).fill(0x8a6a40);
          floor.rect(x, y, 2, TILE).fill(0x8a6a40);
        }
      }
      world.addChild(floor);

      // ---- Terre cultivable (par-dessus l'herbe) ----
      const soilG = new Graphics();
      for (let r = SOIL.top; r <= SOIL.bottom; r++) {
        for (let c = SOIL.left; c <= SOIL.right; c++) {
          const x = c * TILE, y = r * TILE, ck = (c + r) % 2 === 0;
          soilG.rect(x, y, TILE, TILE).fill(ck ? 0x6b4a2c : 0x5a3d22);
          // texture terre
          soilG.rect(x + 4, y + 6, 6, 3).fill(0x7a5534);
          soilG.rect(x + 18, y + 14, 8, 3).fill(0x4e3018);
          soilG.rect(x + 8, y + 22, 5, 3).fill(0x7a5534);
        }
      }
      world.addChild(soilG);

      // ---- Murs intérieur (pixel art bois + pierre) ----
      const wallG = new Graphics();
      function drawWallTile(c: number, r: number) {
        const x = c * TILE, y = r * TILE;
        // pierre de base
        wallG.rect(x, y, TILE, TILE).fill(0xd4b896);
        // joints horizontaux
        wallG.rect(x, y + 10, TILE, 2).fill(0xa07850);
        wallG.rect(x, y + 22, TILE, 2).fill(0xa07850);
        // bande sombre en haut (ombrage)
        wallG.rect(x, y, TILE, 5).fill(0x8a6040);
      }
      for (let c = INT.left; c <= INT.right; c++) {
        drawWallTile(c, INT.top);
        if (c !== EXIT_COL) drawWallTile(c, INT.bottom);
      }
      for (let r = INT.top + 1; r < INT.bottom; r++) {
        drawWallTile(INT.left, r);
        if (r < LINK.top || r > LINK.bottom) drawWallTile(INT.right, r);
      }
      world.addChild(wallG);

      // ---- Porte de sortie ----
      const exitDoor = new Graphics();
      const edx = EXIT_COL * TILE, edy = INT.bottom * TILE;
      exitDoor.rect(edx, edy, TILE, TILE).fill(0x7a4f2a);
      exitDoor.rect(edx + 5, edy + 3, TILE - 10, TILE - 3).fill(0x5a3a1c);
      exitDoor.rect(edx + 5, edy + 3, TILE - 10, 2).fill(0x3a2010);
      exitDoor.circle(edx + TILE - 8, edy + TILE / 2, 2).fill(0xf0c040);
      world.addChild(exitDoor);
      const exitLabel = new Text({ text: "Sortie", style: new TextStyle({ fontSize: 9, fill: 0xffffff, fontFamily: "monospace", dropShadow: { color: 0x000000, blur: 2, distance: 1 } }) });
      exitLabel.x = edx + TILE / 2 - exitLabel.width / 2;
      exitLabel.y = edy + TILE + 2;
      world.addChild(exitLabel);

      // ---- Clôture jardin (pixel art bois) ----
      const fenceG = new Graphics();
      function drawFenceTile(c: number, r: number, horiz = true) {
        const x = c * TILE, y = r * TILE;
        if (horiz) {
          // latte horizontale
          fenceG.rect(x, y + 8, TILE, 5).fill(0xc8924e);
          fenceG.rect(x, y + 19, TILE, 5).fill(0xc8924e);
          fenceG.rect(x, y + 8, TILE, 1).fill(0x7a5028);
          fenceG.rect(x, y + 19, TILE, 1).fill(0x7a5028);
          // poteaux
          fenceG.rect(x + 4, y + 4, 5, TILE - 4).fill(0xb07c3c);
          fenceG.rect(x + TILE - 9, y + 4, 5, TILE - 4).fill(0xb07c3c);
          fenceG.rect(x + 4, y + 4, 5, 3).fill(0xd4a060);
          fenceG.rect(x + TILE - 9, y + 4, 5, 3).fill(0xd4a060);
        } else {
          // poteau vertical seul
          fenceG.rect(x + TILE / 2 - 3, y, 6, TILE).fill(0xb07c3c);
          fenceG.rect(x + TILE / 2 - 3, y, 6, 3).fill(0xd4a060);
        }
      }
      for (let c = GARD.left; c <= GARD.right; c++) {
        drawFenceTile(c, GARD.top);
        drawFenceTile(c, GARD.bottom);
      }
      for (let r = GARD.top + 1; r < GARD.bottom; r++) {
        if (r < LINK.top || r > LINK.bottom) drawFenceTile(GARD.left, r, false);
        drawFenceTile(GARD.right, r, false);
      }
      world.addChild(fenceG);

      type Dir = "down" | "up" | "right" | "left";

      // ---- Joueurs — paper doll local + pixel art fallback autres ----
      const playerSprites = new Map<string, Container>();
      const playerDolls   = new Map<string, PlayerDoll>();
      type PlayerAnim = { legL: Graphics; legR: Graphics; body: Graphics; walkTime: number; step: number };
      const playerAnims = new Map<string, PlayerAnim>();

      function createFallbackSprite(id: string, name: string, isLocal = false) {
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

      function showChatBubble(sprite: Container, text: string) {
        const existing = sprite.getChildByLabel("bubble");
        if (existing) sprite.removeChild(existing);
        const bubble = new Container();
        bubble.label = "bubble";
        const txt = new Text({ text, style: new TextStyle({ fontSize: 10, fill: 0x222222, fontFamily: "monospace", wordWrap: true, wordWrapWidth: 120 }) });
        const pad = 5, bw = txt.width + pad * 2, bh = txt.height + pad * 2;
        const bg = new Graphics();
        bg.roundRect(0, 0, bw, bh, 4).fill({ color: 0xffffff, alpha: 0.92 });
        bg.moveTo(bw / 2 - 4, bh).lineTo(bw / 2 + 4, bh).lineTo(bw / 2, bh + 6).fill({ color: 0xffffff, alpha: 0.92 });
        txt.x = pad; txt.y = pad;
        bubble.addChild(bg); bubble.addChild(txt);
        bubble.x = 10 - bw / 2; bubble.y = -bh - 42;
        sprite.addChild(bubble);
        let elapsed = 0;
        const tickFn = (t: { deltaMS: number }) => {
          elapsed += t.deltaMS;
          if (elapsed > 4000) bubble.alpha = Math.max(0, 1 - (elapsed - 4000) / 800);
          if (elapsed > 4800) { sprite.removeChild(bubble); appRef.current?.ticker.remove(tickFn); }
        };
        appRef.current?.ticker.add(tickFn);
      }

      // spawn : toujours à l'entrée (au-dessus de la porte) pour éviter de ressortir en boucle
      let localX = (EXIT_COL * TILE) + 6;
      let localY = (INT.bottom - 4) * TILE;

      const localDoll = await loadDoll(resolvedCfg, username, true, world, app);
      if (destroyed) { app.destroy(true); return; }
      playerDolls.set(room.id, localDoll);
      playerSprites.set(room.id, localDoll.container);
      localDoll.container.x = localX; localDoll.container.y = localY;

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
          if (s) { s.x = msg.x; s.y = msg.y; }
        }
        if (msg.type === "chat") {
          const s = msg.id === room.id ? localDoll.container : playerSprites.get(msg.id);
          if (s) showChatBubble(s, msg.text);
        }
      });

      let wasMoving = false;
      let localDir: Dir = "down";

      // point "pieds" pour collisions
      const feet = (x: number, y: number) => ({ c: Math.floor((x + 10) / TILE), r: Math.floor((y + 28) / TILE) });

      app.ticker.add((ticker) => {
        let dx = 0, dy = 0;
        let dir: Dir = localDir;
        if (isDown("arrowup")    || isDown("z")) { dy = -1; dir = "up"; }
        if (isDown("arrowdown")  || isDown("s")) { dy =  1; dir = "down"; }
        if (isDown("arrowleft")  || isDown("q")) { dx = -1; dir = "left"; }
        if (isDown("arrowright") || isDown("d")) { dx =  1; dir = "right"; }
        localDir = dir;
        const speed = isDown("shift") ? RUN : WALK;
        dx *= speed; dy *= speed;

        const isMoving = dx !== 0 || dy !== 0;

        if (isMoving) {
          const nx = localX + dx;
          const fx = feet(nx, localY);
          if (walkable(fx.c, fx.r)) localX = nx;
          const ny = localY + dy;
          const fy = feet(localX, ny);
          if (walkable(fy.c, fy.r)) localY = ny;

          localDoll.container.x = localX; localDoll.container.y = localY;
          tickDoll(localDoll, true, dir as DollDir, ticker.deltaMS);
          room.send("move", { x: localX, y: localY, direction: dir, moving: true });

          // détection porte de sortie
          const f = feet(localX, localY);
          if (!exitedRef.current && f.c === EXIT_COL && f.r >= INT.bottom - 1) {
            exitedRef.current = true;
            onExit();
          }
        } else {
          tickDoll(localDoll, false, dir as DollDir, ticker.deltaMS);
        }
        if (wasMoving && !isMoving) {
          room.send("move", { x: localX, y: localY, direction: dir, moving: false });
        }
        wasMoving = isMoving;

        // caméra
        const vw = app!.screen.width, vh = app!.screen.height;
        world.x = Math.min(0, Math.max(vw - COLS * TILE, vw / 2 - localX - 10));
        world.y = Math.min(0, Math.max(vh - ROWS * TILE, vh / 2 - localY - 12));
      });
    })();

    return () => {
      destroyed = true;
      window.removeEventListener("keydown",  onKeyDown);
      window.removeEventListener("keyup",    onKeyUp);
      document.removeEventListener("keyup",  onKeyUp);
      window.removeEventListener("blur",     onBlur);
      if (app && app.renderer) app.destroy(true);
    };
  }, [room]);

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", position: "relative" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

      {/* Bandeau */}
      <div style={{ position: "absolute", top: 16, left: 16, background: "rgba(0,0,0,0.55)", color: "#fff", padding: "8px 14px", borderRadius: 10, fontFamily: "monospace", fontSize: 13, backdropFilter: "blur(4px)" }}>
        🏠 {ownerName === username ? "Ta maison" : `Maison de ${ownerName}`}
      </div>

      {/* Bouton sortir */}
      <button
        onClick={() => { if (!exitedRef.current) { exitedRef.current = true; onExit(); } }}
        style={{ position: "absolute", top: 16, right: 16, background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 10, color: "#fff", padding: "8px 14px", cursor: "pointer", fontSize: 13, fontFamily: "monospace", backdropFilter: "blur(4px)" }}
      >
        ← Sortir
      </button>

      {/* Bouton miroir (changer de personnage) */}
      {onChangeChar && (
        <button
          onClick={onChangeChar}
          style={{ position: "absolute", top: 60, right: 16, background: "rgba(80,60,180,0.7)", border: "1px solid rgba(180,160,255,0.4)", borderRadius: 10, color: "#fff", padding: "8px 14px", cursor: "pointer", fontSize: 13, fontFamily: "monospace", backdropFilter: "blur(4px)" }}
        >
          🪞 Changer de perso
        </button>
      )}

      {/* Chat */}
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
              e.currentTarget.value = ""; chatOpenRef.current = false; e.currentTarget.blur();
            }
          }}
          style={{ width: "100%", padding: "8px 12px", borderRadius: 20, background: "rgba(0,0,0,0.55)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)", outline: "none", fontSize: 13, fontFamily: "monospace", backdropFilter: "blur(4px)" }}
        />
      </div>
    </div>
  );
}
