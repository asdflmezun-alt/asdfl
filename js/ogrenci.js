// OGRENCI DASHBOARD LOGIC
let allAlumni = [];
let myScholarshipApps = [];
let myMentorships = [];
let myInternshipApps = [];
let allEvents = [];
let allPostings = [];
let allScholarships = [];

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Optimistic Render: If user is locally cached as a student, render dashboard immediately
  const isLoggedInSync = !!ASDFL.currentUser;
  const isStudentSync = isLoggedInSync && ASDFL.currentUser.role === 'Öğrenci';

  if (isLoggedInSync && isStudentSync) {
    document.getElementById('studentAuthBlock').classList.add('hidden');
    document.getElementById('studentDashboardWrapper').classList.remove('hidden');
    renderHeaderDetails();
    calculateProfileCompletion();
  } else if (isLoggedInSync && !isStudentSync) {
    // If logged in as someone else, redirect instantly
    window.location.href = 'index.html';
    return;
  }

  // 2. Perform deep database/token auth check
  await ASDFL.waitForAuth();

  const isLoggedIn = !!ASDFL.currentUser;
  const isStudent = isLoggedIn && ASDFL.currentUser.role === 'Öğrenci';

  if (!isLoggedIn) {
    document.getElementById('studentAuthBlock').classList.remove('hidden');
    document.getElementById('studentDashboardWrapper').classList.add('hidden');
    return;
  }

  if (!isStudent) {
    window.location.href = 'index.html';
    return;
  }

  // Ensure dashboard wrapper is shown and blocker hidden
  document.getElementById('studentAuthBlock').classList.add('hidden');
  document.getElementById('studentDashboardWrapper').classList.remove('hidden');

  // Render fresh header details
  renderHeaderDetails();

  // Load fresh async dashboard data
  await loadDashboardData();
  
  // Calculate profile completion
  calculateProfileCompletion();
});

function renderHeaderDetails() {
  const student = ASDFL.currentUser;
  
  // Avatar
  const avatarEl = document.getElementById('studentAvatar');
  if (avatarEl) {
    const initials = ASDFL.getInitials(student.name);
    const avatarUrl = student.avatar_url || student.avatarUrl || '';
    if (avatarUrl) {
      avatarEl.style.backgroundImage = `url('${avatarUrl}')`;
      avatarEl.textContent = '';
    } else {
      avatarEl.textContent = initials;
    }
  }
  
  // Title / Welcome
  const titleEl = document.getElementById('studentWelcomeTitle');
  if (titleEl) {
    titleEl.textContent = `Merhaba, ${student.name.split(' ')[0]}! 👋`;
  }
  
  // Subtitle
  const subtitleEl = document.getElementById('studentWelcomeSubtitle');
  if (subtitleEl) {
    const gradeText = student.grade || 'Öğrenci';
    const sectionText = student.class_section || student.classSection ? ` - ${student.class_section || student.classSection} Şubesi` : '';
    subtitleEl.textContent = `Afyon Süleyman Demirel Fen Lisesi · ${gradeText}${sectionText}`;
  }
}

async function loadDashboardData() {
  const student = ASDFL.currentUser;
  
  try {
    // Fetch common lists and personal applications in parallel to eliminate request waterfalls
    const promises = [
      ASDFL.fetchAlumni(),
      ASDFL.fetchEvents(),
      ASDFL.fetchScholarships(),
      ASDFL.fetchJobPostings()
    ];
    
    if (ASDFL.supabase) {
      promises.push(ASDFL.supabase.from('applications').select('*').eq('user_id', student.id));
      promises.push(ASDFL.supabase.from('mentorships').select('*, mentor:profiles!mentor_id(id,name,avatar_url,avatar_position,job,company,university)').eq('student_id', student.id));
      promises.push(ASDFL.supabase.from('job_applications').select('*, job_postings(*)').eq('applicant_id', student.id));
    }
    
    const results = await Promise.all(promises);
    
    allAlumni = results[0] || [];
    allEvents = results[1] || [];
    allScholarships = results[2] || [];
    allPostings = results[3] || [];
    
    if (ASDFL.supabase) {
      myScholarshipApps = results[4]?.data || [];
      myMentorships = results[5]?.data || [];
      myInternshipApps = results[6]?.data || [];
    } else {
      loadLocalDataFallback();
    }
  } catch (err) {
    console.warn('Error loading dashboard data in parallel, falling back to sequential with local storage:', err);
    allAlumni = await ASDFL.fetchAlumni().catch(() => []);
    allEvents = await ASDFL.fetchEvents().catch(() => []);
    allScholarships = await ASDFL.fetchScholarships().catch(() => []);
    allPostings = await ASDFL.fetchJobPostings().catch(() => []);
    loadLocalDataFallback();
  }

  // Render everything
  updateStats();
  renderOverview();
  renderScholarships();
  renderMentors();
  renderOpportunities();
  renderMyApplications();
  renderMentorWidget();
}

function loadLocalDataFallback() {
  const student = ASDFL.currentUser;
  
  // 1. Scholarships
  const allApps = JSON.parse(localStorage.getItem('asdfl_applications') || '[]');
  myScholarshipApps = allApps.filter(a => a.user_id === student.id && a.type === 'Burs');
  
  // 2. Mentorships
  const allMents = JSON.parse(localStorage.getItem('asdfl_mentorships') || '[]');
  myMentorships = allMents.filter(m => m.student_id === student.id);
  // Match mentor profile
  myMentorships = myMentorships.map(m => {
    const mentorProfile = allAlumni.find(a => a.id === m.mentor_id) || m.mentor;
    return {
      ...m,
      mentor: mentorProfile
    };
  });
  
  // 3. Internship Applications
  const allJobApps = JSON.parse(localStorage.getItem('asdfl_job_apps') || '[]');
  myInternshipApps = allJobApps.filter(ja => ja.applicant_id === student.id);
  myInternshipApps = myInternshipApps.map(ja => {
    const posting = allPostings.find(p => p.id === ja.posting_id);
    return {
      ...ja,
      job_postings: posting
    };
  });
}

function updateStats() {
  // Stat 1: Burs Başvurularım
  const bursCountEl = document.getElementById('statBursCount');
  if (bursCountEl) bursCountEl.textContent = myScholarshipApps.length;
  
  // Stat 2: Aktif Mentör
  const mentorNameEl = document.getElementById('statMentorName');
  if (mentorNameEl) {
    const activeMentor = myMentorships.find(m => m.status === 'Active');
    if (activeMentor && activeMentor.mentor) {
      mentorNameEl.textContent = activeMentor.mentor.name.split(' ').slice(0,2).join(' ');
      mentorNameEl.title = activeMentor.mentor.name;
    } else {
      mentorNameEl.textContent = 'Eşleşme Yok';
      mentorNameEl.removeAttribute('title');
    }
  }
  
  // Stat 3: Toplam Başvuru
  const appsCountEl = document.getElementById('statAppsCount');
  if (appsCountEl) {
    const totalApps = myScholarshipApps.length + myMentorships.length + myInternshipApps.length;
    appsCountEl.textContent = totalApps;
  }
}

function calculateProfileCompletion() {
  const student = ASDFL.currentUser;
  const completion = ASDFL.getProfileCompletion(student);
  const score = completion.percent;
  
  const bar = document.getElementById('studentProfileProgress');
  const txt = document.getElementById('studentProfileProgressText');
  if (bar) bar.style.width = score + '%';
  
  if (txt) {
    const missingText = completion.missing.length
      ? ` Öncelik: ${completion.missing.map(item => ASDFL.escapeHTML(item)).join(', ')}.`
      : '';
    if (score < 50) {
      txt.innerHTML = `Profiliniz <strong>%${score}</strong> dolu.${missingText} Mentorluk ve burs başvuruları için lütfen <a href="profil.html" style="color:var(--gold-500);font-weight:600">profil ayarlarınızdan</a> eksik alanları doldurun.`;
    } else if (score < 100) {
      txt.innerHTML = `Profiliniz <strong>%${score}</strong> dolu. Harika gidiyorsunuz!${missingText} Eksik alanları tamamlayarak öne çıkın. <a href="profil.html" style="color:var(--gold-500);font-weight:600">Ayarlara git</a>.`;
    } else {
      txt.innerHTML = `<span style="color:#2ecc71;display:flex;align-items:center;gap:.2rem"><i data-lucide="check-circle" style="width:14px;height:14px"></i> Profiliniz %100 dolu. Mezunlarımız sizi kolayca keşfedebilir!</span>`;
      setTimeout(() => ASDFL.refreshIcons(), 10);
    }
  }
}

// TAB SWITCHING
window.switchDashboardTab = function(tabName) {
  // Hide all contents
  document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
  // Remove active classes from tab buttons
  document.querySelectorAll('.student-tab').forEach(b => b.classList.remove('active'));
  
  // Show target
  const targetContent = document.getElementById(`student-tab-${tabName}`);
  if (targetContent) targetContent.classList.remove('hidden');
  
  // Set button active
  const targetBtn = Array.from(document.querySelectorAll('.student-tab')).find(b => b.textContent.toLowerCase().includes(tabName === 'my-apps' ? 'başvurularım' : tabName === 'opportunities' ? 'staj' : tabName === 'overview' ? 'genel bakış' : tabName === 'scholarships' ? 'burslar' : 'mentörler'));
  if (targetBtn) targetBtn.classList.add('active');
};

// TAB 1: GENEL BAKIŞ RENDERING
function renderOverview() {
  // 1. Önerilen 3 Mezun
  const recGrid = document.getElementById('recAlumniGrid');
  if (recGrid) {
    const graduates = allAlumni.filter(a => a.role === 'Mezun' || a.role === 'Admin');
    
    // Get logged in student targets
    const student = ASDFL.currentUser || {};
    const targetUni = (student.target_university || student.targetUniversity || '').trim().toLowerCase();
    const targetJob = (student.target_job || student.targetJob || '').trim().toLowerCase();
    
    // Smart recommendation scoring
    const scoredGraduates = graduates.map(g => {
      let score = 0;
      if (g.mentor) score += 2;
      if (g.specialization) score += 1;
      
      const gUni = (g.university || '').trim().toLowerCase();
      const gJob = (g.job || '').trim().toLowerCase();
      const gSpec = (g.specialization || '').trim().toLowerCase();
      
      if (targetUni && gUni && (gUni.includes(targetUni) || targetUni.includes(gUni))) {
        score += 5;
      }
      if (targetJob && ((gJob && (gJob.includes(targetJob) || targetJob.includes(gJob))) || (gSpec && (gSpec.includes(targetJob) || targetJob.includes(gSpec))))) {
        score += 5;
      }
      return { graduate: g, score: score };
    });
    
    // Sort by descending score
    const sorted = scoredGraduates.sort((a, b) => b.score - a.score);
    const recs = sorted.slice(0, 3).map(item => item.graduate);
    
    if (recs.length === 0) {
      recGrid.innerHTML = '<div style="color:var(--text-muted);font-size:.85rem;">Şu an önerilen mezun bulunmuyor.</div>';
    } else {
      recGrid.innerHTML = recs.map(r => {
        const initials = ASDFL.getInitials(r.name);
        const avatarUrl = r.avatar_url || '';
        const avatarHTML = avatarUrl 
          ? `<div class="rec-alumni-avatar" style="background-image:url('${ASDFL.escapeAttr(avatarUrl)}')"></div>`
          : `<div class="rec-alumni-avatar">${ASDFL.escapeHTML(initials)}</div>`;
          
        return `
          <div class="rec-alumni-card lift">
            ${avatarHTML}
            <strong>${r.academic_title ? ASDFL.escapeHTML(r.academic_title) + ' ' : ''}${ASDFL.escapeHTML(r.name)}</strong>
            <span class="job">${ASDFL.escapeHTML(r.job || 'Mezun')}${r.company ? ' @ ' + ASDFL.escapeHTML(r.company) : ''}</span>
            <span class="uni">${ASDFL.escapeHTML(r.university || 'ASDFL Mezunu')}</span>
            ${r.specialization ? `<span class="spec-badge"><i data-lucide="award" style="width:12px;height:12px"></i> ${ASDFL.escapeHTML(r.specialization)}</span>` : ''}
            <button class="btn btn-secondary btn-sm" style="width:100%;margin-top:0.5rem;" onclick="window.location.href='profil.html?id=${encodeURIComponent(r.id)}'">Profili Gör</button>
          </div>
        `;
      }).join('');
    }
  }

  // 2. Yaklaşan Etkinlikler
  const eventsGrid = document.getElementById('recEventsGrid');
  if (eventsGrid) {
    const upcoming = allEvents
      .map(e => ({ ...e, startDate: ASDFL.eventStart(e) || new Date(e.date) }))
      .filter(e => ASDFL.eventIsUpcoming(e))
      .sort((a, b) => a.startDate - b.startDate)
      .slice(0, 3);
    if (upcoming.length === 0) {
      eventsGrid.innerHTML = '<div class="card" style="padding:1rem;color:var(--text-muted);font-size:.85rem;text-align:center;">Yaklaşan etkinlik bulunmuyor.</div>';
    } else {
      eventsGrid.innerHTML = upcoming.map(e => {
        return `
          <div class="dashboard-item-card">
            <div class="dic-details">
              <h4>${ASDFL.escapeHTML(e.title)}</h4>
              <div class="dic-meta">
                <span><i data-lucide="calendar"></i> ${ASDFL.escapeHTML(e.date)}</span>
                <span><i data-lucide="clock"></i> ${ASDFL.escapeHTML(e.time || 'Belirtilmemiş')}</span>
                <span><i data-lucide="map-pin"></i> ${ASDFL.escapeHTML(e.location || 'Online')}</span>
              </div>
              <p class="dic-desc">${ASDFL.escapeHTML(e.description || '')}</p>
            </div>
            <div class="dic-actions">
              <button class="btn btn-primary btn-sm" onclick="window.location.href='etkinlikler.html'">Katıl / Detay Gör</button>
            </div>
          </div>
        `;
      }).join('');
    }
  }
}

// TAB 2: AÇIK BURSLAR RENDERING
function renderScholarships() {
  const grid = document.getElementById('scholarshipsListGrid');
  if (!grid) return;
  
  const active = allScholarships.filter(s => s.active);
  if (active.length === 0) {
    grid.innerHTML = '<div class="card" style="padding:3rem;text-align:center;color:var(--text-muted)"><i data-lucide="award" style="width:3rem;height:3rem;margin-bottom:1rem;opacity:.3"></i><p>Şu an açık burs başvurusu bulunmuyor. Lütfen daha sonra tekrar kontrol edin.</p></div>';
    setTimeout(() => ASDFL.refreshIcons(), 10);
    return;
  }
  
  grid.innerHTML = active.map(s => {
    const alreadyApplied = myScholarshipApps.some(app => app.title === s.title);
    const actionButton = alreadyApplied
      ? `<span class="badge-status approved" style="padding: 0.4rem 0.8rem;"><i data-lucide="check" style="width:14px;height:14px;vertical-align:middle;margin-right:4px;"></i> Başvuruldu</span>`
      : `<button class="btn btn-primary btn-sm" onclick="ASDFL.openScholarshipModal(${ASDFL.jsString(s.title)}, ${ASDFL.jsString(s.id)})">Başvur</button>`;
      
    return `
      <div class="dashboard-item-card">
        <div class="dic-details">
          <h4>${ASDFL.escapeHTML(s.title)}</h4>
          <div class="dic-meta">
            <span style="color:var(--gold-500);font-weight:600;"><i data-lucide="dollar-sign"></i> Miktar: ${ASDFL.escapeHTML(s.amount)}</span>
            <span><i data-lucide="calendar"></i> Son Başvuru: ${ASDFL.escapeHTML(s.deadline)}</span>
            <span><i data-lucide="user"></i> Sponsor: ${ASDFL.escapeHTML(s.sponsor || 'Mezunlar Derneği')}</span>
          </div>
          <p class="dic-desc">${ASDFL.escapeHTML(s.description || '')}</p>
        </div>
        <div class="dic-actions">
          ${actionButton}
        </div>
      </div>
    `;
  }).join('');
  setTimeout(() => ASDFL.refreshIcons(), 10);
}

// TAB 3: MENTÖRLER RENDERING
function renderMentors() {
  const grid = document.getElementById('mentorsListGrid');
  if (!grid) return;
  
  const mentors = allAlumni.filter(a => a.mentor && a.role !== 'Öğrenci');
  if (mentors.length === 0) {
    grid.innerHTML = '<div class="card" style="padding:3rem;text-align:center;color:var(--text-muted)"><i data-lucide="sparkles" style="width:3rem;height:3rem;margin-bottom:1rem;opacity:.3"></i><p>Sistemde kayıtlı mentör bulunmuyor.</p></div>';
    setTimeout(() => ASDFL.refreshIcons(), 10);
    return;
  }
  
  grid.innerHTML = mentors.map(m => {
    // Eşleşme kontrolü
    const match = myMentorships.find(app => app.mentor_id === m.id);
    let actionHTML = '';
    
    if (match) {
      if (match.status === 'Active') {
        actionHTML = `<span class="badge-status approved" style="padding:0.4rem 0.8rem;"><i data-lucide="check" style="width:14px;height:14px;vertical-align:middle;margin-right:4px;"></i> Aktif Eşleşme</span>`;
      } else if (match.status === 'Pending') {
        actionHTML = `<span class="badge-status pending" style="padding:0.4rem 0.8rem;"><i data-lucide="clock" style="width:14px;height:14px;vertical-align:middle;margin-right:4px;"></i> İstek Beklemede</span>`;
      } else {
        actionHTML = `<button class="btn btn-primary btn-sm" onclick="requestMentorship(${ASDFL.jsString(m.id)})">Mentörlük İste</button>`;
      }
    } else {
      actionHTML = `<button class="btn btn-primary btn-sm" onclick="requestMentorship(${ASDFL.jsString(m.id)})">Mentörlük İste</button>`;
    }
    
    const initials = ASDFL.getInitials(m.name);
    const avatarUrl = m.avatar_url || '';
    const avatarHTML = avatarUrl 
      ? `<div class="profile-avatar" style="width:48px;height:48px;background-image:url('${ASDFL.escapeAttr(avatarUrl)}');background-size:cover;background-position:center;border:1.5px solid var(--gold-500);flex-shrink:0;"></div>`
      : `<div class="profile-avatar" style="width:48px;height:48px;flex-shrink:0;">${ASDFL.escapeHTML(initials)}</div>`;

    return `
      <div class="dashboard-item-card">
        <div style="display:flex;align-items:center;gap:1rem;flex:1;">
          ${avatarHTML}
          <div class="dic-details">
            <h4>${m.academic_title ? ASDFL.escapeHTML(m.academic_title) + ' ' : ''}${ASDFL.escapeHTML(m.name)}</h4>
            <div class="dic-meta">
              <span><i data-lucide="briefcase"></i> ${ASDFL.escapeHTML(m.job || 'Mezun')}${m.company ? ' @ ' + ASDFL.escapeHTML(m.company) : ''}</span>
              <span><i data-lucide="graduation-cap"></i> ${ASDFL.escapeHTML(m.university || 'ASDFL Mezunu')}</span>
              <span><i data-lucide="map-pin"></i> ${ASDFL.escapeHTML(m.city || 'Belirtilmemiş')}</span>
            </div>
            ${m.specialization ? `<div style="font-size:0.8rem;color:var(--gold-500);margin-top:0.25rem;"><i data-lucide="award" style="width:12px;height:12px;vertical-align:middle;margin-right:2px;"></i> Uzmanlık: ${ASDFL.escapeHTML(m.specialization)}</div>` : ''}
          </div>
        </div>
        <div class="dic-actions">
          <button class="btn btn-ghost btn-sm" style="margin-bottom:0.25rem" onclick="window.location.href='profil.html?id=${encodeURIComponent(m.id)}'">Profili Gör</button>
          ${actionHTML}
        </div>
      </div>
    `;
  }).join('');
  setTimeout(() => ASDFL.refreshIcons(), 10);
}

// TAB 4: STAJ & FIRSATLAR RENDERING
function renderOpportunities() {
  // 1. Staj ilanları
  const intGrid = document.getElementById('internshipsListGrid');
  if (intGrid) {
    const internships = allPostings.filter(p => p.type === 'Staj' && p.status === 'Active');
    
    if (internships.length === 0) {
      intGrid.innerHTML = '<div class="card" style="padding:2rem;text-align:center;color:var(--text-muted)">Şu an mezunlarımız tarafından yayınlanmış aktif bir staj ilanı bulunmuyor. Staj talebinizi "Başvurularım" panelinden iletebilirsiniz.</div>';
    } else {
      intGrid.innerHTML = internships.map(i => {
        const alreadyApplied = myInternshipApps.some(app => app.posting_id === i.id);
        const actionBtn = alreadyApplied
          ? `<span class="badge-status approved" style="padding:0.4rem 0.8rem;"><i data-lucide="check" style="width:14px;height:14px;vertical-align:middle;margin-right:4px;"></i> Başvuruldu</span>`
          : `<button class="btn btn-primary btn-sm" onclick="openApplyInternshipModal(${ASDFL.jsString(i.id)}, ${ASDFL.jsString(i.title)})">Staj Başvurusu Yap</button>`;
          
        return `
          <div class="dashboard-item-card">
            <div class="dic-details">
              <h4>${ASDFL.escapeHTML(i.title)}</h4>
              <div class="dic-meta">
                <span style="font-weight:600;color:var(--gold-500)"><i data-lucide="building"></i> Şirket: ${ASDFL.escapeHTML(i.company)}</span>
                <span><i data-lucide="map-pin"></i> Konum: ${ASDFL.escapeHTML(i.location)}</span>
                <span><i data-lucide="user"></i> İlanı Veren: ${ASDFL.escapeHTML(i.employerName || 'Mezun')}</span>
              </div>
              <p class="dic-desc">${ASDFL.escapeHTML(i.description)}</p>
            </div>
            <div class="dic-actions">
              ${actionBtn}
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // 2. Ulusal Fırsatlar (TÜBİTAK/TEKNOFEST) - Statik Zengin İçerik
  const contestsGrid = document.getElementById('contestsListGrid');
  if (contestsGrid) {
    contestsGrid.innerHTML = `
      <div class="dashboard-item-card">
        <div class="dic-details">
          <h4>TÜBİTAK 2204-A Lise Öğrencileri Araştırma Projeleri Yarışması</h4>
          <div class="dic-meta">
            <span style="color:var(--gold-500);font-weight:600;"><i data-lucide="award"></i> Ulusal Bilim Projesi Yarışması</span>
            <span><i data-lucide="calendar"></i> Son Teslim: Aralık 2026</span>
            <span><i data-lucide="globe"></i> Organizasyon: TÜBİTAK</span>
          </div>
          <p class="dic-desc">Lise öğrencilerinin fen bilimleri ve sosyal bilimler alanlarında araştırma projeleri üretmesini amaçlayan prestijli araştırma yarışması. Mezun mentörlerimizden proje yazımı konusunda destek alabilirsiniz!</p>
        </div>
        <div class="dic-actions">
          <a class="btn btn-secondary btn-sm" href="https://tubitak.gov.tr" target="_blank" style="text-decoration:none;display:inline-flex;align-items:center;gap:0.4rem">Detayları Gör <i data-lucide="external-link" style="width:14px;height:14px"></i></a>
        </div>
      </div>
      <div class="dashboard-item-card">
        <div class="dic-details">
          <h4>TEKNOFEST Girişimcilik ve Robotik Yarışmaları</h4>
          <div class="dic-meta">
            <span style="color:var(--gold-500);font-weight:600;"><i data-lucide="rocket"></i> Teknoloji &amp; Yazılım Girişimi</span>
            <span><i data-lucide="calendar"></i> Başvurular: Ocak 2027</span>
            <span><i data-lucide="globe"></i> Organizasyon: T3 Vakfı</span>
          </div>
          <p class="dic-desc">Yapay zeka, insansız hava araçları, akıllı ulaşım ve robotik gibi alanlarda lise takımlarının yarıştığı dev teknoloji festivali. Okuldaki robotik takımı projelerimiz ve mentör eşleşmelerimiz için staj sekmesini kullanabilirsiniz.</p>
        </div>
        <div class="dic-actions">
          <a class="btn btn-secondary btn-sm" href="https://teknofest.org" target="_blank" style="text-decoration:none;display:inline-flex;align-items:center;gap:0.4rem">Detayları Gör <i data-lucide="external-link" style="width:14px;height:14px"></i></a>
        </div>
      </div>
    `;
  }
  setTimeout(() => ASDFL.refreshIcons(), 10);
}

// TAB 5: BAŞVURULARIM RENDERING
function renderMyApplications() {
  const tbody = document.getElementById('myApplicationsTableBody');
  if (!tbody) return;
  
  if (myScholarshipApps.length === 0 && myMentorships.length === 0 && myInternshipApps.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:3rem;color:var(--text-muted)"><i data-lucide="file-question" style="width:2.5rem;height:2.5rem;margin-bottom:1rem;opacity:.3;display:block;margin-left:auto;margin-right:auto;"></i>Henüz hiçbir başvuru veya eşleşme talebiniz bulunmuyor.</td></tr>';
    setTimeout(() => ASDFL.refreshIcons(), 10);
    return;
  }
  
  let rowsHTML = '';
  
  // 1. Burslar
  myScholarshipApps.forEach(app => {
    const date = new Date(app.created_at).toLocaleDateString('tr-TR');
    let statusClass = 'pending';
    let statusText = 'Beklemede';
    
    if (app.status === 'Approved') { statusClass = 'approved'; statusText = 'Onaylandı'; }
    else if (app.status === 'Rejected') { statusClass = 'rejected'; statusText = 'Reddedildi'; }
    
    rowsHTML += `
      <tr>
        <td data-label="Başvuru Tipi"><strong>Burs Başvurusu</strong></td>
        <td data-label="Detay / Sponsor">${ASDFL.escapeHTML(app.title)}</td>
        <td data-label="Tarih">${date}</td>
        <td data-label="Durum"><span class="badge-status ${statusClass}">${statusText}</span></td>
      </tr>
    `;
  });
  
  // 2. Mentörlük
  myMentorships.forEach(m => {
    const date = new Date(m.created_at).toLocaleDateString('tr-TR');
    let statusClass = 'pending';
    let statusText = 'Beklemede';
    
    if (m.status === 'Active') { statusClass = 'approved'; statusText = 'Aktif Eşleşme'; }
    else if (m.status === 'Cancelled') { statusClass = 'rejected'; statusText = 'İptal Edildi'; }
    else if (m.status === 'Completed') { statusClass = 'approved'; statusText = 'Tamamlandı'; }
    
    rowsHTML += `
      <tr>
        <td data-label="Başvuru Tipi"><strong>Mentörlük Talebi</strong></td>
        <td data-label="Detay / Sponsor">Mentör: ${ASDFL.escapeHTML(m.mentor?.name || 'Bilinmeyen Mentör')}</td>
        <td data-label="Tarih">${date}</td>
        <td data-label="Durum"><span class="badge-status ${statusClass}">${statusText}</span></td>
      </tr>
    `;
  });
  
  // 3. Stajlar
  myInternshipApps.forEach(app => {
    const date = new Date(app.created_at).toLocaleDateString('tr-TR');
    let statusClass = 'pending';
    let statusText = 'Beklemede';
    
    if (app.status === 'Approved') { statusClass = 'approved'; statusText = 'Kabul Edildi'; }
    else if (app.status === 'Rejected') { statusClass = 'rejected'; statusText = 'Reddedildi'; }
    
    rowsHTML += `
      <tr>
        <td data-label="Başvuru Tipi"><strong>Staj Başvurusu</strong></td>
        <td data-label="Detay / Sponsor">İlan: ${ASDFL.escapeHTML(app.job_postings?.title || 'Staj İlanı')} @ ${ASDFL.escapeHTML(app.job_postings?.company || '')}</td>
        <td data-label="Tarih">${date}</td>
        <td data-label="Durum"><span class="badge-status ${statusClass}">${statusText}</span></td>
      </tr>
    `;
  });
  
  tbody.innerHTML = rowsHTML;
}

// SIDEBAR WIDGET: MENTÖRÜM KARTI
function renderMentorWidget() {
  const container = document.getElementById('mentorWidgetContent');
  if (!container) return;
  
  const activeMatch = myMentorships.find(m => m.status === 'Active');
  
  if (activeMatch && activeMatch.mentor) {
    const m = activeMatch.mentor;
    const initials = ASDFL.getInitials(m.name);
    const avatarUrl = m.avatar_url || '';
    const avatarHTML = avatarUrl 
      ? `<div class="mentor-assigned-avatar" style="background-image:url('${ASDFL.escapeAttr(avatarUrl)}')"></div>`
      : `<div class="mentor-assigned-avatar">${ASDFL.escapeHTML(initials)}</div>`;
      
    container.innerHTML = `
      <div class="mentor-assigned-box">
        ${avatarHTML}
        <div class="mentor-assigned-info">
          <h5>${m.academic_title ? ASDFL.escapeHTML(m.academic_title) + ' ' : ''}${ASDFL.escapeHTML(m.name)}</h5>
          <p>${ASDFL.escapeHTML(m.job || 'Mezun')}${m.company ? ' @ ' + ASDFL.escapeHTML(m.company) : ''}</p>
        </div>
        
        <div style="font-size: 0.8rem; text-align: left; background: rgba(255,255,255,0.01); border: 1px solid var(--glass-border); padding: 0.75rem; border-radius: var(--radius-sm); margin-bottom: 1rem; color: var(--text-secondary);">
          <div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:0.35rem;"><i data-lucide="mail" style="width:14px;height:14px;color:var(--gold-500)"></i> <span>${ASDFL.escapeHTML(m.email || 'Mail gizli')}</span></div>
          <div style="display:flex;align-items:center;gap:0.4rem;"><i data-lucide="phone" style="width:14px;height:14px;color:var(--gold-500)"></i> <span>${ASDFL.escapeHTML(m.phone || 'Telefon gizli')}</span></div>
        </div>
        
        <div class="mentor-assigned-actions">
          <button class="btn btn-primary btn-sm" style="width:100%;" onclick="window.location.href='mentorluk.html'"><i data-lucide="calendar" style="width:14px;height:14px;vertical-align:middle;margin-right:4px;"></i> Görüşme Planla / Takvim</button>
          <button class="btn btn-ghost btn-sm" style="width:100%;font-size:.78rem;padding:.3rem;" onclick="window.location.href='profil.html?id=${encodeURIComponent(m.id)}'">Mentörün Profilini İncele</button>
        </div>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div style="text-align:center; padding: 1rem 0; color:var(--text-secondary); font-size: 0.85rem;">
        <i data-lucide="sparkles" style="width:2rem;height:2rem;color:var(--gold-500);margin-bottom:0.5rem;opacity:.5"></i>
        <p style="margin:0 0 0.75rem 0;">Şu an aktif bir mentörlük eşleşmeniz bulunmamaktadır.</p>
        <button class="btn btn-secondary btn-sm" style="width:100%;" onclick="switchDashboardTab('mentors')">Mentör Keşfet</button>
      </div>
    `;
  }
  setTimeout(() => ASDFL.refreshIcons(), 10);
}



window.requestMentorship = async function(mentorId) {
  const mentor = allAlumni.find(a => a.id === mentorId);
  if (!mentor) return;
  
  if (ASDFL.supabase) {
    const { error } = await ASDFL.supabase
      .from('mentorships')
      .insert({
        mentor_id: mentorId,
        student_id: ASDFL.currentUser.id,
        status: 'Pending'
      });
      
    if (error) {
      ASDFL.toast('Talep gönderilirken hata oluştu: ' + error.message, 'error');
      return;
    }
  } else {
    // Local fallback
    const allMents = JSON.parse(localStorage.getItem('asdfl_mentorships') || '[]');
    allMents.push({
      id: 'ment-' + Math.random().toString(36).substring(2),
      mentor_id: mentorId,
      student_id: ASDFL.currentUser.id,
      status: 'Pending',
      created_at: new Date().toISOString()
    });
    localStorage.setItem('asdfl_mentorships', JSON.stringify(allMents));
  }
  
  ASDFL.toast(`${mentor.name} adlı mezunumuza mentörlük talebi iletildi!`, 'success');
  
  // Reload dashboard
  await loadDashboardData();
};

window.openApplyInternshipModal = function(id, title) {
  const modal = document.getElementById('applyInternshipModal');
  const modalTitle = document.getElementById('applyInternshipTitle');
  const modalId = document.getElementById('applyInternshipId');
  const cover = document.getElementById('applyInternshipCover');
  const resume = document.getElementById('applyInternshipResume');
  
  if (modalTitle) modalTitle.textContent = title;
  if (modalId) modalId.value = id;
  if (cover) cover.value = '';
  if (resume) resume.value = '';
  
  ASDFL.openModal('applyInternshipModal');
};

window.submitInternshipApplication = async function() {
  const id = document.getElementById('applyInternshipId')?.value;
  const coverText = document.getElementById('applyInternshipCover')?.value || '';
  const resumeUrl = document.getElementById('applyInternshipResume')?.value || '';
  
  if (!coverText || !resumeUrl) {
    ASDFL.toast('Lütfen tüm alanları doldurun.', 'warning');
    return;
  }
  
  if (ASDFL.supabase) {
    const { error } = await ASDFL.supabase
      .from('job_applications')
      .insert({
        posting_id: id,
        applicant_id: ASDFL.currentUser.id,
        resume_url: resumeUrl,
        cover_letter: coverText,
        status: 'Pending'
      });
      
    if (error) {
      ASDFL.toast('Staj başvurusu gönderilirken hata oluştu: ' + error.message, 'error');
      return;
    }
  } else {
    // Local fallback
    const allJobApps = JSON.parse(localStorage.getItem('asdfl_job_apps') || '[]');
    allJobApps.push({
      id: 'app-' + Math.random().toString(36).substring(2),
      posting_id: id,
      applicant_id: ASDFL.currentUser.id,
      resume_url: resumeUrl,
      cover_letter: coverText,
      status: 'Pending',
      created_at: new Date().toISOString()
    });
    localStorage.setItem('asdfl_job_apps', JSON.stringify(allJobApps));
  }
  
  ASDFL.toast('Staj başvurunuz başarıyla iletildi!', 'success');
  ASDFL.closeModal('applyInternshipModal');
  
  // Reload dashboard
  await loadDashboardData();
};
