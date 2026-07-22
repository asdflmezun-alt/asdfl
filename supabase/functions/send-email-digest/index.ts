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

const BRAND_LOGO_URL = "https://www.asdflmezun.org/assets/images/logo.png";
const BRAND_NAME = "ASDFL Mezunlar Derneği";

function resultPage(title: string, message: string, ok: boolean): string {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  const badge = ok ? "#1f8a4c" : "#b3541e";
  const badgeIcon = ok ? "✓" : "!";

  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${safeTitle}</title>
</head>
<body style="margin:0;padding:0;background:#eef0f4;font-family:Segoe UI,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef0f4;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e4ea;">
          <tr>
            <td align="center" style="background:#0a0f24;padding:28px 24px 24px;">
              <img src="${BRAND_LOGO_URL}" width="44" height="44" alt="${escapeHtml(BRAND_NAME)}" style="display:block;margin:0 auto 10px;border-radius:8px;" />
              <span style="color:#ffffff;font-size:15px;font-weight:bold;letter-spacing:0.3px;">${escapeHtml(BRAND_NAME)}</span>
            </td>
          </tr>
          <tr>
            <td style="background:#d4af37;height:3px;line-height:3px;font-size:0;">&nbsp;</td>
          </tr>
          <tr>
            <td align="center" style="padding:36px 32px 12px;">
              <div style="display:inline-block;width:48px;height:48px;line-height:48px;border-radius:50%;background:${badge};color:#ffffff;font-size:22px;font-weight:bold;text-align:center;">${badgeIcon}</div>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:4px 32px 8px;">
              <h1 style="color:#0a0f24;font-size:19px;margin:0 0 12px;">${safeTitle}</h1>
              <p style="color:#4b5563;font-size:14px;line-height:1.7;margin:0;">${safeMessage}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid #eee;font-size:0;line-height:0;">&nbsp;</td></tr></table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 24px 28px;">
              <p style="color:#9ca3af;font-size:11px;line-height:1.6;margin:0;">Afyon Süleyman Demirel Fen Lisesi Mezunlar Derneği<br />© 2026 ASDFL</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
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

// Bildirim türü → e-postada gösterilecek Türkçe etiket. Bilinmeyen bir tür
// gelirse (yeni eklenmiş ama burada tanımlanmamış bir bildirim türü gibi)
// genel "Bildirim" etiketine düşer, boş/undefined render edilmez.
const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  mention: "Bahsetme",
  post_report: "Gönderi Şikâyeti",
  contact_request: "İletişim Talebi",
  contact_request_status: "İletişim Talebi",
  mentorship_request: "Mentorluk Talebi",
  mentorship_status: "Mentorluk",
  new_event: "Yeni Etkinlik",
  event_reminder: "Etkinlik Hatırlatması",
  direct_message: "Mesaj",
  appointment_new: "Görüşme",
  appointment_status: "Görüşme",
  imece_request: "İmece Çağrısı",
  imece_report: "İmece Şikâyeti",
  system_test: "Sistem Testi",
};

function notificationTypeLabel(type: string): string {
  return NOTIFICATION_TYPE_LABELS[type] ?? "Bildirim";
}

// created_at değerini "9 Temmuz, 14:30" biçiminde biçimlendirir. Veritabanından
// gelen tarih hatalı/parse edilemez olursa hata fırlatmak yerine boş döner,
// bildirim satırı tarihsiz gösterilir.
function formatNotificationDate(createdAt: string): string {
  try {
    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("tr-TR", {
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Istanbul",
    }).format(date);
  } catch {
    return "";
  }
}

function buildEmailHtml(env: Env, row: DigestRow): string {
  const safeName = escapeHtml(row.name?.trim() || "Merhaba");
  const count = row.notifications.length;
  const preheader = escapeHtml(
    `Sitede seni bekleyen ${count} bildirim var.`,
  );

  const items = row.notifications
    .map((n) => {
      const safeTitle = escapeHtml(n.title);
      const safeBody = n.body ? escapeHtml(n.body) : "";
      const relLink = sanitizeRelativeLink(n.link);
      const safeTypeLabel = escapeHtml(notificationTypeLabel(n.type));
      const safeDate = escapeHtml(formatNotificationDate(n.created_at));

      const bodyHtml = safeBody
        ? `<div style="color:#6b7280;font-size:14px;line-height:1.6;margin-top:6px;">${safeBody}</div>`
        : "";

      const dateHtml = safeDate
        ? `<div style="color:#9ca3af;font-size:11px;margin-top:10px;">${safeDate}</div>`
        : "";

      // relLink attribute içine de kaçışlanarak yazılır (tırnakla attribute'tan çıkma girişimine karşı).
      const titleHtml = relLink
        ? `<a href="${env.siteUrl}/${escapeHtml(relLink)}" style="color:#0a0f24;text-decoration:none;font-weight:bold;font-size:15px;">${safeTitle}</a>`
        : `<span style="color:#0a0f24;font-weight:bold;font-size:15px;">${safeTitle}</span>`;

      return `
        <tr>
          <td style="padding:0 0 14px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fb;border-radius:8px;">
              <tr>
                <td width="3" style="background:#d4af37;border-radius:8px 0 0 8px;font-size:0;line-height:0;">&nbsp;</td>
                <td style="padding:16px 18px;">
                  <div style="color:#d4af37;font-size:11px;font-weight:bold;letter-spacing:0.4px;text-transform:uppercase;margin-bottom:6px;">${safeTypeLabel}</div>
                  ${titleHtml}
                  ${bodyHtml}
                  ${dateHtml}
                </td>
              </tr>
            </table>
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
<meta name="color-scheme" content="light" />
</head>
<body style="margin:0;padding:0;background:#eef0f4;font-family:Segoe UI,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef0f4;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e4ea;">
          <tr>
            <td align="center" style="background:#0a0f24;padding:28px 32px 24px;">
              <img src="${BRAND_LOGO_URL}" width="44" height="44" alt="${escapeHtml(BRAND_NAME)}" style="display:block;margin:0 auto 10px;border-radius:8px;" />
              <span style="color:#ffffff;font-size:16px;font-weight:bold;letter-spacing:0.3px;">${escapeHtml(BRAND_NAME)}</span>
            </td>
          </tr>
          <tr>
            <td style="background:#d4af37;height:3px;line-height:3px;font-size:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:32px 32px 8px;">
              <p style="color:#0a0f24;font-size:17px;font-weight:bold;margin:0 0 6px;">Merhaba ${safeName},</p>
              <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0;">Sitede okumadığın ${count} bildirim var. Aşağıda kısa bir özetini bulabilirsin:</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${items}
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:8px 32px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:8px;background:#d4af37;">
                    <a href="${env.siteUrl}" style="display:inline-block;padding:12px 28px;color:#0a0f24;font-size:14px;font-weight:bold;text-decoration:none;border-radius:8px;">Bildirimleri Görüntüle</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid #eee;font-size:0;line-height:0;">&nbsp;</td></tr></table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:20px 24px 28px;">
              <p style="color:#9ca3af;font-size:11px;line-height:1.9;margin:0;">
                Afyon Süleyman Demirel Fen Lisesi Mezunlar Derneği<br />
                <a href="${profileUrl}" style="color:#6b7280;">Bildirim tercihlerini yönet</a>
                &nbsp;·&nbsp;
                <a href="${unsubUrl}" style="color:#6b7280;">E-posta bildirimlerini kapat</a>
                <br />© 2026 ASDFL
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
