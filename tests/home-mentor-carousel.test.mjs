import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [home, index, homeCss] = await Promise.all([
  readFile('js/home.js', 'utf8'),
  readFile('index.html', 'utf8'),
  readFile('css/home.css', 'utf8')
]);

test('ana sayfadaki mentör vitrini tüm kayıtları döngü halinde gösterir', () => {
  assert.doesNotMatch(home, /filter\(a => a\.mentor[\s\S]*\)\.slice\(0, 4\)/);
  assert.match(home, /const shouldLoop = mentors\.length > 4/);
  assert.match(home, /ASDFL\.safeURL\(`profil\.html\?id=\$\{encodeURIComponent\(a\.id\)\}`\)/);
  assert.match(home, /aria-label="\$\{ASDFL\.escapeAttr\(profileLabel\)\}"/);
  assert.match(home, /featured-alumni-group/);
  assert.match(index, /class="featured-alumni-carousel"[\s\S]*class="grid-4 featured-alumni-track"/);
  assert.match(homeCss, /\.featured-alumni-track\.is-looping[\s\S]*animation: featured-alumni-loop var\(--featured-alumni-duration, 52s\) linear infinite/);
  assert.match(homeCss, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.featured-alumni-track\.is-looping/);
});
