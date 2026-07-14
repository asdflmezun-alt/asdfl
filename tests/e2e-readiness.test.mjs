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
const mainCss = await readFile('css/main.css', 'utf8');
const homeCss = await readFile('css/home.css', 'utf8');
const animationsCss = await readFile('css/animations.css', 'utf8');

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

test('community posts expose a functional and accessible report action', () => {
  assert.match(community, /post-report-btn/);
  assert.match(community, /'Bildirildi' : 'Bildir'/);
  assert.match(community, /aria-label="\$\{alreadyReported \? 'Bu paylaşım bildirildi' : 'Paylaşımı yönetime bildir'\}"/);
  assert.match(community, /from\('post_reports'\)\.insert/);
  assert.match(community, /reportedPosts\.add\(postId\)/);
  assert.match(community, /reportReasonType/);
});

test('local development bypasses stale service worker caches', () => {
  assert.match(sw, /DEV_BYPASS_CACHE/);
  assert.match(sw, /localhost/);
  assert.match(sw, /event\.respondWith\(fetch\(request\)\.catch/);
});

test('desktop navbar becomes a compact floating surface after scroll', () => {
  assert.match(mainCss, /@media \(min-width: 769px\)[\s\S]*\.navbar\.scrolled \{/);
  assert.match(mainCss, /\.navbar\.scrolled \{[\s\S]*top: \.75rem;[\s\S]*border-radius: 20px;/);
  assert.match(mainCss, /backdrop-filter: blur\(26px\) saturate\(185%\)/);
  assert.match(mainCss, /\.navbar\.scrolled \.nav-brand \.sub/);
  assert.match(mainCss, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.navbar::after/);
  assert.match(mainCss, /@media \(min-width: 769px\) and \(max-width: 1280px\)[\s\S]*\.nav-links\.open/);
  assert.match(mainCss, /\.hamburger \{[^}]*min-width:44px;[^}]*min-height:44px/);
  assert.match(animationsCss, /animation: pageEnter[^;]*backwards/);
  assert.doesNotMatch(animationsCss, /animation: pageEnter[^;]*both/);
});

test('mobile homepage avoids white flash and counter reflow', () => {
  assert.match(mainCss, /html\s*\{[\s\S]*background:\s*var\(--navy-900\)/);
  assert.match(mainCss, /\.mobile-bottom-nav\s*\{[\s\S]*grid-template-columns:\s*repeat\(auto-fit, minmax\(48px, 1fr\)\)/);
  assert.match(homeCss, /@media \(max-width: 500px\)[\s\S]*\.hero-stats\s*\{[\s\S]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(homeCss, /\.hero-stat-divider\s*\{\s*display:\s*none/);
  assert.match(homeCss, /\.hero-scroll-hint\s*\{[\s\S]*left:\s*50vw;[\s\S]*width:\s*max-content/);
  assert.match(homeCss, /animation:\s*heroScrollHintIn/);
  assert.match(homeCss, /@keyframes heroScrollHintIn[\s\S]*translate\(-50%, 0\)/);
});

test('shared UI layer supports accessible mobile navigation and modals', () => {
  assert.match(app, /initMobileBottomNav/);
  assert.match(app, /trapFocusInModal/);
  assert.match(app, /aria-modal/);
  assert.match(app, /focusFirstInModal/);
  assert.match(app, /_lastFocusedBeforeModal/);
});

test('mobile auth initialization preserves slow sessions without blocking auth events', () => {
  assert.match(app, /storage: ASDFL_STORAGE/);
  assert.match(app, /global: \{ fetch: supabaseFetchWithTimeout \}/);
  assert.match(app, /_subscribeToAuthChanges\(\);[\s\S]*auth\.getSession\(\)/);
  assert.match(app, /onAuthStateChange\(\(event, session\) =>/);
  assert.doesNotMatch(app, /onAuthStateChange\(async/);
  assert.match(app, /'INITIAL_SESSION', 'SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED'/);
  assert.match(app, /if \(this\.authReady\) this\.initNotificationBell\(\)/);
  assert.match(app, /}, 13000\)/);
  assert.match(app, /if \(this\.currentUser\) \{\s*this\.authReady = true;\s*this\.updateUIForAuth\(\);\s*\}/);
});

test('login and community loading fail safely on stalled mobile requests', () => {
  assert.match(app, /_loginInProgress/);
  assert.match(app, /Giriş yapılıyor\.\.\./);
  assert.match(app, /signInWithPassword[\s\S]*15000/);
  assert.match(community, /queryWithTimeout\(query, 10000\)/);
  assert.match(community, /data-retry-feed/);
  assert.match(community, /Topluluk akışı şu anda yüklenemedi/);
  assert.match(community, /asdfl:auth-changed/);
  assert.match(community, /refreshCommunityForAuth/);
});

test('critical auth assets bypass stale iOS PWA caches', () => {
  assert.match(sw, /CACHE_VERSION = 'v24'/);
  assert.match(sw, /fetch\(request, \{ cache: 'no-store' \}\)/);
  assert.match(sw, /NETWORK_FIRST_ASSET_SUFFIXES/);
  assert.match(sw, /fetch\(request, \{ cache: 'no-cache' \}\)/);
  assert.match(sw, /js\/app\.js\?v=1\.9/);
  assert.match(sw, /assets\/vendor\/supabase\.js\?v=2\.108\.2-1/);
});
