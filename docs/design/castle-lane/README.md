# Castle lane artwork

Generated with the built-in image generation tool for the reference-based PATCH WARS streaming layout. Original 2172 × 724 PNG retained here. Production WebP: `apps/web/public/art/castle-lane.webp`.

Prompt: Premium painterly fantasy strategy-game background only. Orange Ember castle gate at left, cyan Azure castle gate at right, one clear continuous flat stone bridge path between the castles, distant sunstone cliffs, soft warm daylight. No soldiers, characters, UI, health bars, text, or dividing panels. Natural weathered masonry and readable silhouettes.

The path ground baseline is approximately 60% of image height. Keep both gates visible when fitting the asset. The `encode.mjs` script performs offline browser-canvas WebP encoding at quality 0.91 without resizing or network requests.

## Transparent streaming foreground

`apps/web/public/art/castle-foreground-v2.png` is a 2172 × 724 RGBA edit generated with the built-in image generation tool from `castle-lane.webp`. It preserves the gate-to-gate composition and the 62% ground anchor, with refined stonework, banners and lighting. The prompt requested removal of all sky, clouds, mountains, waterfalls, distant city and scenery, including gaps around flags, battlements and bridge arches. Only the two complete castles, attached foreground masonry and connecting stone platform remain. No soldiers, text or UI were generated. The original artwork is retained for non-stream views.

The PNG is used directly to preserve alpha and avoid another lossy encoding pass. Automated browser tests sample transparent gaps on both castle tops and opaque castle/platform pixels. The renderer switches scenery sprites when entering/exiting stream theater while keeping the same canvas, unit sprites and authoritative game state.
