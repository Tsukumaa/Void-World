import { Graphics } from "pixi.js";

// Personnage pixel art — 14 cols × 17 rows corps + 5 rows jambes, PIXEL=2
// Centré sur x=0, pieds à y=0
export const PIXEL    = 2;
const NAT_W  = 14;
const BC     = 17; // body count rows
const LC     = 5;  // leg count rows

export const OX = -(NAT_W * PIXEL) / 2;          // = -14
export const OY = -((BC + LC) * PIXEL);           // = -44  (pieds à y=0)
export const LEG_Y   = OY + BC * PIXEL;           // = -44+34 = -10
export const LEG_L_X = OX + 2 * PIXEL;            // = -14+4  = -10
export const LEG_R_X = OX + 8 * PIXEL;            // = -14+16 =   2
export const CHAR_ABOVE = -OY + PIXEL;            // = 46  (hauteur au-dessus y=0)

// Corps — 14 chars × 17 rows (tous exactement 14)
const BODY: string[] = [
  "....HHHHHH....",  // 0  cheveux haut
  "..HHHhhhhHHH..",  // 1  cheveux larges
  "..HHhSSSShhH..",  // 2  front
  "..HhSSSSSSHH..",  // 3  visage
  "..HhSESSEShH..",  // 4  yeux
  "..HhSSSSSSHH..",  // 5  joues
  "..HhSSSSSSHH..",  // 6  bas visage
  "..HhSSmSSShH..",  // 7  bouche (m=lèvres)
  "...HHhSSHHH...",  // 8  menton
  ".....KKKK.....",  // 9  cou
  "...BBBBBBBB...",  // 10 col
  "..BBBBBBBBBB..",  // 11 épaules
  ".BBBWBBBBwBBB.",  // 12 poitrine (W/w=reflets)
  ".BBBBBBBBBBB..",  // 13 ventre
  "SBBBBBBBBBBBBS",  // 14 bras G (S=peau)
  "SBBBBBBBBBBBBS",  // 15 bras D
  "..DDDDDDDDDD..",  // 16 ceinture
];

// Jambe gauche / droite — 4 cols × 5 rows
const LEG_L: string[] = ["PPPP","PPPP","PPPP","ppPP","OOOO"];
const LEG_R: string[] = ["PPPP","PPPP","PPPP","PPpp","OOOO"];

function pal(local: boolean): Record<string, number> {
  return {
    H: 0x261710,  // cheveux très foncé
    h: 0x4a2e1a,  // cheveux
    S: 0xfcd4a0,  // peau
    K: 0xe0a870,  // cou ombre
    E: 0x201828,  // œil pupille
    m: 0xcc5050,  // lèvres
    B: local ? 0x5545e0 : 0x2e8a5a,   // vêtement principal
    W: local ? 0x8878ff : 0x55c07a,   // reflet gauche
    w: local ? 0x7868f0 : 0x45b068,   // reflet droit
    D: local ? 0x3328a8 : 0x1a6038,   // ceinture / ombre
    P: 0x362e58,  // pantalon
    p: 0x241e3e,  // pantalon ombre
    O: 0x181220,  // chaussures
  };
}

const OUTLINE = 0x100c18;

function subgrid(g: Graphics, rows: string[], p: Record<string,number>, ox: number, oy: number) {
  const maxW = Math.max(...rows.map(r => r.length));
  const f = (r: number, c: number) =>
    r >= 0 && r < rows.length && c >= 0 && c < rows[r].length && rows[r][c] !== ".";
  for (let r = -1; r <= rows.length; r++)
    for (let c = -1; c <= maxW; c++) {
      if (f(r,c)) continue;
      if (f(r-1,c)||f(r+1,c)||f(r,c-1)||f(r,c+1))
        g.rect(ox + c*PIXEL, oy + r*PIXEL, PIXEL, PIXEL).fill(OUTLINE);
    }
  for (let r = 0; r < rows.length; r++)
    for (let c = 0; c < rows[r].length; c++) {
      const ch = rows[r][c];
      if (ch === ".") continue;
      const col = p[ch];
      if (col !== undefined) g.rect(ox + c*PIXEL, oy + r*PIXEL, PIXEL, PIXEL).fill(col);
    }
}

export function drawPixelCharBody(g: Graphics, local: boolean) {
  subgrid(g, BODY, pal(local), OX, OY);
}

export function drawPixelLeg(g: Graphics, local: boolean, right: boolean) {
  subgrid(g, right ? LEG_R : LEG_L, pal(local), 0, 0);
}
