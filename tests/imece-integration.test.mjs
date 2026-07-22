import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const navigationPages = [
  'burs-mentorluk.html',
  'etkinlikler.html',
  'galeri.html',
  'index.html',
  'kariyer.html',
  'mentorluk.html',
  'mesajlar.html',
  'mezunlar.html',
  'ogrenci.html',
  'profil.html',
  'topluluk.html',
  'yonetim.html'
];

test('İmece is reachable from every application navigation', async () => {
  for (const page of navigationPages) {
    const html = await readFile(page, 'utf8');
    assert.match(html, /<li><a href="imece\.html"><i data-lucide="hand-heart"[^>]*><\/i> İmece<\/a><\/li>/, page);
  }

  const imece = await readFile('imece.html', 'utf8');
  assert.match(imece, /href="imece\.html" class="active" aria-current="page"/);
});

test('İmece assets are versioned and precached with a fresh cache', async () => {
  const sw = await readFile('sw.js', 'utf8');
  assert.match(sw, /CACHE_VERSION = 'v42'/);
  assert.match(sw, /'imece\.html'/);
  assert.match(sw, /'css\/imece\.css\?v=1\.1'/);
  assert.match(sw, /'js\/imece\.js\?v=1\.0'/);
  assert.match(sw, /'js\/app\.js\?v=1\.18'/);
});

test('login returns guests to the İmece deep link safely', async () => {
  const app = await readFile('js/app.js', 'utf8');
  const imece = await readFile('imece.html', 'utf8');
  assert.match(app, /_loginReturnRoutes: new Set\(\[[\s\S]*'imece\.html'/);
  assert.match(app, /sanitizeLoginReturnPath\(`\$\{window\.location\.pathname\}\$\{window\.location\.search\}\$\{window\.location\.hash\}`\)/);
  assert.match(imece, /js\/app\.js\?v=1\.18/);
});

test('email digests label İmece request and report notifications', async () => {
  const digest = await readFile('supabase/functions/send-email-digest/index.ts', 'utf8');
  assert.match(digest, /imece_request: "İmece Çağrısı"/);
  assert.match(digest, /imece_report: "İmece Şikâyeti"/);
});
