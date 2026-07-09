// send-email-digest
// ASDFL Mezunlar Derneği — bildirim özeti e-posta gönderim fonksiyonu.
//
// İki rota (query string ile seçilir):
//   ?action=unsubscribe&token=<uuid>  → e-posta bildirimlerini kapatır, HTML sonuç sayfası döner.
//   (varsayılan, action yok)          → bekleyen bildirimleri e-posta olarak toplu gönderir.
//
// Harici bağımlılık yok: Supabase RPC'leri ve Resend API'si doğrudan fetch ile çağrılır.
// Bu fonksiyon --no-verify-jwt ile deploy edilmelidir (bkz. docs/email-bildirimleri.md):
// abonelik iptal linki e-postadan, oturum olmadan tıklanır; güvenlik JWT'de değil,
// tahmin edilemeyen unsub_token (UUID) değerinde sağlanır.

// ---- Tipler ----

interface DigestNotification {
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  created_at: string;
}

interface DigestRow {
  user_id: string;
  email: string;
  name: string | null;
  unsub_token: string;
  notifications: DigestNotification[];
}

// ---- Ortam değişkenleri ----

interface Env {
  supabaseUrl: string;
  serviceRoleKey: string;
  resendApiKey: string;
  fromEmail: string;
  siteUrl: string;
}

function loadEnv(): Env {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("FROM_EMAIL");
  const siteUrl = Deno.env.get("SITE_URL");

  const missing: string[] = [];
  if (!supabaseUrl) missing.push("SUPABASE_URL");
  if (!serviceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!resendApiKey) missing.push("RESEND_API_KEY");
  if (!fromEmail) missing.push("FROM_EMAIL");
  if (!siteUrl) missing.push("SITE_URL");

  if (missing.length > 0) {
    throw new Error(
      `Eksik ortam değişkeni: ${missing.join(", ")}. Bkz. docs/email-bildirimleri.md kurulum adımları.`,
    );
  }

  // Sondaki "/" karakterlerini temizle, link birleştirmede çift slash oluşmasın.
  return {
    supabaseUrl: supabaseUrl!.replace(/\/+$/, ""),
    serviceRoleKey: serviceRoleKey!,
    resendApiKey: resendApiKey!,
    fromEmail: fromEmail!,
    siteUrl: siteUrl!.replace(/\/+$/, ""),
  };
}

// ---- Yardımcılar ----

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// HTML içine yazılacak her metni kaçışlıyoruz (XSS / e-posta enjeksiyonuna karşı).
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Bildirim "link" alanı veritabanından geldiği için güvenmiyoruz: yalnızca
// göreli (relative) path'lere izin veriyoruz (örn. "topluluk.html#post-x").
// http:, https:, javascript: gibi şemaları ve "//host" (protocol-relative) biçimini reddediyoruz.
function sanitizeRelativeLink(link: string | null): string | null {
  if (!link) return null;
  const trimmed = link.trim();
  if (trimmed === "") return null;
  if (trimmed.startsWith("//")) return null;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return null; // herhangi bir URI şeması (http:, https:, javascript:, data: ...)
  if (trimmed.startsWith("\\")) return null;
  return trimmed;
}

async function callRpc<T>(
  env: Env,
  fnName: string,
  args: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`${env.supabaseUrl}/rest/v1/rpc/${fnName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: env.serviceRoleKey,
      Authorization: `Bearer ${env.serviceRoleKey}`,
    },
    body: JSON.stringify(args),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`RPC ${fnName} başarısız (HTTP ${res.status}): ${text}`);
  }

  return (await res.json()) as T;
}

// ---- HTML sayfa şablonları (abonelik iptali sonucu) ----

function resultPage(title: string, message: string, ok: boolean): string {
  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#0a0f24;font-family:Segoe UI,Arial,sans-serif;">
  <div style="max-width:480px;margin:60px auto;background:#101736;border-radius:12px;padding:40px 32px;text-align:center;border:1px solid #d4af3733;">
    <div style="font-size:32px;margin-bottom:12px;">${ok ? "✅" : "⚠️"}</div>
    <h1 style="color:#d4af37;font-size:20px;margin:0 0 12px;">${escapeHtml(title)}</h1>
    <p style="color:#e6e6e6;font-size:15px;line-height:1.6;margin:0;">${escapeHtml(message)}</p>
  </div>
</body>
</html>`;
}

// ---- Rota A: abonelik iptali ----

async function handleUnsubscribe(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";

  if (!UUID_RE.test(token)) {
    return new Response(
      resultPage(
        "Geçersiz bağlantı",
        "Bu abonelik iptal bağlantısı geçersiz görünüyor. Tercihlerini profil sayfandan da yönetebilirsin.",
        false,
      ),
      { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }

  try {
    const success = await callRpc<boolean>(env, "email_unsubscribe", {
      token,
    });

    if (!success) {
      return new Response(
        resultPage(
          "Bağlantı bulunamadı",
          "Bu abonelik iptal bağlantısı artık geçerli değil. Tercihlerini profil sayfandan yönetebilirsin.",
          false,
        ),
        { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } },
      );
    }

    return new Response(
      resultPage(
        "E-posta bildirimleri kapatıldı",
        "E-posta bildirimleri kapatıldı. Tercihini istediğin zaman profil sayfandan değiştirebilirsin.",
        true,
      ),
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  } catch (err) {
    console.error("unsubscribe hatası:", err);
    return new Response(
      resultPage(
        "Bir sorun oluştu",
        "İsteğin işlenirken beklenmeyen bir hata oluştu. Lütfen daha sonra tekrar dene.",
        false,
      ),
      { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }
}

// ---- Rota B: digest gönderimi ----

function buildUnsubscribeUrl(env: Env, unsubToken: string): string {
  return `${env.supabaseUrl}/functions/v1/send-email-digest?action=unsubscribe&token=${unsubToken}`;
}

function buildEmailHtml(env: Env, row: DigestRow): string {
  const safeName = escapeHtml(row.name?.trim() || "Merhaba");
  const items = row.notifications
    .map((n) => {
      const safeTitle = escapeHtml(n.title);
      const safeBody = n.body ? escapeHtml(n.body) : "";
      const relLink = sanitizeRelativeLink(n.link);

      const bodyHtml = safeBody
        ? `<div style="color:#4b5563;font-size:14px;margin-top:4px;">${safeBody}</div>`
        : "";

      // relLink attribute içine de kaçışlanarak yazılır (tırnakla attribute'tan çıkma girişimine karşı).
      const titleHtml = relLink
        ? `<a href="${env.siteUrl}/${escapeHtml(relLink)}" style="color:#0a0f24;text-decoration:none;font-weight:bold;font-size:15px;">${safeTitle}</a>`
        : `<span style="color:#0a0f24;font-weight:bold;font-size:15px;">${safeTitle}</span>`;

      return `
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid #eee;">
            ${titleHtml}
            ${bodyHtml}
          </td>
        </tr>`;
    })
    .join("");

  const unsubUrl = buildUnsubscribeUrl(env, row.unsub_token);
  const profileUrl = `${env.siteUrl}/profil.html`;

  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;padding:0;background:#f4f4f6;font-family:Segoe UI,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f6;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="background:#0a0f24;padding:24px 32px;">
              <span style="color:#d4af37;font-size:18px;font-weight:bold;letter-spacing:0.5px;">ASDFL Mezunlar Derneği</span>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 8px;">
              <p style="color:#111;font-size:16px;margin:0 0 4px;">Merhaba ${safeName},</p>
              <p style="color:#555;font-size:14px;margin:0;">Aşağıda okumadığın bildirimlerin özeti var:</p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${items}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 32px;">
              <p style="color:#888;font-size:12px;line-height:1.8;margin:0;">
                <a href="${profileUrl}" style="color:#0a0f24;">Bildirim tercihlerini yönet</a>
                &nbsp;·&nbsp;
                <a href="${unsubUrl}" style="color:#888;">E-posta bildirimlerini kapat</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendViaResend(
  env: Env,
  to: string,
  subject: string,
  html: string,
): Promise<boolean> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.resendApiKey}`,
      },
      body: JSON.stringify({
        from: env.fromEmail,
        to,
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`Resend gönderim hatası (${to}): HTTP ${res.status} ${text}`);
      return false;
    }

    return true;
  } catch (err) {
    console.error(`Resend isteği başarısız (${to}):`, err);
    return false;
  }
}

function maxCreatedAt(notifications: DigestNotification[]): string | null {
  if (notifications.length === 0) return null;
  // notifications created_at'e göre artan sırada geliyor; yine de emin olmak için en büyüğünü alıyoruz.
  return notifications.reduce(
    (max, n) => (n.created_at > max ? n.created_at : max),
    notifications[0].created_at,
  );
}

async function handleDigest(env: Env): Promise<Response> {
  let rows: DigestRow[];
  try {
    rows = await callRpc<DigestRow[]>(env, "list_email_digests", {
      batch_size: 100,
    });
  } catch (err) {
    console.error("list_email_digests hatası:", err);
    return new Response(
      JSON.stringify({ error: "Digest listesi alınamadı", detail: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of rows) {
    if (!row.notifications || row.notifications.length === 0) {
      skipped++;
      continue;
    }

    const subject = `ASDFL | ${row.notifications.length} yeni bildirimin var`;
    const html = buildEmailHtml(env, row);

    const ok = await sendViaResend(env, row.email, subject, html);

    if (!ok) {
      failed++;
      continue; // başarısız gönderimde işaretleme yapılmaz, sonraki çalışmada tekrar denenir
    }

    const upto = maxCreatedAt(row.notifications);
    if (upto) {
      try {
        await callRpc<number>(env, "mark_notifications_emailed", {
          target_user_id: row.user_id,
          upto,
        });
      } catch (err) {
        // E-posta gönderildi ama işaretleme başarısız oldu: loglayıp devam ediyoruz.
        // Bir sonraki çalışmada aynı kullanıcıya tekrar gönderim yapılabilir; bu,
        // hiç bildirim göndermemekten daha güvenli bir taraftır.
        console.error(`mark_notifications_emailed hatası (${row.user_id}):`, err);
      }
    }

    sent++;
  }

  return new Response(JSON.stringify({ sent, failed, skipped }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// ---- Giriş noktası ----

Deno.serve(async (req: Request) => {
  let env: Env;
  try {
    env = loadEnv();
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err instanceof Error ? err.message : err) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  if (action === "unsubscribe") {
    return handleUnsubscribe(req, env);
  }

  return handleDigest(env);
});
