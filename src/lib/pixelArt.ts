import { Graphics, Container } from "pixi.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SHADOW = 0x000000;

function cellFilled(rows: string[], r: number, c: number): boolean {
  if (r < 0 || r >= rows.length) return false;
  const row = rows[r];
  if (c < 0 || c >= row.length) return false;
  const ch = row[c];
  return ch !== "." && ch !== " ";
}

function drawGrid(
  g: Graphics,
  rows: string[],
  pal: Record<string, number>,
  pixel: number,
  cx: number,
  baseY: number,
  outline?: number
) {
  const maxW = Math.max(...rows.map((r) => r.length));
  const startX = Math.round(cx - (maxW * pixel) / 2);
  const startY = Math.round(baseY - rows.length * pixel);

  // Contour sombre auto : chaque case vide bordant une case pleine devient une bordure
  if (outline !== undefined) {
    for (let r = -1; r <= rows.length; r++) {
      for (let c = -1; c <= maxW; c++) {
        if (cellFilled(rows, r, c)) continue;
        if (
          cellFilled(rows, r - 1, c) || cellFilled(rows, r + 1, c) ||
          cellFilled(rows, r, c - 1) || cellFilled(rows, r, c + 1)
        ) {
          g.rect(startX + c * pixel, startY + r * pixel, pixel, pixel).fill(outline);
        }
      }
    }
  }

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      if (ch === "." || ch === " ") continue;
      const color = pal[ch];
      if (color === undefined) continue;
      g.rect(startX + c * pixel, startY + r * pixel, pixel, pixel).fill(color);
    }
  }
}

function shadow(g: Graphics, cx: number, cy: number, rx: number, ry: number, alpha = 0.15) {
  g.ellipse(cx, cy + 2, rx, ry).fill({ color: SHADOW, alpha });
}

function pick<T>(arr: T[], seed: number): T {
  return arr[((seed % arr.length) + arr.length) % arr.length];
}

function noise1(seed: number, i: number): number {
  let h = (seed * 2654435761 + i * 40503) >>> 0;
  h = ((h ^ (h >>> 13)) * 1274126177) >>> 0;
  return (h >>> 0) / 4294967295;
}

// ===========================================================================
// DÉCORATIONS DE SOL (dessinées dans un Graphics partagé)
// ===========================================================================
// Buisson A — arrondi classique avec reflets
const BUSH_A = [
  "....LLL.....",
  "..LLmmmLL...",
  ".LmmmmmmmL..",
  "LmmmmmmmmmL.",
  "LmLmmmmLmmL.",
  ".LmmmmmmmmL.",
  "..ddmmmdd...",
  "....ddd.....",
  ".....s......",
];
// Buisson B — avec baies rouges
const BUSH_B = [
  "....LLL.....",
  "..LLmmmLL...",
  ".LmmRmmRmL..",
  "LmmmmmmmmmL.",
  "LmRmmmmmRmL.",
  ".LmmmmmmmL..",
  "..ddmmmdd...",
  ".....s......",
];
// Buisson C — buisson fleuri
const BUSH_C = [
  "....LLL.....",
  "..LLmFmLL...",
  ".LmmmmmmmL..",
  "LmFmmmmmFmL.",
  "LmmmmFmmmL..",
  ".LmmmmmmmL..",
  "..ddmmmdd...",
  ".....s......",
];
// Buisson D — petit touffu
const BUSH_D = [
  "...LLL....",
  "..LmmmL...",
  ".LmmmmmL..",
  "LmmmmmmmL.",
  ".ddmmmdd..",
  "...ddd....",
  "....s.....",
];

const BUSH_SHAPES = [BUSH_A, BUSH_B, BUSH_C, BUSH_D];
const BUSH_PALS = [
  { m: 0x5fb04f, L: 0x9de06a, d: 0x357a2c, R: 0xc03838, F: 0xfff080, s: 0x7a4f2a },
  { m: 0x6cbf57, L: 0xa8e87a, d: 0x4a9640, R: 0x9040c0, F: 0xffcce0, s: 0x7a4f2a },
  { m: 0x4a9e42, L: 0x88cc5e, d: 0x2e7025, R: 0xff8030, F: 0xffffff, s: 0x7a4f2a },
  { m: 0x58a84e, L: 0x94d46c, d: 0x387030, R: 0xe04040, F: 0xffee80, s: 0x7a4f2a },
];

export function decorBush(g: Graphics, cx: number, baseY: number, seed: number) {
  const shape = BUSH_SHAPES[seed % BUSH_SHAPES.length];
  const pal   = BUSH_PALS[(seed >> 3) % BUSH_PALS.length];
  const scale = 2 + (seed % 2);
  drawGrid(g, shape, pal, scale, cx, baseY, 0x1a3a12);
}

const FLOWER_COLORS = [0xff6b9c, 0xffd23b, 0xffffff, 0xb98cf0, 0xff8c42, 0x6cc2ff];

export function decorFlowers(g: Graphics, cx: number, baseY: number, seed: number) {
  const n = 2 + (seed % 3);
  for (let k = 0; k < n; k++) {
    const off = (k - (n - 1) / 2) * 7 + (noise1(seed, k) * 4 - 2);
    const fx = Math.round(cx + off);
    const fy = Math.round(baseY - 6 - noise1(seed, k + 9) * 6);
    const col = FLOWER_COLORS[Math.floor(noise1(seed, k + 3) * FLOWER_COLORS.length)];
    // tige
    g.rect(fx, fy, 2, 8).fill(0x3f8c38);
    // pétales (croix)
    g.rect(fx - 2, fy - 4, 2, 2).fill(col);
    g.rect(fx + 2, fy - 4, 2, 2).fill(col);
    g.rect(fx, fy - 6, 2, 2).fill(col);
    g.rect(fx, fy - 2, 2, 2).fill(col);
    g.rect(fx, fy - 4, 2, 2).fill(0xffe08a);
  }
}

export function decorGrassTuft(g: Graphics, cx: number, baseY: number, seed: number, color = 0x5fb04f) {
  const blades = 3 + (seed % 3);
  for (let k = 0; k < blades; k++) {
    const bx = Math.round(cx + (k - blades / 2) * 4 + noise1(seed, k) * 2);
    const hgt = 6 + Math.floor(noise1(seed, k + 7) * 6);
    g.rect(bx, baseY - hgt, 2, hgt).fill(color);
    g.rect(bx - 2, baseY - hgt + 3, 2, hgt - 3).fill(color);
  }
}

export function decorPebble(g: Graphics, cx: number, baseY: number, seed: number) {
  const pal = pick(ROCK_PALS, seed);
  const s = pick([2, 2, 3], seed >> 1);
  drawGrid(g, ["www", "wggd", "dddd", ".dd."], { ...pal, w: pal.w }, s, cx, baseY, 0x3a3a40);
}

export function decorSparkle(g: Graphics, cx: number, baseY: number, seed: number) {
  const fx = Math.round(cx + noise1(seed, 1) * 10 - 5);
  const fy = Math.round(baseY - 6 - noise1(seed, 2) * 8);
  g.rect(fx, fy - 2, 2, 6).fill(0xffffff);
  g.rect(fx - 2, fy, 6, 2).fill(0xffffff);
  g.rect(fx, fy, 2, 2).fill(0xcfe6ff);
}

// ===========================================================================
// MONTAGNE — grande, procédurale et pixelisée (sommet enneigé, relief)
// width/height en pixels écran. cx = centre, baseY = pied.
// ===========================================================================
export function drawMountain(
  world: Container,
  cx: number,
  baseY: number,
  width: number,
  height: number,
  seed: number
) {
  const g = new Graphics();
  const STEP = 5; // taille d'un bloc (pixel art)
  const half = width / 2;
  const cols = Math.ceil(width / STEP);
  const snowLine = height * 0.48;

  // Profil de crête (parabole + bruit pour le relief déchiqueté)
  const ridge: number[] = [];
  for (let i = 0; i <= cols; i++) {
    const t = (i / cols) * 2 - 1; // -1..1
    let h = height * (1 - t * t * 0.82);
    h += Math.sin(i * 0.6 + seed * 0.13) * height * 0.05;
    h += Math.sin(i * 0.21 + seed) * height * 0.045;
    h += (noise1(seed, i) * 2 - 1) * height * 0.04;
    ridge.push(Math.max(12, h));
  }

  // ombre au sol
  g.ellipse(cx, baseY + 4, half * 0.85, 16).fill({ color: SHADOW, alpha: 0.16 });

  for (let i = 0; i < cols; i++) {
    const h = ridge[i];
    const x = cx - half + i * STEP;
    const t = i / cols;
    const nz = noise1(seed, i + 911);

    // roche : plus claire à gauche, plus sombre à droite (lumière)
    let rock: number;
    if (t < 0.42) rock = nz < 0.5 ? 0x9aa085 : 0x8b9176;
    else if (t < 0.6) rock = nz < 0.5 ? 0x808468 : 0x767a60;
    else rock = nz < 0.5 ? 0x686b52 : 0x5e6149;
    g.rect(x, baseY - h, STEP, h).fill(rock);

    // sommet enneigé
    if (h > snowLine) {
      let snowH = (h - snowLine) * 0.55 + noise1(seed, i + 5) * 10;
      snowH = Math.min(snowH, h);
      g.rect(x, baseY - h, STEP, snowH).fill(nz < 0.5 ? 0xeef3f8 : 0xdde7f1);
      // bord inférieur de la neige (ombre douce)
      g.rect(x, baseY - h + snowH - STEP, STEP, STEP).fill(0xccd8e6);
    }
  }

  // crevasses / stries de roche
  for (let k = 0; k < 3; k++) {
    const ci = Math.floor((0.28 + 0.2 * k + noise1(seed, k) * 0.08) * cols);
    const h = ridge[ci] ?? 0;
    const x = cx - half + ci * STEP;
    g.rect(x, baseY - h * 0.55, STEP, h * 0.5).fill({ color: 0x4e5140, alpha: 0.45 });
  }

  world.addChild(g);
}

// ===========================================================================
// ARBRE FEUILLU (chêne) — 2 formes, 3 palettes, tailles variables
// ===========================================================================
const OAK_A = [
  "......HHaabb......",
  "....HHaaaaabbbb....",
  "...HHaaaaaabbbbc...",
  "..hHaaaaaaabbbbcc..",
  ".hHaaaaaaaabbbbccc.",
  ".haaaaaaaaabbbbccc.",
  "haaaaaaaaaabbbbbccc",
  "haaaaaaaaaabbbbbccc",
  "haaaaaaaaaabbbbbbcc",
  ".haaaaaaaaabbbbbcc.",
  ".haaaaaaaabbbcccc..",
  "..aaaaaaabbbcccc...",
  "...aaaabbbbccc.....",
  "....bbbbbbcc.......",
  "......ttuutt.......",
  "......tkuutt.......",
  "......ttuukt.......",
  ".....uttttttu......",
];
const OAK_B = [
  ".....HHabb.....",
  "...HHaaaabbb...",
  "..hHaaaaabbbc..",
  ".hHaaaaaabbbcc.",
  ".haaaaaaabbbcc.",
  "haaaaaaaabbbbcc",
  "haaaaaaaabbbbcc",
  ".haaaaaabbbccc.",
  "..aaaaabbbccc..",
  "...aaabbbcc....",
  "....bbbcc......",
  ".....tuut......",
  ".....tkut......",
  ".....ttut......",
  "....uttttu.....",
];
const OAK_PALS = [
  { H: 0x9ed86a, a: 0x6cc24a, b: 0x4a9e3f, c: 0x317528, h: 0x86d65f, t: 0x7a5230, u: 0x5e3e22, k: 0x916841 },
  { H: 0x86cc5a, a: 0x57b04a, b: 0x3f8c38, c: 0x276423, h: 0x78c85a, t: 0x6e4a2c, u: 0x523620, k: 0x855c38 },
  { H: 0xb6e57e, a: 0x8fce5a, b: 0x6cb04a, c: 0x47842e, h: 0xa6dd70, t: 0x8a5e38, u: 0x6e4626, k: 0xa1724a },
];

// petites touffes d'herbe au pied d'un objet (style Stardew)
function baseTuft(g: Graphics, cx: number, cy: number, scale: number, color: number) {
  const s = scale;
  const spots = [-4, -1, 2];
  for (const off of spots) {
    const bx = cx + off * s;
    g.rect(bx, cy - s * 2, s, s * 2).fill(color);
    g.rect(bx - s, cy - s, s, s).fill(color);
    g.rect(bx + s, cy - s, s, s).fill(color);
  }
}

export function drawTree(world: Container, cx: number, cy: number, seed = 0) {
  const g = new Graphics();
  const shape = pick([OAK_A, OAK_B], seed);
  const pal = pick(OAK_PALS, seed >> 1);
  const scale = pick([3, 3, 4, 4, 5], seed >> 3);
  shadow(g, cx, cy, 5 * scale, 2 * scale, 0.16);
  baseTuft(g, cx, cy, scale, pal.b);
  drawGrid(g, shape, pal, scale, cx, cy, 0x20381a);
  world.addChild(g);
}

// ===========================================================================
// CACTUS (désert) — tailles variables
// ===========================================================================
const CACTUS = [
  "....ee....",
  "...egge...",
  "...egge...",
  "h..egge..h",
  "hh.egge.hh",
  "ggeeggeegg",
  "ggeeggeegg",
  ".geeggeeg.",
  "...egge...",
  "...egge...",
  "...egge...",
  "...egge...",
  "..eggge...",
  "..eggge...",
];
const CACTUS_PAL = { e: 0x4f9e4a, g: 0x6fc06a, h: 0x4f9e4a };

export function drawCactus(world: Container, cx: number, cy: number, seed = 0) {
  const g = new Graphics();
  const scale = pick([3, 3, 4], seed);
  shadow(g, cx, cy, 4 * scale, 1.5 * scale);
  drawGrid(g, CACTUS, CACTUS_PAL, scale, cx, cy, 0x2e4a2a);
  world.addChild(g);
}

// ===========================================================================
// PALMIER (plage)
// ===========================================================================
const PALM = [
  "..ll....ll..",
  ".llll..llll.",
  "llllllllllll",
  ".llgg..ggll.",
  "...lg..gl...",
  "....tttt....",
  "....tuut....",
  "....tuut....",
  "....tuut....",
  "....tuut....",
  "....tuut....",
  "...tuuut....",
];
const PALM_PAL = { l: 0x4db848, g: 0x3a9636, t: 0xa0784a, u: 0x7d5c34 };

export function drawPalmTree(world: Container, cx: number, cy: number, seed = 0) {
  const g = new Graphics();
  const scale = pick([3, 4, 4], seed);
  shadow(g, cx, cy, 4 * scale, 1.5 * scale);
  drawGrid(g, PALM, PALM_PAL, scale, cx, cy, 0x223d1c);
  world.addChild(g);
}

// ===========================================================================
// SAPIN ENNEIGÉ (neige)
// ===========================================================================
const SNOW_TREE = [
  ".......ss.......",
  "......swws......",
  ".....sggggs.....",
  "....ggwwwwgg....",
  "....gggggggg....",
  "...sggggggggs...",
  "..ggwwwwwwwwgg..",
  "..gggggggggggg..",
  ".sggggggggggggs.",
  "ggwwwwwwwwwwwwgg",
  "gggggggggggggggg",
  ".....ttuutt.....",
  ".....ttuutt.....",
];
const SNOW_TREE_PAL = { g: 0x2f7a3a, w: 0xeef4fb, s: 0xdfeaf5, t: 0x6e4a2c, u: 0x553820 };

export function drawSnowTree(world: Container, cx: number, cy: number, seed = 0) {
  const g = new Graphics();
  const scale = pick([3, 3, 4], seed);
  shadow(g, cx, cy, 4 * scale, 1.5 * scale, 0.12);
  drawGrid(g, SNOW_TREE, SNOW_TREE_PAL, scale, cx, cy, 0x1c3322);
  world.addChild(g);
}

// ===========================================================================
// ARBRE DES MARAIS
// ===========================================================================
const SWAMP_TREE = [
  "...ddccdd...",
  "..dccccccd..",
  ".dcceeeccd..",
  ".cceeeeeccd.",
  ".cceeeeeccd.",
  "..cceeeccm..",
  "...mccmm....",
  "....tuut....",
  "....tuut....",
  "...mtuutm...",
  "..mmtuutmm..",
  ".mm.tuut.mm.",
];
const SWAMP_TREE_PAL = { c: 0x4a7a30, d: 0x3d6a26, e: 0x5a8a3a, m: 0x6fae45, t: 0x5a4a2a, u: 0x44371e };

export function drawSwampTree(world: Container, cx: number, cy: number, seed = 0) {
  const g = new Graphics();
  const scale = pick([3, 4], seed);
  shadow(g, cx, cy, 4 * scale, 1.5 * scale);
  drawGrid(g, SWAMP_TREE, SWAMP_TREE_PAL, scale, cx, cy, 0x223317);
  world.addChild(g);
}

// ===========================================================================
// ROCHER — 2 palettes, tailles variables
// ===========================================================================
const ROCK = [
  "...wwww...",
  "..wgggdd..",
  ".wggggddd.",
  "wgggggdddd",
  "wgggggdddd",
  ".dddddddd.",
];
const ROCK_PALS = [
  { g: 0xa6a6a6, d: 0x7d7d7d, w: 0xc4c4c4 },
  { g: 0x9a8f80, d: 0x6f6558, w: 0xb8ad9d },
];

export function drawRock(world: Container, cx: number, cy: number, seed = 0) {
  const g = new Graphics();
  const pal = pick(ROCK_PALS, seed);
  const scale = pick([2, 3, 3, 4], seed >> 1);
  shadow(g, cx, cy, 5 * scale, 2 * scale);
  drawGrid(g, ROCK, pal, scale, cx, cy, 0x3a3a40);
  world.addChild(g);
}

// ===========================================================================
// ROCHERS DE MONTAGNE — 4 formes, palette variable, neige optionnelle
// ===========================================================================
const MT_A = [ // pic pointu haut
  "........www........",
  ".......wwwww.......",
  "......gwwwwwg......",
  ".....gwwwwwwwg.....",
  "....ggwwwwwwwgg....",
  "...gggggwwwgggg....",
  "..gggggggggdddgg...",
  ".ggggggggdddddddg..",
  "gggggggdddddddddgg.",
  ".ddddddddddddddd...",
];
const MT_B = [ // colline large aplatie
  "......wwwwww......",
  ".....wwwwwwww.....",
  "....gwwwwwwwwg....",
  "...gggwwwwwggg....",
  "..gggggggggdddg...",
  ".gggggggddddddgg..",
  "gggggdddddddddddg.",
  ".ddddddddddddddd..",
];
const MT_C = [ // petite roche trapue
  "....www....",
  "...gwwwg...",
  "..ggwwwgg..",
  ".ggggggggg.",
  "ggggddddggg",
  ".ddddddddd.",
];
const MT_D = [ // amas de blocs
  "..www...www..",
  ".gwwwg.gwwwg.",
  "ggwwwgggwwwgg",
  "gggggggddddgg",
  "ggdddddddddgg",
  ".ddddddddddd.",
];

const MT_SHAPES = [MT_A, MT_B, MT_C, MT_D];
const MT_PALS = [
  { g: 0x8a9068, d: 0x6a7050, w: 0xeef4fa }, // vert-gris classique
  { g: 0x9a9888, d: 0x787060, w: 0xf0f6fc }, // beige-gris
  { g: 0x7a8870, d: 0x5a6850, w: 0xe8f2f8 }, // vert sombre
  { g: 0x9090a0, d: 0x6a6a80, w: 0xf8faff }, // gris-bleu (enneigé)
];

export function drawMountainRock(world: Container, cx: number, cy: number, seed = 0) {
  const g = new Graphics();
  const shape = MT_SHAPES[seed % MT_SHAPES.length];
  const pal   = MT_PALS[(seed >> 2) % MT_PALS.length];
  const scale = [3, 4, 4, 5, 3][(seed >> 1) % 5];
  const cols  = shape[0].length;
  shadow(g, cx, cy, cols * scale * 0.45, cols * scale * 0.15, 0.2);
  drawGrid(g, shape, pal, scale, cx, cy, 0x3a3d2c);
  world.addChild(g);
}

// ===========================================================================
// MAISON — toits de couleurs variées, tailles variables, cheminée
// ===========================================================================
const HOUSE = [
  "........rrrrrrrr.mm.....",
  ".......rrrrrrrrrrmm.....",
  "......rrrrrrrrrrrr......",
  ".....rrrrrrrrrrrrrr.....",
  "....rrrrrrrrrrrrrrrr....",
  "...rrrrrrrrrrrrrrrrrr...",
  "..rrrrrrrrrrrrrrrrrrrr..",
  ".rrrrrrrrrrrrrrrrrrrrrr.",
  "kkkkkkkkkkkkkkkkkkkkkkkk",
  "wwwwwwwwwwwwwwwwwwwwwwww",
  "wwwwwwwwwwwwwwwwwwwwwwww",
  "wwwbbbbwwwwwwwwwwbbbbwww",
  "wwwbGgbwwwwwwwwwwbGgbwww",
  "wwwbggbwwwwwwwwwwbggbwww",
  "wwwbbbbwwwwwwwwwwbbbbwww",
  "wwwwwwwwwddddddwwwwwwwww",
  "wwwwwwwwwdoooedwwwwwwwww",
  "wwwwwwwwwdoooedwwwwwwwww",
  "wwwwwwwwwdoooedwwwwwwwww",
  "vvvvvvvvvdoooedvvvvvvvvv",
];

// Variante B — maison large avec 3 fenêtres et poutres apparentes
const HOUSE_B = [
  "......RrRrRrRrRrRrRrRrRrRr.....",
  ".....rRrRrRrRrRrRrRrRrRrRrRr...",
  "....RrRrRrRrRrRrRrRrRrRrRrRrRr.",
  "...rRrRrRrRrRrRrRrRrRrRrRrRrRrr",
  "..RrRrRrRrRrRrRrRrRrRrRrRrRrRrR",
  ".kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk",
  ".WWwWWwWWwWWwWWwWWwWWwWWwWWwWWwWW",
  ".wWwwWwwWwwWwwWwwWwwWwwWwwWwwWwwW",
  ".WWwbbbbWWwWWwbbbbWWwWWwbbbbWWwWWw",
  ".wWwbGGbwWwWwwbGGbwWwWwwbGGbwWwwW",
  ".WWwbGgbWWwWWwbGgbWWwWWwbGgbWWwWWw",
  ".wWwbbbbwWwWwwbbbbwWwWwwbbbbwWwwW",
  ".WWwWWwWWwWdddddddWWwWWwWWwWWwWWw",
  ".vvVvvVvvVvdooooedvVvvVvvVvvVvvVv",
];

// Variante C — petite maison avec cheminée
const HOUSE_C = [
  "..Mm....................",
  "..mM....................",
  ".....RrRrRrRrRrRrRrRr..",
  "....rRrRrRrRrRrRrRrRrr.",
  "...RrRrRrRrRrRrRrRrRrRr",
  "..rRrRrRrRrRrRrRrRrRrRr",
  ".kkkkkkkkkkkkkkkkkkkkkk.",
  ".WWwWWwWWwWWwWWwWWwWWwW.",
  ".wWwwWwwWwwWwwWwwWwwWww.",
  ".WWwbbbbWWwWWwbbbbWWwWW.",
  ".wWwbGGbwWwWwwbGGbwWwwW.",
  ".WWwbGgbWWwWWwbGgbWWwWW.",
  ".wWwbbbbwWwdddwbbbbwWwwW.",
  ".vvVvvVvvVdoeodvVvvVvvVv.",
];

const HOUSE_SHAPES = [HOUSE, HOUSE_B, HOUSE_C];

const ROOF_VARIANTS = [
  { r: 0xc0392b, R: 0x9c2f24, k: 0x7a1e14 }, // rouge brique
  { r: 0x3b6fb0, R: 0x2f5990, k: 0x1e3c6a }, // bleu ardoise
  { r: 0x2f9e8f, R: 0x267f73, k: 0x185e55 }, // vert-bleu
  { r: 0x8a6a3a, R: 0x6f5430, k: 0x4e3820 }, // tuile brun
  { r: 0x7d5aa6, R: 0x654a86, k: 0x4a3462 }, // violet
];
const WALL_VARIANTS = [
  { w: 0xf0ddb0, W: 0xc8a870, v: 0xb09058, V: 0x806438 }, // bois chaud
  { w: 0xe8d8c0, W: 0xbca07a, v: 0xa08860, V: 0x786040 }, // bois beige
  { w: 0xddd0b8, W: 0xb09878, v: 0x9e8060, V: 0x745c3a }, // bois gris
];
const HOUSE_FIXED = {
  m: 0x8a7a6a, M: 0x5a4a3a,
  b: 0x5a4020, g: 0x9cd8f0, G: 0xd0f0ff,
  d: 0x7a4f2a, o: 0x5e3c1e, e: 0xf0c040,
};

export function drawHouse(world: Container, col: number, row: number, tileSize: number, seed = 0) {
  const shape = HOUSE_SHAPES[seed % HOUSE_SHAPES.length];
  const roof  = ROOF_VARIANTS[(seed >> 2) % ROOF_VARIANTS.length];
  const wall  = WALL_VARIANTS[(seed >> 5) % WALL_VARIANTS.length];
  const scale = [3, 4, 4][seed % 3];
  const pal   = { ...HOUSE_FIXED, ...roof, ...wall };

  const cols  = shape[0].length;
  const rows  = shape.length;
  const cx    = col * tileSize + (cols * scale) / 2;
  const baseY = row * tileSize + rows * scale;

  const g = new Graphics();
  g.ellipse(cx, baseY + 4, cols * scale * 0.38, 8).fill({ color: SHADOW, alpha: 0.18 });
  drawGrid(g, shape, pal, scale, cx, baseY, 0x2a1a08);
  world.addChild(g);
}

// Retourne le rectangle de collision de la zone murs/façade de la maison
export function getHouseHitbox(col: number, row: number, tileSize: number, seed = 0): { x: number; y: number; w: number; h: number } {
  const shape = HOUSE_SHAPES[seed % HOUSE_SHAPES.length];
  const scale = [3, 4, 4][seed % 3];
  const cols  = shape[0].length;
  const rows  = shape.length;
  // Les murs occupent les 9 dernières lignes (toit = ~55% du haut)
  const wallRowStart = Math.floor(rows * 0.42);
  const wallH = (rows - wallRowStart) * scale;
  const wallY = row * tileSize + wallRowStart * scale;
  return { x: col * tileSize, y: wallY, w: cols * scale, h: wallH };
}

// ===========================================================================
// DÉCORATIONS HUB — fontaine, lampadaire, banc, statue
// ===========================================================================

// Fontaine — pilier central + bassin en pierre + eau animée
// Fontaine — grand bassin octogonal + pilier central
const FOUNTAIN_BASIN = [
  "......ssssssssssss......",
  "....ssSSSSSSSSSSSSss....",
  "...sSSSSSSSSSSSSSSSss...",
  "..sSSSSSSSSSSSSSSSSSs...",
  "..sSSSSSSSSSSSSSSSSSs...",
  "..sSSSSSSSSSSSSSSSSSs...",
  "..sSSSSSSSSSSSSSSSSSs...",
  "..sSSSSSSSSSSSSSSSSSs...",
  "..sSSSSSSSSSSSSSSSSSs...",
  "...sSSSSSSSSSSSSSSSss...",
  "....ssSSSSSSSSSSSSss....",
  "......ssssssssssss......",
  ".......BBBBBBBBBB.......",
  "......BBBBBBBBBBBB......",
  ".....BBbbbbbbbbbbBB.....",
];
const FOUNTAIN_PAL = { s: 0xa89870, S: 0xc8b890, B: 0x9a8860, b: 0x7a6840 };

// Pilier — deux vasques étagées larges
const FOUNTAIN_PILLAR = [
  ".ooooooooo.",  // vasque haute — bord
  "oOOOOOOOOOo",
  "oOOOOOOOOOo",
  ".ooooooooo.",  // fond vasque haute
  "....ppp.....",  // tige
  "...pPPPp....",
  "..pPPPPPp...",  // vasque basse — bord
  ".pPPPPPPPp..",
  ".pPPPPPPPp..",
  "..pppppppp..",
  "....CCC.....",  // colonne
  "....CCC.....",
  "...CCCCC....",
];
const PILLAR_PAL = { o: 0xb8a878, O: 0xd8c8a0, p: 0xa89868, P: 0xc8b888, C: 0xa89060 };

export function drawFountain(world: Container, cx: number, cy: number): Graphics {
  const S = 4;
  const g = new Graphics();
  g.ellipse(cx, cy + 6, 60, 16).fill({ color: 0x000000, alpha: 0.2 });
  drawGrid(g, FOUNTAIN_BASIN,  FOUNTAIN_PAL, S, cx, cy,      0x5a4a28);
  drawGrid(g, FOUNTAIN_PILLAR, PILLAR_PAL,   S, cx, cy - 32, 0x5a4a28);
  world.addChild(g);
  const water = new Graphics();
  world.addChild(water);
  return water;
}

export function animateFountain(water: Graphics, cx: number, cy: number, t: number) {
  water.clear();
  const pulse = 0.65 + 0.35 * Math.sin(t * 0.0025);
  // L'eau est dans le bassin : centre à cy-38 (bassin 15 lignes × scale4 = 60px, eau rows 1-10)
  const wy = cy - 38;
  // Mare intérieure
  water.ellipse(cx, wy, 40, 16).fill({ color: 0x4aa8e0, alpha: 0.82 });
  water.ellipse(cx, wy, 36, 12).fill({ color: 0x6ec8f8, alpha: 0.45 * pulse });
  // Ondulations concentriques
  for (let i = 0; i < 3; i++) {
    const r = 8 + i * 7 + Math.sin(t * 0.002 + i) * 2;
    water.ellipse(cx, wy, r, r * 0.38).stroke({ color: 0x90d8ff, width: 1.5, alpha: (0.45 - i * 0.12) * pulse });
  }
  // Cascades depuis les 4 bords de la vasque haute vers le bassin
  const vasqueY = cy - 80;
  const cascadeAngles = [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5];
  for (let i = 0; i < cascadeAngles.length; i++) {
    const angle = cascadeAngles[i];
    const srcX = cx + Math.cos(angle) * 18;
    const srcY = vasqueY + 6;
    // filet d'eau vertical tombant
    const flow = 0.5 + 0.5 * Math.sin(t * 0.003 + i * 1.5);
    for (let d = 0; d < 5; d++) {
      const dropY = srcY + d * 5 + ((t * 0.08 + i * 7 + d * 3) % 25);
      if (dropY < wy + 4) {
        water.circle(srcX, dropY, 1.5 - d * 0.15).fill({ color: 0xb8e8ff, alpha: (0.9 - d * 0.15) * pulse * flow });
      }
    }
    // splash arrivée dans le bassin bas
    water.circle(srcX, wy - 4, 2 + flow).fill({ color: 0x90d0f8, alpha: 0.55 * pulse });
  }
  // Reflets
  for (let i = 0; i < 3; i++) {
    const rx = cx - 16 + i * 14 + Math.sin(t * 0.002 + i) * 3;
    water.rect(rx, wy - 3 + Math.cos(t * 0.0015 + i) * 2, 10 + i * 2, 2).fill({ color: 0xd0f0ff, alpha: 0.4 * pulse });
  }
}

// Lampadaire — lanterne ronde sur poteau forgé
export function drawLamp(world: Container, cx: number, cy: number) {
  const g = new Graphics();
  g.ellipse(cx, cy + 2, 5, 2).fill({ color: 0x000000, alpha: 0.18 });
  // base
  g.rect(cx - 5, cy - 4, 10, 4).fill(0x7a6848);
  g.rect(cx - 4, cy - 4, 10, 2).fill(0x9a8860);
  // poteau
  g.rect(cx - 2, cy - 28, 4, 24).fill(0x6a5838);
  g.rect(cx - 2, cy - 28, 2, 24).fill(0x8a7050);
  // coude
  g.rect(cx - 2, cy - 30, 10, 4).fill(0x6a5838);
  g.rect(cx + 6, cy - 34, 4, 8).fill(0x6a5838);
  g.rect(cx + 6, cy - 34, 2, 8).fill(0x8a7050);
  // lanterne
  g.rect(cx + 3, cy - 42, 10, 10).fill(0x5a4828);
  g.rect(cx + 4, cy - 41, 8, 8).fill(0xffe890);
  g.rect(cx + 4, cy - 41, 8, 2).fill(0xfff4b0);
  g.rect(cx + 3, cy - 43, 10, 2).fill(0x7a6848);
  // halo
  g.circle(cx + 8, cy - 37, 12).fill({ color: 0xffe860, alpha: 0.12 });
  world.addChild(g);
}

// Banc en pierre — large et lisible top-down
export function drawBench(world: Container, cx: number, cy: number, horizontal = true) {
  const g = new Graphics();
  if (horizontal) {
    g.ellipse(cx, cy + 2, 22, 5).fill({ color: 0x000000, alpha: 0.12 });
    // dossier (haut)
    g.rect(cx - 20, cy - 14, 40, 6).fill(0xc8b898);
    g.rect(cx - 20, cy - 14, 40, 2).fill(0xe0d0b0);
    // assise
    g.rect(cx - 18, cy - 8, 36, 8).fill(0xd8c8a0);
    g.rect(cx - 18, cy - 8, 36, 2).fill(0xeee0c0);
    // pieds
    g.rect(cx - 16, cy,     6, 4).fill(0xa89870);
    g.rect(cx + 10, cy,     6, 4).fill(0xa89870);
  } else {
    g.ellipse(cx + 2, cy, 5, 22).fill({ color: 0x000000, alpha: 0.12 });
    g.rect(cx - 14, cy - 20, 6, 40).fill(0xc8b898);
    g.rect(cx - 8,  cy - 18, 8, 36).fill(0xd8c8a0);
    g.rect(cx - 14, cy - 20, 2, 40).fill(0xe0d0b0);
    g.rect(cx,      cy - 16, 4, 6).fill(0xa89870);
    g.rect(cx,      cy + 10, 4, 6).fill(0xa89870);
  }
  world.addChild(g);
}

// Urne décorative — vase large sur socle
const URN_SHAPE = [
  "...OOO...",  // couvercle
  "..OOOOO..",
  ".OOOOOOO.",
  ".OOOOOOO.",
  "OOOOOOOOO", // panse max
  ".OOOOOOO.",
  "..OOOOO..",
  "...ooo...",  // pied
  "..ooooo..",
  ".ooooooo.",
];
const URN_PAL = { O: 0xd0b888, o: 0xb09868 };

export function drawStatue(world: Container, cx: number, cy: number) {
  const g = new Graphics();
  g.ellipse(cx, cy + 4, 20, 6).fill({ color: 0x000000, alpha: 0.2 });
  // socle
  g.rect(cx - 14, cy - 6, 28, 6).fill(0xa89870);
  g.rect(cx - 14, cy - 6, 28, 2).fill(0xc8b898);
  // urne
  drawGrid(g, URN_SHAPE, URN_PAL, 3, cx, cy - 8, 0x6a5030);
  // motif doré sur la panse
  g.rect(cx - 6, cy - 22, 12, 2).fill(0xf0c840);
  g.rect(cx - 4, cy - 26, 8,  2).fill(0xf0c840);
  g.rect(cx - 2, cy - 30, 4,  2).fill(0xf0c840);
  world.addChild(g);
}

// ===========================================================================
// PORTAIL DE BIOME — arche en pixel art avec glow animé
// ===========================================================================
export type BiomeKey = "forest" | "snow" | "desert" | "beach" | "swamp" | "mountain";

export const BIOME_COLORS: Record<BiomeKey, { stone: number; glow: number; glowDark: number; label: string }> = {
  forest:   { stone: 0x5a7a3a, glow: 0x4cdb6a, glowDark: 0x2a8a40, label: "Forêt" },
  snow:     { stone: 0x8898b8, glow: 0xa8d8ff, glowDark: 0x6898d0, label: "Neige" },
  desert:   { stone: 0xa87840, glow: 0xffcc44, glowDark: 0xc88820, label: "Désert" },
  beach:    { stone: 0x6888a0, glow: 0x40ccff, glowDark: 0x2088c0, label: "Plage" },
  swamp:    { stone: 0x4a5a38, glow: 0x80c840, glowDark: 0x486828, label: "Marécage" },
  mountain: { stone: 0x707870, glow: 0xd0e8f0, glowDark: 0x9090a8, label: "Montagne" },
};

// Portail pixel art — arche en blocs de pierre + glow intérieur animé
// Grille 20×22 px (S=3 → 60×66px rendu)
const PORTAL_GRID = [
  ".....SSSSSSSSS.....",  // sommet arche
  "....Ss.......sS....",
  "...Ss.........sS...",
  "..Ss...........sS..",
  "..S.............S..",
  "..S.............S..",
  "..S.............S..",
  "..S.............S..",
  "..S.............S..",
  "..S.............S..",
  "..S.............S..",
  "..S.............S..",
  "..S.............S..",
  "..S.............S..",
  "..S.............S..",
  "..SS...........SS..",
  "...SSSSSSSSSSSSS...",
];

export function drawPortal(
  world: Container,
  cx: number,
  cy: number,
  biome: BiomeKey,
): { outer: Graphics; inner: Graphics } {
  const c  = BIOME_COLORS[biome];
  const S  = 3;
  const st = c.stone;
  const sl = lighten(st, 0.25);
  const sd = darken(st, 0.25);

  const outer = new Graphics();

  // Ombre au sol
  outer.ellipse(cx, cy + 4, 32, 9).fill({ color: 0x000000, alpha: 0.22 });

  // Arche en blocs de pierre depuis la grille
  const gW = PORTAL_GRID[0].length;
  const gH = PORTAL_GRID.length;
  const offX = cx - Math.floor(gW * S / 2);
  const offY = cy - gH * S;

  for (let r = 0; r < gH; r++) {
    for (let cc = 0; cc < gW; cc++) {
      const ch = PORTAL_GRID[r][cc];
      if (ch === ".") continue;
      const px = offX + cc * S;
      const py = offY + r  * S;
      // couleur de base selon coin/bord
      const col = ch === "S" ? st : sd;
      outer.rect(px, py, S, S).fill(col);
      // reflet haut-gauche
      if (ch === "S") {
        outer.rect(px, py, S, 1).fill(sl);
        outer.rect(px, py, 1, S).fill(sl);
      }
    }
  }

  // Runes sur les piliers (gauche + droite)
  for (let i = 0; i < 4; i++) {
    const ry = offY + (4 + i * 3) * S;
    outer.rect(offX + 2 * S, ry, S * 2, S).fill(c.glow);
    outer.rect(offX + (gW - 4) * S, ry, S * 2, S).fill(c.glow);
  }

  world.addChild(outer);

  // Inner glow animé
  const inner = new Graphics();
  const iX = offX + 3 * S;
  const iY = offY + 4 * S;
  const iW = (gW - 6) * S;
  const iH = (gH - 5) * S;
  _drawInnerGlow(inner, iX, iY, iW, iH, c.glow, c.glowDark, 0);
  world.addChild(inner);

  return { outer, inner, _ix: iX, _iy: iY, _iw: iW, _ih: iH } as unknown as { outer: Graphics; inner: Graphics };
}

function _drawInnerGlow(g: Graphics, x: number, y: number, w: number, h: number, glow: number, glowDark: number, t: number) {
  g.clear();
  const pulse = 0.75 + 0.25 * Math.sin(t * 0.0025);

  // Fond coloré
  g.rect(x, y, w, h).fill({ color: glowDark, alpha: 0.88 });

  // Vagues horizontales de lumière
  for (let row = 0; row < Math.floor(h / 3); row++) {
    const wave = Math.sin(t * 0.003 + row * 0.45) * 0.5 + 0.5;
    g.rect(x + 2, y + row * 3, w - 4, 2).fill({ color: glow, alpha: wave * 0.55 * pulse });
  }

  // Halo central
  g.ellipse(x + w / 2, y + h / 2, w * 0.38, h * 0.3).fill({ color: glow, alpha: 0.18 * pulse });

  // Particules qui montent
  for (let i = 0; i < 5; i++) {
    const px = x + 4 + ((Math.sin(t * 0.0015 + i * 1.3) * 0.5 + 0.5) * (w - 8));
    const py = y + h - 2 - ((t * 0.02 + i * (h / 5)) % h);
    g.circle(px, py, 2).fill({ color: glow, alpha: 0.85 * pulse });
  }
}

// Cache des paramètres intérieurs par biome (pour l'animation)
const _portalCache = new Map<Graphics, { x: number; y: number; w: number; h: number; biome: BiomeKey }>();

export function drawPortalFull(
  world: Container, cx: number, cy: number, biome: BiomeKey,
): { outer: Graphics; inner: Graphics } {
  const c  = BIOME_COLORS[biome];
  const S  = 3;
  const gW = PORTAL_GRID[0].length;
  const gH = PORTAL_GRID.length;
  const offX = cx - Math.floor(gW * S / 2);
  const offY = cy - gH * S;
  const iX = offX + 3 * S, iY = offY + 4 * S;
  const iW = (gW - 6) * S, iH = (gH - 5) * S;

  const st = c.stone, sl = lighten(st, 0.25), sd = darken(st, 0.25);
  const outer = new Graphics();
  outer.ellipse(cx, cy + 4, 32, 9).fill({ color: 0x000000, alpha: 0.22 });
  for (let r = 0; r < gH; r++) {
    for (let cc = 0; cc < gW; cc++) {
      const ch = PORTAL_GRID[r][cc];
      if (ch === ".") continue;
      const px = offX + cc * S, py = offY + r * S;
      outer.rect(px, py, S, S).fill(ch === "S" ? st : sd);
      if (ch === "S") { outer.rect(px, py, S, 1).fill(sl); outer.rect(px, py, 1, S).fill(sl); }
    }
  }
  for (let i = 0; i < 4; i++) {
    const ry = offY + (4 + i * 3) * S;
    outer.rect(offX + 2 * S, ry, S * 2, S).fill(c.glow);
    outer.rect(offX + (gW - 4) * S, ry, S * 2, S).fill(c.glow);
  }
  world.addChild(outer);

  const inner = new Graphics();
  _drawInnerGlow(inner, iX, iY, iW, iH, c.glow, c.glowDark, 0);
  _portalCache.set(inner, { x: iX, y: iY, w: iW, h: iH, biome });
  world.addChild(inner);
  return { outer, inner };
}

export function animatePortal(inner: Graphics, cx: number, cy: number, biome: BiomeKey, t: number) {
  const cached = _portalCache.get(inner);
  if (!cached) return;
  const c = BIOME_COLORS[cached.biome];
  _drawInnerGlow(inner, cached.x, cached.y, cached.w, cached.h, c.glow, c.glowDark, t);
}

function darken(color: number, amount: number): number {
  const r = Math.max(0, ((color >> 16) & 0xff) * (1 - amount));
  const g = Math.max(0, ((color >> 8)  & 0xff) * (1 - amount));
  const b = Math.max(0, ((color)       & 0xff) * (1 - amount));
  return (r << 16) | (g << 8) | b;
}
function lighten(color: number, amount: number): number {
  const r = Math.min(255, ((color >> 16) & 0xff) * (1 + amount));
  const g = Math.min(255, ((color >> 8)  & 0xff) * (1 + amount));
  const b = Math.min(255, ((color)       & 0xff) * (1 + amount));
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}
