// Paper doll Mana Seed — frame layout (512×512, 64×64 per frame, 8 cols)
// Walk rows (0-indexed): down=4, up=5, left=6, right=7  — 6 frames per row
import { Application, Container, Graphics, Sprite, Texture, Rectangle, Text, TextStyle, Assets } from "pixi.js";
import { CharConfig, charPaths } from "./charConfig";

export const FRAME_W = 64;
export const FRAME_H = 64;
export const WALK_FRAMES = 6;
export const WALK_MS = 135; // ms per frame

const DIR_ROW: Record<string, number> = { down: 4, up: 5, left: 7, right: 6 };

export type Dir = 'down' | 'up' | 'left' | 'right';

export interface PlayerDoll {
  container: Container;
  body: Sprite;
  outfit: Sprite;
  hair: Sprite;
  walkTime: number;
  frame: number;
  dir: Dir;
}

function makeFrames(tex: Texture, row: number): Texture[] {
  return Array.from({ length: WALK_FRAMES }, (_, i) =>
    new Texture({ source: tex.source, frame: new Rectangle(i * FRAME_W, row * FRAME_H, FRAME_W, FRAME_H) })
  );
}

// Charge les textures d'un perso et renvoie un PlayerDoll
export async function loadDoll(
  cfg: CharConfig,
  name: string,
  isLocal: boolean,
  world: Container,
  app: Application
): Promise<PlayerDoll> {
  const paths = charPaths(cfg);
  const [bodyTex, outfitTex, hairTex] = await Promise.all([
    Assets.load(paths.body) as Promise<Texture>,
    Assets.load(paths.outfit) as Promise<Texture>,
    Assets.load(paths.hair) as Promise<Texture>,
  ]);
  for (const t of [bodyTex, outfitTex, hairTex]) t.source.scaleMode = 'nearest';

  const SCALE = 1.5; // agrandit un peu le perso (64px → 96px)
  // Pieds Mana Seed à la ligne 44/63 (19 lignes vides en bas).
  // Avec anchor(0.5,1), on descend les sprites pour aligner pieds sur y=0.
  const FOOT_OFFSET = Math.round(19 * SCALE); // = 29

  const container = new Container();
  world.addChild(container);
  world.sortableChildren = true;

  const shadow = new Graphics();
  shadow.ellipse(0, 4, 14, 6).fill({ color: 0x000000, alpha: 0.25 });
  container.addChild(shadow);

  const body = new Sprite(makeFrames(bodyTex, DIR_ROW.down)[0]);
  body.anchor.set(0.5, 1);
  body.scale.set(SCALE);
  body.y = FOOT_OFFSET;

  const outfit = new Sprite(makeFrames(outfitTex, DIR_ROW.down)[0]);
  outfit.anchor.set(0.5, 1);
  outfit.scale.set(SCALE);
  outfit.y = FOOT_OFFSET;

  const hair = new Sprite(makeFrames(hairTex, DIR_ROW.down)[0]);
  hair.anchor.set(0.5, 1);
  hair.scale.set(SCALE);
  hair.y = FOOT_OFFSET;

  container.addChild(body);
  container.addChild(outfit);
  container.addChild(hair);

  const label = new Text({
    text: name,
    style: new TextStyle({
      fontSize: isLocal ? 10 : 9,
      fill: isLocal ? 0xffffaa : 0xffffff,
      fontFamily: 'monospace',
      dropShadow: { color: 0x000000, blur: 2, distance: 1 },
    }),
  });
  label.x = -label.width / 2;
  label.y = -(FRAME_H * SCALE - FOOT_OFFSET) - 8;
  container.addChild(label);

  return { container, body, outfit, hair, walkTime: 0, frame: 0, dir: 'down' };
}

// Met à jour l'animation d'un doll (appeler dans le ticker)
export function tickDoll(
  doll: PlayerDoll,
  moving: boolean,
  dir: Dir,
  deltaMS: number
) {
  if (doll.dir !== dir) { doll.dir = dir; doll.walkTime = 0; doll.frame = 0; }
  const row = DIR_ROW[dir];

  if (moving) {
    doll.walkTime += deltaMS;
    if (doll.walkTime >= WALK_MS) {
      doll.walkTime -= WALK_MS;
      doll.frame = (doll.frame + 1) % WALK_FRAMES;
    }
  } else {
    doll.frame = 0;
    doll.walkTime = 0;
  }

  const rect = new Rectangle(doll.frame * FRAME_W, row * FRAME_H, FRAME_W, FRAME_H);
  doll.body.texture = new Texture({ source: doll.body.texture.source, frame: rect });
  doll.outfit.texture = new Texture({ source: doll.outfit.texture.source, frame: rect });
  doll.hair.texture = new Texture({ source: doll.hair.texture.source, frame: rect });
}

// Unload toutes les textures d'un perso (avant app.destroy pour éviter le bug WebGL)
export async function unloadDollTextures(cfg: CharConfig) {
  const paths = charPaths(cfg);
  await Promise.allSettled([
    Assets.unload(paths.body),
    Assets.unload(paths.outfit),
    Assets.unload(paths.hair),
  ]);
}
