# Original PATCH WARS interface artwork

The current Sunstone artwork was generated for this project with OpenAI image generation on October 30, 2026, using the owner's selected Sunstone concept as the reference. No Riot/TFT characters, artwork or screenshot UI are included in production assets.

- `sunstone-arena.webp`: 1836 × 857 sandstone courtyard, 418,886 bytes.
- `sunstone-units.webp`: 1774 × 887 transparent atlas, 1,075,346 bytes. Six roles, two teams, six poses per team. Use the explicit frame rectangles and baseline-preserving trim/origin data in `apps/web/src/art/sunstone-units.json`; the source does not have uniform row or column spacing.
- `sunstone-portraits.webp`: 1536 × 1024, 313,834 bytes, three columns and two rows of portrait cards. Guardian/Archer/Sprinter above Healer/Bomber/Slime. The extension packages the same portrait image under its existing `unit-atlas.webp` filename.

Original PNGs and the selected reference are retained in `docs/design/sunstone`. `pnpm exec tsx scripts/encode-sunstone-art.ts` re-encodes delivery images without resizing; animation coordinates remain valid. The three encoded images total 1,808,066 bytes, compared with 7,672,586 bytes of original PNGs. The generated sprite source has small weapon-tip cuts in a few adjacent attack cells; this is a minor art limitation, not missing game damage or abilities.

The older October 29 artwork below is retained for history and compatibility, and is no longer the active battlefield/roster art:

- fracture-arena.webp: 1536x1024 painted floating courtyard. Used by the landing scene and as a subdued renderer background.
- unit-atlas.webp: 1536x1024 RGBA atlas, three columns and two rows, each cell512x512. Top row: guardian/badger, archer/fox, sprinter/hare. Bottom row: healer/moth, bomber/raccoon, slime. Used by CSS portraits and Pixi sprite textures.

The artwork is generated rather than artist-commissioned. Its style was deliberately made matte and restrained; interface typography, values and controls are real DOM elements. The atlas depicts a unit's silhouette, not a new gameplay ability. Runtime stats and mechanics remain defined by the engine.

Phosphor icons are supplied by @phosphor-icons/react under its MIT license. Display typography uses system Georgia and interface typography uses system sans-serif, so no external font requests are needed.
