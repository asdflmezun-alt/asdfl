import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const files = [
  ['node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'assets/vendor/supabase.js'],
  ['node_modules/lucide/dist/umd/lucide.js', 'assets/vendor/lucide.js'],
  ['node_modules/leaflet/dist/leaflet.js', 'assets/vendor/leaflet.js'],
  ['node_modules/leaflet/dist/leaflet.css', 'assets/vendor/leaflet.css'],
  ['node_modules/leaflet/dist/images/layers.png', 'assets/vendor/images/layers.png'],
  ['node_modules/leaflet/dist/images/layers-2x.png', 'assets/vendor/images/layers-2x.png'],
  ['node_modules/leaflet/dist/images/marker-icon.png', 'assets/vendor/images/marker-icon.png']
];

for (const [source, destination] of files) {
  const target = resolve(destination);
  await mkdir(dirname(target), { recursive: true });
  if (/\.(?:css|js)$/.test(destination)) {
    const content = await readFile(resolve(source), 'utf8');
    const normalized = content.replace(/[ \t]+$/gm, '').trimEnd();
    await writeFile(target, `${normalized}\n`, 'utf8');
  } else {
    await copyFile(resolve(source), target);
  }
}
