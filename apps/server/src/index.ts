import 'dotenv/config';
import { buildApp } from './app.js';
const { app } = await buildApp();
await app.listen({ port: Number(process.env.PORT ?? 3001), host: process.env.HOST ?? '127.0.0.1' });
console.log('PATCH WARS server listening on port ' + (process.env.PORT ?? 3001));
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => {
    void app.close().then(() => process.exit(0));
  });
