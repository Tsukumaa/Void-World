"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import {
  CharConfig, BodyType, HairStyle, OutfitStyle,
  OUTFIT_VARIANTS, charPaths, saveCharConfig,
} from "@/lib/charConfig";

const BODIES: BodyType[]   = ['p1', 'pONE1', 'pONE2', 'pONE3'];
const HAIRS: HairStyle[]   = ['bob1', 'dap1'];
const OUTFITS: OutfitStyle[] = ['fstr', 'pfpn', 'boxr', 'undi'];
const BODY_VARIANTS = Array.from({ length: 11 }, (_, i) => i);   // 0–10
const HAIR_VARIANTS = Array.from({ length: 14 }, (_, i) => i);   // 0–13

// Couleurs indicatives pour les swatches (approximatif)
const SKIN_COLORS = [
  '#f5c9a0','#e8a870','#d08850','#b86830','#8a5020',
  '#604018','#f0d0b0','#e8c090','#c09070','#a07050','#786048',
];
const HAIR_COLORS = [
  '#201010','#402010','#804020','#c06020','#d09030',
  '#e0c050','#f0e090','#d0a060','#a05030','#602010',
  '#4080c0','#8050c0','#40a060','#c04060',
];

// Frame idle face down = row 4, frame 0 → on découpe 64x64 à (0,256) dans le PNG 512x512
// On affiche via CSS background-position
function PreviewSprite({ src, size = 64 }: { src: string; size?: number }) {
  const scale = size / 64;
  return (
    <div style={{
      width: size, height: size, overflow: 'hidden', imageRendering: 'pixelated', position: 'relative',
    }}>
      <div style={{
        width: 512 * scale, height: 512 * scale,
        backgroundImage: `url(${src})`,
        backgroundSize: `${512 * scale}px ${512 * scale}px`,
        backgroundPosition: `0px ${-256 * scale}px`,
        imageRendering: 'pixelated',
        position: 'absolute',
        left: `${-0 * scale}px`, top: 0,
      }} />
    </div>
  );
}

function LayeredPreview({ cfg, size = 96 }: { cfg: CharConfig; size?: number }) {
  const paths = charPaths(cfg);
  const style = (src: string): React.CSSProperties => {
    const scale = size / 64;
    return {
      position: 'absolute', inset: 0,
      backgroundImage: `url(${src})`,
      backgroundSize: `${512 * scale}px ${512 * scale}px`,
      backgroundPosition: `0px ${-256 * scale}px`,
      imageRendering: 'pixelated',
    };
  };
  return (
    <div style={{ width: size, height: size, position: 'relative', imageRendering: 'pixelated' }}>
      <div style={style(paths.body)} />
      <div style={style(paths.outfit)} />
      <div style={style(paths.hair)} />
    </div>
  );
}

interface Props {
  initial: CharConfig;
  onSave: (cfg: CharConfig) => void;
  onCancel?: () => void;
  title?: string;
}

export default function CharacterPicker({ initial, onSave, onCancel, title = "Crée ton personnage" }: Props) {
  const [cfg, setCfg] = useState<CharConfig>(initial);

  const set = (patch: Partial<CharConfig>) => setCfg(c => ({ ...c, ...patch }));

  // Reset outfitVariant when outfit changes
  const setOutfit = (o: OutfitStyle) => set({ outfit: o, outfitVariant: OUTFIT_VARIANTS[o][0] });
  const outfitVars = OUTFIT_VARIANTS[cfg.outfit];

  const confirm = () => { saveCharConfig(cfg); onSave(cfg); };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 16,
        padding: 32, width: 560, maxHeight: '90vh', overflowY: 'auto',
        fontFamily: 'monospace', color: '#fff', display: 'flex', flexDirection: 'column', gap: 20,
      }}>
        <h2 style={{ margin: 0, fontSize: 18, textAlign: 'center' }}>{title}</h2>

        {/* Preview centré */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 16 }}>
            <LayeredPreview cfg={cfg} size={128} />
          </div>
        </div>

        {/* Silhouette */}
        <Section label="Silhouette">
          <div style={{ display: 'flex', gap: 8 }}>
            {BODIES.map(b => (
              <button key={b} onClick={() => set({ body: b })} style={btnStyle(cfg.body === b)}>
                <PreviewSprite src={charPaths({ ...cfg, body: b }).body} size={48} />
              </button>
            ))}
          </div>
        </Section>

        {/* Couleur de peau */}
        <Section label="Couleur de peau">
          <Swatches
            colors={SKIN_COLORS}
            selected={cfg.bodyVariant}
            onSelect={i => set({ bodyVariant: i })}
          />
        </Section>

        {/* Coiffure */}
        <Section label="Coiffure">
          <div style={{ display: 'flex', gap: 8 }}>
            {HAIRS.map(h => (
              <button key={h} onClick={() => set({ hair: h })} style={btnStyle(cfg.hair === h)}>
                <PreviewSprite src={charPaths({ ...cfg, hair: h }).hair} size={48} />
              </button>
            ))}
          </div>
        </Section>

        {/* Couleur des cheveux */}
        <Section label="Couleur des cheveux">
          <Swatches
            colors={HAIR_COLORS}
            selected={cfg.hairVariant}
            onSelect={i => set({ hairVariant: i })}
          />
        </Section>

        {/* Tenue */}
        <Section label="Tenue">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {OUTFITS.map(o => (
              <button key={o} onClick={() => setOutfit(o)} style={btnStyle(cfg.outfit === o)}>
                <PreviewSprite src={charPaths({ ...cfg, outfit: o, outfitVariant: OUTFIT_VARIANTS[o][0] }).outfit} size={48} />
              </button>
            ))}
          </div>
        </Section>

        {/* Couleur de tenue */}
        {outfitVars.length > 1 && (
          <Section label="Couleur de la tenue">
            <div style={{ display: 'flex', gap: 8 }}>
              {outfitVars.map(v => (
                <button key={v} onClick={() => set({ outfitVariant: v })} style={btnStyle(cfg.outfitVariant === v)}>
                  <PreviewSprite src={charPaths({ ...cfg, outfitVariant: v }).outfit} size={48} />
                </button>
              ))}
            </div>
          </Section>
        )}

        {/* Boutons */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 8 }}>
          {onCancel && (
            <button onClick={onCancel} style={{
              padding: '10px 24px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)',
              background: 'transparent', color: '#aaa', cursor: 'pointer', fontFamily: 'monospace', fontSize: 14,
            }}>
              Annuler
            </button>
          )}
          <button onClick={confirm} style={{
            padding: '10px 28px', borderRadius: 10, border: 'none',
            background: '#5545e0', color: '#fff', cursor: 'pointer', fontFamily: 'monospace',
            fontSize: 14, fontWeight: 'bold',
          }}>
            Confirmer
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 12, color: '#aaa', letterSpacing: 1, textTransform: 'uppercase' }}>{label}</div>
      {children}
    </div>
  );
}

function Swatches({ colors, selected, onSelect }: { colors: string[]; selected: number; onSelect: (i: number) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {colors.map((c, i) => (
        <div
          key={i}
          onClick={() => onSelect(i)}
          style={{
            width: 24, height: 24, borderRadius: 6, background: c,
            cursor: 'pointer', border: selected === i ? '2px solid #fff' : '2px solid transparent',
            boxSizing: 'border-box',
          }}
        />
      ))}
    </div>
  );
}

function btnStyle(active: boolean): React.CSSProperties {
  return {
    padding: 4, borderRadius: 8, cursor: 'pointer',
    border: active ? '2px solid #8878ff' : '2px solid transparent',
    background: active ? 'rgba(136,120,255,0.15)' : 'rgba(255,255,255,0.05)',
  };
}
