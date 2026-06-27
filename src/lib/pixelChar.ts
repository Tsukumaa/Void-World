import { Graphics } from "pixi.js";

// Personnage en pixel art — grille native 14x20, dessinée pixel par pixel.
// Vue de face. Chaque caractère = une couleur de la palette.
const ROWS = [
  "....HHHHHH....",
  "...HHHHHHHH...",
  "..HHhhhhhhHH..",
  "..HhSSSSSShH..",
  ".HhSSSSSSSShH.",
  ".HhSEESSEEShH.",
  ".HhSSSSSSSShH.",
  "..HSSSSSSSSH..",
  "...KKKKKKKK...",
  "..BBBBBBBBBB..",
  ".BBBWBBBBWBBB.",
  ".BBBBBBBBBBBB.",
  "SBBBBBBBBBBBBS",
  "SBBBBBBBBBBBBS",
  ".DDDBBBBBBDDD.",
  "..PPPPPPPPPP..",
  "..PPPP..PPPP..",
  "..PPPP..PPPP..",
  "..ppPP..PPpp..",
  "..OOOO..OOOO..",
];

const PIXEL = 2;          // taille d'un pixel à l'écran
const NAT_W = 14;
const OFFSET_X = 10 - (NAT_W * PIXEL) / 2; // centré sur x≈10
const OFFSET_Y = -10;     // pieds vers y≈30

function palette(isLocal: boolean): Record<string, number> {
  return {
    H: 0x2f2418,                          // cheveux foncé
    h: 0x4a3526,                          // cheveux
    S: 0xffd9a8,                          // peau
    K: 0xe6b487,                          // peau ombre (cou)
    E: 0x2a2433,                          // yeux
    B: isLocal ? 0x6c63ff : 0x43aa8b,     // haut
    W: isLocal ? 0x9d96ff : 0x6fd1aa,     // haut reflet
    D: isLocal ? 0x4f48c4 : 0x2f7d63,     // haut ombre
    P: 0x3b3656,                          // pantalon
    p: 0x2b2740,                          // pantalon ombre
    O: 0x21202a,                          // chaussures
  };
}

const OUTLINE = 0x2a2233;

function filled(r: number, c: number): boolean {
  if (r < 0 || r >= ROWS.length) return false;
  const row = ROWS[r];
  if (c < 0 || c >= row.length) return false;
  return row[c] !== ".";
}

/** Dessine le personnage pixel art dans un Graphics (origine ~ coin haut-gauche du conteneur joueur). */
export function drawPixelChar(g: Graphics, isLocal: boolean) {
  const pal = palette(isLocal);
  const maxW = Math.max(...ROWS.map((r) => r.length));

  // contour sombre
  for (let r = -1; r <= ROWS.length; r++) {
    for (let c = -1; c <= maxW; c++) {
      if (filled(r, c)) continue;
      if (filled(r - 1, c) || filled(r + 1, c) || filled(r, c - 1) || filled(r, c + 1)) {
        g.rect(OFFSET_X + c * PIXEL, OFFSET_Y + r * PIXEL, PIXEL, PIXEL).fill(OUTLINE);
      }
    }
  }

  for (let r = 0; r < ROWS.length; r++) {
    const row = ROWS[r];
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      if (ch === ".") continue;
      const color = pal[ch];
      if (color === undefined) continue;
      g.rect(OFFSET_X + c * PIXEL, OFFSET_Y + r * PIXEL, PIXEL, PIXEL).fill(color);
    }
  }
}

// ---------------------------------------------------------------------------
// Version animée : corps (sans jambes) + jambes séparées pour le walk-cycle
// ---------------------------------------------------------------------------
const BODY_COUNT = 16; // ROWS 0..15 (le reste = jambes)
const LEG_L = ["PPPP", "PPPP", "ppPP", "OOOO"];
const LEG_R = ["PPPP", "PPPP", "PPpp", "OOOO"];

// positions (locales au conteneur joueur) des jambes
export const LEG_L_X = OFFSET_X + 2 * PIXEL;
export const LEG_R_X = OFFSET_X + 8 * PIXEL;
export const LEG_Y = OFFSET_Y + BODY_COUNT * PIXEL;

function drawSubGrid(
  g: Graphics,
  rows: string[],
  pal: Record<string, number>,
  ox: number,
  oy: number,
  outline: number
) {
  const f = (r: number, c: number) =>
    r >= 0 && r < rows.length && c >= 0 && c < rows[r].length && rows[r][c] !== ".";
  const maxW = Math.max(...rows.map((r) => r.length));
  for (let r = -1; r <= rows.length; r++)
    for (let c = -1; c <= maxW; c++) {
      if (f(r, c)) continue;
      if (f(r - 1, c) || f(r + 1, c) || f(r, c - 1) || f(r, c + 1))
        g.rect(ox + c * PIXEL, oy + r * PIXEL, PIXEL, PIXEL).fill(outline);
    }
  for (let r = 0; r < rows.length; r++)
    for (let c = 0; c < rows[r].length; c++) {
      const ch = rows[r][c];
      if (ch === ".") continue;
      const color = pal[ch];
      if (color !== undefined) g.rect(ox + c * PIXEL, oy + r * PIXEL, PIXEL, PIXEL).fill(color);
    }
}

/** Corps seul (tête + torse + bras + hanches), sans les jambes. */
export function drawPixelCharBody(g: Graphics, isLocal: boolean) {
  drawSubGrid(g, ROWS.slice(0, BODY_COUNT), palette(isLocal), OFFSET_X, OFFSET_Y, OUTLINE);
}

/** Une jambe, dessinée à l'origine (0,0) du conteneur de jambe. */
export function drawPixelLeg(g: Graphics, isLocal: boolean, right: boolean) {
  drawSubGrid(g, right ? LEG_R : LEG_L, palette(isLocal), 0, 0, OUTLINE);
}
