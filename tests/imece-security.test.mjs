import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationPath = 'supabase/migrations/20260721232943_imece_targeted_need_board.sql';
const sql = await readFile(migrationPath, 'utf8');

function functionBody(name, nextMarker) {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}`);
  assert.notEqual(start, -1, `${name} bulunamadı`);
  const end = nextMarker ? sql.indexOf(nextMarker, start) : sql.length;
  assert.notEqual(end, -1, `${name} bitiş sınırı bulunamadı`);
  return sql.slice(start, end);
}

const createRpc = functionBody('create_imece_request', 'CREATE OR REPLACE FUNCTION public.update_imece_request_status');
const statusRpc = functionBody('update_imece_request_status', 'CREATE TABLE IF NOT EXISTS public.imece_reports');
const reportRpc = functionBody('report_imece_request', 'CREATE OR REPLACE FUNCTION public.review_imece_report');
const reviewReportRpc = functionBody('review_imece_report', 'REVOKE ALL ON FUNCTION public.create_imece_request');

test('imece request schema constrains content, audience, expiry and workflow', () => {
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.imece_requests/);
  for (const category of ['contact', 'health', 'career', 'education', 'legal', 'technical', 'logistics', 'other']) {
    assert.match(sql, new RegExp(`'${category}'`));
  }
  assert.match(sql, /char_length\(btrim\(title\)\) BETWEEN 8 AND 140/);
  assert.match(sql, /char_length\(btrim\(description\)\) BETWEEN 20 AND 2500/);
  assert.match(sql, /urgency IN \('normal', 'urgent'\)/);
  assert.match(sql, /status IN \('open', 'resolved', 'closed'\)/);
  assert.match(sql, /target_user_ids UUID\[\][\s\S]*cardinality\(target_user_ids\) <= 50/);
  assert.match(sql, /imece_requests_has_audience/);
  assert.match(sql, /expires_at > created_at AND expires_at <= created_at \+ INTERVAL '30 days'/);
  assert.match(sql, /imece_requests_resolution_consistent/);
});

test('imece request indexes support author lookup and the open feed', () => {
  assert.match(sql, /idx_imece_requests_author_created[\s\S]*\(author_id, created_at DESC\)/);
  assert.match(sql, /idx_imece_requests_open_feed[\s\S]*\(expires_at, created_at DESC\)[\s\S]*WHERE status = 'open'/);
});

test('authenticated members read a safe feed without target routing metadata', () => {
  assert.match(sql, /ALTER TABLE public\.imece_requests ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /Authenticated members read imece requests[\s\S]*FOR SELECT TO authenticated[\s\S]*USING \(status <> 'open' OR expires_at > NOW\(\)\)/);
  assert.match(sql, /REVOKE ALL ON TABLE public\.imece_requests FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /GRANT SELECT \([\s\S]*resolved_at[\s\S]*\) ON TABLE public\.imece_requests TO authenticated/);
  assert.match(sql, /CREATE OR REPLACE VIEW public\.imece_request_feed[\s\S]*security_invoker = true/);
  assert.match(sql, /GRANT SELECT ON TABLE public\.imece_request_feed TO authenticated/);

  const viewSql = sql.slice(
    sql.indexOf('CREATE OR REPLACE VIEW public.imece_request_feed'),
    sql.indexOf('REVOKE ALL ON TABLE public.imece_request_feed')
  );
  assert.doesNotMatch(viewSql, /target_(?:roles|cities|jobs|companies|universities|user_ids)|is_broadcast|notification_recipient_count/);
  assert.match(viewSql, /WHERE status <> 'open' OR expires_at > NOW\(\)/);
  assert.doesNotMatch(sql, /GRANT (?:INSERT|UPDATE|DELETE|ALL)[^;]*public\.imece_requests[^;]*authenticated/i);
  assert.doesNotMatch(sql, /GRANT[^;]*ON TABLE public\.imece_requests TO anon/i);
});

test('create RPC is a locked, authenticated and bounded write path', () => {
  assert.match(createRpc, /RETURNS UUID[\s\S]*SECURITY DEFINER[\s\S]*SET search_path = ''/);
  assert.match(createRpc, /caller_id UUID := \(SELECT auth\.uid\(\)\)/);
  assert.match(createRpc, /pg_advisory_xact_lock/);
  assert.match(createRpc, /created_at > request_time - INTERVAL '24 hours'[\s\S]*\) >= 5/);
  assert.match(createRpc, /LIMIT 1001[\s\S]*matched_recipient_count > 1000/);
  assert.match(createRpc, /broad_notification := clean_audience_all[\s\S]*matched_recipient_count >= 250[\s\S]*matched_recipient_count \* 2 >= available_recipient_count/);
  assert.match(createRpc, /r\.is_broadcast = true[\s\S]*created_at > request_time - INTERVAL '24 hours'[\s\S]*\) >= 1/);
  assert.match(createRpc, /cardinality\(COALESCE\(p_target_roles/);
  assert.match(createRpc, /Hedef terimleri 2 ile 80 karakter arasında olmalıdır/);
  assert.match(createRpc, /En az bir hedef kitle seçmelisiniz/);
  assert.match(createRpc, /clean_expires_at > request_time \+ INTERVAL '30 days'/);
  assert.doesNotMatch(createRpc, /user_metadata|raw_user_meta_data/);
});

test('targeting is case-insensitive OR fanout across supported profile fields', () => {
  assert.match(createRpc, /clean_audience_all\s+OR p\.id = ANY\(clean_user_ids\)/);
  for (const field of ['role', 'city', 'job', 'specialization', 'academic_title', 'target_job', 'company', 'university']) {
    assert.match(createRpc, new RegExp(`COALESCE\\(p\\.${field}, ''\\)`), field);
  }
  assert.match(createRpc, /pg_catalog\.lower[\s\S]*pg_catalog\.strpos/);
  assert.match(createRpc, /WHERE p\.id <> caller_id/);
});

test('imece notification uses a deep link and never copies request content', () => {
  assert.match(createRpc, /'imece_request'/);
  assert.match(createRpc, /'Yeni İmece çağrısı'/);
  assert.match(createRpc, /'imece\.html\?request=' \|\| new_request_id::TEXT/);

  const notificationInsert = createRpc.slice(
    createRpc.indexOf('INSERT INTO public.notifications'),
    createRpc.indexOf('FROM pg_catalog.unnest(matched_recipient_ids)', createRpc.indexOf('INSERT INTO public.notifications'))
  );
  assert.doesNotMatch(notificationInsert, /clean_description|p_description|clean_title|p_title/);
  assert.match(createRpc, /FROM pg_catalog\.unnest\(matched_recipient_ids\) AS recipient\(id\)/);
});

test('status RPC permits only the author or a server-side admin decision', () => {
  assert.match(statusRpc, /SECURITY DEFINER[\s\S]*SET search_path = ''/);
  assert.match(statusRpc, /clean_status NOT IN \('open', 'resolved', 'closed'\)/);
  assert.match(statusRpc, /caller_id <> request_author_id AND NOT public\.is_admin\(\)/);
  assert.match(statusRpc, /clean_status = 'open' AND request_expires_at <= change_time/);
  assert.match(statusRpc, /Süresi geçmiş bir İmece çağrısı yeniden açılamaz/);
  assert.match(statusRpc, /FOR UPDATE/);
  assert.match(statusRpc, /resolved_at = CASE[\s\S]*clean_status = 'resolved'/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.protect_imece_request_fields/);
  assert.match(sql, /NEW\.author_id IS DISTINCT FROM OLD\.author_id/);
  assert.match(sql, /NEW\.target_user_ids IS DISTINCT FROM OLD\.target_user_ids/);
  assert.match(sql, /NEW\.is_broadcast IS DISTINCT FROM OLD\.is_broadcast/);
  assert.match(sql, /NEW\.notification_recipient_count IS DISTINCT FROM OLD\.notification_recipient_count/);
});

test('imece reports block self-reporting, duplicates and report spam', () => {
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.imece_reports/);
  assert.match(sql, /UNIQUE \(request_id, reporter_id\)/);
  assert.match(sql, /char_length\(btrim\(reason\)\) BETWEEN 10 AND 500/);
  assert.match(sql, /status TEXT NOT NULL DEFAULT 'Pending' CHECK \(status IN \('Pending', 'Reviewed', 'Dismissed'\)\)/);
  assert.match(sql, /moderator_id UUID REFERENCES public\.profiles\(id\) ON DELETE SET NULL/);
  assert.match(sql, /reviewed_at TIMESTAMPTZ/);
  assert.match(sql, /imece_reports_review_consistent/);
  assert.match(reportRpc, /SECURITY DEFINER[\s\S]*SET search_path = ''/);
  assert.match(reportRpc, /request_author_id = caller_id/);
  assert.match(reportRpc, /pg_advisory_xact_lock/);
  assert.match(reportRpc, /created_at > report_time - INTERVAL '24 hours'[\s\S]*\) >= 10/);
  assert.match(reportRpc, /request_id = p_request_id AND r\.reporter_id = caller_id/);
});

test('only admins can review or dismiss an imece report with an audit trail', () => {
  assert.match(reviewReportRpc, /RETURNS VOID[\s\S]*SECURITY DEFINER[\s\S]*SET search_path = ''/);
  assert.match(reviewReportRpc, /caller_id IS NULL OR NOT public\.is_admin\(\)/);
  assert.match(reviewReportRpc, /WHEN 'reviewed' THEN 'Reviewed'/);
  assert.match(reviewReportRpc, /WHEN 'dismissed' THEN 'Dismissed'/);
  assert.match(reviewReportRpc, /FOR UPDATE/);
  assert.match(reviewReportRpc, /moderator_id = caller_id/);
  assert.match(reviewReportRpc, /reviewed_at = pg_catalog\.now\(\)/);
});

test('report details are restricted to the reporter, admins and service role', () => {
  assert.match(sql, /ALTER TABLE public\.imece_reports ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /Reporters and admins read imece reports[\s\S]*\(SELECT auth\.uid\(\)\) = reporter_id OR public\.is_admin\(\)/);
  assert.match(sql, /REVOKE ALL ON TABLE public\.imece_reports FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /GRANT SELECT ON TABLE public\.imece_reports TO authenticated/);
  assert.match(sql, /GRANT SELECT ON TABLE public\.imece_reports TO service_role/);
  assert.doesNotMatch(sql, /GRANT (?:INSERT|UPDATE|DELETE|ALL)[^;]*public\.imece_reports[^;]*authenticated/i);
});

test('reports notify admins without exposing complaint or request text', () => {
  assert.match(reportRpc, /'imece_report'/);
  assert.match(reportRpc, /'yonetim\.html#moderation'/);
  assert.match(reportRpc, /WHERE p\.role = 'Admin'/);
  const adminNotification = reportRpc.slice(reportRpc.indexOf('INSERT INTO public.notifications'));
  assert.doesNotMatch(adminNotification, /clean_reason|p_reason|description|title\s*\|\|/);
});

test('all public RPCs have empty search paths and explicit execution ACLs', () => {
  for (const body of [createRpc, statusRpc, reportRpc, reviewReportRpc]) {
    assert.match(body, /SECURITY DEFINER/);
    assert.match(body, /SET search_path = ''/);
  }
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.create_imece_request\([\s\S]*FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.update_imece_request_status\(UUID, TEXT\) FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.report_imece_request\(UUID, TEXT\) FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.review_imece_report\(UUID, TEXT\) FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.create_imece_request\([\s\S]*\) TO authenticated/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.update_imece_request_status\(UUID, TEXT\) TO authenticated/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.report_imece_request\(UUID, TEXT\) TO authenticated/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.review_imece_report\(UUID, TEXT\) TO authenticated/);
});
