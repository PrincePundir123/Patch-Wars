import { useEffect, useRef, useState } from 'react';
import { Application, Graphics, Container, Text, Sprite, Texture, Rectangle } from 'pixi.js';
import { UnitPortrait } from './UnitPortrait.js';
// Pixi's static shader/uniform polyfills support a CSP without unsafe-eval.
import 'pixi.js/unsafe-eval';
import type { GameState, Entity, Snapshot } from '../../../packages/shared/src/index.js';
import { createGame, startGame, step } from '../../../packages/game-core/src/index.js';
const COLORS = { ember: 0xff8255, azure: 0x65c9ff };
// Shared same-origin images avoid blob workers and keep the existing CSP intact.
const textures = new Map<string, Promise<Texture>>();
function loadArtwork(url: string) {
  let pending = textures.get(url);
  if (!pending) {
    pending = new Promise<Texture>((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => resolve(Texture.from(image));
      image.onerror = () => {
        textures.delete(url);
        reject(new Error('Artwork unavailable.'));
      };
      image.src = url;
    });
    textures.set(url, pending);
  }
  return pending;
}
function silhouette(g: Graphics, shape: string, color: number, child = false) {
  const s = child ? 0.65 : 1;
  g.scale.set(s);
  g.ellipse(0, 10, 14, 5).fill({ color: 0x000000, alpha: 0.4 });
  if (shape === 'shield') {
    g.poly([-10, -13, 10, -13, 13, 1, 0, 15, -13, 1]).fill(color);
    g.rect(-3, -8, 6, 14).fill(0x252831);
    g.rect(-7, -4, 14, 4).fill(0x252831);
  } else if (shape === 'arrow') {
    g.poly([0, -15, 13, 7, 4, 5, 4, 14, -4, 14, -4, 5, -13, 7]).fill(color);
    g.rect(-2, -9, 4, 10).fill(0x18212b);
  } else if (shape === 'diamond') {
    g.poly([0, -15, 11, 0, 0, 15, -11, 0]).fill(color);
    g.poly([0, -8, 4, 0, 0, 8, -4, 0]).fill(0x21242e);
  } else if (shape === 'cross') {
    g.roundRect(-5, -14, 10, 28, 2).fill(color);
    g.roundRect(-13, -5, 26, 10, 2).fill(color);
    g.rect(-3, -3, 6, 6).fill(0xeaffdf);
  } else if (shape === 'slime') {
    g.roundRect(-15, -10, 30, 24, 10).fill(0xb8ef70);
    g.circle(-5, -2, 2.6).fill(0x121d1c);
    g.circle(5, -2, 2.6).fill(0x121d1c);
    g.rect(-3, 5, 6, 2).fill(0x121d1c);
  } else {
    g.circle(0, 0, 11).fill(color);
    g.rect(-2, -17, 4, 8).fill(0xe7e6db);
    g.circle(1, -18, 3).fill(0xffd86b);
  }
}
export function Arena({
  game,
  preview = false,
  transparent = false,
  feedback = [],
  labels = false,
}: {
  game?: GameState;
  preview?: boolean;
  transparent?: boolean;
  feedback?: Snapshot['commandFeedback'];
  labels?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(game);
  latest.current = game;
  const receipts = useRef(feedback);
  receipts.current = feedback;
  const showLabels = useRef(labels);
  showLabels.current = labels;
  const [error, setError] = useState('');
  useEffect(() => {
    let stopped = false;
    const app = new Application();
    const nodes = new Map<
      number,
      {
        root: Container;
        body: Graphics;
        bar: Graphics;
        label: Text;
        sprite?: Sprite;
        appearance: string;
      }
    >();
    const local = createGame(83, 600);
    startGame(local);
    for (let i = 0; i < 350; i++) step(local);
    let last = performance.now();
    let accumulator = 0;
    void (async () => {
      await app.init({
        width: 1200,
        height: 560,
        backgroundAlpha: transparent ? 0 : 1,
        background: 0x10151b,
        antialias: true,
        resolution: Math.min(window.devicePixelRatio, 2),
        autoDensity: true,
        preference: 'webgl',
      });
      if (stopped) {
        app.destroy(true);
        return;
      }
      const [arenaAsset, unitAsset] = await Promise.allSettled([
        transparent ? Promise.resolve(null) : loadArtwork('/art/fracture-arena.webp'),
        loadArtwork('/art/unit-atlas.webp'),
      ]);
      if (stopped) {
        if (app.renderer) app.destroy(true);
        return;
      }
      const frames = new Map<string, Texture>();
      if (unitAsset.status === 'fulfilled') {
        const atlas = unitAsset.value;
        const width = atlas.width / 3,
          height = atlas.height / 2;
        ['shield', 'arrow', 'diamond', 'cross', 'orb', 'slime'].forEach((shape, i) => {
          frames.set(
            shape,
            new Texture({
              source: atlas.source,
              frame: new Rectangle((i % 3) * width, Math.floor(i / 3) * height, width, height),
            }),
          );
        });
      }
      if (arenaAsset.status === 'fulfilled' && arenaAsset.value) {
        const backdrop = new Sprite(arenaAsset.value);
        backdrop.width = 1200;
        backdrop.height = 560;
        backdrop.alpha = 0.78;
        app.stage.addChild(backdrop);
      }
      host.current?.appendChild(app.canvas);
      app.canvas.setAttribute('aria-label', 'Animated battlefield with Ember and Azure units');
      const field = new Graphics();
      if (!transparent) {
        field
          .rect(0, 0, 1200, 560)
          .fill({ color: 0x10202b, alpha: arenaAsset.status === 'fulfilled' ? 0.12 : 1 });
      }
      for (const [x, color] of [
        [65, COLORS.ember],
        [1135, COLORS.azure],
      ]) {
        field
          .ellipse(x!, 278, 27, 44)
          .fill({ color: color!, alpha: 0.1 })
          .stroke({ color: color!, alpha: 0.65, width: 2 });
      }
      app.stage.addChild(field);
      const watermark = new Text({
        text: 'PATCH // BATTLEFIELD 01',
        style: { fontFamily: 'monospace', fontSize: 10, fill: 0x65727f, letterSpacing: 3 },
      });
      watermark.position.set(460, 520);
      app.stage.addChild(watermark);
      const layer = new Container();
      app.stage.addChild(layer);
      const fx = new Graphics();
      app.stage.addChild(fx);
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      app.ticker.add(() => {
        const now = performance.now();
        if (preview) {
          accumulator += Math.min(now - last, 100);
          while (accumulator >= 50) {
            step(local);
            accumulator -= 50;
          }
        }
        last = now;
        const s = preview ? local : latest.current;
        if (!s) return;
        const present = new Set(s.units.map((u) => u.id));
        for (const [id, node] of nodes)
          if (!present.has(id)) {
            layer.removeChild(node.root);
            node.root.destroy({ children: true });
            nodes.delete(id);
          }
        for (const u of s.units) {
          let n = nodes.get(u.id);
          const blueprint = s.catalog[u.blueprintId];
          const appearance = `${u.blueprintId}:${u.team}:${blueprint?.appearance.shape}:${blueprint?.appearance.palette}:${u.child}`;
          // Resets can reuse entity IDs for a different blueprint or team.
          if (n && n.appearance !== appearance) {
            layer.removeChild(n.root);
            n.root.destroy({ children: true });
            nodes.delete(u.id);
            n = undefined;
          }
          if (!n) {
            const root = new Container();
            const body = new Graphics();
            const palette = s.catalog[u.blueprintId]?.appearance.palette;
            const bodyColor =
              palette === 'violet'
                ? 0xc9a4ff
                : palette === 'lime'
                  ? 0xb8ef70
                  : palette === 'gold'
                    ? 0xffd86b
                    : COLORS[u.team];
            silhouette(
              body,
              s.catalog[u.blueprintId]?.appearance.shape ?? 'orb',
              bodyColor,
              u.child,
            );
            const bar = new Graphics();
            const texture = frames.get(s.catalog[u.blueprintId]?.appearance.shape ?? 'orb');
            const sprite = texture ? new Sprite(texture) : undefined;
            if (sprite) {
              sprite.anchor.set(0.5, 0.72);
              sprite.width = sprite.height = u.child ? 42 : 66;
              if (u.team === 'azure') sprite.scale.x = -Math.abs(sprite.scale.x);
              if (palette && palette !== 'team') sprite.tint = bodyColor;
              body.visible = false;
              root.addChild(sprite);
            }
            const label = new Text({
              text: s.catalog[u.blueprintId]?.name ?? u.blueprintId,
              style: {
                fontFamily: 'sans-serif',
                fontSize: 15,
                fontWeight: 'bold',
                fill: 0xffffff,
                stroke: { color: 0x10151b, width: 4 },
              },
            });
            label.anchor.set(0.5, 1);
            label.y = -40;
            root.addChild(body, bar, label);
            root.position.set(u.x, u.y);
            layer.addChild(root);
            n = { root, body, bar, label, sprite, appearance };
            nodes.set(u.id, n);
          }
          n.root.x += (u.x - n.root.x) * (reduced ? 1 : 0.25);
          n.root.y += (u.y - n.root.y) * (reduced ? 1 : 0.25);
          n.body.y = reduced ? 0 : Math.sin(now / 140 + u.id) * 1.4;
          if (n.sprite) n.sprite.y = n.body.y;
          n.bar.clear();
          const highlighted = receipts.current.some(
            (r) => r.entityId === u.id && s.tick - r.tick < 120,
          );
          n.label.visible = highlighted || showLabels.current;
          n.bar.ellipse(0, 15, 15, 5).stroke({ color: COLORS[u.team], width: 2, alpha: 0.8 });
          if (highlighted)
            n.bar.circle(0, 0, 25).stroke({ color: COLORS[u.team], width: 3, alpha: 0.85 });
          n.bar.rect(-15, -34, 30, 4).fill(0x080b10);
          n.bar.rect(-15, -34, 30 * Math.max(0, u.hp / u.maxHp), 4).fill(COLORS[u.team]);
          if (u.shield > 0)
            n.bar.circle(0, 0, 19).stroke({ color: 0xd8d2ff, alpha: 0.45, width: 1 });
          if (u.slowUntil > s.tick)
            n.bar.circle(0, 0, 17).stroke({ color: 0x98e0ff, alpha: 0.7, width: 2 });
        }
        fx.clear();
        if (!reduced)
          for (const e of s.events) {
            const age = s.tick - e.tick;
            if (age > 6) continue;
            const alpha = 1 - age / 7;
            if (e.kind === 'attack' && e.targetX !== undefined) {
              fx.moveTo(e.x, e.y)
                .lineTo(e.targetX, e.targetY!)
                .stroke({ color: COLORS[e.team], alpha: alpha * 0.7, width: 1.5 });
              fx.circle(e.targetX, e.targetY!, 3 + age).stroke({
                color: 0xffe4a8,
                alpha,
                width: 1,
              });
            }
            if (['split', 'death', 'spawn', 'heal'].includes(e.kind))
              fx.circle(e.x, e.y, 8 + age * 4).stroke({
                color: e.kind === 'heal' || e.kind === 'split' ? 0xb8ef70 : COLORS[e.team],
                alpha: alpha * 0.7,
                width: 2,
              });
          }
      });
    })().catch(() =>
      setError('The battlefield needs WebGL. Enable hardware acceleration in your browser or OBS.'),
    );
    return () => {
      stopped = true;
      if (app.renderer) app.destroy(true, { children: true });
    };
  }, [preview, transparent]);
  return (
    <div className="arena-canvas" ref={host} role="img" aria-label="Live battlefield">
      {error && (
        <p className="canvas-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
export function UnitIcon({ shape, team = 'ember' }: { shape: string; team?: Entity['team'] }) {
  return (
    <span className={`unit-icon ${team}`}>
      <UnitPortrait shape={shape} />
    </span>
  );
}
