import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationPath = 'supabase/migrations/20260721223459_group_message_digests_and_link_appointments.sql';
const migration = await readFile(migrationPath, 'utf8');
const digestFunction = await readFile('supabase/functions/send-email-digest/index.ts', 'utf8');

function modelDigestPrefix(rows) {
  const sorted = [...rows].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  const conversationState = new Map();
  const mapped = sorted.map(row => {
    if (row.type !== 'direct_message' || !row.link) {
      return { ...row, unit: `notification:${row.id}` };
    }

    const key = `${row.userId}:${row.link}`;
    const state = conversationState.get(key);
    const session = !state || row.at - state.lastAt > 30 ? (state?.session || 0) + 1 : state.session;
    conversationState.set(key, { lastAt: row.at, session });
    return { ...row, unit: `direct_message:${row.link}:${session}` };
  });

  const units = new Map();
  for (const row of mapped) {
    const key = `${row.userId}:${row.unit}`;
    const current = units.get(key);
    if (!current || row.at < current.start) units.set(key, { userId: row.userId, unit: row.unit, start: row.at });
  }

  const ranked = [...units.values()].sort((a, b) => a.start - b.start || a.unit.localeCompare(b.unit));
  const includedStartLimit = ranked[19]?.start ?? null;
  const nextStart = includedStartLimit === null
    ? null
    : (ranked.find(unit => unit.start > includedStartLimit)?.start ?? null);
  const allowed = new Set(
    ranked
      .filter(unit => includedStartLimit === null || unit.start <= includedStartLimit)
      .map(unit => `${unit.userId}:${unit.unit}`),
  );
  const included = mapped.filter(row => allowed.has(`${row.userId}:${row.unit}`) && (nextStart === null || row.at < nextStart));
  const omitted = mapped.filter(row => !included.includes(row));
  return { included, omitted, nextStart };
}

test('digest RPC sessionizes direct messages with a chained 30-minute gap', () => {
  assert.match(migration, /lag\(e\.created_at\)[\s\S]*PARTITION BY e\.user_id, e\.link, e\.groupable/);
  assert.match(migration, /previous_created_at \+ INTERVAL '30 minutes'/);
  assert.match(migration, /sum\(m\.starts_new_session\)[\s\S]*ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW/);
  assert.match(migration, /notification_count::TEXT \|\| ' yeni mesaj'/);
  assert.match(migration, /Bu konu\u015fmada[\s\S]*yeni mesaj\u0131n\u0131z var\./u);

  const rows = [
    { id: 'a', userId: 'u', type: 'direct_message', link: 'mesajlar.html?conversation=one', at: 0 },
    { id: 'b', userId: 'u', type: 'direct_message', link: 'mesajlar.html?conversation=two', at: 10 },
    { id: 'c', userId: 'u', type: 'direct_message', link: 'mesajlar.html?conversation=one', at: 20 },
    { id: 'd', userId: 'u', type: 'direct_message', link: 'mesajlar.html?conversation=one', at: 45 },
    { id: 'e', userId: 'u', type: 'direct_message', link: 'mesajlar.html?conversation=one', at: 76 },
  ];
  const { included } = modelDigestPrefix(rows);
  const firstConversationUnits = included.filter(row => row.link.endsWith('one')).map(row => row.unit);
  assert.deepEqual(firstConversationUnits, [
    'direct_message:mesajlar.html?conversation=one:1',
    'direct_message:mesajlar.html?conversation=one:1',
    'direct_message:mesajlar.html?conversation=one:1',
    'direct_message:mesajlar.html?conversation=one:2',
  ]);
  assert.notEqual(included[1].unit, included[0].unit, 'different conversations must never merge');
});

test('the 20-unit prefix cannot mark an omitted notification through max created_at', () => {
  const rows = Array.from({ length: 21 }, (_, index) => ({
    id: `n-${String(index).padStart(2, '0')}`,
    userId: 'u',
    type: 'system_test',
    link: null,
    at: index,
  }));
  rows.push({ id: 'late-continuation', userId: 'u', type: 'direct_message', link: 'mesajlar.html?conversation=late', at: 100 });

  const { included, omitted, nextStart } = modelDigestPrefix(rows);
  assert.equal(nextStart, 20);
  assert.equal(new Set(included.map(row => row.unit)).size, 20);
  assert.ok(Math.max(...included.map(row => row.at)) < Math.min(...omitted.map(row => row.at)));

  assert.match(migration, /unit_rank = 20/);
  assert.match(migration, /r\.unit_start <= c\.included_start_limit/);
  assert.match(migration, /m\.created_at < c\.next_start/);
});

test('equal timestamps at the twentieth-unit boundary are processed without starvation', () => {
  const rows = Array.from({ length: 21 }, (_, index) => ({
    id: `tie-${String(index).padStart(2, '0')}`,
    userId: 'u',
    type: 'system_test',
    link: null,
    at: 0,
  }));

  const { included, omitted, nextStart } = modelDigestPrefix(rows);
  assert.equal(nextStart, null);
  assert.equal(included.length, 21);
  assert.equal(omitted.length, 0);
});

test('digest and appointment RPCs retain least-privilege execution', () => {
  assert.match(migration, /SET search_path = ''/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.list_email_digests\(INTEGER\) FROM PUBLIC, anon, authenticated/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.list_email_digests\(INTEGER\) TO service_role/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.notify_mentorship_appointment\(\) FROM PUBLIC, anon, authenticated/);
});

test('mentor appointment notifications carry the target appointment deep link', () => {
  assert.match(migration, /'Yeni g\u00f6r\u00fc\u015fme talebi'[\s\S]*'mentorluk\.html\?appointment=' \|\| NEW\.id::TEXT/u);
  assert.match(migration, /'appointment_status'[\s\S]*'mentorluk\.html\?appointment=' \|\| NEW\.id::TEXT/u);
  assert.match(digestFunction, /direct_message: "Mesaj"/);
  assert.match(digestFunction, /appointment_new: "G\u00f6r\u00fc\u015fme"/u);
});
