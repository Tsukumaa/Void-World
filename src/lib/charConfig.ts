// Configuration du personnage (paper doll Mana Seed)
export type BodyType = 'p1' | 'pONE1' | 'pONE2' | 'pONE3';
export type HairStyle = 'bob1' | 'dap1';
export type OutfitStyle = 'boxr' | 'fstr' | 'pfpn' | 'undi';

export interface CharConfig {
  body: BodyType;
  bodyVariant: number;   // 0–10
  hair: HairStyle;
  hairVariant: number;   // 0–13
  outfit: OutfitStyle;
  outfitVariant: number; // 1–N (outfit specific)
}

export const DEFAULT_CHAR: CharConfig = {
  body: 'p1', bodyVariant: 0,
  hair: 'bob1', hairVariant: 0,
  outfit: 'fstr', outfitVariant: 1,
};

// Variants disponibles par outfit
export const OUTFIT_VARIANTS: Record<OutfitStyle, number[]> = {
  boxr: [1],
  fstr: [1, 2, 3, 4, 5],
  pfpn: [1, 2, 3, 4, 5],
  undi: [1],
};

const pad = (n: number) => String(n).padStart(2, '0');

export function charPaths(cfg: CharConfig): { body: string; outfit: string; hair: string } {
  const b = `char_a_${cfg.body}`;
  return {
    body:   `/chars/${b}/${b}_0bas_humn_v${pad(cfg.bodyVariant)}.png`,
    outfit: `/chars/${b}/1out/${b}_1out_${cfg.outfit}_v${pad(cfg.outfitVariant)}.png`,
    hair:   `/chars/${b}/4har/${b}_4har_${cfg.hair}_v${pad(cfg.hairVariant)}.png`,
  };
}

export function loadCharConfig(): CharConfig {
  try {
    const raw = localStorage.getItem('void_char');
    if (raw) return { ...DEFAULT_CHAR, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_CHAR };
}

export function saveCharConfig(cfg: CharConfig) {
  try { localStorage.setItem('void_char', JSON.stringify(cfg)); } catch {}
}
