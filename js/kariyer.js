// =========================================================================
// ASDFL MEZUNLAR DERNEĞİ — KARİYER AĞI FRONTER CONTROLLER (js/kariyer.js)
// =========================================================================

// Caches for listing filters
window.allJobs = [];
window.allRequests = [];

// ==========================================
// 1. NAVIGATION & GENERAL TAB CONTROLLERS
// ==========================================

/**
 * Switch between the top-level Career Network sections (Jobs, Requests, Dashboard)
 */
window.switchCareerTab = function(tabName) {
  // Update tabs active state
  const tabs = document.querySelectorAll('.kariyer-tab');
  tabs.forEach(t => {
    t.classList.remove('active');
  });
  
  let activeTabBtn = null;
  if (tabName === 'jobs') activeTabBtn = document.getElementById('tabBtnJobs');
  else if (tabName === 'requests') activeTabBtn = document.getElementById('tabBtnRequests');
  else if (tabName === 'dashboard') activeTabBtn = document.getElementById('tabBtnDashboard');
  
  if (activeTabBtn) activeTabBtn.classList.add('active');
  
  // Toggle sections
  const sections = [
    document.getElementById('careerSectionJobs'),
    document.getElementById('careerSectionRequests'),
    document.getElementById('careerSectionDashboard')
  ];
  
  sections.forEach(sec => {
    if (sec) sec.classList.add('hidden');
  });
  
  let activeSec = null;
  if (tabName === 'jobs') activeSec = document.getElementById('careerSectionJobs');
  else if (tabName === 'requests') activeSec = document.getElementById('careerSectionRequests');
  else if (tabName === 'dashboard') activeSec = document.getElementById('careerSectionDashboard');
  
  if (activeSec) {
    activeSec.classList.remove('hidden');
    
    // Smooth scroll page to tabs bar to make navigation comfortable on mobile devices
    const tabsWrapper = document.querySelector('.kariyer-tabs-wrapper');
    if (tabsWrapper) {
      const offsetTop = tabsWrapper.offsetTop - 75;
      window.scrollTo({ top: offsetTop, behavior: 'smooth' });
    }
  }
  
  // Update hash dynamically for state persistence on browser reload
  window.location.hash = tabName;
  
  // Trigger appropriate loaders
  if (tabName === 'jobs') renderJobs();
  else if (tabName === 'requests') renderRequests();
  else if (tabName === 'dashboard') renderDashboard();
};

/**
 * Switch between sub-tabs in the personal Owner Dashboard
 */
window.switchDashboardMenu = function(menuName) {
  // Update sidebar active classes
  const menuButtons = document.querySelectorAll('.dashboard-menu-item');
  menuButtons.forEach(btn => {
    btn.classList.remove('active');
  });
  
  let activeBtn = null;
  if (menuName === 'main') activeBtn = document.getElementById('menuBtnMain');
  else if (menuName === 'my-jobs') activeBtn = document.getElementById('menuBtnMyJobs');
  else if (menuName === 'manage-apps') activeBtn = document.getElementById('menuBtnManageApps');
  else if (menuName === 'my-requests') activeBtn = document.getElementById('menuBtnMyRequests');
  else if (menuName === 'my-applications') activeBtn = document.getElementById('menuBtnMyApplications');
  
  if (activeBtn) activeBtn.classList.add('active');
  
  // Toggle sub-content areas
  const subContents = document.querySelectorAll('.dash-sub-content');
  subContents.forEach(content => {
    content.classList.add('hidden');
  });
  
  let activeSub = null;
  if (menuName === 'main') activeSub = document.getElementById('dashSubMain');
  else if (menuName === 'my-jobs') activeSub = document.getElementById('dashSubMyJobs');
  else if (menuName === 'manage-apps') activeSub = document.getElementById('dashSubManageApps');
  else if (menuName === 'my-requests') activeSub = document.getElementById('dashSubMyRequests');
  else if (menuName === 'my-applications') activeSub = document.getElementById('dashSubMyApplications');
  
  if (activeSub) {
    activeSub.classList.remove('hidden');
    // Fetch and render sub-tab data dynamically on select
    if (menuName === 'my-jobs') renderMyPostings();
    else if (menuName === 'manage-apps') renderIncomingApplications();
    else if (menuName === 'my-requests') renderMyRequests();
    else if (menuName === 'my-applications') renderMyApplications();
  }
};

/**
 * Toggle role-specific elements (.role-field) based on the logged-in user's role
 */
function updateRoleFieldsVisibility() {
  const user = ASDFL.currentUser;
  
  // Hide all role fields initially
  document.querySelectorAll('.role-field').forEach(el => {
    el.classList.add('hidden');
  });
  
  if (user) {
    if (user.role === 'Mezun') {
      document.querySelectorAll('.role-mezun').forEach(el => {
        el.classList.remove('hidden');
      });
    } else if (user.role === 'Öğrenci') {
      document.querySelectorAll('.role-ogrenci').forEach(el => {
        el.classList.remove('hidden');
      });
    } else if (user.role === 'Admin') {
      // Admins have access to both management controls
      document.querySelectorAll('.role-mezun, .role-ogrenci').forEach(el => {
        el.classList.remove('hidden');
      });
    }
  }
}

// ==========================================
// 2. MAIN JOBS LIST & SEARCH INTEGRATION
// ==========================================

/**
 * Main Job postings renderer
 */
window.renderJobs = async function() {
  const grid = document.getElementById('jobsGrid');
  if (!grid) return;
  
  grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:3rem"><div class="spinner"></div></div>';
  
  const jobs = await ASDFL.fetchJobPostings();
  window.allJobs = jobs; // Cache locally
  
  filterJobs();
};

/**
 * Filters cached jobs based on search term and dropdown filter value
 */
window.filterJobs = function() {
  const grid = document.getElementById('jobsGrid');
  if (!grid) return;
  
  const query = document.getElementById('jobSearch')?.value.toLowerCase().trim() || '';
  const type = document.getElementById('jobTypeFilter')?.value || 'all';
  
  if (!window.allJobs) return;
  
  const filtered = window.allJobs.filter(job => {
    const matchesSearch = !query || 
      job.title.toLowerCase().includes(query) || 
      job.company.toLowerCase().includes(query) || 
      job.description.toLowerCase().includes(query) ||
      job.location.toLowerCase().includes(query);
      
    const matchesType = type === 'all' || job.type === type;
    
    return matchesSearch && matchesType;
  });
  
  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:4rem 2rem;background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:var(--radius-lg);color:var(--text-muted)">
        <i data-lucide="search-slash" style="width:2.5rem;height:2.5rem;color:var(--text-muted);margin-bottom:.5rem;display:inline-block"></i>
        <p>Arama kriterlerinize uygun iş veya staj ilanı bulunamadı.</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }
  
  const user = ASDFL.currentUser;
  
  grid.innerHTML = filtered.map(job => {
    const isStaj = job.type === 'Staj';
    const cardClass = isStaj ? 'card job-card type-staj' : 'card job-card';
    const initials = job.initials || 'M';
    const dateStr = ASDFL.formatDate(job.created_at);
    
    let actionBtn = '';
    if (!user) {
      actionBtn = `<button class="btn btn-primary btn-sm" onclick="ASDFL.openModal('loginModal')">Başvur (Giriş Yapın)</button>`;
    } else if (user.role === 'Öğrenci' || user.role === 'Admin') {
      actionBtn = `<button class="btn btn-primary btn-sm" onclick="openApplyJobModal('${job.id}', '${job.title.replace(/'/g, "\\'")}', '${job.company.replace(/'/g, "\\'")}')">Başvur</button>`;
    } else {
      actionBtn = `<button class="btn btn-secondary btn-sm" style="opacity:0.65;cursor:not-allowed" disabled title="Sadece öğrenciler iş/staj ilanlarına başvurabilir">Sadece Öğrenci</button>`;
    }
    
    return `
      <div class="${cardClass}">
        <div class="job-card-header">
          <div class="job-title-group">
            <h3>${job.title}</h3>
            <span class="job-company">${job.company}</span>
          </div>
          <span class="badge ${isStaj ? 'badge-success' : 'badge-gold'}">${job.type}</span>
        </div>
        
        <div class="job-meta-row">
          <div class="job-meta-item"><i data-lucide="map-pin" style="width:14px;height:14px"></i> ${job.location}</div>
          <div class="job-meta-item"><i data-lucide="calendar" style="width:14px;height:14px"></i> ${dateStr}</div>
        </div>
        
        <p class="job-desc">${job.description}</p>
        
        <div class="job-footer">
          <div class="job-poster">
            ${ASDFL.getAvatarHTML({ initials, avatar_url: job.employerAvatarUrl, avatar_position: job.employerAvatarPosition, name: job.employerName }, 'avatar avatar-sm')}
            <span>Yayınlayan: <strong>${job.employerName}</strong> ${job.employerYear ? `(${job.employerYear} Mezunu)` : ''}</span>
          </div>
          ${actionBtn}
        </div>
      </div>
    `;
  }).join('');
  
  lucide.createIcons();
};

// ==========================================
// 3. INTERNSHIP REQUESTS (STUDENTS) LIST
// ==========================================

/**
 * Internship requests renderer
 */
window.renderRequests = async function() {
  const grid = document.getElementById('requestsGrid');
  if (!grid) return;
  
  grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:3rem"><div class="spinner"></div></div>';
  
  const requests = await ASDFL.fetchInternshipRequests();
  window.allRequests = requests; // Cache locally
  
  filterRequests();
};

/**
 * Filters student internship requests based on search and fields filter
 */
window.filterRequests = function() {
  const grid = document.getElementById('requestsGrid');
  if (!grid) return;
  
  const query = document.getElementById('reqSearch')?.value.toLowerCase().trim() || '';
  const field = document.getElementById('reqFieldFilter')?.value || 'all';
  
  if (!window.allRequests) return;
  
  const filtered = window.allRequests.filter(req => {
    const matchesSearch = !query || 
      req.title.toLowerCase().includes(query) || 
      req.studentName.toLowerCase().includes(query) || 
      req.details.toLowerCase().includes(query);
      
    const matchesField = field === 'all' || req.field === field;
    
    return matchesSearch && matchesField;
  });
  
  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:4rem 2rem;background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:var(--radius-lg);color:var(--text-muted)">
        <i data-lucide="search-slash" style="width:2.5rem;height:2.5rem;color:var(--text-muted);margin-bottom:.5rem;display:inline-block"></i>
        <p>Arama kriterlerinize uygun staj arayış talebi bulunamadı.</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }
  
  const user = ASDFL.currentUser;
  
  grid.innerHTML = filtered.map(req => {
    const initials = req.initials || 'Ö';
    const dateStr = ASDFL.formatDate(req.created_at);
    
    let contactBtn = '';
    if (user && (user.role === 'Mezun' || user.role === 'Admin')) {
      const email = req.studentEmail || 'info@asdfl.org';
      const subject = encodeURIComponent(`ASDFL Kariyer Ağı — Staj Arayışınız Hakkında`);
      const body = encodeURIComponent(`Merhaba ${req.studentName},\n\nASDFL Kariyer Ağı üzerindeki "${req.title}" başlıklı staj arayış talebinizi inceledim. Sizinle staj/mentörlük imkanları hakkında görüşmek isterim.\n\nSaygılarımla,\n${user.name}`);
      contactBtn = `<a href="mailto:${email}?subject=${subject}&body=${body}" class="btn btn-primary btn-sm"><i data-lucide="mail"></i> İletişime Geç</a>`;
    } else {
      contactBtn = `<button class="btn btn-secondary btn-sm" style="opacity:0.65;cursor:not-allowed" disabled title="Öğrenci iletişim bilgilerini sadece dernek üyesi mezunlar görüntüleyebilir">Sadece Mezunlar</button>`;
    }
    
    return `
      <div class="card req-card">
        <div class="req-header">
          ${ASDFL.getAvatarHTML({ initials, avatar_url: req.studentAvatarUrl, avatar_position: req.studentAvatarPosition, name: req.studentName }, 'avatar')}
          <div class="req-student-info">
            <strong>${req.studentName}</strong>
            <span>${req.studentGrade || 'Öğrenci'} ${req.studentClassSection ? `(${req.studentClassSection} Şubesi)` : ''} — ${dateStr}</span>
          </div>
        </div>
        
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:0.5rem">
          <h3 class="req-title" style="font-size:1.05rem">${req.title}</h3>
          <span class="badge badge-gold" style="font-size:0.75rem">${req.field}</span>
        </div>
        
        <p class="req-details">${req.details}</p>
        
        <div style="display:flex;justify-content:flex-end;margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid var(--glass-border)">
          ${contactBtn}
        </div>
      </div>
    `;
  }).join('');
  
  lucide.createIcons();
};

// ==========================================
// 4. PERSONAL OWNER DASHBOARD CONTROLLERS
// ==========================================

/**
 * Checks auth and builds core dashboard statistics & sub-menu visibility
 */
window.renderDashboard = async function() {
  await ASDFL.waitForAuth();
  
  const loginPrompt = document.getElementById('dashboardLoginPrompt');
  const mainArea = document.getElementById('dashboardMainArea');
  
  if (!loginPrompt || !mainArea) return;
  
  if (!ASDFL.currentUser) {
    loginPrompt.classList.remove('hidden');
    mainArea.classList.add('hidden');
    return;
  }
  
  loginPrompt.classList.add('hidden');
  mainArea.classList.remove('hidden');
  
  // Set welcome credentials
  const avatar = document.getElementById('dashAvatar');
  const title = document.getElementById('dashWelcomeTitle');
  const sub = document.getElementById('dashWelcomeSub');
  
  if (avatar) ASDFL.setAvatarElement(avatar, ASDFL.currentUser);
  if (title) title.textContent = `Hoş Geldiniz, ${ASDFL.currentUser.name}`;
  if (sub) sub.textContent = `Rolünüz: ${ASDFL.currentUser.role}`;
  
  // Show / hide sidebar menus based on active role
  updateRoleFieldsVisibility();
  
  // Maintain subtab selection state
  const activeMenu = document.querySelector('.dashboard-menu-item.active');
  if (activeMenu && !activeMenu.classList.contains('hidden')) {
    const id = activeMenu.id;
    let menuName = 'main';
    if (id === 'menuBtnMyJobs') menuName = 'my-jobs';
    else if (id === 'menuBtnManageApps') menuName = 'manage-apps';
    else if (id === 'menuBtnMyRequests') menuName = 'my-requests';
    else if (id === 'menuBtnMyApplications') menuName = 'my-applications';
    switchDashboardMenu(menuName);
  } else {
    // Reset to overview main tab
    switchDashboardMenu('main');
  }
};

/**
 * Subtab: Verdiğim İlanlar (Mezun)
 */
async function renderMyPostings() {
  const container = document.getElementById('myPostingsList');
  if (!container) return;
  
  container.innerHTML = '<div class="text-center p-3"><div class="spinner"></div></div>';
  
  const jobs = await ASDFL.fetchJobPostings();
  const userJobs = jobs.filter(j => j.employer_id === ASDFL.currentUser.id);
  
  if (userJobs.length === 0) {
    container.innerHTML = `
      <div class="dash-empty">
        <i data-lucide="briefcase" style="width:2.5rem;height:2.5rem;color:var(--text-muted);margin-bottom:.5rem;display:inline-block"></i>
        <p>Henüz herhangi bir iş veya staj ilanı yayınlamadınız.</p>
        <button class="btn btn-primary btn-sm" style="margin-top:1rem" onclick="openNewPostingModal()">Hemen İlan Ver <i data-lucide="plus"></i></button>
      </div>
    `;
    lucide.createIcons();
    return;
  }
  
  const apps = await ASDFL.fetchJobApplications();
  
  container.innerHTML = userJobs.map(job => {
    const jobApps = apps.filter(app => app.posting_id === job.id);
    const pendingCount = jobApps.filter(app => app.status === 'Pending').length;
    
    return `
      <div class="card" style="padding:1.5rem;margin-bottom:1rem;position:relative">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:0.5rem">
          <div>
            <h4 style="color:var(--text-primary);margin-bottom:0.25rem">${job.title}</h4>
            <span class="badge ${job.type === 'Staj' ? 'badge-success' : 'badge-gold'}" style="font-size:0.75rem">${job.type}</span>
            <span style="font-size:0.8rem;color:var(--text-muted);margin-left:0.5rem">
              <i data-lucide="map-pin" style="width:0.85rem;height:0.85rem;display:inline-block;vertical-align:middle"></i> ${job.location}
            </span>
          </div>
          <div style="text-align:right">
            <span style="font-size:0.8rem;color:var(--text-muted);display:block">Yayınlanma: ${ASDFL.formatDate(job.created_at)}</span>
            <span style="font-size:0.8rem;color:var(--text-secondary);display:block;margin-top:0.25rem">
              <strong>${jobApps.length}</strong> Başvuru ${pendingCount > 0 ? `(<span style="color:var(--gold-400)">${pendingCount} bekleyen</span>)` : ''}
            </span>
          </div>
        </div>
        <p style="font-size:0.85rem;color:var(--text-secondary);margin-top:0.75rem;line-height:1.5">${job.description}</p>
        <div style="margin-top:1rem;display:flex;gap:0.5rem;flex-wrap:wrap">
          <button class="btn btn-outline btn-sm" onclick="switchDashboardMenu('manage-apps')">Gelen Başvuruları Yönet <i data-lucide="user-check"></i></button>
          <button class="btn btn-danger btn-sm" style="background:rgba(248, 113, 113, 0.2);color:var(--danger);border:1px solid rgba(248, 113, 113, 0.3)" onclick="confirmDeletePosting('${job.id}')"><i data-lucide="trash-2"></i> İlanı Sil</button>
        </div>
      </div>
    `;
  }).join('');
  
  lucide.createIcons();
}

/**
 * Subtab: Gelen Başvurular (Mezun)
 */
async function renderIncomingApplications() {
  const container = document.getElementById('incomingApplicationsList');
  if (!container) return;
  
  container.innerHTML = '<div class="text-center p-3"><div class="spinner"></div></div>';
  
  const apps = await ASDFL.fetchJobApplications();
  const incomingApps = apps.filter(app => app.employerId === ASDFL.currentUser.id);
  
  if (incomingApps.length === 0) {
    container.innerHTML = `
      <div class="dash-empty">
        <i data-lucide="user-x" style="width:2.5rem;height:2.5rem;color:var(--text-muted);margin-bottom:.5rem;display:inline-block"></i>
        <p>İlanlarınıza gelen herhangi bir başvuru bulunmamaktadır.</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }
  
  container.innerHTML = incomingApps.map(app => {
    const initials = app.initials || 'Ö';
    const statusText = app.status === 'Pending' ? 'Bekliyor' : (app.status === 'Approved' ? 'Onaylandı' : 'Reddedildi');
    const statusClass = app.status === 'Pending' ? 'status-pending' : (app.status === 'Approved' ? 'status-approved' : 'status-rejected');
    
    const email = app.applicantEmail || 'Gizli';
    const phone = app.applicantPhone || 'Gizli';
    
    let actionButtons = '';
    if (app.status === 'Pending') {
      actionButtons = `
        <div style="display:flex;gap:0.5rem">
          <button class="btn btn-success btn-sm" style="background:rgba(45, 212, 191, 0.2);color:var(--success);border:1px solid rgba(45, 212, 191, 0.3)" onclick="respondToApplication('${app.id}', 'Approved')"><i data-lucide="check"></i> Onayla</button>
          <button class="btn btn-danger btn-sm" style="background:rgba(248, 113, 113, 0.2);color:var(--danger);border:1px solid rgba(248, 113, 113, 0.3)" onclick="respondToApplication('${app.id}', 'Rejected')"><i data-lucide="x"></i> Reddet</button>
        </div>
      `;
    } else {
      actionButtons = `
        <span style="font-size:0.85rem;color:var(--text-muted);font-weight:600">Durum: ${statusText}</span>
      `;
    }
    
    return `
      <div class="app-item">
        <div class="app-item-header">
          <div class="app-applicant-profile">
            ${ASDFL.getAvatarHTML({ initials, avatar_url: app.applicantAvatarUrl, avatar_position: app.applicantAvatarPosition, name: app.applicantName }, 'avatar')}
            <div>
              <strong style="color:var(--text-primary);display:block">${app.applicantName}</strong>
              <span style="font-size:0.75rem;color:var(--text-muted)">Öğrenci ${app.applicantYear ? `(${app.applicantYear} Mezunu/Girişli)` : ''}</span>
            </div>
          </div>
          <span class="app-status ${statusClass}">${statusText}</span>
        </div>
        
        <div class="app-details-body">
          <div style="margin-bottom:0.5rem">
            <strong style="color:var(--gold-400)">Başvurulan İlan:</strong> <span style="color:var(--text-primary);font-weight:600">${app.jobTitle} (${app.companyName})</span>
          </div>
          <div style="margin-bottom:0.75rem">
            <strong style="color:var(--gold-400)">Ön Yazı / Başvuru Notu:</strong>
            <p style="margin-top:0.25rem;background:rgba(255,255,255,0.02);padding:0.75rem;border-radius:var(--radius-md);border:1px solid var(--glass-border);font-style:italic;color:var(--text-secondary)">
              "${app.cover_letter}"
            </p>
          </div>
          <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap">
            <strong style="color:var(--gold-400)">CV / Özgeçmiş Bağlantısı:</strong>
            <a href="${app.resume_url}" target="_blank" class="btn btn-secondary btn-sm" style="padding:0.25rem 0.75rem;font-size:0.78rem">
              CV'yi İncele <i data-lucide="external-link" style="width:12px;height:12px;display:inline-block"></i>
            </a>
          </div>
        </div>
        
        <div class="app-actions-row">
          <div style="display:flex;gap:1rem;font-size:0.8rem;color:var(--text-muted);flex-wrap:wrap">
            <span><i data-lucide="mail" style="width:14px;height:14px;display:inline-block;vertical-align:middle"></i> ${email}</span>
            <span><i data-lucide="phone" style="width:14px;height:14px;display:inline-block;vertical-align:middle"></i> ${phone}</span>
          </div>
          ${actionButtons}
        </div>
      </div>
    `;
  }).join('');
  
  lucide.createIcons();
}

/**
 * Subtab: Staj Taleplerim (Öğrenci)
 */
async function renderMyRequests() {
  const container = document.getElementById('myRequestsList');
  if (!container) return;
  
  container.innerHTML = '<div class="text-center p-3"><div class="spinner"></div></div>';
  
  const requests = await ASDFL.fetchInternshipRequests();
  const myRequests = requests.filter(r => r.student_id === ASDFL.currentUser.id);
  
  if (myRequests.length === 0) {
    container.innerHTML = `
      <div class="dash-empty">
        <i data-lucide="graduation-cap" style="width:2.5rem;height:2.5rem;color:var(--text-muted);margin-bottom:.5rem;display:inline-block"></i>
        <p>Henüz herhangi bir staj arayış talebi oluşturmadınız.</p>
        <button class="btn btn-primary btn-sm" style="margin-top:1rem" onclick="openNewRequestModal()">Yeni Talep Oluştur <i data-lucide="plus"></i></button>
      </div>
    `;
    lucide.createIcons();
    return;
  }
  
  container.innerHTML = myRequests.map(req => {
    return `
      <div class="card" style="padding:1.5rem;margin-bottom:1rem">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:0.5rem">
          <div>
            <h4 style="color:var(--text-primary);margin-bottom:0.25rem">${req.title}</h4>
            <span class="badge badge-gold" style="font-size:0.75rem">${req.field}</span>
          </div>
          <span style="font-size:0.8rem;color:var(--text-muted)">Oluşturulma: ${ASDFL.formatDate(req.created_at)}</span>
        </div>
        <p style="font-size:0.85rem;color:var(--text-secondary);margin-top:0.75rem;line-height:1.5">${req.details}</p>
      </div>
    `;
  }).join('');
  
  lucide.createIcons();
}

/**
 * Subtab: Başvurularım (Öğrenci)
 */
async function renderMyApplications() {
  const container = document.getElementById('myApplicationsList');
  if (!container) return;
  
  container.innerHTML = '<div class="text-center p-3"><div class="spinner"></div></div>';
  
  const apps = await ASDFL.fetchJobApplications();
  const myApps = apps.filter(app => app.applicant_id === ASDFL.currentUser.id);
  
  if (myApps.length === 0) {
    container.innerHTML = `
      <div class="dash-empty">
        <i data-lucide="send" style="width:2.5rem;height:2.5rem;color:var(--text-muted);margin-bottom:.5rem;display:inline-block"></i>
        <p>Henüz herhangi bir iş veya staj ilanına başvurmadınız.</p>
        <button class="btn btn-primary btn-sm" style="margin-top:1rem" onclick="switchCareerTab('jobs')">İlanları Keşfet</button>
      </div>
    `;
    lucide.createIcons();
    return;
  }
  
  container.innerHTML = myApps.map(app => {
    const statusText = app.status === 'Pending' ? 'Bekliyor' : (app.status === 'Approved' ? 'Onaylandı' : 'Reddedildi');
    const statusClass = app.status === 'Pending' ? 'status-pending' : (app.status === 'Approved' ? 'status-approved' : 'status-rejected');
    
    return `
      <div class="card" style="padding:1.5rem;margin-bottom:1rem">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:0.5rem">
          <div>
            <h4 style="color:var(--text-primary);margin-bottom:0.25rem">${app.jobTitle}</h4>
            <span style="font-size:0.85rem;color:var(--gold-400);font-weight:600">${app.companyName}</span>
          </div>
          <span class="app-status ${statusClass}">${statusText}</span>
        </div>
        <div style="margin-top:0.75rem;font-size:0.82rem;color:var(--text-muted)">
          <div style="margin-bottom:0.25rem"><strong>Başvuru Tarihi:</strong> ${ASDFL.formatDate(app.created_at)}</div>
          <div style="margin-bottom:0.25rem"><strong>Özgeçmiş Bağlantısı:</strong> <a href="${app.resume_url}" target="_blank" style="color:var(--gold-400)">CV'yi Aç <i data-lucide="external-link" style="width:11px;height:11px;display:inline-block"></i></a></div>
          <div style="margin-top:0.5rem">
            <strong>Ön Yazınız:</strong>
            <p style="margin-top:0.25rem;font-style:italic;color:var(--text-secondary);background:rgba(255,255,255,0.01);padding:0.5rem;border-radius:var(--radius-sm)">
              "${app.cover_letter}"
            </p>
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  lucide.createIcons();
}

// ==========================================
// 5. MODAL TRIGGER CONTROLLERS & FORM HANDLERS
// ==========================================

/**
 * Open job/internship post modal
 */
window.openNewPostingModal = function() {
  const user = ASDFL.currentUser;
  if (!user) {
    ASDFL.toast('İlan oluşturabilmek için lütfen giriş yapın.', 'warning');
    ASDFL.openModal('loginModal');
    return;
  }
  if (user.role !== 'Mezun' && user.role !== 'Admin' && user.role !== 'Öğretmen') {
    ASDFL.toast('Sadece mezun üyelerimiz iş/staj ilanı oluşturabilir.', 'warning');
    return;
  }
  
  // Autocomplete employer company if present in profile
  if (user.company) {
    const compInput = document.getElementById('newPostCompany');
    if (compInput) compInput.value = user.company;
  }
  
  ASDFL.openModal('newPostingModal');
};

/**
 * Open student request modal
 */
window.openNewRequestModal = function() {
  const user = ASDFL.currentUser;
  if (!user) {
    ASDFL.toast('Staj talebi oluşturabilmek için lütfen giriş yapın.', 'warning');
    ASDFL.openModal('loginModal');
    return;
  }
  if (user.role !== 'Öğrenci' && user.role !== 'Admin') {
    ASDFL.toast('Sadece öğrenci üyelerimiz staj arayış talebi oluşturabilir.', 'warning');
    return;
  }
  
  ASDFL.openModal('newRequestModal');
};

/**
 * Open apply job modal with preloaded properties
 */
window.openApplyJobModal = function(jobId, jobTitle, companyName) {
  const user = ASDFL.currentUser;
  if (!user) {
    ASDFL.toast('İlanlara başvurabilmek için lütfen giriş yapın.', 'warning');
    ASDFL.openModal('loginModal');
    return;
  }
  if (user.role !== 'Öğrenci' && user.role !== 'Admin') {
    ASDFL.toast('İş/staj ilanlarına sadece öğrenci üyelerimiz başvurabilir.', 'warning');
    return;
  }
  
  const idInput = document.getElementById('applyJobPostingId');
  if (idInput) idInput.value = jobId;
  
  const subtitle = document.getElementById('applyJobModalSubtitle');
  if (subtitle) subtitle.textContent = `${jobTitle} — ${companyName}`;
  
  ASDFL.openModal('applyJobModal');
};

/**
 * Submits the form data for a new job/internship posting
 */
window.handleCreateJobPosting = async function() {
  const title = document.getElementById('newPostTitle').value.trim();
  const type = document.getElementById('newPostType').value;
  const location = document.getElementById('newPostLocation').value.trim();
  const company = document.getElementById('newPostCompany').value.trim();
  const description = document.getElementById('newPostDesc').value.trim();

  if (!title || !location || !company || !description) {
    ASDFL.toast('Lütfen tüm alanları doldurun.', 'warning');
    return;
  }

  const success = await ASDFL.createJobPosting(title, type, company, location, description);
  if (success) {
    ASDFL.closeModal('newPostingModal');
    
    // Clear inputs
    document.getElementById('newPostTitle').value = '';
    document.getElementById('newPostLocation').value = '';
    document.getElementById('newPostCompany').value = '';
    document.getElementById('newPostDesc').value = '';
    
    // Refresh page data and toggle to the dashboard tab dynamically
    await renderJobs();
    switchCareerTab('dashboard');
    switchDashboardMenu('my-jobs');
  }
};

/**
 * Submits the form data for an internship request
 */
window.handleCreateInternshipRequest = async function() {
  const title = document.getElementById('newReqTitle').value.trim();
  const field = document.getElementById('newReqField').value;
  const details = document.getElementById('newReqDetails').value.trim();

  if (!title || !details) {
    ASDFL.toast('Lütfen tüm alanları doldurun.', 'warning');
    return;
  }

  const success = await ASDFL.createInternshipRequest(title, field, details);
  if (success) {
    ASDFL.closeModal('newRequestModal');
    
    // Clear inputs
    document.getElementById('newReqTitle').value = '';
    document.getElementById('newReqDetails').value = '';
    
    // Refresh page data and toggle to the dashboard tab dynamically
    await renderRequests();
    switchCareerTab('dashboard');
    switchDashboardMenu('my-requests');
  }
};

/**
 * Submits a new job/internship application
 */
window.handleApplyJobSubmit = async function() {
  const postingId = document.getElementById('applyJobPostingId').value;
  const resumeUrl = document.getElementById('applyJobResume').value.trim();
  const coverLetter = document.getElementById('applyJobCoverLetter').value.trim();

  if (!resumeUrl || !coverLetter) {
    ASDFL.toast('Lütfen özgeçmiş linkinizi ve ön yazınızı doldurun.', 'warning');
    return;
  }

  // Basic link URL validation check
  if (!resumeUrl.startsWith('http://') && !resumeUrl.startsWith('https://')) {
    ASDFL.toast('Lütfen geçerli bir özgeçmiş (URL) bağlantısı girin.', 'warning');
    return;
  }

  const success = await ASDFL.applyToJob(postingId, resumeUrl, coverLetter);
  if (success) {
    ASDFL.closeModal('applyJobModal');
    
    // Clear inputs
    document.getElementById('applyJobResume').value = '';
    document.getElementById('applyJobCoverLetter').value = '';
    
    // Refresh page data and navigate to applications tracking panel
    switchCareerTab('dashboard');
    switchDashboardMenu('my-applications');
  }
};

/**
 * Responds to a student application (Approved/Rejected)
 */
window.respondToApplication = async function(appId, status) {
  const isApprove = status === 'Approved';
  const confirmMsg = isApprove 
    ? 'Bu staj/iş başvurusunu onaylamak istediğinizden emin misiniz? Öğrenciye e-posta ile bildirim iletilecektir.' 
    : 'Bu staj/iş başvurusunu reddetmek istediğinizden emin misiniz?';
    
  if (confirm(confirmMsg)) {
    const success = await ASDFL.updateApplicationStatus(appId, status);
    if (success) {
      await renderIncomingApplications(); // Re-render live
    }
  }
};

/**
 * Confirms and deletes a job/internship posting
 */
window.confirmDeletePosting = async function(postingId) {
  if (confirm('Bu ilanı tamamen silmek istediğinizden emin misiniz? İlana ait tüm başvurular da silinecektir.')) {
    const success = await ASDFL.deleteJobPosting(postingId);
    if (success) {
      await renderJobs(); // Refresh jobs listing
      await renderMyPostings(); // Re-render dashboard list
    }
  }
};

// ==========================================
// 6. INITIALIZATION & HASH SYNCS ON LOAD
// ==========================================

/**
 * Bootstraps the entire Career page
 */
async function initCareerPage() {
  await ASDFL.waitForAuth();
  
  // Setup responsive visibility rules on boot
  updateRoleFieldsVisibility();
  
  // Decide which tab to display based on location hash
  let defaultTab = 'jobs';
  const hash = window.location.hash.substring(1);
  if (hash === 'jobs' || hash === 'requests' || hash === 'dashboard') {
    defaultTab = hash;
  }
  
  switchCareerTab(defaultTab);
}

// Global page load hook
document.addEventListener('DOMContentLoaded', () => {
  initCareerPage();
});
