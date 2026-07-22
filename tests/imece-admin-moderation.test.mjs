import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const admin = await readFile('js/yonetim.js', 'utf8');
const adminHtml = await readFile('yonetim.html', 'utf8');

test('admin loads exact imece report and privacy-safe request fields', () => {
  assert.match(admin, /let allImeceReports = \[\]/);
  assert.match(admin, /\.from\('imece_reports'\)[\s\S]*\.select\('id,request_id,reporter_id,reason,status,moderator_id,reviewed_at,created_at'\)/);
  assert.match(admin, /\.from\('imece_request_feed'\)[\s\S]*\.select\('id,author_id,title,description,status'\)[\s\S]*\.in\('id', requestIds\)/);
  assert.match(admin, /\.from\('public_profiles'\)[\s\S]*\.select\('id,name,role'\)[\s\S]*\.in\('id', missingProfileIds\)/);
  assert.match(admin, /new Map\(allMembers\.map\(member => \[member\.id, member\]\)\)/);
});

test('imece reports join the moderation union and render escaped details', () => {
  assert.match(admin, /allImeceReports\.map\(report => \(\{ \.\.\.report, reportType: 'imece' \}\)\)/);
  assert.match(admin, /adminEscape\(reportedTitle\)/);
  assert.match(admin, /adminEscape\(String\(reportedText\)\.slice\(0, 500\)\)/);
  assert.match(admin, /adminEscape\(reporterName\)/);
  assert.match(admin, /adminEscape\(authorName\)/);
  assert.match(admin, /adminEscape\(report\.reason \|\| 'Neden belirtilmedi'\)/);
  assert.match(admin, /imece\.html\?request=\$\{ASDFL\.escapeAttr\(report\.request\.id\)\}/);
  assert.match(admin, /!isMessageReport && !isImeceReport/);
});

test('imece moderation uses the exact review RPC without delete action', () => {
  const statusFunction = admin.match(/window\.updateImeceReportStatus = async function\(reportId, status\)[\s\S]*?\n};/)?.[0] || '';
  assert.match(admin, /window\.updateImeceReportStatus = async function\(reportId, status\)/);
  assert.match(admin, /rpc\('review_imece_report', \{[\s\S]*p_report_id: reportId,[\s\S]*p_status: status/);
  assert.match(admin, /isImeceReport \? 'updateImeceReportStatus'/);
  assert.doesNotMatch(statusFunction, /deleteReportedPost\(/);
});

test('imece pending reports update moderation stats, badge and priority queue', () => {
  assert.match(admin, /\[\.\.\.allPostReports, \.\.\.allMessageReports, \.\.\.allImeceReports\]\.filter\(report => report\.status === 'Pending'\)\.length/);
  assert.match(admin, /allImeceReports\.filter\(report => report\.status === 'Pending'\)\.forEach/);
  assert.match(admin, /meta: report\.reason \|\| 'İmece moderasyonu incelemesi bekliyor'/);
  assert.match(admin, /reportBadge\.textContent = pendingReports/);
  assert.match(admin, /allImeceReports = \[\];[\s\S]*ASDFL\._storage\.getItem/);
});

test('authenticated admin honors only the exact moderation hash after loading data', () => {
  assert.match(admin, /await loadAdminData\(\);[\s\S]*window\.location\.hash === '#moderation' \? 'moderation' : currentTab/);
  assert.match(admin, /switchAdminTab\(initialTab, document\.getElementById\(`btn-tab-\$\{initialTab\}`\)\)/);
  assert.doesNotMatch(admin, /location\.hash\.replace/);
});

test('admin copy and script cache token include imece moderation', () => {
  assert.match(adminHtml, /özel mesajları ve İmece ihtiyaçlarını tek kuyrukta inceleyin/);
  assert.match(admin, /gönderi, mesaj veya İmece moderasyonu/);
  assert.match(adminHtml, /js\/yonetim\.js\?v=1\.4/);
});
