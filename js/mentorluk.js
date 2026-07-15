// MENTORSHIP PANEL CONTROLLER
let mentorships = [];
let appointments = [];
let isMentor = false;
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();
let selectedDate = new Date();

const mentorEscapeHTML = value => ASDFL.escapeHTML(value);
const mentorEscapeAttr = value => ASDFL.escapeAttr(value);
const mentorJsString = value => ASDFL.jsString(value);

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseLocalDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  return Number.isNaN(date.getTime()) ? null : date;
}

function safeEmailLink(value) {
  const email = String(value || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return { href: `mailto:${encodeURIComponent(email)}`, label: email };
}

function safePhoneLink(value) {
  const label = String(value || '').trim();
  const normalized = label.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
  if (!/^\+?\d{7,15}$/.test(normalized)) return null;
  return { href: `tel:${normalized}`, label };
}

function emptyMentorState(icon, title, description, action = '') {
  return `<div class="mentor-empty-state">
    <span><i data-lucide="${mentorEscapeAttr(icon)}" aria-hidden="true"></i></span>
    <strong>${mentorEscapeHTML(title)}</strong>
    <p>${mentorEscapeHTML(description)}</p>
    ${action}
  </div>`;
}

function partnerForAppointment(appointment) {
  return isMentor
    ? { profile: appointment.student || {}, name: appointment.student?.name || 'Öğrenci', role: appointment.student?.grade || 'Öğrenci' }
    : { profile: appointment.mentor || {}, name: appointment.mentor?.name || 'Mentör', role: appointment.mentor?.job || 'Mezun mentör' };
}

function appointmentStatus(status) {
  const map = {
    Scheduled: ['Planlandı', 'status-scheduled'],
    Completed: ['Tamamlandı', 'status-completed'],
    Cancelled: ['İptal edildi', 'status-cancelled']
  };
  return map[status] || ['Durum bilinmiyor', 'status-cancelled'];
}

function renderAppointmentCard(appointment, compact = false) {
  const partner = partnerForAppointment(appointment);
  const [statusLabel, statusClass] = appointmentStatus(appointment.status);
  const actionHtml = appointment.status === 'Scheduled' ? `<div class="appointment-actions">
    ${isMentor ? `<button type="button" class="mentor-action-btn success" onclick="completeAppointment(${mentorJsString(appointment.id)})"><i data-lucide="check" aria-hidden="true"></i> Görüşüldü</button>` : ''}
    <button type="button" class="mentor-action-btn danger" onclick="cancelAppointment(${mentorJsString(appointment.id)})"><i data-lucide="x" aria-hidden="true"></i> İptal et</button>
  </div>` : '';

  return `<article class="appointment-card${compact ? ' is-compact' : ''}">
    <div class="appointment-meta">
      <div class="appointment-person">
        ${ASDFL.getAvatarHTML(partner.profile, compact ? 'avatar avatar-sm' : 'avatar')}
        <div><strong>${mentorEscapeHTML(partner.name)}</strong><span>${mentorEscapeHTML(partner.role)}</span></div>
      </div>
      <span class="appointment-status ${statusClass}">${statusLabel}</span>
    </div>
    <div class="appointment-details">
      <span><i data-lucide="calendar" aria-hidden="true"></i>${mentorEscapeHTML(ASDFL.formatDate(appointment.appointment_date))}</span>
      <span><i data-lucide="clock" aria-hidden="true"></i>${mentorEscapeHTML(appointment.appointment_time || 'Saat belirtilmedi')} · ${mentorEscapeHTML(appointment.duration || 45)} dk</span>
    </div>
    ${appointment.notes ? `<p class="appointment-note">${mentorEscapeHTML(appointment.notes)}</p>` : ''}
    ${actionHtml}
  </article>`;
}

function bindPortalTabKeyboard() {
  const tablist = document.querySelector('.mentor-tablist[role="tablist"]');
  if (!tablist || tablist.dataset.keyboardReady === 'true') return;
  tablist.dataset.keyboardReady = 'true';
  tablist.addEventListener('keydown', event => {
    const tabs = [...tablist.querySelectorAll('[role="tab"]')];
    const index = tabs.indexOf(event.target.closest('[role="tab"]'));
    if (index < 0) return;
    let next = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    if (next == null) return;
    event.preventDefault();
    const target = tabs[next];
    window.switchPortalTab(target.id.replace('btn-tab-', ''));
    target.focus();
  });
}

window.switchPortalTab = function(tabId, options = {}) {
  document.querySelectorAll('.portal-tab-content').forEach(panel => {
    const active = panel.id === `tab-${tabId}`;
    panel.classList.toggle('active', active);
    panel.hidden = !active;
  });
  document.querySelectorAll('.portal-nav-btn').forEach(button => {
    const active = button.id === `btn-tab-${tabId}`;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
    button.tabIndex = active ? 0 : -1;
  });
  const button = document.getElementById(`btn-tab-${tabId}`);
  const panel = document.getElementById(`tab-${tabId}`);
  if (button && window.matchMedia('(max-width: 992px)').matches) {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    button.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest', inline: 'center' });
  }
  if (options.focusPanel && panel) requestAnimationFrame(() => panel.focus({ preventScroll: true }));
  setTimeout(() => ASDFL.refreshIcons(), 10);
};

async function initPortal() {
  await ASDFL.waitForAuth();
  const authBlock = document.getElementById('mentorAuthBlock');
  const activeWrapper = document.getElementById('mentorActiveWrapper');
  if (!ASDFL.currentUser) {
    if (authBlock) authBlock.style.display = 'block';
    if (activeWrapper) activeWrapper.style.display = 'none';
    setTimeout(() => ASDFL.refreshIcons(), 10);
    return;
  }
  if (authBlock) authBlock.style.display = 'none';
  if (activeWrapper) activeWrapper.style.display = 'block';

  const userName = ASDFL.currentUser.name || 'ASDFL üyesi';
  const nameEl = document.getElementById('portalUserName');
  if (nameEl) nameEl.textContent = `Hoş geldiniz, ${userName}`;
  isMentor = ASDFL.currentUser.role === 'Admin' || ASDFL.currentUser.mentor === true;
  applyRoleCopy();

  const dateInput = document.getElementById('appDate');
  if (dateInput) {
    dateInput.min = localDateKey(new Date());
    dateInput.value = localDateKey(selectedDate);
  }
  bindPortalTabKeyboard();
  window.switchPortalTab('overview');
  await refreshPortalData();
}

function applyRoleCopy() {
  const roleBadge = document.getElementById('portalRoleBadge');
  const requestsButton = document.getElementById('btn-tab-requests');
  const requestsTitle = document.getElementById('requestsTitle');
  const requestsSubtitle = document.getElementById('requestsSubtitle');
  const connectionsTitle = document.getElementById('connectionsTitle');
  const connectionsSubtitle = document.getElementById('connectionsSubtitle');
  const formTitle = document.getElementById('scheduleFormTitle');
  const userLabel = document.getElementById('scheduleUserLabel');
  const submitButton = document.querySelector('#appointmentForm button[type="submit"]');
  if (isMentor) {
    if (roleBadge) { roleBadge.className = 'badge badge-gold mentor-role-badge'; roleBadge.innerHTML = '<i data-lucide="sparkles" aria-hidden="true"></i> Mentör paneli'; }
    if (requestsButton) requestsButton.innerHTML = '<i data-lucide="clipboard-list" aria-hidden="true"></i> Öğrenci talepleri';
    if (requestsTitle) requestsTitle.textContent = 'Öğrenci talepleri';
    if (requestsSubtitle) requestsSubtitle.textContent = 'Öğrencilerden gelen mentörlük bağlantı isteklerini yönetin.';
    if (connectionsTitle) connectionsTitle.textContent = 'Aktif öğrencilerim';
    if (connectionsSubtitle) connectionsSubtitle.textContent = 'Mentörlük verdiğiniz öğrenciler ve güvenli iletişim bilgileri.';
    if (formTitle) formTitle.innerHTML = '<i data-lucide="calendar-plus" aria-hidden="true"></i> Görüşme planla';
    if (userLabel) userLabel.textContent = 'Öğrenci seçin';
    if (submitButton) submitButton.textContent = 'Görüşme oluştur';
  } else {
    if (roleBadge) { roleBadge.className = 'badge badge-teal mentor-role-badge'; roleBadge.innerHTML = '<i data-lucide="sparkles" aria-hidden="true"></i> Danışan paneli'; }
    if (requestsButton) requestsButton.innerHTML = '<i data-lucide="clipboard-list" aria-hidden="true"></i> Başvurularım';
    if (requestsTitle) requestsTitle.textContent = 'Başvurularım';
    if (requestsSubtitle) requestsSubtitle.textContent = 'Mentörlük almak için gönderdiğiniz başvuruların durumunu izleyin.';
    if (connectionsTitle) connectionsTitle.textContent = 'Aktif mentörlerim';
    if (connectionsSubtitle) connectionsSubtitle.textContent = 'Eşleştiğiniz mezun mentörler ve görüşme planlama alanı.';
    if (formTitle) formTitle.innerHTML = '<i data-lucide="calendar-plus" aria-hidden="true"></i> Görüşme planla';
    if (userLabel) userLabel.textContent = 'Mentör seçin';
    if (submitButton) submitButton.textContent = 'Görüşme oluştur';
  }
}

async function refreshPortalData() {
  const [allMentorships, allAppointments] = await Promise.all([ASDFL.fetchMentorships(), ASDFL.fetchMentorshipAppointments()]);
  if (isMentor) {
    mentorships = allMentorships.filter(item => item.mentor_id === ASDFL.currentUser.id);
    appointments = allAppointments.filter(item => item.mentor_id === ASDFL.currentUser.id);
  } else {
    mentorships = allMentorships.filter(item => item.student_id === ASDFL.currentUser.id);
    appointments = allAppointments.filter(item => item.student_id === ASDFL.currentUser.id);
  }
  populateTargetUserDropdown();
  renderOverviewTab();
  renderRequestsTab();
  renderConnectionsTab();
  renderCalendar(currentYear, currentMonth);
  updateSelectedDayAppointments(localDateKey(selectedDate));
  setTimeout(() => ASDFL.refreshIcons(), 15);
}

function populateTargetUserDropdown() {
  const select = document.getElementById('appTargetUser');
  if (!select) return;
  select.replaceChildren();
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.disabled = true;
  placeholder.selected = true;
  placeholder.textContent = isMentor ? 'Lütfen öğrenci seçin' : 'Lütfen mentör seçin';
  select.appendChild(placeholder);
  mentorships.filter(item => item.status === 'Active').forEach(item => {
    const option = document.createElement('option');
    option.value = isMentor ? item.student_id : item.mentor_id;
    option.textContent = isMentor ? (item.student?.name || 'Öğrenci') : (item.mentor?.name || 'Mentör');
    select.appendChild(option);
  });
}

function renderOverviewTab() {
  const activeConnections = mentorships.filter(item => item.status === 'Active');
  const pendingRequests = mentorships.filter(item => item.status === 'Pending');
  const todayKey = localDateKey(new Date());
  const scheduled = appointments
    .filter(item => item.status === 'Scheduled' && item.appointment_date >= todayKey)
    .sort((a, b) => `${a.appointment_date} ${a.appointment_time || ''}`.localeCompare(`${b.appointment_date} ${b.appointment_time || ''}`));
  document.getElementById('statConnectionsCount').textContent = activeConnections.length;
  document.getElementById('statPendingRequestsCount').textContent = pendingRequests.length;
  document.getElementById('statAppointmentsCount').textContent = scheduled.length;

  const upcomingHost = document.getElementById('overviewUpcomingList');
  if (upcomingHost) {
    upcomingHost.innerHTML = scheduled.length
      ? renderAppointmentCard(scheduled[0])
      : emptyMentorState('calendar-check', 'Ajandanız açık', 'Planlanmış gelecek görüşmeniz bulunmuyor.', '<button type="button" class="btn btn-primary btn-sm" onclick="switchPortalTab(\'calendar\', { focusPanel: true })">Görüşme planla</button>');
  }

  const activityHost = document.getElementById('overviewNotificationsList');
  if (!activityHost) return;
  if (isMentor) {
    activityHost.innerHTML = pendingRequests.length
      ? pendingRequests.slice(0, 3).map(renderPendingRequestActivity).join('')
      : emptyMentorState('inbox', 'Yeni talep yok', 'Bekleyen öğrenci talebi bulunmuyor.');
  } else {
    activityHost.innerHTML = mentorships.length
      ? mentorships.slice(0, 3).map(renderStudentActivity).join('')
      : emptyMentorState('user-search', 'Henüz başvuru yok', 'Bir mentör seçtiğinizde başvurunuz burada görünür.');
  }
}

function renderPendingRequestActivity(request) {
  const name = request.student?.name || 'Öğrenci';
  const meta = [request.student?.grade, request.student?.city].filter(Boolean).join(' · ') || 'Öğrenci';
  return `<article class="mentor-activity-card">
    <div><strong>${mentorEscapeHTML(name)}</strong><span>${mentorEscapeHTML(meta)}</span></div><span class="badge badge-gold">Yeni talep</span>
    ${request.notes ? `<p>${mentorEscapeHTML(request.notes)}</p>` : ''}
    <div class="mentor-card-actions"><button type="button" class="mentor-action-btn success" onclick="approveRequest(${mentorJsString(request.id)})">Onayla</button><button type="button" class="mentor-action-btn danger" onclick="rejectRequest(${mentorJsString(request.id)})">Reddet</button></div>
  </article>`;
}

function renderStudentActivity(item) {
  const statusMap = { Pending: ['İnceleniyor', 'badge-gold'], Active: ['Eşleşti', 'badge-teal'], Completed: ['Tamamlandı', 'badge-teal'], Cancelled: ['İptal edildi', 'badge-danger'] };
  const [label, className] = statusMap[item.status] || ['Durum bilinmiyor', 'badge-blue'];
  return `<article class="mentor-activity-card is-row"><div><strong>${mentorEscapeHTML(item.mentor?.name || 'Mentör')}</strong><span>${mentorEscapeHTML(item.mentor?.job || 'Mezun')}</span></div><span class="badge ${className}">${label}</span></article>`;
}

function renderRequestsTab() {
  const host = document.getElementById('requestsListContainer');
  if (!host) return;
  if (isMentor) {
    const pending = mentorships.filter(item => item.status === 'Pending');
    host.innerHTML = pending.length ? pending.map(request => {
      const name = request.student?.name || 'Öğrenci';
      const meta = [request.student?.grade, request.student?.city].filter(Boolean).join(' · ') || 'Öğrenci';
      return `<article class="mentor-request-card">
        <div class="mentor-card-header"><div class="appointment-person">${ASDFL.getAvatarHTML(request.student || {}, 'avatar')}<div><h4>${mentorEscapeHTML(name)}</h4><span>${mentorEscapeHTML(meta)}</span></div></div><div><span class="badge badge-gold">Bekliyor</span><small>${mentorEscapeHTML(ASDFL.formatDate(request.created_at))}</small></div></div>
        <div class="mentor-request-note"><strong>Talep notu</strong><p>${mentorEscapeHTML(request.notes || 'Not eklenmemiş.')}</p></div>
        <div class="mentor-card-actions"><button type="button" class="btn btn-primary btn-sm" onclick="approveRequest(${mentorJsString(request.id)})"><i data-lucide="check" aria-hidden="true"></i> Kabul et</button><button type="button" class="btn btn-secondary btn-sm danger-text" onclick="rejectRequest(${mentorJsString(request.id)})"><i data-lucide="x" aria-hidden="true"></i> Reddet</button></div>
      </article>`;
    }).join('') : emptyMentorState('inbox', 'Bekleyen talep yok', 'Yeni bir öğrenci talebi geldiğinde burada görünecek.');
    return;
  }
  host.innerHTML = mentorships.length ? mentorships.map(item => {
    const statusMap = { Pending: ['Bekliyor', 'badge-gold'], Active: ['Aktif', 'badge-teal'], Completed: ['Tamamlandı', 'badge-teal'], Cancelled: ['Reddedildi / iptal', 'badge-danger'] };
    const [label, className] = statusMap[item.status] || ['Durum bilinmiyor', 'badge-blue'];
    const mentor = item.mentor || {};
    const meta = [mentor.job || 'Mezun', mentor.grad_year ? `${mentor.grad_year} mezunu` : '', mentor.city || ''].filter(Boolean).join(' · ');
    return `<article class="mentor-request-card is-summary"><div class="appointment-person">${ASDFL.getAvatarHTML(mentor, 'avatar')}<div><h4>${mentorEscapeHTML(mentor.name || 'Mentör')}</h4><span>${mentorEscapeHTML(meta)}</span>${item.notes ? `<p>${mentorEscapeHTML(item.notes)}</p>` : ''}</div></div><div class="mentor-request-status"><span class="badge ${className}">${label}</span><small>${mentorEscapeHTML(ASDFL.formatDate(item.created_at))}</small></div></article>`;
  }).join('') : emptyMentorState('user-search', 'Henüz başvurunuz yok', 'Uygun bir mezun mentör bularak ilk bağlantınızı kurabilirsiniz.', '<a href="burs-mentorluk.html" class="btn btn-primary btn-sm">Mentör bul</a>');
}

function renderConnectionsTab() {
  const host = document.getElementById('connectionsGridContainer');
  if (!host) return;
  const active = mentorships.filter(item => item.status === 'Active');
  if (!active.length) {
    host.innerHTML = emptyMentorState('users-round', 'Aktif bağlantı yok', 'Eşleşmeniz tamamlandığında bağlantınız burada görünecek.');
    return;
  }
  host.innerHTML = active.map(connection => {
    const profile = isMentor ? (connection.student || {}) : (connection.mentor || {});
    const name = profile.name || (isMentor ? 'Öğrenci' : 'Mentör');
    const role = isMentor ? (profile.grade || 'Öğrenci') : [profile.job || 'Mezun', profile.grad_year ? `${profile.grad_year} mezunu` : ''].filter(Boolean).join(' · ');
    const email = safeEmailLink(profile.email);
    const phone = safePhoneLink(profile.phone);
    const targetId = isMentor ? connection.student_id : connection.mentor_id;
    const contactHtml = email || phone ? `<div class="mentor-contact-list">
      ${email ? `<a href="${mentorEscapeAttr(email.href)}"><i data-lucide="mail" aria-hidden="true"></i><span>${mentorEscapeHTML(email.label)}</span></a>` : ''}
      ${phone ? `<a href="${mentorEscapeAttr(phone.href)}"><i data-lucide="phone" aria-hidden="true"></i><span>${mentorEscapeHTML(phone.label)}</span></a>` : ''}
    </div>` : '';
    return `<article class="mentor-connection-card">
      <div class="mentor-connection-profile">${ASDFL.getAvatarHTML(profile, 'avatar avatar-lg')}<div><h4>${mentorEscapeHTML(name)}</h4><strong>${mentorEscapeHTML(role)}</strong>${profile.city ? `<span><i data-lucide="map-pin" aria-hidden="true"></i>${mentorEscapeHTML(profile.city)}</span>` : ''}</div></div>
      ${contactHtml}
      <div style="display:flex;gap:.6rem;flex-wrap:wrap">
        <a class="btn btn-primary btn-sm" href="mesajlar.html?user=${mentorEscapeAttr(encodeURIComponent(targetId))}" data-messenger-user="${mentorEscapeAttr(targetId)}"><i data-lucide="message-circle" aria-hidden="true"></i> Mesaj gönder</a>
        <button type="button" class="btn btn-secondary btn-sm" onclick="startBookingWithUser(${mentorJsString(targetId)})"><i data-lucide="calendar-plus" aria-hidden="true"></i> Görüşme planla</button>
      </div>
    </article>`;
  }).join('');
}

window.startBookingWithUser = function(targetUserId) {
  const select = document.getElementById('appTargetUser');
  if (select) select.value = targetUserId;
  window.switchPortalTab('calendar', { focusPanel: true });
  requestAnimationFrame(() => select?.focus());
};

function renderCalendar(year, month) {
  const monthNames = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  const title = document.getElementById('calendarMonthTitle');
  const grid = document.getElementById('calendarDaysGrid');
  if (title) title.textContent = `${monthNames[month]} ${year}`;
  if (!grid) return;
  grid.setAttribute('role', 'grid');
  grid.setAttribute('aria-label', `${monthNames[month]} ${year} takvimi`);
  const firstDay = new Date(year, month, 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const previousMonthDays = new Date(year, month, 0).getDate();
  const todayKey = localDateKey(new Date());
  const cells = [];
  for (let index = offset; index > 0; index -= 1) cells.push(`<span class="calendar-day empty" aria-hidden="true">${previousMonthDays - index + 1}</span>`);
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day, 12);
    const key = localDateKey(date);
    const count = appointments.filter(item => item.appointment_date === key && item.status === 'Scheduled').length;
    const classes = ['calendar-day'];
    if (key === todayKey) classes.push('today');
    if (key === localDateKey(selectedDate)) classes.push('selected');
    if (count) classes.push('has-appointment');
    const label = `${date.toLocaleDateString('tr-TR', { day:'numeric', month:'long', weekday:'long' })}; ${count ? `${count} görüşme` : 'görüşme yok'}`;
    cells.push(`<button type="button" role="gridcell" class="${classes.join(' ')}" data-date="${key}" aria-label="${mentorEscapeAttr(label)}" aria-pressed="${key === localDateKey(selectedDate)}">${day}</button>`);
  }
  const used = offset + daysInMonth;
  const trailing = (7 - (used % 7)) % 7;
  for (let day = 1; day <= trailing; day += 1) cells.push(`<span class="calendar-day empty" aria-hidden="true">${day}</span>`);
  grid.innerHTML = cells.join('');
  grid.querySelectorAll('button.calendar-day').forEach(button => button.addEventListener('click', () => selectCalendarDate(button.dataset.date)));
}

function selectCalendarDate(dateKey) {
  const date = parseLocalDate(dateKey);
  if (!date) return;
  selectedDate = date;
  currentYear = date.getFullYear();
  currentMonth = date.getMonth();
  renderCalendar(currentYear, currentMonth);
  updateSelectedDayAppointments(dateKey);
  const input = document.getElementById('appDate');
  if (input) input.value = dateKey;
}

function updateSelectedDayAppointments(dateKey) {
  const host = document.getElementById('selectedDayAppointments');
  const title = document.getElementById('selectedDateTitle');
  if (!host) return;
  if (title) title.textContent = `${ASDFL.formatDate(dateKey)} görüşmeleri`;
  const dayAppointments = appointments.filter(item => item.appointment_date === dateKey).sort((a,b) => String(a.appointment_time || '').localeCompare(String(b.appointment_time || '')));
  host.innerHTML = dayAppointments.length
    ? dayAppointments.map(item => renderAppointmentCard(item, true)).join('')
    : emptyMentorState('calendar-x', 'Bu gün boş', 'Seçili tarihte planlanmış görüşme bulunmuyor.');
  setTimeout(() => ASDFL.refreshIcons(), 10);
}

function moveCalendarMonth(delta) {
  const target = new Date(currentYear, currentMonth + delta, 1, 12);
  currentYear = target.getFullYear();
  currentMonth = target.getMonth();
  selectedDate = target;
  const key = localDateKey(target);
  renderCalendar(currentYear, currentMonth);
  updateSelectedDayAppointments(key);
  const input = document.getElementById('appDate');
  if (input) input.value = key;
}

window.approveRequest = async function(id) {
  if (confirm('Bu mentörlük bağlantı talebini kabul etmek istediğinize emin misiniz?') && await ASDFL.updateMentorshipStatus(id, 'Active')) await refreshPortalData();
};
window.rejectRequest = async function(id) {
  if (confirm('Bu mentörlük bağlantı talebini reddetmek istediğinize emin misiniz?') && await ASDFL.updateMentorshipStatus(id, 'Cancelled')) await refreshPortalData();
};
window.completeAppointment = async function(id) {
  if (confirm('Görüşmenin tamamlandığını onaylıyor musunuz?') && await ASDFL.updateAppointmentStatus(id, 'Completed')) await refreshPortalData();
};
window.cancelAppointment = async function(id) {
  if (confirm('Bu randevuyu iptal etmek istediğinize emin misiniz?') && await ASDFL.updateAppointmentStatus(id, 'Cancelled')) await refreshPortalData();
};

window.submitScheduleAppointment = async function() {
  const user = document.getElementById('appTargetUser');
  const dateInput = document.getElementById('appDate');
  const timeInput = document.getElementById('appTime');
  const duration = document.getElementById('appDuration');
  const notes = document.getElementById('appNotes');
  if (!user || !dateInput || !timeInput || !duration || !notes) return;
  if (!user.value) { ASDFL.toast(isMentor ? 'Lütfen bir öğrenci seçin.' : 'Lütfen bir mentör seçin.', 'warning'); return; }
  if (!dateInput.value || !timeInput.value) { ASDFL.toast('Lütfen tarih ve saat alanlarını doldurun.', 'warning'); return; }
  if (!notes.value.trim()) { ASDFL.toast('Lütfen görüşme konusunu yazın.', 'warning'); return; }
  const success = isMentor
    ? await ASDFL.createAppointment(ASDFL.currentUser.id, user.value, dateInput.value, timeInput.value, duration.value, notes.value)
    : await ASDFL.createAppointment(user.value, ASDFL.currentUser.id, dateInput.value, timeInput.value, duration.value, notes.value);
  if (!success) return;
  user.value = '';
  dateInput.value = localDateKey(selectedDate);
  timeInput.value = '';
  notes.value = '';
  await refreshPortalData();
};

document.addEventListener('DOMContentLoaded', () => {
  initPortal();
  document.getElementById('btnPrevMonth')?.addEventListener('click', () => moveCalendarMonth(-1));
  document.getElementById('btnNextMonth')?.addEventListener('click', () => moveCalendarMonth(1));
});
