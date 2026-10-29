import 'dotenv/config';
import { setTimeout } from 'node:timers/promises';
import { writeFile } from 'node:fs/promises';
import { Room } from '../apps/server/src/room.js';
const r = new Room('local-verification', 'live', 'ollama', 1, 120000);
const started = performance.now();
r.channels = [{ id: 'local-test', name: 'local_test', team: 'ember', status: 'connected' }];
try {
  r.start();
  r.receive({
    broadcaster_user_id: 'local-test',
    chatter_user_id: 'proposer',
    chatter_user_name: 'Test viewer',
    message_id: '1',
    message: { text: '!forge A sturdy guardian that starts with a protective shield' },
  });
  r.openVote();
  r.receive({
    broadcaster_user_id: 'local-test',
    chatter_user_id: 'voter',
    chatter_user_name: 'Test viewer',
    message_id: '2',
    message: { text: '!vote p1' },
  });
  r.launchForge();
  r.paused = true;
  while (
    r.forge &&
    !['approved', 'rejected'].includes(r.forge.status) &&
    performance.now() - started < 125000
  )
    await setTimeout(200);
  if (r.forge?.status !== 'approved') throw new Error(r.forge?.error || 'No approved result');
  r.paused = false;
  for (let i = 0; i < 60; i++) r.tick();
  const deployed = r.game.units.filter((u) => u.blueprintId === r.forge?.blueprint?.id);
  if ((r.forge.status as string) !== 'deployed' || deployed.length !== 2)
    throw new Error('Approved unit was not deployed');
  const evidence = {
    date: new Date().toISOString(),
    mode: 'Synthetic normalized chat -> real Ollama worker -> validation -> 200 battles -> paused reveal -> deployment. Not a real Twitch test.',
    provider: r.provider,
    elapsedMs: Math.round(performance.now() - started),
    attempts: r.forge.attempts,
    status: r.forge.status,
    blueprint: r.forge.blueprint,
    report: r.forge.report,
    deployedUnits: deployed.length,
  };
  await writeFile(
    'docs/evaluation/local-forge-flow.json',
    JSON.stringify(evidence, null, 2) + '\n',
  );
  console.log(
    JSON.stringify({
      status: evidence.status,
      elapsedMs: evidence.elapsedMs,
      attempts: evidence.attempts,
      name: evidence.blueprint?.name,
      deployedUnits: deployed.length,
    }),
  );
} finally {
  r.dispose();
}
