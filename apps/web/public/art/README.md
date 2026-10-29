# Original PATCH WARS interface artwork

These two raster assets were generated for this project with OpenAI image generation on October 29, 2026 and encoded into WebP for browser delivery. No Riot/TFT artwork or screenshot UI is included in these production files.

- fracture-arena.webp: 1536x1024 painted floating courtyard. Used by the landing scene and as a subdued renderer background.
- unit-atlas.webp: 1536x1024 RGBA atlas, three columns and two rows, each cell512x512. Top row: guardian/badger, archer/fox, sprinter/hare. Bottom row: healer/moth, bomber/raccoon, slime. Used by CSS portraits and Pixi sprite textures.

The artwork is generated rather than artist-commissioned. Its style was deliberately made matte and restrained; interface typography, values and controls are real DOM elements. The atlas depicts a unit's silhouette, not a new gameplay ability. Runtime stats and mechanics remain defined by the engine.

Phosphor icons are supplied by @phosphor-icons/react under its MIT license. Display typography uses system Georgia and interface typography uses system sans-serif, so no external font requests are needed.
