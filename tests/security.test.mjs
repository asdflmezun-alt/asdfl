import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

const migration = await readFile('supabase/migrations/202606180001_security_hardening.sql', 'utf8');
const app = await readFile('js/app.js', 'utf8');
const admin = await readFile('js/yonetim.js', 'utf8');
const community = await readFile('js/topluluk.js', 'utf8');
const gallery = await readFile('js/galeri.js', 'utf8');
const career = await readFile('js/kariyer.js', 'utf8');
const home = await readFile('js/home.js', 'utf8');
const scanFixes = await readFile('supabase/migrations/202607080003_security_scan_fixes.sql', 'utf8');

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

test('gallery and career user content is escaped before rendering', () => {
  assert.match(gallery, /ASDFL\.escapeHTML\(g\.title\)/);
  assert.match(gallery, /ASDFL\.escapeHTML\(g\.description \|\| ''\)/);
  assert.match(gallery, /ASDFL\.escapeHTML\(authorName\)/);
  assert.match(gallery, /ASDFL\.safeURL\(g\.image_url/);
  assert.doesNotMatch(gallery, /<h4>\$\{g\.title\}<\/h4>/);

  assert.match(career, /function careerSafeHttpUrl/);
  assert.match(career, /ASDFL\.escapeHTML\(req\.title\)/);
  assert.match(career, /ASDFL\.escapeHTML\(req\.details\)/);
  assert.match(career, /ASDFL\.escapeHTML\(app\.cover_letter\)/);
  assert.match(career, /ASDFL\.escapeAttr\(resumeUrl \|\| '#'\)/);
  assert.doesNotMatch(career, /href="\$\{app\.resume_url\}"/);
});

test('admin application views and csv exports sanitize user supplied fields', () => {
  assert.match(admin, /function adminCsvCell/);
  assert.match(admin, /row\.map\(adminCsvCell\)/);
  assert.match(admin, /\[name, email, gpa, grade, program, date, status, bio\]\.map\(adminCsvCell\)/);
  assert.match(admin, /\[name, email, phone, gpa, grade, program, sponsor, amount, date\]\.map\(adminCsvCell\)/);
  assert.match(admin, /adminEscape\(studentName\)/);
  assert.match(admin, /adminEscape\(studentBio\)/);
  assert.match(admin, /adminEscape\(details\.bio\)/);
  assert.match(admin, /adminEscape\(details\.description\)/);
  assert.doesNotMatch(admin, /\$\{a\.details\.bio\}/);
  assert.doesNotMatch(admin, /\$\{a\.details\.description\}/);
});

test('post system fields and workflow tables are protected by database policy', () => {
  assert.match(scanFixes, /protect_post_system_fields/);
  assert.match(scanFixes, /Pinned changes must use set_post_pinned/);
  assert.match(scanFixes, /app\.post_like_counter_write/);
  assert.match(scanFixes, /CREATE OR REPLACE FUNCTION public\.set_post_pinned/);
  assert.match(scanFixes, /ALTER TABLE public\.applications ENABLE ROW LEVEL SECURITY/);
  assert.match(scanFixes, /ALTER TABLE public\.job_applications ENABLE ROW LEVEL SECURITY/);
  assert.match(scanFixes, /ALTER TABLE public\.contact_requests ENABLE ROW LEVEL SECURITY/);
  assert.match(scanFixes, /ALTER TABLE public\.data_requests ENABLE ROW LEVEL SECURITY/);
  assert.match(scanFixes, /ALTER TABLE public\.mentorships ENABLE ROW LEVEL SECURITY/);
  assert.match(scanFixes, /ALTER TABLE public\.mentorship_appointments ENABLE ROW LEVEL SECURITY/);
});

test('legal consent popup waits for verified auth state', () => {
  assert.match(app, /if \(this\.authReady && !this\._consentCheckRun\)/);
  assert.match(app, /if \(this\.supabase && !this\.authReady\) return/);
});

test('home page shows only future events in calendar preview', () => {
  assert.match(home, /ASDFL\.eventStart\(e\)/);
  assert.match(home, /e\.startDate >= now/);
  assert.match(home, /\.sort\(\(a, b\) => a\.startDate - b\.startDate\)/);
  assert.doesNotMatch(home, /return e\.upcoming \|\|/);
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

test('community posts have baseline RLS and poll votes are server-validated', async () => {
  const baseline = await readFile('supabase/migrations/202607080001_posts_baseline_and_poll_votes.sql', 'utf8');
  assert.match(baseline, /CREATE TABLE IF NOT EXISTS public\.posts/);
  assert.match(baseline, /"Authors and admins update posts"/);
  assert.match(baseline, /CREATE OR REPLACE FUNCTION public\.cast_poll_vote/);
  assert.match(baseline, /REVOKE ALL ON FUNCTION public\.cast_poll_vote/);
  // Oylar istemciden posts.content güncellenerek yazılamaz; yalnızca RPC kullanılır.
  assert.match(community, /\.rpc\('cast_poll_vote'/);
  assert.doesNotMatch(community, /from\('posts'\)\s*\.update\(/);
});

test('user text is not embedded in inline event handlers', () => {
  assert.doesNotMatch(community, /onclick="window\.filterByHashtag\('\$1'\)"/);
  assert.match(community, /data-tag="\$1"/);
});

test('events have admin-only writes and RSVPs are user-scoped', async () => {
  const events = await readFile('supabase/migrations/202607080002_events_baseline_and_rsvps.sql', 'utf8');
  assert.match(events, /CREATE TABLE IF NOT EXISTS public\.events/);
  assert.match(events, /"Admins insert events"[\s\S]*WITH CHECK \(public\.is_admin\(\)\)/);
  assert.match(events, /CREATE TABLE IF NOT EXISTS public\.event_rsvps/);
  assert.match(events, /"Users create own rsvp"[\s\S]*WITH CHECK \(auth\.uid\(\) = user_id\)/);
  // Kontenjan sunucuda uygulanır; istemci sayaçla aşamaz.
  assert.match(events, /CREATE OR REPLACE FUNCTION public\.enforce_event_capacity/);
  assert.match(events, /Event capacity full/);
  // Katılımcı e-posta/telefonuna yalnızca admin RPC'siyle erişilir.
  assert.match(events, /CREATE OR REPLACE FUNCTION public\.list_event_attendees/);
  assert.match(events, /Admin privileges required/);
  assert.match(events, /REVOKE ALL ON FUNCTION public\.list_event_attendees/);
});

test('events page escapes user content and scopes rsvp mutations', async () => {
  const events = await readFile('js/etkinlikler.js', 'utf8');
  assert.match(events, /const E = ASDFL\.escapeHTML/);
  assert.match(events, /E\(ev\.title\)/);
  assert.match(events, /E\(ev\.desc\)/);
  // Kullanıcı yalnızca kendi RSVP'sini siler/ekler.
  assert.match(events, /from\('event_rsvps'\)\.delete\(\)\.eq\('event_id', eventId\)\.eq\('user_id', myId\)/);
  assert.match(events, /from\('event_rsvps'\)\.insert\(\{ event_id: eventId, user_id: myId/);
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
