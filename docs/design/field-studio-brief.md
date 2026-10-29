# PATCH WARS: recommended dashboard concept

This file records the generated visual prototype approved before implementation. The image is a concept, not a running-application screenshot. It was generated with the built-in Image Gen tool using actual project artwork and public interface references. The approved design has since been implemented; see [implementation verification](../field-studio-verification.md) for real screenshots and checks.

## Visual target

[Full-page prototype](field-studio-prototype.png)

A warm ivory workspace surrounds a dark forest battle stage. Persistent section navigation, compact match actions and a short Twitch checklist bring the arena higher up the page. The Forge and event feed stay beside combat. Community blueprints, the searchable unit library and operator forms follow below.

## Review of the supplied screenshots

1. Entry and setup: the tall introduction and checklist delay the main arena. Keep the connected state, channel-chat action and next command together in a compact strip.
2. Combat and Forge: the existing illustration gives the product its strongest identity. Keep it prominent, reduce competing unit labels, align the scoreboard and Forge rail, and reserve team colors for identity and health.
3. Blueprints and roster: empty panels occupy excessive height. Use a shorter empty state and a consistent card grid with aligned art fields, roles, names and energy costs.
4. Connections and settings: explanatory configuration text competes with routine controls. Keep essential connection state visible and move callback details into a disclosure. Align form labels and actions.

These observations come from the user-supplied screenshots and source components. Keyboard operation, responsive behavior and accessibility compliance have not been evaluated for this new concept.

## Foundations

- Workspace: #F3F0E8; form surfaces: #FCFAF5; separators: #DCDDD4.
- Navigation: #171E1B; battle stage: #17221F; Forge dock: #1D2824.
- Text: #232B28; secondary text: #62716B; primary action: #36584A.
- Ember: #D97751; Azure: #418FA6; small brass accents: #BA9563.
- Sans-serif interface text with restrained serif section titles. Implement body text at readable sizes, use tabular timers and test actual contrast values before release.
- Use a shared spacing scale, modest corner radii, consistent icons and visible focus states. Retain responsive stacking and reduced-motion behavior.

## Functionality to preserve during implementation

Existing room ownership and operator authentication; Twitch authorization and invitations; match pause/reset/settings; command receipts; voting and moderation; Forge validation, balance and deployment; real provider and fixture labels; searchable unit details and command copying; spectator/OBS routes; label/audio preferences; connection diagnostics. Do not introduce purchase mechanics, fake generation inputs or unsupported statistics.

The image is design guidance. Implement state from authoritative server snapshots, use the actual project artwork, and retain energy/lightning semantics even where generated artwork approximates an icon. The pictured match values are illustrative, not new live verification evidence.

## Research references

- [Riot: TFT Interface Update](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/tft-interface-update/) explains grouping related controls to communicate their relationship. The article's HUD image was inspected and supplied as structural inspiration.
- [OBS Studio](https://obsproject.com/) documents modular docks and provides an interface screenshot. Its preview-and-controls hierarchy informed the battle-stage composition.
- [OBS Studio source repository](https://github.com/obsproject/obs-studio) was reviewed as an open-source streaming-product reference. No source code or third-party interface art was copied into the application.
- Twitch's creator-dashboard help page could not be fully inspected because its public page returned a loading/CSS error. It was not used as visual evidence.
- Mobbin search was unavailable because the connector requires a paid plan. No Mobbin results are claimed.

Reference downloads remain in ignored .data/design-references for research only. The final prototype uses the project's recognizable art and an original interface composition.
