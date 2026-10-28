import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const root = JSON.parse(await readFile('package.json', 'utf8'));
const rows = [];
for (const name of Object.keys({ ...root.dependencies, ...root.devDependencies })) {
  const p = JSON.parse(await readFile(join('node_modules', name, 'package.json'), 'utf8'));
  rows.push({
    name,
    version: p.version,
    license: p.license ?? 'See package LICENSE',
    repository: p.repository ?? null,
  });
}
await writeFile('docs/dependency-licenses.json', JSON.stringify(rows, null, 2));
