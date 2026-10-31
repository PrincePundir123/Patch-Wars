import { useEffect, useRef, useState } from 'react';
import { Application, Graphics, Container, Text, Sprite, Texture, Rectangle } from 'pixi.js';
// Pixi's static shader/uniform polyfills support a CSP without unsafe-eval.
import 'pixi.js/unsafe-eval';
import type { GameState, Snapshot } from '../../../packages/shared/src/index.js';
import { createGame, startGame, step } from '../../../packages/game-core/src/index.js';
import { useBattle } from './store.js';
import soldierAtlas from './art/sunstone-units.json';
import {
  perspectiveScale,
  projectToLane,
  soldierPose,
  SOLDIER_COLUMNS,
  SOLDIER_ROWS,
  SUNSTONE_ARENA,
  SUNSTONE_SOLDIERS,
} from './battle-presentation.js';
const COLORS = { ember: 0xff8255, azure: 0x65c9ff };
function closestUnit(
  units: GameState['units'],
  x: number,
  y: number,
  team: 'ember' | 'azure',
  enemy = false,
) {
  let closest: GameState['units'][number] | undefined;
  let nearest = Infinity;
  for (const unit of units) {
    if (enemy ? unit.team === team : unit.team !== team) continue;
    const distance = (unit.x - x) ** 2 + (unit.y - y) ** 2;
    if (distance < nearest) {
      nearest = distance;
      closest = unit;
    }
  }
  return closest;
}
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
    let observer: IntersectionObserver | undefined;
    let sizeObserver: ResizeObserver | undefined;
    let visibility: (() => void) | undefined;
    const coarse = matchMedia('(pointer: coarse)').matches;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const targetFps = reduced ? 20 : coarse ? 30 : 60;
    let renderedFrames = 0,
      barsRedrawn = 0,
      poseUpdates = 0,
      lastReport = performance.now();
    const report = () => {
      if (!host.current) return;
      host.current.dataset.renderFrames = String(renderedFrames);
      host.current.dataset.barRedraws = String(barsRedrawn);
      host.current.dataset.poseUpdates = String(poseUpdates);
      host.current.dataset.renderReportAt = String(performance.now());
    };
    const app = new Application();
    const nodes = new Map<
      number,
      {
        root: Container;
        body: Graphics;
        bar: Graphics;
        label: Text;
        sprite?: Sprite;
        shadow: Graphics;
        appearance: string;
        barVisual?: string;
        previousX: number;
        previousY: number;
        attacks: number;
        attackTick: number;
        distance: number;
        moving: boolean;
        facing: number;
        frame?: number;
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
        height: 675,
        backgroundAlpha: transparent ? 0 : 1,
        background: 0xc3b28b,
        antialias: true,
        resolution: Math.min(window.devicePixelRatio, coarse ? 1.5 : 2),
        autoDensity: true,
        preference: 'webgl',
      });
      if (stopped) {
        app.destroy(true);
        return;
      }
      app.ticker.maxFPS = targetFps;
      if (host.current) {
        host.current.dataset.targetFps = String(targetFps);
        host.current.dataset.renderResolution = String(app.renderer.resolution);
      }
      const [arenaAsset, unitAsset] = await Promise.allSettled([
        transparent ? Promise.resolve(null) : loadArtwork(SUNSTONE_ARENA),
        loadArtwork(SUNSTONE_SOLDIERS),
      ]);
      if (stopped) {
        if (app.renderer) app.destroy(true);
        return;
      }
      const frames = new Map<string, Texture[]>();
      if (unitAsset.status === 'fulfilled') {
        const atlas = unitAsset.value;
        SOLDIER_ROWS.forEach((shape, row) => {
          frames.set(
            shape,
            Array.from({ length: SOLDIER_COLUMNS }, (_, column) => {
              const cell = soldierAtlas.frames[row * SOLDIER_COLUMNS + column]!;
              const rect = (r: { x: number; y: number; width: number; height: number }) =>
                new Rectangle(r.x, r.y, r.width, r.height);
              return new Texture({
                source: atlas.source,
                frame: rect(cell.frame),
                orig: rect(cell.orig),
                trim: rect(cell.trim),
              });
            }),
          );
        });
      }
      const backdrop =
        arenaAsset.status === 'fulfilled' && arenaAsset.value
          ? new Sprite(arenaAsset.value)
          : undefined;
      if (backdrop) app.stage.addChild(backdrop);
      let reproject = true;
      const project = projectToLane;
      host.current?.appendChild(app.canvas);
      useBattle.getState().setRenderer('ready');
      app.canvas.setAttribute('aria-label', 'Animated battlefield with Ember and Azure units');
      if (host.current) {
        host.current.dataset.artDirection = 'sunstone';
        host.current.dataset.animationFrames = String(SOLDIER_COLUMNS);
        host.current.dataset.visualResets = '0';
        host.current.dataset.artworkStatus =
          unitAsset.status === 'fulfilled' ? 'ready' : 'fallback';
      }
      const field = new Graphics();
      app.stage.addChild(field);
      const watermark = new Text({
        text: 'SUNSTONE // CASTLE LANE',
        style: { fontFamily: 'monospace', fontSize: 9, fill: 0x76684c, letterSpacing: 3 },
      });
      app.stage.addChild(watermark);
      const resizeCamera = () => {
        if (stopped || !host.current) return;
        const width = 1200,
          height = 260;
        app.renderer.resize(width, height);
        host.current.dataset.camera = 'lane';
        if (backdrop) {
          const scale = Math.max(width / backdrop.texture.width, height / backdrop.texture.height);
          backdrop.scale.set(scale);
          backdrop.position.set((width - backdrop.width) / 2, (height - backdrop.height) / 2);
        }
        field.clear();
        if (!transparent && !backdrop) field.rect(0, 0, width, height).fill(0xceb98f);
        for (const [x, color] of [
          [65, COLORS.ember],
          [1135, COLORS.azure],
        ]) {
          const gate = project(x!, 270);
          field
            .ellipse(gate.x, gate.y, 20, 8)
            .fill({ color: color!, alpha: 0.1 })
            .stroke({ color: color!, alpha: 0.55, width: 1.5 });
        }
        watermark.position.set(width / 2 - 140, height - 24);
        reproject = true;
      };
      sizeObserver = new ResizeObserver(resizeCamera);
      if (host.current) sizeObserver.observe(host.current);
      resizeCamera();
      const layer = new Container();
      layer.sortableChildren = true;
      app.stage.addChild(layer);
      const fx = new Graphics();
      app.stage.addChild(fx);
      let previousGame: GameState | undefined,
        previousTick = -1;
      let snapshotAt = performance.now();
      let presentationTick = 0;
      app.ticker.add(() => {
        const now = performance.now();
        const elapsed = Math.min(now - last, 100);
        renderedFrames++;
        if (now - lastReport >= 1000) {
          report();
          lastReport = now;
        }
        if (preview) {
          accumulator += elapsed;
          while (accumulator >= 50) {
            step(local);
            accumulator -= 50;
          }
        }
        last = now;
        const s = preview ? local : latest.current;
        if (!s) return;
        const changed = s !== previousGame || s.tick !== previousTick;
        if (s.tick !== previousTick) snapshotAt = now;
        // At most two ticks of visual interpolation; paused/disconnected battles settle.
        presentationTick =
          s.tick + (s.phase === 'battle' ? Math.min((now - snapshotAt) / 50, 2) : 0);
        if (changed) {
          // A rematch can reuse IDs and appearances; discard the previous round's gait/attack state.
          if (previousGame && (s.tick < previousTick || s.seed !== previousGame.seed)) {
            for (const node of nodes.values()) node.root.destroy({ children: true });
            nodes.clear();
            reproject = true;
            if (host.current)
              host.current.dataset.visualResets = String(
                Number(host.current.dataset.visualResets ?? 0) + 1,
              );
          }
          const present = new Set(s.units.map((u) => u.id));
          for (const [id, node] of nodes)
            if (!present.has(id)) {
              layer.removeChild(node.root);
              node.root.destroy({ children: true });
              nodes.delete(id);
            }
          previousGame = s;
          previousTick = s.tick;
        }
        const highlightedIds = new Set(
          receipts.current
            .filter((r) => r.entityId !== undefined && s.tick - r.tick < 120)
            .map((r) => r.entityId),
        );
        const interpolation = reduced || reproject ? 1 : 1 - Math.exp(-elapsed / 58);
        for (const u of s.units) {
          let n = nodes.get(u.id);
          const blueprint = s.catalog[u.blueprintId];
          const appearance =
            changed || !n
              ? `${u.blueprintId}:${u.team}:${blueprint?.appearance.shape}:${blueprint?.appearance.palette}:${u.child}`
              : n.appearance;
          // Resets can reuse entity IDs for a different blueprint or team.
          if (n && n.appearance !== appearance) {
            layer.removeChild(n.root);
            n.root.destroy({ children: true });
            nodes.delete(u.id);
            n = undefined;
          }
          if (!n) {
            const root = new Container();
            const shadow = new Graphics();
            shadow.ellipse(0, 0, 16, 5).fill({ color: 0x352917, alpha: 0.23 });
            root.addChild(shadow);
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
            const textures = frames.get(blueprint?.appearance.shape ?? 'orb');
            const sprite = textures ? new Sprite(textures[u.team === 'azure' ? 6 : 0]) : undefined;
            if (sprite) {
              sprite.anchor.set(soldierAtlas.anchor.x, soldierAtlas.anchor.y);
              sprite.width = sprite.height = u.child ? 64 : 112;
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
            label.y = -68;
            root.addChild(body, bar, label);
            const point = project(u.x, u.y);
            root.position.set(point.x, point.y);
            layer.addChild(root);
            n = {
              root,
              body,
              bar,
              label,
              sprite,
              shadow,
              appearance,
              previousX: u.x,
              previousY: u.y,
              attacks: u.attacks,
              attackTick: -100,
              distance: 0,
              moving: false,
              facing: u.team === 'ember' ? 1 : -1,
            };
            nodes.set(u.id, n);
          }
          if (changed) {
            const dx = u.x - n.previousX,
              dy = u.y - n.previousY;
            n.moving = Math.hypot(dx, dy) > 0.02;
            if (Math.abs(dx) > 0.01) n.facing = dx > 0 ? 1 : -1;
            if (u.attacks !== n.attacks) {
              n.attackTick = s.tick;
              n.attacks = u.attacks;
              const target = closestUnit(s.units, u.x, u.y, u.team, true);
              if (target) n.facing = target.x >= u.x ? 1 : -1;
            }
            n.previousX = u.x;
            n.previousY = u.y;
          }
          const point = project(u.x, u.y);
          const dx = (point.x - n.root.x) * interpolation,
            dy = (point.y - n.root.y) * interpolation;
          if (!reproject) n.distance += Math.hypot(dx, dy);
          n.root.x += dx;
          n.root.y += dy;
          n.root.zIndex = n.root.y;
          n.root.scale.set(perspectiveScale(u.y));
          const pose = soldierPose({
            distance: n.distance,
            moving: n.moving && now - snapshotAt < 150,
            attackAge: presentationTick - n.attackTick,
            cooldown: u.cooldown,
            reduced,
          });
          if (n.sprite) {
            const textures = frames.get(blueprint?.appearance.shape ?? 'orb');
            if (textures && n.frame !== pose.frame) {
              n.sprite.texture = textures[(u.team === 'azure' ? 6 : 0) + pose.frame]!;
              n.frame = pose.frame;
              poseUpdates++;
            }
            n.sprite.scale.x = Math.abs(n.sprite.scale.x) * n.facing;
            n.sprite.position.set(pose.reach * n.facing, pose.lift);
            n.sprite.rotation = pose.lean * n.facing;
          }
          const highlighted = highlightedIds.has(u.id);
          n.label.visible = highlighted || showLabels.current;
          const barVisual = `${u.hp}:${u.maxHp}:${u.shield > 0}:${u.slowUntil > s.tick}:${highlighted}`;
          if (n.barVisual === barVisual) continue;
          n.barVisual = barVisual;
          barsRedrawn++;
          n.bar.clear();
          n.bar.ellipse(0, 0, 17, 5).stroke({ color: COLORS[u.team], width: 1.5, alpha: 0.75 });
          if (highlighted)
            n.bar.circle(0, 0, 25).stroke({ color: COLORS[u.team], width: 3, alpha: 0.85 });
          n.bar.rect(-16, -61, 32, 4).fill(0x273128);
          n.bar.rect(-16, -61, 32 * Math.max(0, u.hp / u.maxHp), 4).fill(COLORS[u.team]);
          if (u.shield > 0)
            n.bar.circle(0, 0, 19).stroke({ color: 0xd8d2ff, alpha: 0.45, width: 1 });
          if (u.slowUntil > s.tick)
            n.bar.circle(0, 0, 17).stroke({ color: 0x98e0ff, alpha: 0.7, width: 2 });
        }
        reproject = false;
        fx.clear();
        // All effects come from acknowledged events, never local predictions of damage.
        // Work is bounded even when raids or generated splash abilities fill the event queue.
        if (!reduced)
          for (const e of s.events.slice(-36)) {
            const age = presentationTick - e.tick;
            if (age < 0 || age > 10) continue;
            const alpha = Math.max(0, 1 - age / 10);
            const origin = project(e.x, e.y);
            if (e.kind === 'attack' && e.targetX !== undefined && e.targetY !== undefined) {
              const target = project(e.targetX, e.targetY);
              const source = closestUnit(s.units, e.x, e.y, e.team);
              const shape = source ? s.catalog[source.blueprintId]?.appearance.shape : 'shield';
              const ranged = shape === 'arrow' || shape === 'orb' || shape === 'cross';
              const progress = Math.min(1, age / 4);
              if (ranged && progress < 1) {
                const x = origin.x + (target.x - origin.x) * progress;
                const y = origin.y - 30 + (target.y - origin.y) * progress;
                if (shape === 'orb') {
                  const arc = Math.sin(progress * Math.PI) * 28;
                  fx.circle(x, y - arc, 3).fill(0x3b3021);
                  fx.circle(x + 2, y - arc - 3, 1.2).fill({ color: 0xffd588, alpha });
                } else {
                  const angle = Math.atan2(target.y - origin.y, target.x - origin.x);
                  fx.moveTo(x - Math.cos(angle) * 12, y - Math.sin(angle) * 12)
                    .lineTo(x, y)
                    .stroke({ color: shape === 'cross' ? 0xa1cf83 : 0xffdf99, alpha, width: 1.8 });
                }
              }
              if (!ranged || progress >= 1) {
                const impact = ranged ? Math.max(0, age - 4) : age;
                const ix = target.x,
                  iy = target.y - 22;
                for (let i = 0; i < 4; i++) {
                  const angle = (i * Math.PI) / 2 + e.id;
                  const radius = 3 + impact * 1.6;
                  fx.moveTo(ix + Math.cos(angle) * radius, iy + Math.sin(angle) * radius)
                    .lineTo(
                      ix + Math.cos(angle) * (radius + 4),
                      iy + Math.sin(angle) * (radius + 4),
                    )
                    .stroke({ color: 0xffd88d, alpha, width: 1.4 });
                }
                if (shape === 'orb')
                  fx.ellipse(ix, target.y, 5 + impact * 2, 2 + impact).stroke({
                    color: 0xb17b45,
                    alpha: alpha * 0.45,
                    width: 1.5,
                  });
              }
            } else if (e.kind === 'heal') {
              fx.ellipse(origin.x, origin.y, 13 + age, 4 + age * 0.3).stroke({
                color: 0x91c56c,
                alpha: alpha * 0.7,
                width: 1.5,
              });
              fx.moveTo(origin.x - 4, origin.y - 35 - age)
                .lineTo(origin.x + 4, origin.y - 35 - age)
                .moveTo(origin.x, origin.y - 39 - age)
                .lineTo(origin.x, origin.y - 31 - age)
                .stroke({ color: 0xc4e7a2, alpha, width: 2 });
            } else if (e.kind === 'spawn' || e.kind === 'split') {
              fx.ellipse(origin.x, origin.y, 10 + age * 1.6, 3 + age * 0.4).stroke({
                color: e.kind === 'split' ? 0xa4ca7a : COLORS[e.team],
                alpha: alpha * 0.6,
                width: 1.5,
              });
            } else if (e.kind === 'death') {
              for (let i = 0; i < 3; i++)
                fx.circle(origin.x + (i - 1) * age * 1.4, origin.y - age * 0.6, 1.8).fill({
                  color: 0xb3a17b,
                  alpha: alpha * 0.45,
                });
            }
          }
      });
      let inView = true;
      visibility = () => {
        if (stopped) return;
        const active = !document.hidden && inView;
        if (host.current) host.current.dataset.renderActivity = active ? 'active' : 'suspended';
        report();
        if (active) {
          last = performance.now();
          accumulator = 0;
          app.ticker.start();
        } else app.ticker.stop();
      };
      observer = new IntersectionObserver((entries) => {
        inView = entries.some((entry) => entry.isIntersecting);
        visibility?.();
      });
      if (host.current) observer.observe(host.current);
      document.addEventListener('visibilitychange', visibility);
      visibility();
    })().catch(() => {
      useBattle.getState().setRenderer('error');
      setError(
        'The battlefield could not start. Check your connection and enable browser hardware acceleration.',
      );
    });
    return () => {
      stopped = true;
      observer?.disconnect();
      sizeObserver?.disconnect();
      if (visibility) document.removeEventListener('visibilitychange', visibility);
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
