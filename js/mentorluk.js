// MENTORSHIP PANEL CONTROLLER
let mentorships = [];
let appointments = [];
let isMentor = false;

let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth(); // 0-indexed (0 = Ocak, 11 = Aralık)
let selectedDate = new Date(); // Default today

async function initPortal() {
  await ASDFL.waitForAuth();
  
  if (!ASDFL.currentUser) {
    const authBlock = document.getElementById('mentorAuthBlock');
    const activeWrapper = document.getElementById('mentorActiveWrapper');
    if (authBlock) authBlock.style.display = 'block';
    if (activeWrapper) activeWrapper.style.display = 'none';
    setTimeout(() => lucide.createIcons(), 10);
    return;
  }

  const authBlock = document.getElementById('mentorAuthBlock');
  const activeWrapper = document.getElementById('mentorActiveWrapper');
  if (authBlock) authBlock.style.display = 'none';
  if (activeWrapper) activeWrapper.style.display = 'block';

  // Set user profile info
  const nameEl = document.getElementById('portalUserName');
  if (nameEl) nameEl.textContent = `Hoş Geldiniz, ${ASDFL.currentUser.name}`;

  // Role detection
  isMentor = ASDFL.currentUser.role === 'Admin' || ASDFL.currentUser.mentor === true;

  const portalRoleBadge = document.getElementById('portalRoleBadge');
  const btnTabRequests = document.getElementById('btn-tab-requests');
  const requestsTitle = document.getElementById('requestsTitle');
  const requestsSubtitle = document.getElementById('requestsSubtitle');
  const connectionsTitle = document.getElementById('connectionsTitle');
  const connectionsSubtitle = document.getElementById('connectionsSubtitle');
  const scheduleFormTitle = document.getElementById('scheduleFormTitle');
  const scheduleUserLabel = document.getElementById('scheduleUserLabel');
  
  if (isMentor) {
    if (portalRoleBadge) {
      portalRoleBadge.className = 'badge badge-gold';
      portalRoleBadge.innerHTML = '<i data-lucide="sparkles" style="width:1em;height:1em;display:inline-block;vertical-align:middle;margin-top:-2px"></i> Mentör Paneli';
    }
    if (btnTabRequests) {
      btnTabRequests.innerHTML = '<i data-lucide="clipboard-list" style="width:1.2rem;height:1.2rem"></i> Öğrenci Talepleri';
    }
    if (requestsTitle) requestsTitle.textContent = 'Öğrenci Talepleri';
    if (requestsSubtitle) requestsSubtitle.textContent = 'Öğrencilerden gelen mentörlük bağlantı isteklerini buradan yönetebilirsiniz.';
    if (connectionsTitle) connectionsTitle.textContent = 'Aktif Öğrencilerim';
    if (connectionsSubtitle) connectionsSubtitle.textContent = 'Mentörlük verdiğiniz aktif öğrencilerinizin listesi.';
    if (scheduleFormTitle) {
      scheduleFormTitle.innerHTML = '<i data-lucide="plus" style="display:inline-block;vertical-align:middle;margin-top:-2px;margin-right:4px;"></i> Randevu Planla';
    }
    if (scheduleUserLabel) scheduleUserLabel.textContent = 'Öğrenci Seçin';
    
    const select = document.getElementById('appTargetUser');
    if (select) {
      const defaultOption = select.querySelector('option[value=""]');
      if (defaultOption) defaultOption.textContent = 'Lütfen öğrenci seçin';
    }
    
    const submitBtn = document.querySelector('#appointmentForm button[type="submit"]');
    if (submitBtn) submitBtn.textContent = 'Randevu Planla';
  } else {
    if (portalRoleBadge) {
      portalRoleBadge.className = 'badge badge-teal';
      portalRoleBadge.innerHTML = '<i data-lucide="sparkles" style="width:1em;height:1em;display:inline-block;vertical-align:middle;margin-top:-2px"></i> Danışan Paneli';
    }
    if (btnTabRequests) {
      btnTabRequests.innerHTML = '<i data-lucide="clipboard-list" style="width:1.2rem;height:1.2rem"></i> Başvurularım';
    }
    if (requestsTitle) requestsTitle.textContent = 'Başvurularım';
    if (requestsSubtitle) requestsSubtitle.textContent = 'Mentörlük almak için gönderdiğiniz başvuruları buradan inceleyebilirsiniz.';
    if (connectionsTitle) connectionsTitle.textContent = 'Aktif Mentörlerim';
    if (connectionsSubtitle) connectionsSubtitle.textContent = 'Eşleştiğiniz ve mentörlük aldığınız mezun mentörler.';
    if (scheduleFormTitle) {
      scheduleFormTitle.innerHTML = '<i data-lucide="plus" style="display:inline-block;vertical-align:middle;margin-top:-2px;margin-right:4px;"></i> Randevu Talep Et';
    }
    if (scheduleUserLabel) scheduleUserLabel.textContent = 'Mentör Seçin';
    
    const select = document.getElementById('appTargetUser');
    if (select) {
      const defaultOption = select.querySelector('option[value=""]');
      if (defaultOption) defaultOption.textContent = 'Lütfen mentör seçin';
    }
    
    const submitBtn = document.querySelector('#appointmentForm button[type="submit"]');
    if (submitBtn) submitBtn.textContent = 'Randevu Talep Et';
  }

  // Pre-fill today's date in form
  const dateInput = document.getElementById('appDate');
  if (dateInput) {
    dateInput.value = selectedDate.toISOString().split('T')[0];
  }

  // Set up navigation tab buttons
  window.switchPortalTab = function(tabId) {
    document.querySelectorAll('.portal-tab-content').forEach(el => el.classList.remove('active'));
    const tabEl = document.getElementById(`tab-${tabId}`);
    if (tabEl) tabEl.classList.add('active');

    document.querySelectorAll('.portal-nav-btn').forEach(btn => btn.classList.remove('active'));
    const btnEl = document.getElementById(`btn-tab-${tabId}`);
    if (btnEl) btnEl.classList.add('active');
    
    setTimeout(() => lucide.createIcons(), 10);
  };

  // Switch to overview initially
  switchPortalTab('overview');

  // Load and refresh panel content
  await refreshPortalData();
}

async function refreshPortalData() {
  const allMentorships = await ASDFL.fetchMentorships();
  const allAppointments = await ASDFL.fetchMentorshipAppointments();

  // Filter lists based on user role
  if (isMentor) {
    mentorships = allMentorships.filter(m => m.mentor_id === ASDFL.currentUser.id);
    appointments = allAppointments.filter(a => a.mentor_id === ASDFL.currentUser.id);
  } else {
    mentorships = allMentorships.filter(m => m.student_id === ASDFL.currentUser.id);
    appointments = allAppointments.filter(a => a.student_id === ASDFL.currentUser.id);
  }

  populateTargetUserDropdown();
  renderOverviewTab();
  renderRequestsTab();
  renderConnectionsTab();
  
  // Render calendar & day events
  renderCalendar(currentYear, currentMonth);
  updateSelectedDayAppointments(selectedDate.toISOString().split('T')[0]);

  setTimeout(() => lucide.createIcons(), 15);
}

function populateTargetUserDropdown() {
  const select = document.getElementById('appTargetUser');
  if (!select) return;

  const defaultOption = select.querySelector('option[value=""]');
  select.innerHTML = '';
  if (defaultOption) {
    select.appendChild(defaultOption);
  } else {
    const opt = document.createElement('option');
    opt.value = '';
    opt.disabled = true;
    opt.selected = true;
    opt.textContent = isMentor ? 'Lütfen öğrenci seçin' : 'Lütfen mentör seçin';
    select.appendChild(opt);
  }

  const activeConnections = mentorships.filter(m => m.status === 'Active');
  activeConnections.forEach(m => {
    const opt = document.createElement('option');
    if (isMentor) {
      opt.value = m.student_id;
      opt.textContent = m.student?.name || 'Öğrenci';
    } else {
      opt.value = m.mentor_id;
      opt.textContent = m.mentor?.name || 'Mentör';
    }
    select.appendChild(opt);
  });
}

function renderOverviewTab() {
  const activeConnections = mentorships.filter(m => m.status === 'Active');
  const pendingRequests = mentorships.filter(m => m.status === 'Pending');

  const todayStr = new Date().toISOString().split('T')[0];
  const scheduledApps = appointments.filter(a => a.status === 'Scheduled' && a.appointment_date >= todayStr);

  const statConnections = document.getElementById('statConnectionsCount');
  if (statConnections) statConnections.textContent = activeConnections.length;

  const statPending = document.getElementById('statPendingRequestsCount');
  if (statPending) statPending.textContent = pendingRequests.length;

  const statApps = document.getElementById('statAppointmentsCount');
  if (statApps) statApps.textContent = scheduledApps.length;

  // Upcoming Meetings list
  const upcomingList = document.getElementById('overviewUpcomingList');
  if (upcomingList) {
    if (scheduledApps.length === 0) {
      upcomingList.innerHTML = '<p style="color:var(--text-muted); font-size:0.85rem; padding: 1rem 0;">Yakın zamanda planlanmış randevunuz bulunmamaktadır.</p>';
    } else {
      const sorted = [...scheduledApps].sort((a, b) => {
        const dateComp = a.appointment_date.localeCompare(b.appointment_date);
        if (dateComp !== 0) return dateComp;
        return a.appointment_time.localeCompare(b.appointment_time);
      });

      upcomingList.innerHTML = sorted.map(app => {
        const partnerName = isMentor ? (app.student?.name || 'Öğrenci') : (app.mentor?.name || 'Mentör');
        const partnerRole = isMentor ? 'Öğrenci' : 'Mezun Mentör';
        const partnerInitials = ASDFL.getInitials(partnerName);
        const formattedDate = ASDFL.formatDate(app.appointment_date);

        return `
          <div class="appointment-card">
            <div class="appointment-meta">
              <div style="display:flex; align-items:center; gap:0.5rem">
                ${ASDFL.getAvatarHTML(isMentor ? app.student : app.mentor, 'avatar avatar-sm')}
                <div>
                  <strong style="color:var(--text-primary); font-size:0.88rem">${partnerName}</strong>
                  <span style="font-size:0.75rem; color:var(--text-muted); display:block">${partnerRole}</span>
                </div>
              </div>
              <span class="appointment-status status-scheduled">Planlandı</span>
            </div>
            <div style="display:flex; flex-direction:column; gap:0.35rem; font-size:0.82rem; color:var(--text-secondary);">
              <div><i data-lucide="calendar" style="width:14px; height:14px; display:inline-block; vertical-align:middle; margin-top:-2px; margin-right:4px;"></i> ${formattedDate} - ${app.appointment_time} (${app.duration} Dk)</div>
              ${app.notes ? `<div style="font-style:italic; font-size:0.8rem; color:var(--text-muted); margin-top:0.25rem; border-left:2px solid var(--gold-500); padding-left:8px;">"${app.notes}"</div>` : ''}
            </div>
            <div style="display:flex; gap:0.5rem; margin-top:0.5rem">
              ${isMentor ? `<button onclick="completeAppointment('${app.id}')" style="background: rgba(45,206,137,0.15); border: 1px solid rgba(45,206,137,0.3); color: var(--teal-500); padding: 0.35rem 0.75rem; font-size: 0.78rem; font-weight:600; border-radius: var(--radius-sm); cursor:pointer;"><i data-lucide="check" style="width:12px; height:12px; display:inline-block; vertical-align:middle; margin-right:2px"></i> Görüşüldü</button>` : ''}
              <button onclick="cancelAppointment('${app.id}')" style="background: rgba(235,94,85,0.15); border: 1px solid rgba(235,94,85,0.3); color: var(--text-red, #eb5e55); padding: 0.35rem 0.75rem; font-size: 0.78rem; font-weight:600; border-radius: var(--radius-sm); cursor:pointer;"><i data-lucide="x" style="width:12px; height:12px; display:inline-block; vertical-align:middle; margin-right:2px"></i> İptal Et</button>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // Son Talepler / Hareketler list
  const notificationsList = document.getElementById('overviewNotificationsList');
  if (notificationsList) {
    let notificationsHtml = '';
    
    if (isMentor) {
      if (pendingRequests.length === 0) {
        notificationsHtml = '<p style="color: var(--text-muted); font-size:0.85rem; padding: 1rem 0;">Bekleyen yeni bir talep bulunmamaktadır.</p>';
      } else {
        notificationsHtml = pendingRequests.slice(0, 3).map(req => {
          const reqName = req.student?.name || 'Öğrenci';
          const reqGrade = req.student?.grade || '12. Sınıf';
          const reqCity = req.student?.city || 'Afyon';
          return `
            <div class="card" style="padding: 1rem; background: rgba(255, 255, 255, 0.02); border: 1px solid var(--glass-border); border-radius: var(--radius-md);">
              <div style="display:flex; justify-content:space-between; align-items:start; flex-wrap:wrap; gap:0.5rem">
                <div>
                  <strong style="color:var(--text-primary); font-size:0.9rem">${reqName}</strong>
                  <span style="font-size:0.75rem; color:var(--text-muted); display:block">${reqGrade} | ${reqCity}</span>
                </div>
                <span class="badge badge-gold" style="font-size:0.7rem">Yeni İstek</span>
              </div>
              <p style="font-size:0.82rem; color:var(--text-secondary); margin-top:0.5rem; font-style:italic;">"${req.notes}"</p>
              <div style="display:flex; gap:0.5rem; margin-top:0.75rem">
                <button onclick="approveRequest('${req.id}')" style="background: rgba(45,206,137,0.15); border: 1px solid rgba(45,206,137,0.3); color: var(--teal-500); padding: 0.35rem 0.75rem; font-size: 0.78rem; font-weight:600; border-radius: var(--radius-sm); cursor:pointer;"><i data-lucide="check" style="width:12px; height:12px; display:inline-block; vertical-align:middle; margin-right:2px"></i> Onayla</button>
                <button onclick="rejectRequest('${req.id}')" style="background: rgba(235,94,85,0.15); border: 1px solid rgba(235,94,85,0.3); color: var(--text-red, #eb5e55); padding: 0.35rem 0.75rem; font-size: 0.78rem; font-weight:600; border-radius: var(--radius-sm); cursor:pointer;"><i data-lucide="x" style="width:12px; height:12px; display:inline-block; vertical-align:middle; margin-right:2px"></i> Reddet</button>
              </div>
            </div>
          `;
        }).join('');
      }
    } else {
      if (mentorships.length === 0) {
        notificationsHtml = '<p style="color: var(--text-muted); font-size:0.85rem; padding: 1rem 0;">Henüz bir mentörlük başvurunuz bulunmamaktadır.</p>';
      } else {
        notificationsHtml = mentorships.slice(0, 3).map(m => {
          const mentorName = m.mentor?.name || 'Mentör';
          const statusText = m.status === 'Pending' ? 'İnceleniyor' : (m.status === 'Active' ? 'Eşleşti' : 'İptal Edildi');
          const badgeClass = m.status === 'Pending' ? 'badge-gold' : (m.status === 'Active' ? 'badge-teal' : 'badge-danger');
          return `
            <div class="card" style="padding: 1rem; background: rgba(255, 255, 255, 0.02); border: 1px solid var(--glass-border); border-radius: var(--radius-md); display:flex; justify-content:space-between; align-items:center;">
              <div>
                <strong style="color:var(--text-primary); font-size:0.9rem">${mentorName}</strong>
                <span style="font-size:0.75rem; color:var(--text-muted); display:block">${m.mentor?.job || 'Mezun'}</span>
              </div>
              <span class="badge ${badgeClass}" style="font-size:0.75rem">${statusText}</span>
            </div>
          `;
        }).join('');
      }
    }
    
    notificationsList.innerHTML = notificationsHtml;
  }
}

function renderRequestsTab() {
  const container = document.getElementById('requestsListContainer');
  if (!container) return;

  if (isMentor) {
    const pending = mentorships.filter(m => m.status === 'Pending');
    if (pending.length === 0) {
      container.innerHTML = '<p style="color:var(--text-muted); font-size:0.9rem; text-align:center; padding: 3rem 0;">Bekleyen mentörlük talebi bulunmamaktadır.</p>';
    } else {
      container.innerHTML = pending.map(req => {
        const studentName = req.student?.name || 'Öğrenci';
        const studentCity = req.student?.city || 'Afyon';
        const studentGrade = req.student?.grade || '12. Sınıf';
        const dateFormatted = ASDFL.formatDate(req.created_at);

        return `
          <div class="card" style="padding: 1.5rem; background: rgba(255, 255, 255, 0.02); border: 1px solid var(--glass-border); border-radius: var(--radius-md);">
            <div style="display:flex; justify-content:space-between; align-items:start; flex-wrap:wrap; gap:1rem; border-bottom: 1px solid var(--glass-border); padding-bottom:1rem; margin-bottom:1rem;">
              <div style="display:flex; align-items:center; gap: 0.75rem;">
                ${ASDFL.getAvatarHTML(req.student, 'avatar')}
                <div>
                  <h4 style="margin:0; font-size:1rem; color:var(--text-primary);">${studentName}</h4>
                  <span style="font-size:0.8rem; color:var(--text-muted);">${studentGrade} | ${studentCity}</span>
                </div>
              </div>
              <div style="text-align:right">
                <span class="badge badge-gold">Bekliyor</span>
                <span style="display:block; font-size:0.72rem; color:var(--text-muted); margin-top:0.25rem">${dateFormatted}</span>
              </div>
            </div>
            <div style="margin-bottom:1.25rem">
              <strong style="display:block; font-size:0.85rem; color:var(--text-primary); margin-bottom:0.25rem">Talep Notu:</strong>
              <p style="font-size:0.85rem; color:var(--text-secondary); line-height:1.5; font-style:italic;">"${req.notes}"</p>
            </div>
            <div style="display:flex; gap:0.75rem;">
              <button class="btn btn-primary btn-sm" onclick="approveRequest('${req.id}')" style="background:linear-gradient(135deg,var(--teal-500),var(--teal-700)); color:#fff; box-shadow:none; border:none; padding:0.5rem 1.25rem"><i data-lucide="check" style="width:16px; height:16px; display:inline-block; vertical-align:middle; margin-right:4px"></i> Kabul Et</button>
              <button class="btn btn-secondary btn-sm" onclick="rejectRequest('${req.id}')" style="border-color: rgba(235,94,85,0.4); color: var(--text-red);"><i data-lucide="x" style="width:16px; height:16px; display:inline-block; vertical-align:middle; margin-right:4px"></i> Reddet</button>
            </div>
          </div>
        `;
      }).join('');
    }
  } else {
    if (mentorships.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding: 3rem 0;">
          <p style="color:var(--text-muted); font-size:0.9rem; margin-bottom:1.5rem">Henüz bir mentörlük başvurusunda bulunmadınız.</p>
          <a href="burs-mentorluk.html" class="btn btn-primary btn-sm">Mentör Bul & Bağlantı Kur</a>
        </div>
      `;
    } else {
      container.innerHTML = mentorships.map(req => {
        const mentorName = req.mentor?.name || 'Mentör';
        const mentorJob = req.mentor?.job || 'Mezun';
        const mentorCity = req.mentor?.city || '';
        const mentorGrad = req.mentor?.grad_year || '';
        const statusText = req.status === 'Pending' ? 'Bekliyor' : (req.status === 'Active' ? 'Aktif' : (req.status === 'Completed' ? 'Tamamlandı' : 'Reddedildi / İptal'));
        const badgeClass = req.status === 'Pending' ? 'badge-gold' : (req.status === 'Active' ? 'badge-teal' : (req.status === 'Completed' ? 'badge-teal' : 'badge-danger'));
        const dateFormatted = ASDFL.formatDate(req.created_at);

        return `
          <div class="card" style="padding: 1.25rem; background: rgba(255, 255, 255, 0.02); border: 1px solid var(--glass-border); border-radius: var(--radius-md); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
            <div style="display:flex; align-items:center; gap: 0.75rem;">
              ${ASDFL.getAvatarHTML(req.mentor, 'avatar')}
              <div>
                <h4 style="margin:0; font-size:0.95rem; color:var(--text-primary);">${mentorName}</h4>
                <span style="font-size:0.8rem; color:var(--text-muted);">${mentorJob} ${mentorGrad ? `(${mentorGrad} Mezunu)` : ''} ${mentorCity ? `| ${mentorCity}` : ''}</span>
                <span style="display:block; font-size:0.75rem; color:var(--text-secondary); margin-top:0.25rem; font-style:italic;">Not: "${req.notes}"</span>
              </div>
            </div>
            <div style="text-align:right">
              <span class="badge ${badgeClass}">${statusText}</span>
              <span style="display:block; font-size:0.7rem; color:var(--text-muted); margin-top:0.25rem">${dateFormatted}</span>
            </div>
          </div>
        `;
      }).join('');
    }
  }
}

function renderConnectionsTab() {
  const container = document.getElementById('connectionsGridContainer');
  if (!container) return;

  const active = mentorships.filter(m => m.status === 'Active');

  if (active.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align:center; padding: 3rem 0;">
        <p style="color:var(--text-muted); font-size:0.9rem;">Aktif bir mentörlük bağlantınız bulunmamaktadır.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = active.map(conn => {
    const partnerName = isMentor ? (conn.student?.name || 'Öğrenci') : (conn.mentor?.name || 'Mentör');
    const partnerEmail = isMentor ? (conn.student?.email || '') : (conn.mentor?.email || '');
    const partnerRole = isMentor ? (conn.student?.grade || 'Öğrenci') : `${conn.mentor?.job || 'Mezun'} ${conn.mentor?.grad_year ? `(${conn.mentor.grad_year} Mezunu)` : ''}`;
    const partnerCity = isMentor ? (conn.student?.city || '') : (conn.mentor?.city || '');
    const partnerPhone = isMentor ? (conn.student?.phone || '') : (conn.mentor?.phone || '');
    const partnerInitials = ASDFL.getInitials(partnerName);
    const targetUserId = isMentor ? conn.student_id : conn.mentor_id;

    return `
      <div class="card lift" style="padding: 1.5rem; background: rgba(255, 255, 255, 0.02); border: 1px solid var(--glass-border); border-radius: var(--radius-lg); display:flex; flex-direction:column; justify-content:space-between; gap:1.25rem;">
        <div>
          <div style="display:flex; gap:0.75rem; align-items:center; margin-bottom:1rem;">
            ${ASDFL.getAvatarHTML(isMentor ? conn.student : conn.mentor, 'avatar avatar-lg')}
            <div>
              <h4 style="margin:0; font-size:1.02rem; color:var(--text-primary);">${partnerName}</h4>
              <span style="font-size:0.78rem; color:var(--gold-500); font-weight:600; display:block; margin-top:0.15rem;">${partnerRole}</span>
              ${partnerCity ? `<span style="font-size:0.72rem; color:var(--text-muted); display:block; margin-top:0.1rem;"><i data-lucide="map-pin" style="width:11px; height:11px; display:inline-block; vertical-align:middle; margin-right:2px"></i> ${partnerCity}</span>` : ''}
            </div>
          </div>
          
          <div style="border-top:1px solid var(--glass-border); padding-top:0.75rem; font-size:0.82rem; color:var(--text-secondary); display:flex; flex-direction:column; gap:0.35rem;">
            ${partnerEmail ? `<div><i data-lucide="mail" style="width:14px; height:14px; display:inline-block; vertical-align:middle; margin-right:4px"></i> <a href="mailto:${partnerEmail}" style="color:inherit; text-decoration:none;">${partnerEmail}</a></div>` : ''}
            ${partnerPhone ? `<div><i data-lucide="phone" style="width:14px; height:14px; display:inline-block; vertical-align:middle; margin-right:4px"></i> <a href="tel:${partnerPhone}" style="color:inherit; text-decoration:none;">${partnerPhone}</a></div>` : ''}
          </div>
        </div>

        <button class="btn btn-secondary btn-sm" onclick="startBookingWithUser('${targetUserId}')" style="width:100%; border-color: rgba(244, 168, 54, 0.2); color: var(--gold-400); margin-top: 0.5rem;">
          <i data-lucide="calendar" style="width:14px; height:14px; display:inline-block; vertical-align:middle; margin-right:4px"></i> Görüşme Planla
        </button>
      </div>
    `;
  }).join('');
}

window.startBookingWithUser = function(targetUserId) {
  const select = document.getElementById('appTargetUser');
  if (select) {
    select.value = targetUserId;
  }
  switchPortalTab('calendar');
};

function renderCalendar(year, month) {
  const monthNames = [
    "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
  ];
  
  const calendarMonthTitle = document.getElementById('calendarMonthTitle');
  if (calendarMonthTitle) {
    calendarMonthTitle.textContent = `${monthNames[month]} ${year}`;
  }

  const calendarDaysGrid = document.getElementById('calendarDaysGrid');
  if (!calendarDaysGrid) return;
  calendarDaysGrid.innerHTML = '';

  // Calculate first weekday index of month (0: Pzt, 6: Paz)
  let firstDayIndex = new Date(year, month, 1).getDay();
  let startingDay = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

  // Days count of current month
  const totalDays = new Date(year, month + 1, 0).getDate();

  // Days count of previous month for padding
  const prevMonthTotalDays = new Date(year, month, 0).getDate();

  // Render previous month's padding cells
  for (let i = startingDay; i > 0; i--) {
    const dayDiv = document.createElement('div');
    dayDiv.className = 'calendar-day empty';
    dayDiv.textContent = prevMonthTotalDays - i + 1;
    calendarDaysGrid.appendChild(dayDiv);
  }

  // Render current month cells
  const today = new Date();
  for (let day = 1; day <= totalDays; day++) {
    const dayDiv = document.createElement('div');
    dayDiv.className = 'calendar-day';
    dayDiv.textContent = day;

    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    dayDiv.dataset.date = dateStr;

    // Check if day is today
    if (today.getFullYear() === year && today.getMonth() === month && today.getDate() === day) {
      dayDiv.classList.add('today');
    }

    // Check if day matches selected date
    if (selectedDate.getFullYear() === year && selectedDate.getMonth() === month && selectedDate.getDate() === day) {
      dayDiv.classList.add('selected');
    }

    // Highlight day if there are meetings scheduled
    const hasApp = appointments.some(app => app.appointment_date === dateStr && app.status === 'Scheduled');
    if (hasApp) {
      dayDiv.classList.add('has-appointment');
    }

    // Day cell click behavior
    dayDiv.addEventListener('click', () => {
      document.querySelectorAll('.calendar-day.selected').forEach(d => d.classList.remove('selected'));
      dayDiv.classList.add('selected');
      selectedDate = new Date(year, month, day);
      
      updateSelectedDayAppointments(dateStr);

      const dateInput = document.getElementById('appDate');
      if (dateInput) {
        dateInput.value = dateStr;
      }
    });

    calendarDaysGrid.appendChild(dayDiv);
  }

  // Render next month's padding cells
  const totalCells = startingDay + totalDays;
  const remainingCells = (7 - (totalCells % 7)) % 7;
  for (let i = 1; i <= remainingCells; i++) {
    const dayDiv = document.createElement('div');
    dayDiv.className = 'calendar-day empty';
    dayDiv.textContent = i;
    calendarDaysGrid.appendChild(dayDiv);
  }
}

function updateSelectedDayAppointments(dateStr) {
  const container = document.getElementById('selectedDayAppointments');
  if (!container) return;

  const formattedDate = ASDFL.formatDate(dateStr);
  const titleEl = document.getElementById('selectedDateTitle');
  if (titleEl) {
    titleEl.textContent = `${formattedDate} Görüşmeleri`;
  }

  const dayApps = appointments.filter(a => a.appointment_date === dateStr);
  
  if (dayApps.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted); font-size:0.85rem; padding: 0.5rem 0;">Bu tarihte planlanmış bir randevu bulunmamaktadır.</p>';
    return;
  }

  const sorted = [...dayApps].sort((a, b) => a.appointment_time.localeCompare(b.appointment_time));

  container.innerHTML = sorted.map(app => {
    const partnerName = isMentor ? (app.student?.name || 'Öğrenci') : (app.mentor?.name || 'Mentör');
    const statusText = app.status === 'Scheduled' ? 'Planlandı' : (app.status === 'Completed' ? 'Tamamlandı' : 'İptal Edildi');
    const badgeClass = app.status === 'Scheduled' ? 'status-scheduled' : (app.status === 'Completed' ? 'status-completed' : 'status-cancelled');

    return `
      <div class="appointment-card" style="margin-bottom:0.5rem; padding: 1rem;">
        <div class="appointment-meta">
          <div>
            <strong style="color:var(--text-primary); font-size:0.88rem; display:block;">${partnerName}</strong>
            <span style="font-size:0.75rem; color:var(--text-muted);">${app.appointment_time} (${app.duration} Dk)</span>
          </div>
          <span class="appointment-status ${badgeClass}" style="font-size:0.7rem; padding: 0.15rem 0.5rem;">${statusText}</span>
        </div>
        ${app.notes ? `<p style="font-size:0.8rem; color:var(--text-secondary); margin: 0.35rem 0 0; font-style:italic;">"${app.notes}"</p>` : ''}
        ${app.status === 'Scheduled' ? `
          <div style="display:flex; gap:0.5rem; margin-top:0.6rem;">
            ${isMentor ? `<button onclick="completeAppointment('${app.id}')" style="background: rgba(45,206,137,0.15); border: 1px solid rgba(45,206,137,0.3); color: var(--teal-500); padding: 0.25rem 0.5rem; font-size: 0.72rem; font-weight:600; border-radius: var(--radius-sm); cursor:pointer;"><i data-lucide="check" style="width:11px; height:11px; display:inline-block; vertical-align:middle; margin-right:2px"></i> Görüşüldü</button>` : ''}
            <button onclick="cancelAppointment('${app.id}')" style="background: rgba(235,94,85,0.15); border: 1px solid rgba(235,94,85,0.3); color: var(--text-red, #eb5e55); padding: 0.25rem 0.5rem; font-size: 0.72rem; font-weight:600; border-radius: var(--radius-sm); cursor:pointer;"><i data-lucide="x" style="width:11px; height:11px; display:inline-block; vertical-align:middle; margin-right:2px"></i> İptal Et</button>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
  
  setTimeout(() => lucide.createIcons(), 10);
}

// Action Handlers
window.approveRequest = async function(id) {
  if (confirm('Bu mentörlük bağlantı talebini kabul etmek istediğinize emin misiniz?')) {
    const success = await ASDFL.updateMentorshipStatus(id, 'Active');
    if (success) {
      await refreshPortalData();
    }
  }
};

window.rejectRequest = async function(id) {
  if (confirm('Bu mentörlük bağlantı talebini reddetmek istediğinize emin misiniz?')) {
    const success = await ASDFL.updateMentorshipStatus(id, 'Cancelled');
    if (success) {
      await refreshPortalData();
    }
  }
};

window.completeAppointment = async function(id) {
  if (confirm('Görüşmenin tamamlandığını onaylıyor musunuz?')) {
    const success = await ASDFL.updateAppointmentStatus(id, 'Completed');
    if (success) {
      await refreshPortalData();
    }
  }
};

window.cancelAppointment = async function(id) {
  if (confirm('Bu randevuyu iptal etmek istediğinize emin misiniz?')) {
    const success = await ASDFL.updateAppointmentStatus(id, 'Cancelled');
    if (success) {
      await refreshPortalData();
    }
  }
};

window.submitScheduleAppointment = async function() {
  const targetUserSelect = document.getElementById('appTargetUser');
  const dateInput = document.getElementById('appDate');
  const timeInput = document.getElementById('appTime');
  const durationSelect = document.getElementById('appDuration');
  const notesTextarea = document.getElementById('appNotes');

  if (!targetUserSelect || !dateInput || !timeInput || !durationSelect || !notesTextarea) return;

  const targetUserId = targetUserSelect.value;
  const date = dateInput.value;
  const time = timeInput.value;
  const duration = durationSelect.value;
  const notes = notesTextarea.value;

  if (!targetUserId) {
    ASDFL.toast(isMentor ? 'Lütfen bir öğrenci seçin.' : 'Lütfen bir mentör seçin.', 'warning');
    return;
  }
  if (!date || !time) {
    ASDFL.toast('Lütfen tarih ve saat alanlarını doldurun.', 'warning');
    return;
  }
  if (!notes.trim()) {
    ASDFL.toast('Lütfen randevu detaylarını/konusunu yazın.', 'warning');
    return;
  }

  let success = false;
  if (isMentor) {
    success = await ASDFL.createAppointment(ASDFL.currentUser.id, targetUserId, date, time, duration, notes);
  } else {
    success = await ASDFL.createAppointment(targetUserId, ASDFL.currentUser.id, date, time, duration, notes);
  }

  if (success) {
    // Reset form fields
    targetUserSelect.value = '';
    dateInput.value = selectedDate.toISOString().split('T')[0];
    timeInput.value = '';
    notesTextarea.value = '';
    
    // Refresh lists and calendar
    await refreshPortalData();
  }
};

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
  initPortal();

  // Calendar Controls
  document.getElementById('btnPrevMonth')?.addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 0) {
      currentMonth = 11;
      currentYear--;
    }
    renderCalendar(currentYear, currentMonth);
  });

  document.getElementById('btnNextMonth')?.addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 11) {
      currentMonth = 0;
      currentYear++;
    }
    renderCalendar(currentYear, currentMonth);
  });
});
