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
const adminCss = await readFile('css/yonetim.css', 'utf8');
const mentorHtml = await readFile('mentorluk.html', 'utf8');
const mentor = await readFile('js/mentorluk.js', 'utf8');
const mentorCss = await readFile('css/mentor.css', 'utf8');
const sw = await readFile('sw.js', 'utf8');
const mainCss = await readFile('css/main.css', 'utf8');
const homeCss = await readFile('css/home.css', 'utf8');
const animationsCss = await readFile('css/animations.css', 'utf8');
const messagesHtml = await readFile('mesajlar.html', 'utf8');
const messages = await readFile('js/mesajlar.js', 'utf8');
const messagesCss = await readFile('css/mesajlar.css', 'utf8');
const messengerWidget = await readFile('js/messenger-widget.js', 'utf8');
const messengerWidgetCss = await readFile('css/messenger-widget.css', 'utf8');

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

test('admin dashboard is operational and mobile responsive', () => {
  assert.match(adminHtml, /role="tablist"/);
  assert.match(adminHtml, /id="adminPriorityQueue"/);
  assert.match(adminHtml, /id="statPendingReports"/);
  assert.match(admin, /enhanceAdminTables/);
  assert.match(admin, /ASDFL\._storage\.getItem/);
  assert.doesNotMatch(admin, /\blocalStorage\./);
  assert.match(adminCss, /@media \(max-width:640px\)[\s\S]*content:attr\(data-label\)/);
  assert.match(adminCss, /\.admin-nav-shell \{ position:sticky/);
});

test('mentorship portal is premium, accessible and safely rendered', () => {
  assert.match(mentorHtml, /class="mentor-welcome"/);
  assert.match(mentorHtml, /role="tablist"/);
  assert.match(mentorHtml, /role="tabpanel"/);
  assert.match(mentor, /bindPortalTabKeyboard/);
  assert.match(mentor, /mentorEscapeHTML\(appointment\.notes\)/);
  assert.match(mentor, /mentorEscapeHTML\(request\.notes/);
  assert.match(mentor, /mentorJsString\(request\.id\)/);
  assert.match(mentor, /function localDateKey/);
  assert.doesNotMatch(mentor, /toISOString\(\)\.split\('T'\)/);
  assert.match(mentorCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(mentorCss, /\.calendar-nav-btn[\s\S]*width: 44px;[\s\S]*height: 44px;/);
  assert.match(mentorCss, /\.mentor-nav-shell\.card \{ position: sticky/);
});

test('community posts expose a functional and accessible report action', () => {
  assert.match(community, /post-report-btn/);
  assert.match(community, /'Bildirildi' : 'Bildir'/);
  assert.match(community, /aria-label="\$\{alreadyReported \? 'Bu paylaşım bildirildi' : 'Paylaşımı yönetime bildir'\}"/);
  assert.match(community, /from\('post_reports'\)\.insert/);
  assert.match(community, /reportedPosts\.add\(postId\)/);
  assert.match(community, /reportReasonType/);
});

test('community featured alumni are randomized on each page load', () => {
  assert.match(community, /const shuffled = \[\.\.\.candidates\]/);
  assert.match(community, /Math\.floor\(Math\.random\(\) \* \(i \+ 1\)\)/);
  assert.match(community, /const list = shuffled\.slice\(0, 4\)/);
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

test('login resumes a safe tab-scoped destination and gates incomplete profiles', () => {
  assert.match(app, /_loginReturnIntentKey: 'asdfl_login_return_intent_v1'/);
  assert.match(app, /window\.sessionStorage\.setItem\(this\._loginReturnIntentKey/);
  assert.match(app, /_loginReturnRoutes: new Set/);
  assert.match(app, /if \(!this\._loginReturnRoutes\.has\(route\)\) return null/);
  assert.match(app, /url\.origin !== window\.location\.origin/);
  assert.match(app, /this\.clearLoginReturnIntent\(\);\s*if \(!intent/);
  assert.match(app, /loadOnboardingProfile/);
  assert.match(app, /\.from\('profiles'\)[\s\S]*\.select\('id,role,name,city,bio/);
  assert.doesNotMatch(app, /role: cached\.role \|\| metadata\.role/);
  assert.match(app, /'profil\.html\?onboarding=1'/);
  assert.match(profile, /id="profileOnboardingPanel"/);
  assert.match(profile, /ASDFL\.getOnboardingRequirements/);
  assert.match(profile, /ASDFL\.consumeLoginReturnIntent/);
});

test('private messaging is responsive, safely rendered and integrated', () => {
  assert.match(messagesHtml, /id="messagesGate"/);
  assert.match(messagesHtml, /id="conversationList"/);
  assert.match(messagesHtml, /id="messageForm"/);
  assert.match(messages, /start_direct_conversation/);
  assert.match(messages, /send_conversation_message/);
  assert.match(messages, /mark_conversation_read/);
  assert.match(messages, /set_user_block/);
  assert.match(messages, /report_message/);
  assert.match(messages, /body\.textContent = String\(message\.body/);
  assert.match(messages, /UUID_PATTERN/);
  assert.match(messages, /POLL_INTERVAL_MS = 10000/);
  assert.match(messages, /postgres_changes/);
  assert.doesNotMatch(messages, /localStorage|ASDFL\._storage/);
  assert.match(messagesCss, /@media \(max-width: 760px\)/);
  assert.match(messagesCss, /\.messages-page \.mobile-bottom-nav \{ display: none !important; \}/);
  assert.match(messagesCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(messagesCss, /min-width: 44px; min-height: 44px/);
  assert.match(app, /href: 'mesajlar\.html', label: 'Mesajlar'/);
  assert.match(profile, /id="social-message"/);
  assert.match(mentor, /mesajlar\.html\?user=/);
});

test('authenticated members can reach a safe global messenger widget', () => {
  assert.match(app, /initMessengerWidgetAssets\(\)/);
  assert.match(app, /messenger-widget\.css\?v=1\.1/);
  assert.match(app, /messenger-widget\.js\?v=1\.1/);
  assert.match(app, /messages-page[\s\S]*mesajlar\.html/);
  assert.match(app, /ASDFLMessenger\?\.syncAuth/);
  assert.match(messengerWidget, /openForUser/);
  assert.match(messengerWidget, /syncAuth: syncAuthSnapshot/);
  assert.match(messengerWidget, /supabase\.auth\.getUser\(\)/);
  assert.match(messengerWidget, /verifiedUserId !== nextUserId/);
  assert.match(messengerWidget, /authEpoch !== state\.authEpoch/);
  assert.match(messengerWidget, /catch \(error\) \{[\s\S]*teardownSession\(\);[\s\S]*return false;/);
  assert.match(messengerWidget, /destroy: destroyWidget/);
  assert.match(messengerWidget, /\[data-messenger-user\]/);
  assert.match(messengerWidget, /!state\.userId \|\| !state\.root/);
  assert.match(messengerWidget, /send_conversation_message/);
  assert.match(messengerWidget, /mark_conversation_read/);
  assert.match(messengerWidget, /set_user_block/);
  assert.match(messengerWidget, /report_message/);
  assert.match(messengerWidget, /postgres_changes/);
  assert.match(messengerWidget, /table: 'conversations'/);
  assert.doesNotMatch(messengerWidget, /table: 'messages'/);
  assert.match(messengerWidget, /POLL_INTERVAL_MS = 15000/);
  assert.match(messengerWidget, /data-action="new-message"/);
  assert.match(messengerWidget, /id="asdflMessengerSearch"/);
  assert.match(messengerWidget, /\.from\('public_profiles'\)[\s\S]*\.ilike\('name', `%\$\{safePattern\}%`\)[\s\S]*\.neq\('id', state\.userId\)[\s\S]*\.limit\(8\)/);
  assert.match(messengerWidget, /term\.replace\(\/\[\\\\%_\]\//);
  assert.match(messengerWidget, /button\.dataset\.newMessageUser = profile\.id/);
  assert.match(messengerWidget, /name\.textContent = profile\.name/);
  assert.match(messengerWidget, /body\.textContent = String\(message\.body/);
  assert.doesNotMatch(messengerWidget, /select\('id,conversation_id,sender_id,body,created_at'\)\.in\('conversation_id', ids\)/);
  assert.match(messengerWidget, /\.eq\('user_id', state\.userId\)/);
  assert.doesNotMatch(messengerWidget, /localStorage|ASDFL\._storage/);
  assert.match(profile, /messageEl\.dataset\.messengerUser = targetUserId/);
  assert.match(profile, /\.social-icon-btn \{[\s\S]*width: 44px;[\s\S]*height: 44px;/);
  assert.match(mentor, /data-messenger-user=/);
  assert.match(messengerWidgetCss, /position:\s*fixed/);
  assert.match(messengerWidgetCss, /@media \(max-width: 600px\)/);
  assert.match(messengerWidgetCss, /min-width:\s*44px;\s*min-height:\s*44px/);
  assert.match(messengerWidgetCss, /@media \(prefers-reduced-motion: reduce\)/);
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
  assert.match(sw, /CACHE_VERSION = 'v32'/);
  assert.match(sw, /fetch\(request, \{ cache: 'no-store' \}\)/);
  assert.match(sw, /NETWORK_FIRST_ASSET_SUFFIXES/);
  assert.match(sw, /fetch\(request, \{ cache: 'no-cache' \}\)/);
  assert.match(sw, /js\/app\.js\?v=1\.13/);
  assert.match(sw, /css\/messenger-widget\.css\?v=1\.1/);
  assert.match(sw, /js\/messenger-widget\.js\?v=1\.1/);
  assert.match(sw, /css\/mesajlar\.css\?v=1\.0/);
  assert.match(sw, /js\/mesajlar\.js\?v=1\.0/);
  assert.match(sw, /assets\/vendor\/supabase\.js\?v=2\.108\.2-1/);
});
