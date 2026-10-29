import { it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TwitchGuide } from '../apps/web/src/TwitchGuide.js';
import { Room } from '../apps/server/src/room.js';
it('guides a real channel to its chat and explains completed matches', () => {
  const r = new Room('owner', 'live');
  r.channels = [{ id: '123', name: 'test_channel', team: 'ember', status: 'connected' }];
  let html = renderToStaticMarkup(createElement(TwitchGuide, { s: r.snapshot() }));
  expect(html).toContain('https://www.twitch.tv/test_channel/chat');
  expect(html).toContain('Press Start battle');
  r.game.phase = 'results';
  html = renderToStaticMarkup(createElement(TwitchGuide, { s: r.snapshot() }));
  expect(html).toContain('Reset, then Start battle');
  r.dispose();
});
