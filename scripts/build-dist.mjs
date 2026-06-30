/**
 * build-dist.mjs
 * Tüm site dosyalarını dist/ klasörüne kopyalar (Netlify deploy için).
 * Önce `npm run vendor` çalıştırır, sonra dosyaları kopyalar.
 */
import { copyFile, mkdir, readdir, stat, rm } from 'node:fs/promises';
import { join, relative, dirname } from 'node:path';

const SRC = '.';
const DEST = 'dist';

// Kopyalanmayacak klasör ve dosyalar
const EXCLUDE = new Set([
  'dist',
  'node_modules',
  '.git',
  '.github',
  'scratch',
  'tests',
  'scripts',
  'supabase',
  'package.json',
  'package-lock.json',
  'agent.md',
  'README.md',
  '.gitattributes',
  '.gitignore',
  // Tek seferlik geliştirme scriptleri
  'add_lucide.js',
  'add_supabase_cdn.js',
  'replace_icons.js',
  'update_home_css.js',
  'update_modals.js',
  'update_modals_2.js',
  'map_logged_in_fixed.png',
]);

const EXCLUDE_EXT = new Set(['.sql', '.mjs', '.md', '.png']); // .png var ama assets/vendor/images gerekiyor aşağıda özel handle

async function shouldExclude(name, fullPath) {
  if (EXCLUDE.has(name)) return true;
  // SQL, script dosyaları
  const ext = name.includes('.') ? '.' + name.split('.').pop() : '';
  if (EXCLUDE_EXT.has(ext) && !fullPath.includes('assets')) return true;
  return false;
}

async function copyDir(src, dest) {
  const entries = await readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    const relPath = relative(SRC, srcPath);

    if (await shouldExclude(entry.name, relPath)) continue;

    if (entry.isDirectory()) {
      await mkdir(destPath, { recursive: true });
      await copyDir(srcPath, destPath);
    } else {
      await mkdir(dirname(destPath), { recursive: true });
      await copyFile(srcPath, destPath);
    }
  }
}

console.log('🔨 dist/ temizleniyor...');
await rm(DEST, { recursive: true, force: true });
await mkdir(DEST, { recursive: true });

console.log('📦 Dosyalar kopyalanıyor...');
await copyDir(SRC, DEST);

console.log('✅ dist/ klasörü hazır! Netlify\'a deploy edebilirsiniz.');
