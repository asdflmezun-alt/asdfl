import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile('imece.html', 'utf8');
const css = await readFile('css/imece.css', 'utf8');
const js = await readFile('js/imece.js', 'utf8');

test('guests see the explainer without loading member data', () => {
  assert.match(html, /id="imeceGuest"/);
  assert.match(html, /id="imeceMember" hidden/);
  assert.match(js, /if \(!ASDFL\.currentUser\) \{[\s\S]*setGuestState\(\);[\s\S]*return;[\s\S]*\}[\s\S]*setMemberState\(\);[\s\S]*await loadRequests\(\)/);
  assert.match(html, /İmece acil servis değildir/);
});

test('member feed uses an exact privacy-preserving select and separately loads public authors', () => {
  assert.match(js, /requestColumns: 'id,author_id,category,title,description,urgency,status,audience_all,expires_at,created_at,updated_at,resolved_at'/);
  assert.match(js, /ASDFL\.queryWithTimeout\([\s\S]*\.from\('imece_request_feed'\)[\s\S]*\.select\(IMECE_API\.requestColumns\)/);
  assert.match(js, /profileColumns: 'id,name,role,job,city,avatar_url,avatar_position'/);
  assert.match(js, /\.from\('public_profiles'\)[\s\S]*\.select\(IMECE_API\.profileColumns\)[\s\S]*\.in\('id', ids\)/);
  assert.doesNotMatch(js, /requestColumns:[^\n]*target_user_ids/);
  assert.match(js, /Kişisel hedefler panoda gösterilmez/);
});

test('all database and user content is safely rendered in its output context', () => {
  assert.match(js, /const escapeHTML = value => ASDFL\.escapeHTML\(value\)/);
  assert.match(js, /const escapeAttr = value => ASDFL\.escapeAttr\(value\)/);
  assert.match(js, /ASDFL\.safeURL\(`mesajlar\.html\?user=/);
  assert.match(js, /escapeHTML\(request\.title/);
  assert.match(js, /escapeHTML\(request\.description/);
  assert.match(js, /data-request-id="\$\{escapeAttr\(id\)\}"/);
  assert.doesNotMatch(js, /innerHTML\s*=\s*request\./);
});

test('create, status and report actions use the database RPC contract', () => {
  assert.match(js, /createRpc: 'create_imece_request'/);
  assert.match(js, /updateStatusRpc: 'update_imece_request_status'/);
  assert.match(js, /reportRpc: 'report_imece_request'/);
  for (const parameter of ['p_category', 'p_title', 'p_description', 'p_urgency', 'p_audience_all', 'p_target_roles', 'p_target_cities', 'p_target_jobs', 'p_target_companies', 'p_target_universities', 'p_target_user_ids', 'p_expires_at']) {
    assert.match(js, new RegExp(`${parameter}:`));
  }
  assert.match(js, /\{ p_request_id: id, p_status: status \}/);
  assert.match(js, /\{ p_request_id: id, p_reason: normalizedReason \}/);
  assert.match(html, /id="imeceReportReason" minlength="10" maxlength="500"/);
  assert.doesNotMatch(js, /window\.prompt/);
});

test('form allowlists and lengths match the database contract', () => {
  for (const category of ['contact', 'health', 'career', 'education', 'legal', 'technical', 'logistics', 'other']) {
    assert.match(html, new RegExp(`<option value="${category}">`));
  }
  for (const rejected of ['material', 'transport', 'solidarity', 'soon']) {
    assert.doesNotMatch(html, new RegExp(`value="${rejected}"`));
  }
  assert.match(html, /id="imeceTitleInput"[^>]*minlength="8" maxlength="140"/);
  assert.match(html, /id="imeceDescription"[^>]*minlength="20" maxlength="2500"/);
});

test('targeting validates at least one notification audience and person search is bounded', () => {
  assert.match(html, /Pano tüm üyelere açıktır; seçimler yalnızca yeni ihtiyaç bildiriminin alıcılarını belirler/);
  assert.match(js, /hasNotificationTarget\(target\)/);
  assert.match(js, /query\.length < 2/);
  assert.match(js, /window\.setTimeout\(\(\) => searchPeople\(query\), 300\)/);
  assert.match(js, /\.ilike\('name', `%\$\{term\}%`\)[\s\S]*\.limit\(8\)/);
  assert.match(js, /selectedPeople = new Map\(\)/);
});

test('cards expose the required owner, messaging and reporting actions', () => {
  assert.match(js, /data-messenger-user="\$\{escapeAttr\(authorId\)\}"/);
  assert.match(js, /request\.status === 'open'/);
  assert.match(js, /data-status="resolved"/);
  assert.match(js, /data-status="closed"/);
  assert.match(js, /data-status="open"/);
  assert.match(js, /data-action="report"/);
});

test('request deep links validate UUID and focus the exact accessible card', () => {
  assert.match(js, /new URLSearchParams\(search\)\.get\('request'\)/);
  assert.match(js, /UUID_PATTERN\.test\(value\) \? value\.toLowerCase\(\) : null/);
  assert.match(js, /querySelectorAll\('\[data-request-id\]'\)/);
  assert.match(js, /scrollIntoView\(\{ behavior: reduceMotion \? 'auto' : 'smooth'/);
  assert.match(js, /card\.focus\(\{ preventScroll: true \}\)/);
});

test('İmece dialogs are explicitly centered in the viewport', () => {
  assert.match(css, /\.imece-dialog \{[^}]*position: fixed;[^}]*top: 50%;[^}]*left: 50%;[^}]*margin: 0;[^}]*transform: translate\(-50%,-50%\)/);
});

test('UI is responsive, reduced-motion aware and avoids raw localStorage', () => {
  assert.match(css, /\[hidden\] \{ display: none !important; \}/);
  assert.match(css, /@media \(max-width: 480px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /min-height: 44px/);
  assert.match(html, /css\/imece\.css\?v=1\.1/);
  assert.match(html, /js\/imece\.js\?v=1\.0/);
  assert.doesNotMatch(js, /\blocalStorage\b/);
  assert.doesNotMatch(html, /\blocalStorage\b/);
});
