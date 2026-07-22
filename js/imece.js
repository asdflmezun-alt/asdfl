(function imecePageController() {
  'use strict';

  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const IMECE_API = Object.freeze({
    requestColumns: 'id,author_id,category,title,description,urgency,status,audience_all,expires_at,created_at,updated_at,resolved_at',
    profileColumns: 'id,name,role,job,city,avatar_url,avatar_position',
    createRpc: 'create_imece_request',
    updateStatusRpc: 'update_imece_request_status',
    reportRpc: 'report_imece_request'
  });
  const CATEGORY_LABELS = Object.freeze({ contact: 'İletişim / bağlantı', health: 'Sağlık dayanışması', career: 'Kariyer', education: 'Eğitim', legal: 'Hukuki yönlendirme', technical: 'Teknik destek', logistics: 'Lojistik / ulaşım', other: 'Diğer' });
  const URGENCY_LABELS = Object.freeze({ normal: 'Normal', urgent: 'Acil' });
  const STATUS_LABELS = Object.freeze({ open: 'Açık', resolved: 'Çözüldü', closed: 'Kapalı' });

  let requests = [];
  let authors = new Map();
  let selectedPeople = new Map();
  let personSearchTimer = null;
  let personSearchSequence = 0;
  let lastDialogTrigger = null;
  let pendingReport = null;

  const byId = id => document.getElementById(id);
  const escapeHTML = value => ASDFL.escapeHTML(value);
  const escapeAttr = value => ASDFL.escapeAttr(value);

  function asTextArray(value) {
    return Array.isArray(value) ? value.filter(item => typeof item === 'string' && item.trim()).map(item => item.trim()) : [];
  }

  function parseCommaTags(input) {
    return [...new Set(String(input?.value || '').split(',').map(item => item.trim()).filter(item => item.length >= 2).map(item => item.slice(0, 80)))].slice(0, 20);
  }

  function readRequestDeepLink(search = window.location.search) {
    try {
      const raw = new URLSearchParams(search).get('request');
      if (raw === null) return { present: false, id: null };
      const value = raw.trim();
      return { present: true, id: UUID_PATTERN.test(value) ? value.toLowerCase() : null };
    } catch (error) {
      return { present: true, id: null };
    }
  }

  function setGuestState() {
    byId('imeceGuest').hidden = false;
    byId('imeceMember').hidden = true;
    byId('guestLoginButton').hidden = false;
    byId('memberCreateButton').hidden = true;
  }

  function setMemberState() {
    byId('imeceGuest').hidden = true;
    byId('imeceMember').hidden = false;
    byId('guestLoginButton').hidden = true;
    byId('memberCreateButton').hidden = false;
  }

  function renderLoading() {
    const feed = byId('imeceFeed');
    feed.setAttribute('aria-busy', 'true');
    feed.innerHTML = '<div class="imece-loading" aria-label="İmece talepleri yükleniyor"><span></span><span></span><span></span></div>';
    byId('imeceFeedStatus').textContent = 'İmece talepleri yükleniyor…';
  }

  function renderState(icon, title, description, retry = false) {
    byId('imeceFeed').innerHTML = `<div class="imece-state"><i data-lucide="${escapeAttr(icon)}" aria-hidden="true"></i><h3>${escapeHTML(title)}</h3><p>${escapeHTML(description)}</p>${retry ? '<button class="btn btn-secondary" type="button" data-action="retry"><i data-lucide="refresh-cw" aria-hidden="true"></i> Yeniden dene</button>' : ''}</div>`;
    byId('imeceFeed').setAttribute('aria-busy', 'false');
    setTimeout(() => ASDFL.refreshIcons(byId('imeceFeed')), 10);
  }

  async function loadRequests(options = {}) {
    if (!ASDFL.currentUser) return;
    if (!ASDFL.supabase) {
      renderState('wifi-off', 'Bağlantı kurulamadı', 'İmece panosuna şu anda ulaşılamıyor.', true);
      return;
    }
    renderLoading();
    try {
      const { data, error } = await ASDFL.queryWithTimeout(
        ASDFL.supabase
          .from('imece_request_feed')
          .select(IMECE_API.requestColumns)
          .order('created_at', { ascending: false })
          .limit(100),
        10000
      );
      if (error) throw error;
      requests = Array.isArray(data) ? data : [];
      await loadAuthors(requests);
      renderFilteredRequests();
      handleDeepLink(options.focusId || null);
    } catch (error) {
      console.error('İmece talepleri yüklenemedi:', error);
      byId('imeceFeedStatus').textContent = 'Talepler yüklenemedi.';
      renderState('circle-alert', 'İmece panosu yüklenemedi', 'Lütfen bağlantınızı kontrol edip yeniden deneyin.', true);
    }
  }

  async function loadAuthors(items) {
    authors = new Map();
    const ids = [...new Set(items.map(item => item.author_id).filter(id => UUID_PATTERN.test(String(id || ''))))];
    if (!ids.length) return;
    const { data, error } = await ASDFL.queryWithTimeout(
      ASDFL.supabase
        .from('public_profiles')
        .select(IMECE_API.profileColumns)
        .in('id', ids),
      8000
    );
    if (error) throw error;
    (data || []).forEach(profile => authors.set(String(profile.id), profile));
  }

  function matchesFilters(request) {
    const term = byId('imeceSearch').value.trim().toLocaleLowerCase('tr-TR');
    const category = byId('imeceCategoryFilter').value;
    const status = byId('imeceStatusFilter').value;
    const urgency = byId('imeceUrgencyFilter').value;
    if (category && request.category !== category) return false;
    if (status && request.status !== status) return false;
    if (urgency && request.urgency !== urgency) return false;
    if (!term) return true;
    const author = authors.get(String(request.author_id)) || {};
    return [request.title, request.description, author.name].some(value => String(value || '').toLocaleLowerCase('tr-TR').includes(term));
  }

  function formatDate(value) {
    return value ? ASDFL.formatDate(value) : 'Tarih belirtilmedi';
  }

  function authorMeta(profile) {
    return [profile.role, profile.job, profile.city].filter(Boolean).join(' · ') || 'ASDFL üyesi';
  }

  function renderTargetSummary(request) {
    return request.audience_all
      ? 'Tüm uygun üyelere bildirim gönderildi. Pano tüm üyelere açıktır.'
      : 'İlgili alanlara bildirim gönderildi. Kişisel hedefler panoda gösterilmez.';
  }

  function renderRequestCard(request) {
    const id = String(request.id || '');
    const authorId = String(request.author_id || '');
    const author = authors.get(authorId) || { name: 'ASDFL üyesi' };
    const ownRequest = authorId === String(ASDFL.currentUser?.id || '');
    const safeMessageUrl = UUID_PATTERN.test(authorId) ? ASDFL.safeURL(`mesajlar.html?user=${encodeURIComponent(authorId)}`) : '';
    const category = CATEGORY_LABELS[request.category] || 'Diğer';
    const urgency = URGENCY_LABELS[request.urgency] || 'Normal';
    const status = STATUS_LABELS[request.status] || 'Durum bilinmiyor';
    const urgencyClass = request.urgency === 'urgent' ? 'urgent' : '';
    const statusClass = request.status === 'resolved' ? 'resolved' : request.status === 'closed' ? 'closed' : '';
    const expiryText = request.expires_at ? `Son gün ${formatDate(request.expires_at)}` : 'Son gün belirtilmedi';
    let ownerActions = '';
    if (ownRequest) {
      if (request.status === 'open') ownerActions += `<button class="imece-card-action" type="button" data-action="status" data-status="resolved" data-request-id="${escapeAttr(id)}"><i data-lucide="circle-check" aria-hidden="true"></i> Çözüldü</button><button class="imece-card-action" type="button" data-action="status" data-status="closed" data-request-id="${escapeAttr(id)}"><i data-lucide="archive" aria-hidden="true"></i> Kapat</button>`;
      if (request.status === 'resolved') ownerActions += `<button class="imece-card-action" type="button" data-action="status" data-status="open" data-request-id="${escapeAttr(id)}"><i data-lucide="rotate-ccw" aria-hidden="true"></i> Yeniden aç</button><button class="imece-card-action" type="button" data-action="status" data-status="closed" data-request-id="${escapeAttr(id)}"><i data-lucide="archive" aria-hidden="true"></i> Kapat</button>`;
      if (request.status === 'closed') ownerActions += `<button class="imece-card-action" type="button" data-action="status" data-status="open" data-request-id="${escapeAttr(id)}"><i data-lucide="rotate-ccw" aria-hidden="true"></i> Yeniden aç</button>`;
    }
    const contactAction = !ownRequest && request.status === 'open' && safeMessageUrl
      ? `<a class="btn btn-primary btn-sm" href="${escapeAttr(safeMessageUrl)}" data-messenger-user="${escapeAttr(authorId)}"><i data-lucide="message-circle" aria-hidden="true"></i> Mesaj gönder</a>`
      : '';
    const reportAction = !ownRequest
      ? `<button class="imece-card-action report" type="button" data-action="report" data-request-id="${escapeAttr(id)}"><i data-lucide="flag" aria-hidden="true"></i> Şikâyet et</button>`
      : '';

    return `<article class="imece-card" data-request-id="${escapeAttr(id)}" tabindex="-1">
      <div class="imece-card-head">
        <div class="imece-card-author">${ASDFL.getAvatarHTML(author, 'avatar')}<div><strong>${escapeHTML(author.name || 'ASDFL üyesi')}</strong><span>${escapeHTML(authorMeta(author))}</span></div></div>
        <div class="imece-badges"><span class="imece-badge category">${escapeHTML(category)}</span><span class="imece-badge ${urgencyClass}">${escapeHTML(urgency)}</span><span class="imece-badge ${statusClass}">${escapeHTML(status)}</span></div>
      </div>
      <div class="imece-card-body"><h3>${escapeHTML(request.title || 'Başlıksız ihtiyaç')}</h3><p class="imece-card-description">${escapeHTML(request.description || '')}</p></div>
      <div class="imece-card-meta"><span><i data-lucide="calendar-days" aria-hidden="true"></i>${escapeHTML(formatDate(request.created_at))}</span><span><i data-lucide="hourglass" aria-hidden="true"></i>${escapeHTML(expiryText)}</span></div>
      <div class="imece-target-summary"><i data-lucide="bell-ring" aria-hidden="true"></i><span>${escapeHTML(renderTargetSummary(request))}</span></div>
      <div class="imece-card-actions">${contactAction}${ownerActions}${reportAction}</div>
    </article>`;
  }

  function renderFilteredRequests() {
    const visible = requests.filter(matchesFilters);
    const feed = byId('imeceFeed');
    feed.setAttribute('aria-busy', 'false');
    byId('imeceFeedStatus').textContent = visible.length ? `${visible.length} ihtiyaç gösteriliyor.` : 'Filtrelerle eşleşen ihtiyaç yok.';
    if (!visible.length) {
      renderState('inbox', 'Eşleşen ihtiyaç bulunamadı', 'Filtreleri temizleyebilir veya yeni bir ihtiyaç paylaşabilirsiniz.');
      return;
    }
    feed.innerHTML = visible.map(renderRequestCard).join('');
    setTimeout(() => ASDFL.refreshIcons(feed), 10);
  }

  function handleDeepLink(explicitId) {
    const parsed = explicitId ? { present: true, id: UUID_PATTERN.test(explicitId) ? explicitId.toLowerCase() : null } : readRequestDeepLink();
    if (!parsed.present) return;
    if (!parsed.id) {
      ASDFL.toast('İmece bağlantısı geçersiz.', 'warning');
      return;
    }
    const exists = requests.some(item => String(item.id || '').toLowerCase() === parsed.id);
    if (!exists) {
      ASDFL.toast('Bu ihtiyaç bulunamadı veya artık görüntülenemiyor.', 'warning');
      return;
    }
    clearFilters(false);
    renderFilteredRequests();
    requestAnimationFrame(() => focusRequestCard(parsed.id));
  }

  function focusRequestCard(requestId) {
    const card = [...byId('imeceFeed').querySelectorAll('[data-request-id]')].find(item => item.dataset.requestId?.toLowerCase() === requestId);
    if (!card) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const previousBorder = card.style.borderColor;
    const previousShadow = card.style.boxShadow;
    card.setAttribute('aria-current', 'true');
    card.style.borderColor = 'var(--gold-400)';
    card.style.boxShadow = '0 0 0 3px rgba(244,168,54,.2)';
    card.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    card.focus({ preventScroll: true });
    window.setTimeout(() => {
      card.removeAttribute('aria-current');
      card.style.borderColor = previousBorder;
      card.style.boxShadow = previousShadow;
    }, 5000);
  }

  function clearFilters(render = true) {
    byId('imeceSearch').value = '';
    byId('imeceCategoryFilter').value = '';
    byId('imeceStatusFilter').value = '';
    byId('imeceUrgencyFilter').value = '';
    if (render) renderFilteredRequests();
  }

  function openRequestDialog(event) {
    if (!ASDFL.currentUser) {
      ASDFL.openModal('loginModal');
      return;
    }
    const dialog = byId('imeceRequestDialog');
    resetRequestForm();
    lastDialogTrigger = event?.currentTarget || document.activeElement;
    dialog.showModal();
    requestAnimationFrame(() => byId('imeceCategory').focus());
  }

  function closeRequestDialog() {
    const dialog = byId('imeceRequestDialog');
    if (dialog.open) dialog.close();
  }

  function resetRequestForm() {
    byId('imeceRequestForm').reset();
    byId('imeceExpiryDays').value = '7';
    selectedPeople = new Map();
    renderSelectedPeople();
    hidePersonResults();
    byId('imeceTargetError').textContent = '';
    byId('imeceSubmitStatus').textContent = '';
    toggleTargetFields();
  }

  function toggleTargetFields() {
    const disabled = byId('imeceAudienceAll').checked;
    const container = byId('imeceTargetFields');
    container.setAttribute('aria-disabled', String(disabled));
    container.querySelectorAll('input').forEach(input => { input.disabled = disabled; });
  }

  function targetPayload() {
    const audienceAll = byId('imeceAudienceAll').checked;
    if (audienceAll) return { audienceAll, roles: [], cities: [], jobs: [], companies: [], universities: [], userIds: [] };
    return {
      audienceAll,
      roles: [...document.querySelectorAll('input[name="imeceRole"]:checked')].map(input => input.value),
      cities: parseCommaTags(byId('imeceCities')),
      jobs: parseCommaTags(byId('imeceJobs')),
      companies: parseCommaTags(byId('imeceCompanies')),
      universities: parseCommaTags(byId('imeceUniversities')),
      userIds: [...selectedPeople.keys()]
    };
  }

  function hasNotificationTarget(target) {
    return target.audienceAll || [target.roles, target.cities, target.jobs, target.companies, target.universities, target.userIds].some(items => items.length);
  }

  async function submitRequest(event) {
    event.preventDefault();
    if (!ASDFL.currentUser || !ASDFL.supabase) return;
    const form = byId('imeceRequestForm');
    if (!form.reportValidity()) return;
    const target = targetPayload();
    if (!hasNotificationTarget(target)) {
      byId('imeceTargetError').textContent = 'Tüm üyelere bildirim seçeneğini veya en az bir bildirim hedefini seçin.';
      byId('imeceAudienceAll').focus();
      return;
    }
    byId('imeceTargetError').textContent = '';
    const submitButton = byId('imeceSubmitButton');
    const expiryDays = Number(byId('imeceExpiryDays').value);
    const expiresAt = new Date(Date.now() + expiryDays * 86400000).toISOString();
    submitButton.disabled = true;
    submitButton.setAttribute('aria-busy', 'true');
    byId('imeceSubmitStatus').textContent = 'İhtiyaç paylaşılıyor…';
    try {
      const { data, error } = await ASDFL.queryWithTimeout(
        ASDFL.supabase.rpc(IMECE_API.createRpc, {
          p_category: byId('imeceCategory').value,
          p_title: byId('imeceTitleInput').value.trim(),
          p_description: byId('imeceDescription').value.trim(),
          p_urgency: byId('imeceUrgency').value,
          p_audience_all: target.audienceAll,
          p_target_roles: target.roles,
          p_target_cities: target.cities,
          p_target_jobs: target.jobs,
          p_target_companies: target.companies,
          p_target_universities: target.universities,
          p_target_user_ids: target.userIds,
          p_expires_at: expiresAt
        }),
        10000
      );
      if (error) throw error;
      const requestId = normalizeRpcId(data);
      closeRequestDialog();
      ASDFL.toast('İhtiyacınız İmece panosunda paylaşıldı.', 'success');
      if (requestId) window.history.replaceState({}, '', `imece.html?request=${encodeURIComponent(requestId)}`);
      await loadRequests({ focusId: requestId });
    } catch (error) {
      console.error('İmece ihtiyacı oluşturulamadı:', error);
      byId('imeceSubmitStatus').textContent = 'İhtiyaç paylaşılamadı. Lütfen bilgileri kontrol edip yeniden deneyin.';
      ASDFL.toast('İhtiyaç paylaşılamadı.', 'error');
    } finally {
      submitButton.disabled = false;
      submitButton.removeAttribute('aria-busy');
    }
  }

  function normalizeRpcId(data) {
    const candidate = typeof data === 'string' ? data : Array.isArray(data) ? data[0]?.id : data?.id;
    return UUID_PATTERN.test(String(candidate || '')) ? String(candidate).toLowerCase() : null;
  }

  async function updateRequestStatus(id, status, button) {
    if (!UUID_PATTERN.test(id) || !['open', 'resolved', 'closed'].includes(status)) return;
    const request = requests.find(item => String(item.id) === id);
    if (!request || String(request.author_id) !== String(ASDFL.currentUser?.id)) return;
    button.disabled = true;
    try {
      const { error } = await ASDFL.queryWithTimeout(
        ASDFL.supabase.rpc(IMECE_API.updateStatusRpc, { p_request_id: id, p_status: status }),
        8000
      );
      if (error) throw error;
      ASDFL.toast(status === 'resolved' ? 'İhtiyaç çözüldü olarak işaretlendi.' : status === 'closed' ? 'İhtiyaç kapatıldı.' : 'İhtiyaç yeniden açıldı.', 'success');
      await loadRequests({ focusId: id });
    } catch (error) {
      console.error('İmece durumu güncellenemedi:', error);
      ASDFL.toast('İhtiyaç durumu güncellenemedi.', 'error');
      button.disabled = false;
    }
  }

  function reportRequest(id, button) {
    if (!UUID_PATTERN.test(id)) return;
    const request = requests.find(item => String(item.id) === id);
    if (!request || String(request.author_id) === String(ASDFL.currentUser?.id)) return;
    pendingReport = { id, button };
    byId('imeceReportForm').reset();
    byId('imeceReportStatus').textContent = '';
    byId('imeceReportDialog').showModal();
    requestAnimationFrame(() => byId('imeceReportReason').focus());
  }

  function closeReportDialog() {
    if (byId('imeceReportDialog').open) byId('imeceReportDialog').close();
  }

  async function submitReport(event) {
    event.preventDefault();
    if (!pendingReport || !ASDFL.currentUser || !ASDFL.supabase) return;
    const reasonInput = byId('imeceReportReason');
    if (!reasonInput.reportValidity()) return;
    const normalizedReason = reasonInput.value.trim();
    if (normalizedReason.length < 10 || normalizedReason.length > 500) {
      byId('imeceReportStatus').textContent = 'Şikâyet nedenini 10-500 karakter arasında yazın.';
      reasonInput.focus();
      return;
    }
    const { id, button } = pendingReport;
    const submitButton = byId('imeceReportSubmit');
    submitButton.disabled = true;
    submitButton.setAttribute('aria-busy', 'true');
    byId('imeceReportStatus').textContent = 'Şikâyet gönderiliyor…';
    try {
      const { error } = await ASDFL.queryWithTimeout(
        ASDFL.supabase.rpc(IMECE_API.reportRpc, { p_request_id: id, p_reason: normalizedReason }),
        8000
      );
      if (error) throw error;
      button.textContent = 'Bildirildi';
      button.disabled = true;
      closeReportDialog();
      ASDFL.toast('Şikâyetiniz moderasyon ekibine iletildi.', 'success');
    } catch (error) {
      console.error('İmece şikâyeti gönderilemedi:', error);
      byId('imeceReportStatus').textContent = 'Şikâyet gönderilemedi veya daha önce bildirdiniz.';
    } finally {
      submitButton.disabled = false;
      submitButton.removeAttribute('aria-busy');
    }
  }

  function onFeedClick(event) {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    if (button.dataset.action === 'retry') { loadRequests(); return; }
    const id = String(button.dataset.requestId || '');
    if (button.dataset.action === 'status') updateRequestStatus(id, String(button.dataset.status || ''), button);
    if (button.dataset.action === 'report') reportRequest(id, button);
  }

  function queuePersonSearch() {
    window.clearTimeout(personSearchTimer);
    const query = byId('imecePersonSearch').value.trim();
    if (query.length < 2) {
      hidePersonResults();
      return;
    }
    personSearchTimer = window.setTimeout(() => searchPeople(query), 300);
  }

  function safeIlikeTerm(value) {
    return String(value || '').replace(/[%_\\]/g, '').slice(0, 60);
  }

  async function searchPeople(query) {
    if (!ASDFL.currentUser || !ASDFL.supabase || query.length < 2) return;
    const sequence = ++personSearchSequence;
    showPersonMessage('Üyeler aranıyor…');
    try {
      const term = safeIlikeTerm(query);
      const { data, error } = await ASDFL.queryWithTimeout(
        ASDFL.supabase
          .from('public_profiles')
          .select(IMECE_API.profileColumns)
          .ilike('name', `%${term}%`)
          .limit(8),
        8000
      );
      if (error) throw error;
      if (sequence !== personSearchSequence) return;
      renderPersonResults((data || []).filter(profile => String(profile.id) !== String(ASDFL.currentUser.id) && !selectedPeople.has(String(profile.id))));
    } catch (error) {
      if (sequence !== personSearchSequence) return;
      console.error('İmece kişi araması başarısız:', error);
      showPersonMessage('Üye araması tamamlanamadı.');
    }
  }

  function showPersonMessage(message) {
    const results = byId('imecePersonResults');
    results.hidden = false;
    results.innerHTML = `<p class="imece-person-message">${escapeHTML(message)}</p>`;
    byId('imecePersonSearch').setAttribute('aria-expanded', 'true');
  }

  function renderPersonResults(profiles) {
    if (!profiles.length) {
      showPersonMessage('Eşleşen başka üye bulunamadı.');
      return;
    }
    const results = byId('imecePersonResults');
    results.hidden = false;
    results.innerHTML = profiles.map(profile => `<button class="imece-person-option" type="button" role="option" data-profile-id="${escapeAttr(profile.id)}">${ASDFL.getAvatarHTML(profile, 'avatar')}<span><strong>${escapeHTML(profile.name || 'ASDFL üyesi')}</strong><small>${escapeHTML(authorMeta(profile))}</small></span></button>`).join('');
    byId('imecePersonSearch').setAttribute('aria-expanded', 'true');
    results.querySelectorAll('[data-profile-id]').forEach(button => button.addEventListener('click', () => {
      const profile = profiles.find(item => String(item.id) === button.dataset.profileId);
      if (profile) addSelectedPerson(profile);
    }));
    setTimeout(() => ASDFL.refreshIcons(results), 10);
  }

  function addSelectedPerson(profile) {
    const id = String(profile.id || '');
    if (!UUID_PATTERN.test(id)) return;
    if (selectedPeople.size >= 50) {
      ASDFL.toast('En fazla 50 belirli üye seçebilirsiniz.', 'warning');
      return;
    }
    selectedPeople.set(id, profile);
    byId('imecePersonSearch').value = '';
    hidePersonResults();
    renderSelectedPeople();
  }

  function removeSelectedPerson(id) {
    selectedPeople.delete(id);
    renderSelectedPeople();
    byId('imecePersonSearch').focus();
  }

  function renderSelectedPeople() {
    const host = byId('imecePersonChips');
    host.innerHTML = [...selectedPeople.values()].map(profile => `<span class="imece-chip">${escapeHTML(profile.name || 'ASDFL üyesi')}<button type="button" data-remove-profile="${escapeAttr(profile.id)}" aria-label="${escapeAttr(`${profile.name || 'Üye'} hedefini kaldır`)}"><i data-lucide="x" aria-hidden="true"></i></button></span>`).join('');
    host.querySelectorAll('[data-remove-profile]').forEach(button => button.addEventListener('click', () => removeSelectedPerson(button.dataset.removeProfile)));
    setTimeout(() => ASDFL.refreshIcons(host), 10);
  }

  function hidePersonResults() {
    const results = byId('imecePersonResults');
    results.hidden = true;
    results.replaceChildren();
    byId('imecePersonSearch').setAttribute('aria-expanded', 'false');
  }

  function bindEvents() {
    byId('memberCreateButton').addEventListener('click', openRequestDialog);
    byId('feedCreateButton').addEventListener('click', openRequestDialog);
    byId('imeceDialogClose').addEventListener('click', closeRequestDialog);
    byId('imeceDialogCancel').addEventListener('click', closeRequestDialog);
    byId('imeceRequestForm').addEventListener('submit', submitRequest);
    byId('imeceReportClose').addEventListener('click', closeReportDialog);
    byId('imeceReportCancel').addEventListener('click', closeReportDialog);
    byId('imeceReportForm').addEventListener('submit', submitReport);
    byId('imeceAudienceAll').addEventListener('change', toggleTargetFields);
    byId('imecePersonSearch').addEventListener('input', queuePersonSearch);
    byId('imeceFeed').addEventListener('click', onFeedClick);
    byId('imeceFilters').addEventListener('input', renderFilteredRequests);
    byId('imeceFilters').addEventListener('change', renderFilteredRequests);
    byId('imeceClearFilters').addEventListener('click', () => clearFilters());
    byId('imeceRequestDialog').addEventListener('close', () => {
      hidePersonResults();
      if (lastDialogTrigger && document.contains(lastDialogTrigger)) lastDialogTrigger.focus({ preventScroll: true });
      lastDialogTrigger = null;
    });
    byId('imeceRequestDialog').addEventListener('click', event => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeRequestDialog();
    });
    byId('imeceReportDialog').addEventListener('close', () => {
      const trigger = pendingReport?.button;
      pendingReport = null;
      if (trigger && document.contains(trigger)) trigger.focus({ preventScroll: true });
    });
    byId('imeceReportDialog').addEventListener('click', event => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeReportDialog();
    });
    document.addEventListener('click', event => {
      if (!event.target.closest('.imece-person-picker')) hidePersonResults();
    });
  }

  async function init() {
    await ASDFL.waitForAuth();
    bindEvents();
    if (!ASDFL.currentUser) {
      setGuestState();
      return;
    }
    setMemberState();
    await loadRequests();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
