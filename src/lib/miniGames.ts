// Mini-jeux de biome — moteur arcade commun (30s, score, meilleur score local)
import { Container, Graphics, Text, TextStyle } from "pixi.js";
import type { BiomeKey } from "./pixelArt";

// ---------- Config par biome ----------

type Behavior = "static" | "fall" | "flee" | "wander";

export interface MiniGameDef {
  name: string;
  desc: string;            // consigne affichée avant de jouer
  duration: number;        // ms
  spawnEvery: number;      // ms entre spawns d'items
  maxItems: number;
  itemLife: number;        // ms avant disparition (0 = infini)
  behavior: Behavior;
  itemSpeed: number;       // px/frame pour fall/flee/wander
  catchR: number;          // rayon de ramassage
  points: number;
  hazard?: {
    count: number;         // nb de dangers simultanés
    speed: number;
    penalty: number;       // points perdus (0 = étourdit à la place)
    stunMs: number;        // durée d'étourdissement (si penalty=0)
    label: string;
  };
  drawItem: (g: Graphics, t: number) => void;    // t = temps ms (pour pulser)
  drawHazard?: (g: Graphics, t: number) => void;
}

export const MINI_GAMES: Record<BiomeKey, MiniGameDef> = {
  forest: {
    name: "Cueillette express",
    desc: "Ramasse les champignons avant qu'ils disparaissent !",
    duration: 30000, spawnEvery: 900, maxItems: 8, itemLife: 5000,
    behavior: "static", itemSpeed: 0, catchR: 26, points: 1,
    drawItem: (g) => {
      g.rect(-3, -4, 6, 6).fill(0xf0e0c0);        // pied
      g.ellipse(0, -6, 8, 5).fill(0xd03030);       // chapeau
      g.circle(-3, -7, 1.7).fill(0xffffff);
      g.circle(3, -6, 1.4).fill(0xffffff);
    },
  },
  snow: {
    name: "Attrape-flocons",
    desc: "Attrape les flocons avant qu'ils touchent le sol !",
    duration: 30000, spawnEvery: 700, maxItems: 12, itemLife: 0,
    behavior: "fall", itemSpeed: 1.1, catchR: 30, points: 1,
    drawItem: (g, t) => {
      const a = 0.7 + 0.3 * Math.sin(t / 300);
      g.circle(0, 0, 5).fill({ color: 0xffffff, alpha: a });
      for (let i = 0; i < 3; i++) {
        const ang = (i * Math.PI) / 3;
        g.moveTo(-Math.cos(ang) * 8, -Math.sin(ang) * 8)
         .lineTo(Math.cos(ang) * 8, Math.sin(ang) * 8)
         .stroke({ color: 0xddeeff, width: 2, alpha: a });
      }
    },
  },
  desert: {
    name: "Chasse à l'oasis",
    desc: "Collecte les gouttes d'eau, évite les scorpions (-3) !",
    duration: 30000, spawnEvery: 1000, maxItems: 6, itemLife: 6000,
    behavior: "static", itemSpeed: 0, catchR: 26, points: 2,
    hazard: { count: 4, speed: 1.3, penalty: 3, stunMs: 0, label: "scorpion" },
    drawItem: (g, t) => {
      const s = 1 + 0.15 * Math.sin(t / 250);
      g.ellipse(0, 0, 6 * s, 8 * s).fill(0x40a0e8);
      g.circle(-2, -3, 2).fill(0x90d0ff);
    },
    drawHazard: (g) => {
      g.ellipse(0, 0, 9, 5).fill(0x503018);        // corps
      g.circle(9, -2, 3).fill(0x503018);           // queue
      g.circle(11, -5, 2).fill(0x802010);          // dard
      g.circle(-9, -2, 2.5).fill(0x604028);        // pinces
      g.circle(-9, 2, 2.5).fill(0x604028);
    },
  },
  beach: {
    name: "Course aux crabes",
    desc: "Les crabes te fuient — attrape-les !",
    duration: 30000, spawnEvery: 1400, maxItems: 5, itemLife: 0,
    behavior: "flee", itemSpeed: 1.15, catchR: 24, points: 2,
    drawItem: (g) => {
      g.ellipse(0, 0, 9, 6).fill(0xe05030);        // carapace
      g.circle(-4, -6, 2).fill(0xe05030);          // yeux
      g.circle(4, -6, 2).fill(0xe05030);
      g.circle(-4, -6, 1).fill(0x201010);
      g.circle(4, -6, 1).fill(0x201010);
      g.circle(-10, 2, 3).fill(0xc04020);          // pinces
      g.circle(10, 2, 3).fill(0xc04020);
    },
  },
  swamp: {
    name: "Lucioles du soir",
    desc: "Attrape les lucioles qui zigzaguent !",
    duration: 30000, spawnEvery: 800, maxItems: 10, itemLife: 8000,
    behavior: "wander", itemSpeed: 0.9, catchR: 28, points: 1,
    drawItem: (g, t) => {
      const glow = 0.5 + 0.5 * Math.sin(t / 180);
      g.circle(0, 0, 8).fill({ color: 0xd8f060, alpha: 0.25 * glow });
      g.circle(0, 0, 3.5).fill({ color: 0xf0ff80, alpha: 0.6 + 0.4 * glow });
      g.circle(0, 0, 1.8).fill(0xffffc0);
    },
  },
  mountain: {
    name: "Ruée vers les cristaux",
    desc: "Ramasse les cristaux, esquive les rochers qui roulent !",
    duration: 30000, spawnEvery: 1100, maxItems: 7, itemLife: 7000,
    behavior: "static", itemSpeed: 0, catchR: 26, points: 2,
    hazard: { count: 5, speed: 2.2, penalty: 0, stunMs: 1500, label: "rocher" },
    drawItem: (g, t) => {
      const a = 0.8 + 0.2 * Math.sin(t / 220);
      g.poly([0, -10, 6, -2, 3, 6, -3, 6, -6, -2]).fill({ color: 0x80d0f0, alpha: a });
      g.poly([0, -10, 2, -2, 0, 5, -2, -2]).fill({ color: 0xc0ecff, alpha: a });
    },
    drawHazard: (g) => {
      g.circle(0, 0, 10).fill(0x686060);
      g.circle(-3, -3, 3).fill(0x787070);
      g.circle(3, 2, 2.5).fill(0x585050);
    },
  },
};

// ---------- Entités ----------

interface Entity {
  g: Graphics;
  x: number; y: number;
  vx: number; vy: number;
  born: number;
  wanderT: number;
}

export interface MiniGameHooks {
  onEnd?: (score: number, best: number) => void;
}

// ---------- Moteur ----------

export class MiniGame {
  private def: MiniGameDef;
  private biome: BiomeKey;
  private world: Container;
  private stage: Container;
  private mapW: number; private mapH: number;
  private layer = new Container();
  private items: Entity[] = [];
  private hazards: Entity[] = [];
  private hud: Text;
  private toast: Text;
  private toastUntil = 0;
  private elapsed = 0;
  private spawnAcc = 0;
  private score = 0;
  private stunnedUntil = 0;
  private hooks: MiniGameHooks;
  running = false;

  constructor(biome: BiomeKey, world: Container, stage: Container, mapW: number, mapH: number, hooks: MiniGameHooks = {}) {
    this.def = MINI_GAMES[biome];
    this.biome = biome;
    this.world = world;
    this.stage = stage;
    this.mapW = mapW; this.mapH = mapH;
    this.hooks = hooks;
    this.layer.zIndex = 5;
    this.hud = new Text({ text: "", style: new TextStyle({
      fontSize: 16, fill: 0xffffff, fontFamily: "monospace", fontWeight: "bold",
      dropShadow: { color: 0x000000, blur: 3, distance: 1 },
    })});
    this.toast = new Text({ text: "", style: new TextStyle({
      fontSize: 14, fill: 0xffe080, fontFamily: "monospace",
      dropShadow: { color: 0x000000, blur: 3, distance: 1 },
    })});
  }

  get bestKey() { return `void_mg_best_${this.biome}`; }
  get best(): number {
    try { return parseInt(localStorage.getItem(this.bestKey) ?? "0", 10) || 0; } catch { return 0; }
  }

  get isStunned() { return this.elapsed < this.stunnedUntil; }

  start(px: number, py: number) {
    if (this.running) return;
    this.running = true;
    this.elapsed = 0; this.spawnAcc = 0; this.score = 0; this.stunnedUntil = 0;
    this.world.addChild(this.layer);
    this.stage.addChild(this.hud);
    this.stage.addChild(this.toast);
    this.hud.x = 20; this.hud.y = 52;
    this.toast.x = 20; this.toast.y = 76;
    // Spawn initial des dangers autour (pas sur) du joueur
    if (this.def.hazard) {
      for (let i = 0; i < this.def.hazard.count; i++) this.spawnHazard(px, py);
    }
  }

  private rand(min: number, max: number) { return min + Math.random() * (max - min); }

  private spawnItem(px: number, py: number) {
    const d = this.def;
    const g = new Graphics();
    let x: number, y: number, vx = 0, vy = 0;
    if (d.behavior === "fall") {
      // tombe depuis le haut de l'écran visible, autour du joueur
      x = px + this.rand(-380, 380);
      y = py - 320;
      vx = this.rand(-0.4, 0.4);
      vy = d.itemSpeed * this.rand(0.8, 1.3);
    } else {
      // apparaît autour du joueur (anneau 120–420 px)
      const ang = Math.random() * Math.PI * 2;
      const r = this.rand(120, 420);
      x = px + Math.cos(ang) * r;
      y = py + Math.sin(ang) * r;
      if (d.behavior === "wander") {
        const a2 = Math.random() * Math.PI * 2;
        vx = Math.cos(a2) * d.itemSpeed; vy = Math.sin(a2) * d.itemSpeed;
      }
    }
    x = Math.max(20, Math.min(this.mapW - 20, x));
    y = Math.max(20, Math.min(this.mapH - 20, y));
    g.x = x; g.y = y;
    this.layer.addChild(g);
    this.items.push({ g, x, y, vx, vy, born: this.elapsed, wanderT: 0 });
  }

  private spawnHazard(px: number, py: number) {
    const hz = this.def.hazard!;
    const g = new Graphics();
    const ang = Math.random() * Math.PI * 2;
    const r = this.rand(200, 500);
    const x = Math.max(20, Math.min(this.mapW - 20, px + Math.cos(ang) * r));
    const y = Math.max(20, Math.min(this.mapH - 20, py + Math.sin(ang) * r));
    const a2 = Math.random() * Math.PI * 2;
    g.x = x; g.y = y;
    this.layer.addChild(g);
    this.hazards.push({ g, x, y, vx: Math.cos(a2) * hz.speed, vy: Math.sin(a2) * hz.speed, born: this.elapsed, wanderT: 0 });
  }

  private showToast(text: string) {
    this.toast.text = text;
    this.toastUntil = this.elapsed + 1500;
  }

  /** Retourne true si le jeu tourne encore. */
  update(deltaMS: number, px: number, py: number): boolean {
    if (!this.running) return false;
    const d = this.def;
    this.elapsed += deltaMS;

    // Fin de partie
    if (this.elapsed >= d.duration) { this.end(); return false; }

    // Spawns
    this.spawnAcc += deltaMS;
    while (this.spawnAcc >= d.spawnEvery) {
      this.spawnAcc -= d.spawnEvery;
      if (this.items.length < d.maxItems) this.spawnItem(px, py);
    }

    // Items
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      // comportement
      if (d.behavior === "fall") {
        it.x += it.vx; it.y += it.vy;
        if (it.y > py + 340) { this.removeItem(i); continue; } // touché "le sol"
      } else if (d.behavior === "flee") {
        const ddx = it.x - px, ddy = it.y - py;
        const dist = Math.hypot(ddx, ddy);
        if (dist < 160 && dist > 0.01) {
          it.vx = (ddx / dist) * d.itemSpeed;
          it.vy = (ddy / dist) * d.itemSpeed;
        } else { it.vx *= 0.92; it.vy *= 0.92; }
        it.x += it.vx; it.y += it.vy;
      } else if (d.behavior === "wander") {
        it.wanderT += deltaMS;
        if (it.wanderT > 600) {
          it.wanderT = 0;
          const a = Math.random() * Math.PI * 2;
          it.vx = Math.cos(a) * d.itemSpeed; it.vy = Math.sin(a) * d.itemSpeed;
        }
        it.x += it.vx; it.y += it.vy;
      }
      it.x = Math.max(16, Math.min(this.mapW - 16, it.x));
      it.y = Math.max(16, Math.min(this.mapH - 16, it.y));
      it.g.x = it.x; it.g.y = it.y;
      it.g.clear();
      d.drawItem(it.g, this.elapsed + it.born);

      // expiration
      if (d.itemLife > 0 && this.elapsed - it.born > d.itemLife) { this.removeItem(i); continue; }

      // ramassage
      const cdx = it.x - px, cdy = it.y - py;
      if (!this.isStunned && cdx * cdx + cdy * cdy < d.catchR * d.catchR) {
        this.score += d.points;
        this.showToast(`+${d.points}`);
        this.removeItem(i);
      }
    }

    // Hazards
    if (d.hazard) {
      const hz = d.hazard;
      for (const h of this.hazards) {
        h.x += h.vx; h.y += h.vy;
        // rebond sur les bords de la map
        if (h.x < 20 || h.x > this.mapW - 20) h.vx *= -1;
        if (h.y < 20 || h.y > this.mapH - 20) h.vy *= -1;
        h.x = Math.max(20, Math.min(this.mapW - 20, h.x));
        h.y = Math.max(20, Math.min(this.mapH - 20, h.y));
        h.g.x = h.x; h.g.y = h.y;
        h.g.clear();
        d.drawHazard!(h.g, this.elapsed);
        // orientation crabe/scorpion : flip selon vx
        h.g.scale.x = h.vx < 0 ? -1 : 1;

        const hdx = h.x - px, hdy = h.y - py;
        if (!this.isStunned && hdx * hdx + hdy * hdy < 22 * 22) {
          if (hz.penalty > 0) {
            this.score = Math.max(0, this.score - hz.penalty);
            this.showToast(`-${hz.penalty} (${hz.label} !)`);
            this.stunnedUntil = this.elapsed + 800; // brève invulnérabilité
          } else {
            this.stunnedUntil = this.elapsed + hz.stunMs;
            this.showToast(`Étourdi ! (${hz.label})`);
          }
        }
      }
    }

    // HUD
    const left = Math.max(0, Math.ceil((d.duration - this.elapsed) / 1000));
    this.hud.text = `⏱ ${left}s   ★ ${this.score}   (record: ${Math.max(this.best, this.score)})`;
    if (this.elapsed > this.toastUntil) this.toast.text = "";

    return true;
  }

  private removeItem(i: number) {
    this.layer.removeChild(this.items[i].g);
    this.items[i].g.destroy();
    this.items.splice(i, 1);
  }

  private end() {
    this.running = false;
    const prevBest = this.best;
    const newBest = Math.max(prevBest, this.score);
    try { localStorage.setItem(this.bestKey, String(newBest)); } catch {}
    // Nettoyage
    for (const it of this.items) { it.g.destroy(); }
    for (const h of this.hazards) { h.g.destroy(); }
    this.items = []; this.hazards = [];
    this.world.removeChild(this.layer);
    this.layer.removeChildren();
    this.stage.removeChild(this.hud);
    this.stage.removeChild(this.toast);
    this.hooks.onEnd?.(this.score, newBest);
  }

  /** Nettoyage forcé (démontage du canvas). */
  destroy() {
    if (this.running) {
      this.running = false;
      for (const it of this.items) it.g.destroy();
      for (const h of this.hazards) h.g.destroy();
      this.items = []; this.hazards = [];
    }
  }
}

// ---------- Panneau de lancement (pixel art Graphics) ----------

export function drawGameSign(world: Container, x: number, y: number, def: MiniGameDef): Container {
  const c = new Container();
  c.x = x; c.y = y;
  c.zIndex = y;
  const g = new Graphics();
  // poteau
  g.rect(-3, -34, 6, 34).fill(0x7a5028);
  g.rect(-3, -34, 2, 34).fill(0x94663a);
  // panneau
  g.roundRect(-30, -58, 60, 28, 3).fill(0xc8924e);
  g.roundRect(-30, -58, 60, 28, 3).stroke({ color: 0x7a5028, width: 2 });
  g.rect(-26, -54, 52, 2).fill(0xa87840);
  // petit "!" décoratif
  g.circle(0, -47, 6).fill(0xf0c040);
  g.rect(-1.5, -50, 3, 5).fill(0x6a4a10);
  g.circle(0, -43, 1.5).fill(0x6a4a10);
  c.addChild(g);
  const lbl = new Text({ text: `${def.name}\n[E] Jouer`, style: new TextStyle({
    fontSize: 9, fill: 0xffffff, fontFamily: "monospace", align: "center",
    dropShadow: { color: 0x000000, blur: 2, distance: 1 },
  })});
  lbl.x = -lbl.width / 2; lbl.y = -80;
  c.addChild(lbl);
  world.addChild(c);
  return c;
}
