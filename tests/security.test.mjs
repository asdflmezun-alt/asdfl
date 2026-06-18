import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

const migration = await readFile('supabase/migrations/202606180001_security_hardening.sql', 'utf8');
const app = await readFile('js/app.js', 'utf8');
const admin = await readFile('js/yonetim.js', 'utf8');
const community = await readFile('js/topluluk.js', 'utf8');

test('profile privilege escalation is blocked in the database', () => {
  assert.match(migration, /protect_profile_privileges/);
  assert.match(migration, /Role changes must use set_user_role/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.set_user_role/);
  assert.match(admin, /\.rpc\('set_user_role'/);
  assert.doesNotMatch(admin, /from\('profiles'\)\.update\(\{ role:/);
});

test('public profile reads use the share-safe view', () => {
  assert.match(migration, /CREATE VIEW public\.public_profiles/);
  assert.match(migration, /CASE WHEN share_email THEN email ELSE NULL END/);
  assert.match(migration, /REVOKE SELECT ON public\.profiles FROM anon, authenticated/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.get_my_profile/);
  assert.doesNotMatch(app, /profiles![^)]*\b(email|phone)\b/);
  assert.match(app, /from\('public_profiles'\)/);
  assert.doesNotMatch(app, /from\('profiles'\)\.select\('\*'\)/);
  assert.match(app, /share_email: Boolean\(d\.email\)/);
  assert.match(app, /queryWithTimeout\(query, 8000\)/);
});

test('known stored XSS fields are escaped', () => {
  assert.match(community, /escapeHtml\(c\.authorName\)/);
  assert.match(community, /escapeHtml\(c\.authorMeta\)/);
  assert.match(admin, /escapeHTML\(m\.name\)/);
  assert.match(admin, /escapeHTML\(m\.email \|\| ''\)/);
});

test('early cached-user rendering uses bootstrap sanitizers', async () => {
  const bootstrap = await readFile('js/bootstrap.js', 'utf8');
  assert.match(bootstrap, /window\.safeHTML/);
  assert.match(bootstrap, /window\.safeURL/);
  const htmlFiles = (await readdir('.')).filter(file => file.endsWith('.html'));
  for (const file of htmlFiles) {
    const html = await readFile(file, 'utf8');
    assert.doesNotMatch(html, /\$\{user\.(?:name|role)\}/, file);
    assert.doesNotMatch(html, /\$\{avatarUrl\}/, file);
  }
});

test('uploads are restricted on client and storage', () => {
  assert.match(app, /maxImageBytes: 5 \* 1024 \* 1024/);
  assert.match(migration, /file_size_limit = 5242880/);
  assert.match(migration, /storage\.foldername\(name\)/);
  assert.match(migration, /allowed_mime_types/);
  assert.match(migration, /can_upload_gallery/);
});

test('HTML pages do not execute third-party CDN assets', async () => {
  const htmlFiles = (await readdir('.')).filter(file => file.endsWith('.html'));
  for (const file of htmlFiles) {
    const html = await readFile(file, 'utf8');
    assert.doesNotMatch(html, /<script[^>]+src=["']https:\/\//i, file);
    assert.doesNotMatch(html, /<link[^>]+href=["']https:\/\//i, file);
  }
});

test('production security headers are declared', async () => {
  const headers = await readFile('_headers', 'utf8');
  assert.match(headers, /Content-Security-Policy:/);
  assert.match(headers, /X-Content-Type-Options: nosniff/);
  assert.match(headers, /Referrer-Policy:/);
});
