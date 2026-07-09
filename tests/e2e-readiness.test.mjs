import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const app = await readFile('js/app.js', 'utf8');
const home = await readFile('js/home.js', 'utf8');
const student = await readFile('js/ogrenci.js', 'utf8');
const community = await readFile('js/topluluk.js', 'utf8');
const profile = await readFile('profil.html', 'utf8');
const adminHtml = await readFile('yonetim.html', 'utf8');
const admin = await readFile('js/yonetim.js', 'utf8');
const sw = await readFile('sw.js', 'utf8');

test('guest homepage keeps member-only previews gated', () => {
  assert.match(home, /ASDFL\.currentUser \? ASDFL\.fetchAlumni\(\) : Promise\.resolve\(\[\]\)/);
  assert.match(home, /ASDFL\.currentUser \? ASDFL\.fetchPosts\(\) : Promise\.resolve\(\[\]\)/);
  assert.match(home, /openModal\('loginModal'\)/);
});

test('event previews use real future dates consistently', () => {
  assert.match(app, /eventIsUpcoming\(ev/);
  assert.match(home, /ASDFL\.eventStart\(e\)/);
  assert.match(home, /e\.startDate >= now/);
  assert.match(student, /ASDFL\.eventIsUpcoming\(e\)/);
  assert.doesNotMatch(student, /filter\(e => e\.upcoming\)/);
});

test('profile has an activity and application summary for signed-in users', () => {
  assert.match(profile, /id="myEventsList"/);
  assert.match(profile, /id="myApplicationSummary"/);
  assert.match(profile, /loadProfileActivitySummary/);
  assert.match(profile, /event_rsvps/);
  assert.match(profile, /job_applications/);
});

test('community event attachments surface live rsvp actions', () => {
  assert.match(community, /loadAttachedEventRsvpState\(posts\)/);
  assert.match(community, /event-attach-attendees/);
  assert.match(community, /Katılıyorum/);
  assert.match(community, /etkinlikler\.html#event-\$\{eventId\}/);
});

test('admin moderation is visible and actionable', () => {
  assert.match(adminHtml, /btn-tab-moderation/);
  assert.match(adminHtml, /adminModerationReportsList/);
  assert.match(admin, /from\('post_reports'\)/);
  assert.match(admin, /renderModerationReports/);
  assert.match(admin, /updatePostReportStatus/);
  assert.match(admin, /deleteReportedPost/);
});

test('local development bypasses stale service worker caches', () => {
  assert.match(sw, /DEV_BYPASS_CACHE/);
  assert.match(sw, /localhost/);
  assert.match(sw, /event\.respondWith\(fetch\(request\)\.catch/);
});

test('shared UI layer supports accessible mobile navigation and modals', () => {
  assert.match(app, /initMobileBottomNav/);
  assert.match(app, /trapFocusInModal/);
  assert.match(app, /aria-modal/);
  assert.match(app, /focusFirstInModal/);
  assert.match(app, /_lastFocusedBeforeModal/);
});
