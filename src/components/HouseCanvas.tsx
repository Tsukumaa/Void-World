"use client";

import { useEffect, useRef } from "react";
import { Application, Graphics, Text, TextStyle, Container } from "pixi.js";
import { WorldRoom } from "@/hooks/useWorldRoom";

interface Props {
  room: WorldRoom;
  username: string;
  ownerName: string;   // à qui appartient la maison
  onExit: () => void;  // retour au monde
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

export default function HouseCanvas({ room, username, ownerName, onExit }: Props) {
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

      // ---- Sol ----
      const ground = new Graphics();
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const x = c * TILE, y = r * TILE;
          const checker = (c + r) % 2 === 0;
          // couloir
          if (c >= LINK.left && c <= LINK.right && r >= LINK.top && r <= LINK.bottom) {
            ground.rect(x, y, TILE, TILE).fill(checker ? C.pathDark : C.path);
          // intérieur
          } else if (c >= INT.left + 1 && c <= INT.right - 1 && r >= INT.top + 1 && r <= INT.bottom - 1) {
            ground.rect(x, y, TILE, TILE).fill(checker ? C.woodDark : C.wood);
          // jardin
          } else if (c >= GARD.left + 1 && c <= GARD.right - 1 && r >= GARD.top + 1 && r <= GARD.bottom - 1) {
            // terre cultivable
            if (c >= SOIL.left && c <= SOIL.right && r >= SOIL.top && r <= SOIL.bottom) {
              ground.rect(x, y, TILE, TILE).fill(checker ? C.soilDark : C.soil);
            } else {
              ground.rect(x, y, TILE, TILE).fill(checker ? C.grassDark : C.grass);
            }
          }
        }
      }
      world.addChild(ground);

      // ---- Murs intérieur ----
      const walls = new Graphics();
      function wallTile(c: number, r: number) {
        const x = c * TILE, y = r * TILE;
        walls.rect(x, y, TILE, TILE).fill(C.wallDark);
        walls.rect(x, y, TILE, 8).fill(C.wallTop); // ombrage haut
      }
      for (let c = INT.left; c <= INT.right; c++) {
        // mur haut
        wallTile(c, INT.top);
        // mur bas (sauf porte de sortie)
        if (c !== EXIT_COL) wallTile(c, INT.bottom);
      }
      for (let r = INT.top; r <= INT.bottom; r++) {
        // mur gauche
        wallTile(INT.left, r);
        // mur droit (sauf gap couloir)
        if (r < LINK.top || r > LINK.bottom) wallTile(INT.right, r);
      }
      world.addChild(walls);

      // ---- Porte de sortie (mur bas) ----
      const exitDoor = new Graphics();
      const edx = EXIT_COL * TILE, edy = INT.bottom * TILE;
      exitDoor.rect(edx, edy, TILE, TILE).fill(C.door);
      exitDoor.rect(edx + 6, edy + 4, TILE - 12, TILE - 4).fill(0x5a3a1c);
      exitDoor.circle(edx + TILE - 9, edy + TILE / 2, 2).fill(0xf0c040);
      world.addChild(exitDoor);
      const exitLabel = new Text({ text: "Sortie", style: new TextStyle({ fontSize: 9, fill: 0xffffff, fontFamily: "monospace", dropShadow: { color: 0x000000, blur: 2, distance: 1 } }) });
      exitLabel.x = edx + TILE / 2 - exitLabel.width / 2;
      exitLabel.y = edy + TILE + 2;
      world.addChild(exitLabel);

      // ---- Clôture jardin ----
      const fence = new Graphics();
      function fencePost(c: number, r: number) {
        const x = c * TILE, y = r * TILE;
        fence.rect(x + 4, y + 6, 6, TILE - 6).fill(C.fenceDark);
        fence.rect(x + TILE - 10, y + 6, 6, TILE - 6).fill(C.fenceDark);
        fence.rect(x + 2, y + 10, TILE - 4, 4).fill(C.fence);
        fence.rect(x + 2, y + 20, TILE - 4, 4).fill(C.fence);
      }
      for (let c = GARD.left; c <= GARD.right; c++) {
        fencePost(c, GARD.top);
        fencePost(c, GARD.bottom);
      }
      for (let r = GARD.top; r <= GARD.bottom; r++) {
        // clôture gauche (sauf gap couloir)
        if (r < LINK.top || r > LINK.bottom) fencePost(GARD.left, r);
        fencePost(GARD.right, r);
      }
      world.addChild(fence);

      // ---- Joueurs (multijoueur) ----
      const playerSprites = new Map<string, Container>();
      const playerParts   = new Map<string, { legL: Container; legR: Container; armL: Container; armR: Container; upper: Container; walkTime: number; moving: boolean; }>();

      function createPlayerSprite(id: string, name: string, isLocal: boolean) {
        const container = new Container();
        const color    = isLocal ? 0x6c63ff : 0x43aa8b;
        const pantsCol = isLocal ? 0x4a4080 : 0x2d6a55;
        const skin     = 0xffd6a5;

        const shadow = new Graphics();
        shadow.ellipse(10, 30, 9, 4).fill({ color: C.shadow, alpha: 0.18 });
        container.addChild(shadow);

        const legL = new Container();
        legL.addChild(new Graphics().roundRect(0, 0, 6, 10, 2).fill(pantsCol));
        legL.x = 3; legL.y = 18; container.addChild(legL);
        const legR = new Container();
        legR.addChild(new Graphics().roundRect(0, 0, 6, 10, 2).fill(pantsCol));
        legR.x = 11; legR.y = 18; container.addChild(legR);

        const upper = new Container();
        upper.addChild(new Graphics().roundRect(2, 8, 16, 12, 3).fill(color));
        upper.addChild(new Graphics().roundRect(6, 7, 8, 4, 2).fill(isLocal ? 0x9b8fff : 0x5ecba1));
        const armL = new Container();
        armL.addChild(new Graphics().roundRect(0, 0, 4, 9, 2).fill(color));
        armL.x = 0; armL.y = 9; upper.addChild(armL);
        const armR = new Container();
        armR.addChild(new Graphics().roundRect(0, 0, 4, 9, 2).fill(color));
        armR.x = 16; armR.y = 9; upper.addChild(armR);
        upper.addChild(new Graphics().roundRect(3, -10, 14, 14, 5).fill(skin));
        upper.addChild(new Graphics().circle(7, -4, 1.5).fill(0x333333));
        upper.addChild(new Graphics().circle(13, -4, 1.5).fill(0x333333));
        upper.addChild(new Graphics().roundRect(3, -12, 14, 6, 4).fill(isLocal ? 0x3d2b1f : 0x2b3d1f));
        container.addChild(upper);

        const label = new Text({ text: name, style: new TextStyle({ fontSize: 9, fill: 0xffffff, fontFamily: "monospace", dropShadow: { color: 0x000000, blur: 2, distance: 1 } }) });
        label.x = 10 - label.width / 2; label.y = -24;
        container.addChild(label);

        playerParts.set(id, { legL, legR, armL, armR, upper, walkTime: 0, moving: false });
        world.addChild(container);
        playerSprites.set(id, container);
        return container;
      }

      // animation
      app.ticker.add((ticker) => {
        const dt = ticker.deltaMS;
        playerParts.forEach((p) => {
          if (p.moving) {
            p.walkTime += dt * 0.007;
            const s = Math.sin(p.walkTime);
            p.legL.y = 18 + s * 6; p.legR.y = 18 - s * 6;
            p.armL.y = 9 - s * 5;  p.armR.y = 9 + s * 5;
            p.upper.y = -Math.abs(s) * 2;
          } else {
            p.walkTime = 0;
            p.legL.y = 18; p.legR.y = 18; p.armL.y = 9; p.armR.y = 9; p.upper.y = 0;
          }
        });
      });

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

      const localSprite = createPlayerSprite(room.id, username, true);
      localSprite.x = localX; localSprite.y = localY;
      const localParts = playerParts.get(room.id)!;

      room.players.forEach((p) => {
        if (p.id === room.id) return;
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
          if (s) { world.removeChild(s); playerSprites.delete(msg.id); playerParts.delete(msg.id); }
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

      let wasMoving = false;

      // point "pieds" pour collisions
      const feet = (x: number, y: number) => ({ c: Math.floor((x + 10) / TILE), r: Math.floor((y + 28) / TILE) });

      app.ticker.add(() => {
        let dx = 0, dy = 0, direction = "down";
        if (isDown("arrowup")    || isDown("z")) { dy = -1; direction = "up"; }
        if (isDown("arrowdown")  || isDown("s")) { dy =  1; direction = "down"; }
        if (isDown("arrowleft")  || isDown("q")) { dx = -1; direction = "left"; }
        if (isDown("arrowright") || isDown("d")) { dx =  1; direction = "right"; }
        const speed = isDown("shift") ? RUN : WALK;
        dx *= speed; dy *= speed;

        const isMoving = dx !== 0 || dy !== 0;
        localParts.moving = isMoving;

        if (isMoving) {
          // collision par axe
          const nx = localX + dx;
          const fx = feet(nx, localY);
          if (walkable(fx.c, fx.r)) localX = nx;
          const ny = localY + dy;
          const fy = feet(localX, ny);
          if (walkable(fy.c, fy.r)) localY = ny;

          localSprite.x = localX; localSprite.y = localY;
          room.send("move", { x: localX, y: localY, direction, moving: true });

          // détection porte de sortie
          const f = feet(localX, localY);
          if (!exitedRef.current && f.c === EXIT_COL && f.r >= INT.bottom - 1) {
            exitedRef.current = true;
            onExit();
          }
        } else if (wasMoving) {
          room.send("move", { x: localX, y: localY, direction, moving: false });
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
