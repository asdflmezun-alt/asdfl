// ETKINLIKLER SAYFASI — RSVP, katılımcı avatarları, takvime ekleme, geri sayım
(function () {
  const E = ASDFL.escapeHTML.bind(ASDFL);
  const A = ASDFL.escapeAttr.bind(ASDFL);

  const TYPE_LABELS = {
    bulusma: ['handshake', 'Buluşma'], gala: ['sparkles', 'Gala'],
    kariyer: ['briefcase', 'Kariyer'], spor: ['dribbble', 'Spor'],
    meziyet: ['graduation-cap', 'Mezuniyet'], mezuniyet: ['graduation-cap', 'Mezuniyet'],
    panel: ['mic', 'Panel'], etkinlik: ['calendar', 'Etkinlik'], duyuru: ['megaphone', 'Duyuru']
  };
  const TYPE_COLORS = {
    bulusma: 'badge-teal', gala: 'badge-gold', kariyer: 'badge-blue', spor: 'badge-teal',
    meziyet: 'badge-gold', mezuniyet: 'badge-gold', panel: 'badge-blue', etkinlik: 'badge-blue', duyuru: 'badge-gold'
  };
  const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

  let allEvents = [];
  let currentFilter = 'all';
  let countdownTimer = null;

  document.addEventListener('DOMContentLoaded', async () => {
    await ASDFL.waitForAuth();
    ensureCalMenu();
    ensureDetailModal();
    await loadEvents();

    document.addEventListener('click', (e) => {
      const menu = document.getElementById('calMenu');
      if (menu && !menu.classList.contains('hidden') && !e.target.closest('#calMenu') && !e.target.closest('[data-cal-btn]')) {
        menu.classList.add('hidden');
      }
    });
    window.addEventListener('scroll', () => {
      const menu = document.getElementById('calMenu');
      if (menu) menu.classList.add('hidden');
    }, { passive: true });
  });

  async function loadEvents() {
    const upcomingEl = document.getElementById('upcomingGrid');
    if (upcomingEl) upcomingEl.innerHTML = skeletonCards(3);

    if (ASDFL.supabase) {
      try {
        const { data, error } = await ASDFL.supabase
          .from('events')
          .select(`
            id, title, description, event_date, event_time, end_time, location, type, capacity, cover_url, created_at,
            event_rsvps ( user_id, status, profiles!user_id ( name, avatar_url, avatar_position ) )
          `)
          .order('event_date', { ascending: true })
          .limit(100);
        if (error) throw error;
        allEvents = (data || []).map(normalizeEvent);
      } catch (err) {
        console.error('Etkinlikler yüklenemedi:', err);
        allEvents = (await ASDFL.fetchEvents()).map(normalizeEvent);
      }
    } else {
      allEvents = (await ASDFL.fetchEvents()).map(normalizeEvent);
    }

    renderCountdown();
    renderEvents(currentFilter);
    handleDeepLink();
  }

  function normalizeEvent(ev) {
    const rsvps = Array.isArray(ev.event_rsvps) ? ev.event_rsvps : [];
    const going = rsvps.filter(r => r.status === 'going');
    const myId = ASDFL.currentUser?.id;
    return {
      id: ev.id,
      title: ev.title || '',
      desc: ev.description ?? ev.desc ?? '',
      date: ev.event_date || ev.date,
      time: ev.event_time || ev.time || '',
      end_time: ev.end_time || '',
      location: ev.location || '',
      type: ev.type || 'bulusma',
      capacity: ev.capacity ?? null,
      cover_url: ev.cover_url || '',
      event_date: ev.event_date || ev.date,
      event_time: ev.event_time || ev.time || '',
      description: ev.description ?? ev.desc ?? '',
      going,
      goingCount: going.length,
      iAmGoing: !!(myId && going.some(r => r.user_id === myId))
    };
  }

  // Etkinlik geçmiş mi? Bitiş (yoksa +2s) şu andan önceyse geçmiş.
  function isPast(ev) {
    const end = ASDFL.eventEnd(ev);
    return end ? end.getTime() < Date.now() : false;
  }

  /* ---------- Geri sayım ---------- */
  function renderCountdown() {
    const host = document.getElementById('eventCountdown');
    if (!host) return;
    if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }

    const next = allEvents
      .filter(e => !isPast(e))
      .map(e => ({ e, start: ASDFL.eventStart(e) }))
      .filter(x => x.start)
      .sort((a, b) => a.start - b.start)[0];

    if (!next) { host.classList.add('hidden'); return; }
    host.classList.remove('hidden');

    const tick = () => {
      const diff = next.start.getTime() - Date.now();
      if (diff <= 0) { clearInterval(countdownTimer); loadEvents(); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      host.innerHTML = `
        <div class="countdown-inner">
          <span class="countdown-label"><i data-lucide="clock" style="width:1em;height:1em"></i> Sıradaki etkinlik</span>
          <a class="countdown-title" href="#event-${A(next.e.id)}" onclick="window.openEventDetail('${A(next.e.id)}');return false;">${E(next.e.title)}</a>
          <div class="countdown-clock">
            ${cdUnit(d, 'gün')}${cdUnit(h, 'saat')}${cdUnit(m, 'dk')}${cdUnit(s, 'sn')}
          </div>
        </div>`;
      ASDFL.refreshIcons(host);
    };
    tick();
    countdownTimer = setInterval(tick, 1000);
  }
  function cdUnit(v, label) {
    return `<div class="cd-unit"><span class="cd-num">${String(v).padStart(2, '0')}</span><span class="cd-lbl">${label}</span></div>`;
  }

  /* ---------- Liste render ---------- */
  function renderEvents(filter) {
    currentFilter = filter;
    let upcoming = allEvents.filter(e => !isPast(e));
    let past = allEvents.filter(e => isPast(e)).sort((a, b) => new Date(b.date) - new Date(a.date));

    if (filter !== 'all' && filter !== 'upcoming' && filter !== 'past') {
      upcoming = upcoming.filter(e => e.type === filter);
      past = past.filter(e => e.type === filter);
    } else if (filter === 'upcoming') { past = []; }
    else if (filter === 'past') { upcoming = []; }

    const upcomingEl = document.getElementById('upcomingGrid');
    const pastEl = document.getElementById('pastGrid');
    const upCount = document.getElementById('upcomingCount');
    const pastCount = document.getElementById('pastCount');

    if (upCount) upCount.textContent = upcoming.length + ' etkinlik';
    if (pastCount) pastCount.textContent = past.length + ' etkinlik';

    if (upcomingEl) {
      upcomingEl.innerHTML = upcoming.length
        ? renderGrouped(upcoming, true)
        : emptyState('calendar-x', 'Yaklaşan etkinlik yok', 'Yeni etkinlikler eklendiğinde burada görünecek.');
    }
    if (pastEl) {
      pastEl.innerHTML = past.length
        ? past.map(ev => renderEventCard(ev, false)).join('')
        : emptyState('folder', 'Geçmiş etkinlik yok', '');
    }

    const upSec = document.getElementById('upcomingSection');
    const pastSec = document.getElementById('pastSection');
    if (upSec) upSec.style.display = filter === 'past' ? 'none' : '';
    if (pastSec) pastSec.style.display = filter === 'upcoming' ? 'none' : '';

    ASDFL.initReveal();
    setTimeout(() => ASDFL.refreshIcons(), 10);
  }

  // Yaklaşan etkinlikleri aya göre grupla
  function renderGrouped(events, isUpcoming) {
    const groups = new Map();
    events.forEach(ev => {
      const d = new Date(ev.date);
      const key = isNaN(d) ? 'Tarih yok' : `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(ev);
    });
    let html = '';
    for (const [label, evs] of groups) {
      html += `<div class="event-month-group"><h4 class="event-month-label">${E(label)}</h4>
        <div class="events-cards-grid">${evs.map(ev => renderEventCard(ev, isUpcoming)).join('')}</div></div>`;
    }
    return html;
  }

  function renderEventCard(ev, isUpcoming) {
    const d = new Date(ev.date);
    const day = isNaN(d) ? '?' : d.getDate();
    const mon = isNaN(d) ? '' : d.toLocaleDateString('tr-TR', { month: 'short' });
    const [icon, tLabel] = TYPE_LABELS[ev.type] || ['calendar', ev.type];
    const badgeClass = TYPE_COLORS[ev.type] || 'badge-blue';
    const cover = ASDFL.safeURL(ev.cover_url);
    const idA = A(ev.id);

    const coverHtml = cover
      ? `<div class="ec-cover" style="background-image:url('${A(cover)}')"></div>`
      : `<div class="ec-cover ec-cover-${E(ev.type)}"><i data-lucide="${A(icon)}"></i></div>`;

    return `
      <div class="card event-card ${isUpcoming ? 'upcoming' : 'past'} reveal" id="event-${idA}">
        <div class="ec-cover-wrap" onclick="window.openEventDetail('${idA}')">
          ${coverHtml}
          <div class="event-date-box2"><span class="day">${E(String(day))}</span><span class="mon">${E(mon)}</span></div>
          <span class="badge ${badgeClass} ec-type-badge"><i data-lucide="${A(icon)}" style="width:1em;height:1em"></i> ${E(tLabel)}</span>
        </div>
        <div class="ec-body">
          <h4 onclick="window.openEventDetail('${idA}')" style="cursor:pointer">${E(ev.title)}</h4>
          <div class="ec-meta">
            <span><i data-lucide="calendar" style="width:1em;height:1em"></i> ${E(ASDFL.formatDate(ev.date))}${ev.time ? ' · ' + E(ev.time) : ''}</span>
            <span><i data-lucide="map-pin" style="width:1em;height:1em"></i> ${E(ev.location || 'ASDFL')}</span>
          </div>
          <p class="ec-desc">${E(ev.desc)}</p>
          ${renderAttendees(ev)}
          ${renderCapacity(ev)}
        </div>
        <div class="ec-footer">
          ${isUpcoming ? renderUpcomingActions(ev) : `
            <span class="badge badge-blue"><i data-lucide="check" style="width:1em;height:1em"></i> Tamamlandı</span>
            <a href="galeri.html" class="btn btn-ghost btn-sm"><i data-lucide="image" style="width:1.1rem;height:1.1rem"></i> Fotoğraflar</a>`}
        </div>
      </div>`;
  }

  function renderUpcomingActions(ev) {
    const idA = A(ev.id);
    const full = ev.capacity != null && ev.goingCount >= ev.capacity && !ev.iAmGoing;
    let rsvpBtn;
    if (!ASDFL.currentUser) {
      rsvpBtn = `<button class="btn btn-primary btn-sm" onclick="ASDFL.openModal('loginModal')">Katılmak için giriş yap</button>`;
    } else if (ev.iAmGoing) {
      rsvpBtn = `<button class="btn btn-success btn-sm rsvp-btn going" onclick="window.toggleRsvp('${idA}')"><i data-lucide="check-circle" style="width:1.1rem;height:1.1rem"></i> Katılıyorsun</button>`;
    } else if (full) {
      rsvpBtn = `<button class="btn btn-ghost btn-sm" disabled><i data-lucide="users" style="width:1.1rem;height:1.1rem"></i> Kontenjan doldu</button>`;
    } else {
      rsvpBtn = `<button class="btn btn-primary btn-sm rsvp-btn" onclick="window.toggleRsvp('${idA}')"><i data-lucide="plus" style="width:1.1rem;height:1.1rem"></i> Katılıyorum</button>`;
    }
    return `${rsvpBtn}
      <button class="btn btn-ghost btn-sm" data-cal-btn onclick="window.openCalMenu('${idA}',this)"><i data-lucide="calendar-plus" style="width:1.1rem;height:1.1rem"></i> Takvime Ekle</button>`;
  }

  function renderAttendees(ev) {
    if (!ASDFL.currentUser) {
      return ev.goingCount ? `<div class="ec-attendees"><span class="ec-att-count"><i data-lucide="users" style="width:1em;height:1em"></i> ${ev.goingCount} kişi katılıyor</span></div>` : '';
    }
    if (!ev.goingCount) return `<div class="ec-attendees ec-att-empty">İlk katılan sen ol!</div>`;
    const shown = ev.going.slice(0, 5);
    const rest = ev.goingCount - shown.length;
    // NOT: sınıf adı 'avatar' içermemeli; içerirse getAvatarHTML 76px 'photo-frame'
    // enjekte edip küçük avatarı bozar.
    const avatars = shown.map(r => {
      const p = r.profiles || {};
      return ASDFL.getAvatarHTML({ name: p.name, avatar_url: p.avatar_url, avatar_position: p.avatar_position }, 'rsvp-face');
    }).join('');
    return `<div class="ec-attendees" onclick="window.openEventDetail('${A(ev.id)}')" style="cursor:pointer">
      <div class="rsvp-avatar-stack">${avatars}${rest > 0 ? `<div class="rsvp-face rsvp-more">+${rest}</div>` : ''}</div>
      <span class="ec-att-count">${ev.goingCount} kişi katılıyor</span>
    </div>`;
  }

  function renderCapacity(ev) {
    if (ev.capacity == null) return '';
    const pct = Math.min(100, Math.round((ev.goingCount / ev.capacity) * 100));
    return `<div class="ec-capacity">
      <div class="ec-capacity-bar"><div class="ec-capacity-fill" style="width:${pct}%"></div></div>
      <span class="ec-capacity-text">${ev.goingCount}/${ev.capacity} kontenjan</span>
    </div>`;
  }

  /* ---------- RSVP ---------- */
  window.toggleRsvp = async function (eventId) {
    if (!ASDFL.currentUser) { ASDFL.openModal('loginModal'); return; }
    const ev = allEvents.find(e => e.id === eventId);
    if (!ev) return;
    const myId = ASDFL.currentUser.id;
    const wasGoing = ev.iAmGoing;

    // Optimistic
    if (wasGoing) {
      ev.going = ev.going.filter(r => r.user_id !== myId);
    } else {
      if (ev.capacity != null && ev.goingCount >= ev.capacity) { ASDFL.toast('Kontenjan dolu.', 'warning'); return; }
      ev.going = [...ev.going, { user_id: myId, status: 'going', profiles: { name: ASDFL.currentUser.name, avatar_url: ASDFL.currentUser.avatar_url || ASDFL.currentUser.avatarUrl, avatar_position: ASDFL.currentUser.avatar_position } }];
    }
    ev.iAmGoing = !wasGoing;
    ev.goingCount = ev.going.length;
    renderEvents(currentFilter);

    if (!ASDFL.supabase) {
      ASDFL.toast(wasGoing ? 'Katılım iptal edildi.' : 'Katılımın kaydedildi! 🎉', wasGoing ? 'info' : 'success');
      return;
    }
    try {
      if (wasGoing) {
        const { error } = await ASDFL.supabase.from('event_rsvps').delete().eq('event_id', eventId).eq('user_id', myId);
        if (error) throw error;
        ASDFL.toast('Katılım iptal edildi.', 'info');
      } else {
        const { error } = await ASDFL.supabase.from('event_rsvps').insert({ event_id: eventId, user_id: myId, status: 'going' });
        if (error) throw error;
        ASDFL.toast('Katılımın kaydedildi! 🎉', 'success');
      }
    } catch (err) {
      // Geri al
      if (wasGoing) {
        ev.going = [...ev.going, { user_id: myId, status: 'going', profiles: { name: ASDFL.currentUser.name } }];
      } else {
        ev.going = ev.going.filter(r => r.user_id !== myId);
      }
      ev.iAmGoing = wasGoing;
      ev.goingCount = ev.going.length;
      renderEvents(currentFilter);
      const msg = /capacity/i.test(err.message || '') ? 'Kontenjan doldu.' : 'İşlem kaydedilemedi: ' + (err.message || '');
      ASDFL.toast(msg, 'error');
    }
  };

  /* ---------- Takvim menüsü ---------- */
  function ensureCalMenu() {
    if (document.getElementById('calMenu')) return;
    const menu = document.createElement('div');
    menu.id = 'calMenu';
    menu.className = 'cal-menu hidden';
    document.body.appendChild(menu);
  }

  window.openCalMenu = function (eventId, btn) {
    const ev = allEvents.find(e => e.id === eventId);
    if (!ev) return;
    const menu = document.getElementById('calMenu');
    const gUrl = ASDFL.googleCalendarUrl(ev);
    menu.innerHTML = `
      <a class="cal-menu-item" href="${A(gUrl)}" target="_blank" rel="noopener noreferrer" onclick="document.getElementById('calMenu').classList.add('hidden')">
        <i data-lucide="calendar" style="width:1.1rem;height:1.1rem"></i> Google Takvim
      </a>
      <button class="cal-menu-item" onclick="ASDFL.downloadICS(ASDFL._calEvent);document.getElementById('calMenu').classList.add('hidden')">
        <i data-lucide="download" style="width:1.1rem;height:1.1rem"></i> Apple / Outlook (.ics)
      </button>`;
    ASDFL._calEvent = ev;
    const r = btn.getBoundingClientRect();
    menu.style.top = (r.bottom + 8) + 'px';
    menu.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 220)) + 'px';
    menu.classList.remove('hidden');
    ASDFL.refreshIcons(menu);
  };

  /* ---------- Detay modalı ---------- */
  function ensureDetailModal() {
    if (document.getElementById('eventDetailModal')) return;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'eventDetailModal';
    overlay.addEventListener('click', (e) => { if (e.target === overlay) window.closeEventDetail(); });
    overlay.innerHTML = `<div class="modal event-detail-modal"><button class="modal-close" onclick="window.closeEventDetail()"><i data-lucide="x" style="width:1em;height:1em"></i></button><div id="eventDetailBody"></div></div>`;
    document.body.appendChild(overlay);
  }

  window.closeEventDetail = function () {
    ASDFL.closeModal('eventDetailModal');
    if (location.hash.startsWith('#event-')) history.replaceState(null, '', location.pathname + location.search);
  };

  window.openEventDetail = function (eventId) {
    const ev = allEvents.find(e => e.id === eventId);
    if (!ev) return;
    const [icon, tLabel] = TYPE_LABELS[ev.type] || ['calendar', ev.type];
    const past = isPast(ev);
    const body = document.getElementById('eventDetailBody');

    const attendeeList = ev.going.length
      ? ev.going.map(r => {
        const p = r.profiles || {};
        return `<div class="detail-attendee">${ASDFL.getAvatarHTML({ name: p.name, avatar_url: p.avatar_url, avatar_position: p.avatar_position }, 'detail-face')}<span>${E(p.name || 'Katılımcı')}</span></div>`;
      }).join('')
      : `<p style="color:var(--text-muted);font-size:.85rem">Henüz katılan yok.</p>`;

    body.innerHTML = `
      <span class="badge ${TYPE_COLORS[ev.type] || 'badge-blue'}"><i data-lucide="${A(icon)}" style="width:1em;height:1em"></i> ${E(tLabel)}</span>
      <h3 style="margin:.75rem 0 .5rem">${E(ev.title)}</h3>
      <div class="detail-meta">
        <span><i data-lucide="calendar" style="width:1.1rem;height:1.1rem"></i> ${E(ASDFL.formatDate(ev.date))}${ev.time ? ' · ' + E(ev.time) : ''}${ev.end_time ? ' - ' + E(ev.end_time) : ''}</span>
        <span><i data-lucide="map-pin" style="width:1.1rem;height:1.1rem"></i> ${E(ev.location || 'ASDFL')}</span>
        ${ev.capacity != null ? `<span><i data-lucide="users" style="width:1.1rem;height:1.1rem"></i> ${ev.goingCount}/${ev.capacity} kontenjan</span>` : `<span><i data-lucide="users" style="width:1.1rem;height:1.1rem"></i> ${ev.goingCount} katılımcı</span>`}
      </div>
      <p class="detail-desc">${E(ev.desc) || '<span style=\"color:var(--text-muted)\">Açıklama eklenmemiş.</span>'}</p>
      <div class="detail-actions">
        ${!past ? renderUpcomingActions(ev) : ''}
        <button class="btn btn-ghost btn-sm" onclick="window.shareEvent('${A(ev.id)}')"><i data-lucide="share-2" style="width:1.1rem;height:1.1rem"></i> Paylaş</button>
      </div>
      <div class="detail-attendees-block">
        <h4 style="font-size:.9rem;margin:1.25rem 0 .5rem"><i data-lucide="users" style="width:1em;height:1em"></i> Katılımcılar (${ev.goingCount})</h4>
        <div class="detail-attendees-list">${attendeeList}</div>
      </div>`;
    ASDFL.openModal('eventDetailModal');
    ASDFL.refreshIcons(body);
  };

  window.shareEvent = async function (eventId) {
    const ev = allEvents.find(e => e.id === eventId);
    if (!ev) return;
    const url = location.origin + location.pathname + '#event-' + eventId;
    const shareData = { title: ev.title, text: `ASDFL etkinliği: ${ev.title}`, url };
    if (navigator.share) {
      try { await navigator.share(shareData); return; } catch (e) { /* iptal edildi */ }
    }
    try {
      await navigator.clipboard.writeText(url);
      ASDFL.toast('Etkinlik bağlantısı kopyalandı.', 'success');
    } catch (e) {
      ASDFL.toast('Bağlantı: ' + url, 'info');
    }
  };

  function handleDeepLink() {
    const m = location.hash.match(/^#event-(.+)$/);
    if (m) {
      const ev = allEvents.find(e => e.id === m[1]);
      if (ev) setTimeout(() => window.openEventDetail(ev.id), 100);
    }
  }

  /* ---------- Yardımcılar ---------- */
  function skeletonCards(n) {
    return `<div class="events-cards-grid">${Array.from({ length: n }).map(() => `
      <div class="card event-card skeleton-card">
        <div class="ec-cover-wrap"><div class="skeleton-box" style="height:120px"></div></div>
        <div class="ec-body"><div class="skeleton-box" style="height:20px;width:70%"></div>
          <div class="skeleton-box" style="height:14px;width:50%;margin-top:.75rem"></div>
          <div class="skeleton-box" style="height:38px;width:100%;margin-top:1rem"></div></div>
      </div>`).join('')}</div>`;
  }

  function emptyState(icon, title, sub) {
    return `<div class="events-empty">
      <i data-lucide="${A(icon)}" style="width:2.5rem;height:2.5rem;opacity:.4"></i>
      <p class="events-empty-title">${E(title)}</p>
      ${sub ? `<p class="events-empty-sub">${E(sub)}</p>` : ''}
    </div>`;
  }

  window.filterEvents = function (type, btn) {
    document.querySelectorAll('.event-filter-bar .tag').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderEvents(type);
  };
})();
