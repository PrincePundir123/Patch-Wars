# Chat dock sizing and scrolling repair

The supplied screenshot showed Twitch's settings controls cut off at the right edge. A read-only check of the actual connected channel reproduced the issue: the app gave Twitch a **294 px** iframe, while the native settings popup was **320 px** wide and extended past its viewport. The native document did not expose horizontal scrolling, so adding scroll to the whole page would not solve the underlying viewport mismatch.

## Shipped behavior

- Standard chat docks are 400 px wide, increasing to 420 px on large displays. Tablet and short landscape layouts use 380 px. The battle reserves the corresponding space, so the dock does not cover its controls.
- **Expand** gives a wider 560 px desktop dock. On phones it opens a tall reading panel with the launcher icons in a separate bottom rail. **Restore** returns to the compact dock. Opening soldier controls restores the docked layout so those controls remain usable.
- The Community header groups channel connection status, Expand/Restore and Close. The channel row retains Open chat as the official Twitch popout fallback. Zero proposal counts no longer add a redundant badge; positive counts remain visible.
- Twitch receives a minimum 360 × 480 viewport. If the available space is smaller, the surrounding chat region scrolls rather than shrinking or clipping Twitch's controls. It has visible scrollbars and keyboard support: focus the scroll region, use Home/End vertically and arrow keys to pan. The overall page does not gain horizontal overflow.
- The outer viewport initially shows the actual composer and follows it when a full-size panel shrinks. A user's explicit outer scroll position is preserved when possible. Twitch still controls its own message-history scrolling, preferences, login, emotes and sending.
- Expand, Restore, Close and the existing icon toggle retain the same iframe and draft. Close returns keyboard focus to the chat icon. The game, canvas, room, OAuth and commands are unchanged. The chat panel remains opaque and unfiltered; launcher tooltips cannot cover the embed.

The layout follows the adjustable dock pattern described in Twitch's [Chat & Events guide](https://help.twitch.tv/s/article/creator-chat-and-events?language=en_US). Native Twitch content stays inside its [official chat embed](https://dev.twitch.tv/docs/embed/chat/); the app does not restyle its cross-origin settings or add another composer.

## Evidence

- `screenshots/chat-before-repair.png`: real native settings popup clipped in the old dock.
- `screenshots/chat-after-repair.png`: real native settings popup fully visible in the new 398 px inner viewport.
- `screenshots/chat-mobile-expanded.png`: real native settings displayed in the expanded 390 × 844 phone layout.

These captures were read-only inspections of the connected local room at different times; match scores are not a before/after game-state comparison. No Twitch message was posted and no Twitch preference was changed during inspection. A first mobile inspection looked for a gear button that Twitch replaces while its settings menu is open; the subsequent inspection checked the already-open menu instead and captured it successfully.

The new browser tests use a labelled external-service fixture with the native menu's observed width, a scrollable message history, a composer and a retained draft. They check desktop menu bounds, 560 px expansion, Close focus return, no iframe reload, exact paused game equality, vertical keyboard scrolling, full phone settings visibility, native message-list scrolling, restoring the composer and horizontal keyboard panning on a 320 px phone. Chromium visibility tracking also checks the composer is unobscured. The actual Twitch inspection above supplements those mocked regression checks; neither is a new authenticated live-send test.

Final verification: typecheck, lint, production build, all 138 unit/integration tests and all 30 browser cases passed. The full browser run used one fresh isolated built server and took 3.4 minutes. The development server and connected Twitch room were left running; no backend, auth, origin, game-core or extension behavior changed.
