import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const mentor = await readFile('js/mentorluk.js', 'utf8');
const mentorHtml = await readFile('mentorluk.html', 'utf8');
const sw = await readFile('sw.js', 'utf8');

test('appointment deep links accept only canonical UUID values', () => {
  assert.match(mentor, /APPOINTMENT_UUID_PATTERN = \/\^\[0-9a-f\]\{8\}/);
  assert.match(mentor, /new URLSearchParams\(search\)\.get\('appointment'\)/);
  assert.match(mentor, /APPOINTMENT_UUID_PATTERN\.test\(id\) \? id\.toLowerCase\(\) : null/);
});

test('appointment deep links resolve only against the RLS-scoped appointment list', () => {
  assert.match(mentor, /appointments\.find\(item => String\(item\.id \|\| ''\)\.toLowerCase\(\) === deepLink\.id\)/);
  assert.match(mentor, /Bu randevu bulunamadı veya görüntüleme yetkiniz yok\./);
  assert.doesNotMatch(mentor, /openAppointmentDeepLink[\s\S]*?\.from\('mentorship_appointments'\)/);
});

test('a resolved appointment opens its calendar date and focuses the exact card accessibly', () => {
  assert.match(mentor, /data-appointment-id="\$\{mentorEscapeAttr\(appointment\.id\)\}" tabindex="-1"/);
  assert.match(mentor, /window\.switchPortalTab\('calendar'\);[\s\S]*selectCalendarDate\(localDateKey\(appointmentDate\)\)/);
  assert.match(mentor, /querySelectorAll\('\[data-appointment-id\]'\)/);
  assert.match(mentor, /prefers-reduced-motion: reduce/);
  assert.match(mentor, /scrollIntoView\(\{ behavior: reduceMotion \? 'auto' : 'smooth'/);
  assert.match(mentor, /card\.focus\(\{ preventScroll: true \}\)/);
  assert.match(mentor, /card\.setAttribute\('aria-current', 'true'\)/);
});

test('mentorship script and service worker cache versions are bumped together', () => {
  assert.match(mentorHtml, /js\/mentorluk\.js\?v=1\.4/);
  assert.match(sw, /CACHE_VERSION = 'v42'/);
});
