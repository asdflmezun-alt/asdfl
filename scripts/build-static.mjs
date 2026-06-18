import { copyFile, cp, mkdir, readdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const output = resolve('dist');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const directory of ['assets', 'css', 'js']) {
  await cp(resolve(directory), resolve(output, directory), { recursive: true });
}

const rootFiles = await readdir('.', { withFileTypes: true });
for (const entry of rootFiles) {
  if (!entry.isFile()) continue;
  if (entry.name.endsWith('.html') || entry.name === '_headers' || entry.name === 'map_logged_in_fixed.png') {
    await copyFile(resolve(entry.name), resolve(output, entry.name));
  }
}

console.log('Static site generated in dist/');
