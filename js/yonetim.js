// ASDFL ADMIN PANEL LOGIC

let allMembers = [];
let allEvents = [];
let allScholarships = [];
let allApplications = [];
let allAnnouncements = [];

let currentTab = 'dashboard';
let currentAppFilter = 'ALL';
let currentAppStatusFilter = 'Pending';

function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn('safeSetItem failed for key "' + key + '":', e);
  }
}

// switchAdminTab global scope'da olmalı — onclick attribute'u DOMContentLoaded beklemez
function switchAdminTab(tabName, btn) {
  currentTab = tabName;
  document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  document.querySelectorAll('.admin-panel-tab').forEach(t => t.style.display = 'none');
  const tabEl = document.getElementById(`tab-${tabName}`);
  if (tabEl) tabEl.style.display = 'block';

  if (typeof renderAllPanels === 'function') renderAllPanels();
}

document.addEventListener('DOMContentLoaded', async () => {
  await ASDFL.waitForAuth();

  // 1. Strict Security Gating
  const isAdmin = await ASDFL.verifyAdminSession();
  if (!isAdmin) {
    const authBlock = document.getElementById('adminAuthBlock');
    const activeWrapper = document.getElementById('adminActiveWrapper');
    if (authBlock) authBlock.style.display = 'block';
    if (activeWrapper) activeWrapper.style.display = 'none';
    
    ASDFL.toast('Bu sayfaya erişim yetkiniz yok. Ana sayfaya yönlendiriliyorsunuz...', 'warning');
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 3000);
    return;
  }

  const authBlock = document.getElementById('adminAuthBlock');
  const activeWrapper = document.getElementById('adminActiveWrapper');
  if (authBlock) authBlock.style.display = 'none';
  if (activeWrapper) activeWrapper.style.display = 'grid';

  // 2. Load Administrative Data
  await loadAdminData();

  // 3. Render Initial State
  renderAllPanels();
});

// Load all site components
async function loadAdminData() {
  if (ASDFL.supabase) {
    // Her tablo ayrı ayrı çekiliyor — biri hata verse diğerleri çalışmaya devam eder
    
    // 1. Üyeler (profiles)
    try {
      const { data, error } = await ASDFL.supabase.from('profiles').select('*').order('name');
      if (error) console.error('profiles fetch error:', error.message);
      allMembers = data || [];
    } catch (e) {
      console.error('profiles exception:', e);
      allMembers = [];
    }

    // 2. Etkinlikler (events)
    try {
      const { data, error } = await ASDFL.supabase.from('events').select('*').order('created_at', { ascending: false });
      if (error) {
        // created_at yoksa date ile tekrar dene
        const { data: data2, error: error2 } = await ASDFL.supabase.from('events').select('*');
        if (error2) console.error('events fetch error:', error2.message);
        allEvents = data2 || [];
      } else {
        allEvents = data || [];
      }
    } catch (e) {
      console.error('events exception:', e);
      allEvents = [];
    }

    // 3. Burslar (scholarships)
    try {
      const { data, error } = await ASDFL.supabase.from('scholarships').select('*').order('created_at', { ascending: false });
      if (error) {
        const { data: data2 } = await ASDFL.supabase.from('scholarships').select('*');
        allScholarships = data2 || [];
      } else {
        allScholarships = data || [];
      }
    } catch (e) {
      console.error('scholarships exception:', e);
      allScholarships = [];
    }

    // 4. Başvurular (applications) - FK join olmadan güvenli sorgu
    try {
      const { data, error } = await ASDFL.supabase
        .from('applications')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) {
        console.error('applications fetch error:', error.message);
        allApplications = [];
      } else {
        // Profil bilgilerini ayrı çek ve birleştir
        if (data && data.length > 0 && allMembers.length > 0) {
          allApplications = data.map(app => ({
            ...app,
            profiles: allMembers.find(m => m.id === (app.user_id || app.profile_id)) || null
          }));
        } else {
          allApplications = data || [];
        }
      }
    } catch (e) {
      console.error('applications exception:', e);
      allApplications = [];
    }

    // 5. Logo duyuruları
    try {
      allAnnouncements = await ASDFL.fetchLogoAnnouncements();
    } catch (annError) {
      console.error('Error loading logo announcements:', annError);
      allAnnouncements = [];
    }

    // Eğer hiç üye yüklenmediyse offline fallback
    if (!allMembers || allMembers.length === 0) {
      loadOfflineFallbackData();
    }
  } else {
    loadOfflineFallbackData();
  }
}

// Fallback when Supabase is offline
function loadOfflineFallbackData() {
  // Members mock
  try {
    const stored = localStorage.getItem('asdfl_alumni');
    allMembers = stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error('Error parsing members mock:', e);
    allMembers = [];
  }
  if (!allMembers || !Array.isArray(allMembers) || allMembers.length === 0) {
    allMembers = [
      { id: '1', name: 'Alika Yıldız', email: 'alika@example.com', phone: '0555 123 45 67', role: 'Admin', grad_year: 2012, mentor: true, initials: 'AY' },
      { id: '2', name: 'Burak Yılmaz', email: 'burak@example.com', phone: '0532 987 65 43', role: 'Mezun', grad_year: 2008, mentor: false, initials: 'BY' },
      { id: '3', name: 'Ceren Demir', email: 'ceren@example.com', phone: '0544 555 66 77', role: 'Öğrenci', grad_year: 2026, mentor: false, initials: 'CD' }
    ];
    safeSetItem('asdfl_alumni', JSON.stringify(allMembers));
  }

  // Events mock
  try {
    const stored = localStorage.getItem('asdfl_events');
    allEvents = stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error('Error parsing events mock:', e);
    allEvents = [];
  }
  if (!allEvents || !Array.isArray(allEvents) || allEvents.length === 0) {
    allEvents = [
      { id: '1', title: 'ASDFL Geleneksel Pilav Günü', desc: 'Tüm mezunlarımızı bekliyoruz.', date: '2026-06-15', location: 'Okul Bahçesi', type: 'etkinlik' },
      { id: '2', title: '2026-2027 Burs Başvuruları Başladı', desc: 'Burs başvuruları aktif.', date: '2026-05-15', location: 'Online', type: 'duyuru' }
    ];
    safeSetItem('asdfl_events', JSON.stringify(allEvents));
  }

  // Scholarships mock
  try {
    const stored = localStorage.getItem('asdfl_scholarships');
    allScholarships = stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error('Error parsing scholarships mock:', e);
    allScholarships = [];
  }
  if (!allScholarships || !Array.isArray(allScholarships) || allScholarships.length === 0) {
    allScholarships = [
      { id: '1', sponsor: 'İstanbul ASDFL Mezunları', title: 'Mühendislik Başarı Bursu', amount: '2.000 ₺ / Ay', deadline: '2026-09-01', active: true },
      { id: '2', sponsor: 'Tıp Mezunları Platformu', title: 'Sağlık Bilimleri Bursu', amount: '2.500 ₺ / Ay', deadline: '2026-09-15', active: true }
    ];
    safeSetItem('asdfl_scholarships', JSON.stringify(allScholarships));
  }

  // Applications mock
  try {
    const stored = localStorage.getItem('asdfl_applications');
    allApplications = stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error('Error parsing applications mock:', e);
    allApplications = [];
  }
  if (!allApplications || !Array.isArray(allApplications) || allApplications.length === 0) {
    allApplications = [
      {
        id: '1',
        user_id: '3',
        type: 'Burs',
        title: 'Mühendislik Başarı Bursu',
        status: 'Pending',
        created_at: new Date().toISOString(),
        details: { name: 'Ceren Demir', grade: '12. Sınıf', gpa: '4.85', bio: 'Burs desteğine ihtiyacım var.', email: 'ceren@example.com' },
        profiles: { name: 'Ceren Demir', role: 'Öğrenci', grad_year: 2026, email: 'ceren@example.com', phone: '0544 555 66 77' }
      }
    ];
    safeSetItem('asdfl_applications', JSON.stringify(allApplications));
  }

  // Logo Announcements mock
  try {
    const stored = localStorage.getItem('asdfl_logo_announcements');
    allAnnouncements = stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error('Error parsing logo announcements mock:', e);
    allAnnouncements = [];
  }
  if (!allAnnouncements || !Array.isArray(allAnnouncements) || allAnnouncements.length === 0) {
    allAnnouncements = [
      { id: 1, title: '2025 Mezunları', subtitle: '128 yeni mezun', icon: 'graduation-cap' },
      { id: 2, title: 'Burs Başvurusu', subtitle: 'Son 5 gün!', icon: 'award' },
      { id: 3, title: 'Yaz Turnuvası', subtitle: '20 Temmuz 2025', icon: 'calendar' }
    ];
    safeSetItem('asdfl_logo_announcements', JSON.stringify(allAnnouncements));
  }
}

// Master Render Method
function renderAllPanels() {
  updateStats();
  
  if (currentTab === 'dashboard') {
    renderDashboardOverview();
  } else if (currentTab === 'members') {
    renderMembersTable(allMembers);
  } else if (currentTab === 'events') {
    renderEventsTable();
  } else if (currentTab === 'burs') {
    renderScholarshipsTable();
  } else if (currentTab === 'applications') {
    renderApplicationsList();
  } else if (currentTab === 'announcements') {
    renderAnnouncementsPanel();
  }

  setTimeout(() => {
    lucide.createIcons();
    if (typeof ASDFL !== 'undefined' && ASDFL.initReveal) {
      ASDFL.initReveal();
    }
  }, 10);
}

// Render counters and badges
function updateStats() {
  const totalUsers = allMembers.length;
  const totalEvents = allEvents.length;
  const pendingApps = allApplications.filter(a => a.status === 'Pending').length;
  const totalScholarships = allScholarships.length;

  const elUsers = document.getElementById('statTotalUsers');
  const elEvents = document.getElementById('statTotalEvents');
  const elPending = document.getElementById('statPendingApps');
  const elBurs = document.getElementById('statTotalScholarships');
  const appBadge = document.getElementById('pendingAppsBadge');

  if (elUsers) elUsers.textContent = totalUsers;
  if (elEvents) elEvents.textContent = totalEvents;
  if (elPending) elPending.textContent = pendingApps;
  if (elBurs) elBurs.textContent = totalScholarships;

  if (appBadge) {
    if (pendingApps > 0) {
      appBadge.textContent = pendingApps;
      appBadge.style.display = 'inline-flex';
    } else {
      appBadge.style.display = 'none';
    }
  }
}

// Dashboard tab UI elements
function renderDashboardOverview() {
  const recentMembers = allMembers.slice(-4).reverse();
  const recentApps = allApplications.slice(-4).reverse();

  // Recent members
  const memberListEl = document.getElementById('recentMembersList');
  if (memberListEl) {
    if (recentMembers.length === 0) {
      memberListEl.innerHTML = '<p style="color:var(--text-muted);font-size:.85rem">Henüz yeni üye yok.</p>';
    } else {
      memberListEl.innerHTML = recentMembers.map(m => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:.75rem;background:rgba(255,255,255,0.01);border:1px solid var(--glass-border);border-radius:var(--radius-md)">
          <div style="display:flex;align-items:center;gap:.75rem">
            ${ASDFL.getAvatarHTML(m, 'avatar', 'width:36px;height:36px;font-size:.85rem')}
            <div>
              <strong style="font-size:.88rem;color:var(--text-primary);display:block">${m.name}</strong>
              <span style="font-size:.75rem;color:var(--text-muted)">${m.role} ${m.grad_year ? '- ' + m.grad_year : ''}</span>
            </div>
          </div>
          <span class="badge ${m.role === 'Admin' ? 'badge-gold' : 'badge-blue'}" style="font-size:.7rem">${m.role}</span>
        </div>
      `).join('');
    }
  }

  // Recent applications
  const appListEl = document.getElementById('recentApplicationsList');
  if (appListEl) {
    if (recentApps.length === 0) {
      appListEl.innerHTML = '<p style="color:var(--text-muted);font-size:.85rem">Bekleyen başvuru yok.</p>';
    } else {
      appListEl.innerHTML = recentApps.map(a => {
        const typeLabels = { Burs: 'Burs Başvurusu', MentorlukTalebi: 'Mentörlük Talebi', MentorlukKaydi: 'Mentörlük Kaydı' };
        const statusColors = { Pending: 'badge-gold', Approved: 'badge-teal', Rejected: 'badge-red' };
        return `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:.75rem;background:rgba(255,255,255,0.01);border:1px solid var(--glass-border);border-radius:var(--radius-md)">
            <div>
              <strong style="font-size:.88rem;color:var(--text-primary);display:block">${a.profiles?.name || 'Bilinmeyen Üye'}</strong>
              <span style="font-size:.75rem;color:var(--text-muted)">${typeLabels[a.type] || a.type}</span>
            </div>
            <span class="badge ${statusColors[a.status]}" style="font-size:.7rem">${a.status === 'Pending' ? 'Bekliyor' : a.status === 'Approved' ? 'Onaylandı' : 'Reddedildi'}</span>
          </div>
        `;
      }).join('');
    }
  }
}

// ---------------- MEMBERS TAB MANAGEMENT ----------------

window.filterMembersList = function() {
  const searchVal = document.getElementById('memberSearch')?.value.toLowerCase() || '';
  const roleVal = document.getElementById('memberRoleFilter')?.value || 'ALL';

  const filtered = allMembers.filter(m => {
    const matchSearch = m.name.toLowerCase().includes(searchVal) || m.email.toLowerCase().includes(searchVal);
    const matchRole = roleVal === 'ALL' || m.role === roleVal;
    return matchSearch && matchRole;
  });

  renderMembersTable(filtered);
};

function renderMembersTable(list) {
  const tbody = document.getElementById('adminMembersTableBody');
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">Arama kriterine uygun üye bulunamadı.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(m => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:.75rem">
          ${ASDFL.getAvatarHTML(m, 'avatar', 'width:34px;height:34px;font-size:.8rem')}
          <div>
            <strong style="color:var(--text-primary);display:block">${m.name}</strong>
            <span style="font-size:.75rem;color:var(--text-muted)">${m.grad_year ? m.grad_year + ' Mezunu' : 'Üye'} ${m.class_section ? '- ' + m.class_section + ' Şubesi' : ''}</span>
          </div>
        </div>
      </td>
      <td>
        <div style="font-size:.82rem;color:var(--text-secondary)">${m.email}</div>
        ${m.phone ? `<div style="font-size:.78rem;color:var(--text-muted);margin-top:2px"><i data-lucide="phone" style="width:10px;height:10px;display:inline-block;vertical-align:middle;margin-top:-2px"></i> ${m.phone}</div>` : ''}
      </td>
      <td>
        <select class="form-select" style="font-size:.8rem;padding:.2rem .4rem;height:auto" onchange="updateMemberRole('${m.id}', this.value)">
          <option value="Mezun" ${m.role === 'Mezun' ? 'selected' : ''}>Mezun</option>
          <option value="Öğrenci" ${m.role === 'Öğrenci' ? 'selected' : ''}>Öğrenci</option>
          <option value="Öğretmen" ${m.role === 'Öğretmen' ? 'selected' : ''}>Öğretmen</option>
          <option value="Admin" ${m.role === 'Admin' ? 'selected' : ''}>Admin</option>
        </select>
      </td>
      <td>
        <label class="switch" style="display:inline-block;cursor:pointer">
          <input type="checkbox" ${m.mentor ? 'checked' : ''} onchange="toggleMemberMentor('${m.id}', this.checked)" style="accent-color:var(--gold-500)">
        </label>
      </td>
      <td style="text-align:right">
        <button class="btn btn-ghost btn-sm" onclick="deleteMember('${m.id}')" style="color:var(--text-red);padding:.25rem"><i data-lucide="trash-2" style="width:1.2rem;height:1.2rem"></i></button>
      </td>
    </tr>
  `).join('');

  setTimeout(() => lucide.createIcons(), 10);
}

window.updateMemberRole = async function(memberId, newRole) {
  if (ASDFL.supabase) {
    const { error } = await ASDFL.supabase.from('profiles').update({ role: newRole }).eq('id', memberId);
    if (error) {
      ASDFL.toast('Rol güncellenemedi: ' + error.message, 'error');
    } else {
      ASDFL.toast('Kullanıcı rolü güncellendi!', 'success');
      loadAdminData().then(() => renderAllPanels());
    }
  } else {
    // Local fallback update
    allMembers = allMembers.map(m => m.id === memberId ? { ...m, role: newRole } : m);
    safeSetItem('asdfl_alumni', JSON.stringify(allMembers));
    ASDFL.toast('Kullanıcı rolü güncellendi! (Local)', 'success');
    updateStats();
  }
};

window.toggleMemberMentor = async function(memberId, isMentor) {
  if (ASDFL.supabase) {
    const { error } = await ASDFL.supabase.from('profiles').update({ mentor: isMentor }).eq('id', memberId);
    if (error) {
      ASDFL.toast('Mentörlük durumu güncellenemedi: ' + error.message, 'error');
    } else {
      ASDFL.toast(isMentor ? 'Kullanıcı Mentör yapıldı!' : 'Mentörlük kaldırıldı!', 'success');
      loadAdminData().then(() => renderAllPanels());
    }
  } else {
    // Local fallback update
    allMembers = allMembers.map(m => m.id === memberId ? { ...m, mentor: isMentor } : m);
    safeSetItem('asdfl_alumni', JSON.stringify(allMembers));
    ASDFL.toast('Mentörlük durumu güncellendi! (Local)', 'success');
    updateStats();
  }
};

window.deleteMember = async function(memberId) {
  if (memberId === ASDFL.currentUser.id) {
    ASDFL.toast('Kendinizi silemezsiniz!', 'warning');
    return;
  }

  if (!confirm('Bu üyeyi kalıcı olarak silmek istediğinize emin misiniz?')) return;

  if (ASDFL.supabase) {
    // Önce RPC (delete_user) fonksiyonu ile hem auth hem de profiles'dan silmeyi dene
    let { error } = await ASDFL.supabase.rpc('delete_user', { target_user_id: memberId });

    // Fallback: RPC fonksiyonu veritabanında yoksa doğrudan profiles tablosundan silmeyi dene
    if (error && (error.code === '42883' || (error.message && (error.message.includes('function') || error.message.includes('does not exist'))))) {
      console.log('delete_user RPC bulunamadı, profiles tablosundan doğrudan silme deneniyor...');
      const fallbackResult = await ASDFL.supabase.from('profiles').delete().eq('id', memberId);
      error = fallbackResult.error;
    }

    if (error) {
      ASDFL.toast('Üye silinemedi: ' + error.message, 'error');
    } else {
      ASDFL.toast('Üye portal kayıtlarından silindi.', 'success');
      loadAdminData().then(() => renderAllPanels());
    }
  } else {
    // Local fallback
    allMembers = allMembers.filter(m => m.id !== memberId);
    safeSetItem('asdfl_alumni', JSON.stringify(allMembers));
    ASDFL.toast('Üye silindi! (Local)', 'success');
    filterMembersList();
  }
};


// ---------------- EVENTS TAB MANAGEMENT ----------------

function renderEventsTable() {
  const tbody = document.getElementById('adminEventsTableBody');
  const countEl = document.getElementById('eventsCount');
  if (!tbody) return;

  if (countEl) countEl.textContent = `${allEvents.length} aktif etkinlik/duyuru`;

  if (allEvents.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">Henüz etkinlik eklenmemiş.</td></tr>';
    return;
  }

  tbody.innerHTML = allEvents.map(e => `
    <tr>
      <td><strong style="color:var(--text-primary)">${e.title}</strong></td>
      <td><span class="badge ${e.type === 'etkinlik' ? 'badge-blue' : 'badge-gold'}">${e.type === 'etkinlik' ? 'Etkinlik' : 'Duyuru'}</span></td>
      <td>${ASDFL.formatDate(e.date)}</td>
      <td>${e.location || 'Online'}</td>
      <td style="text-align:right;display:flex;gap:.5rem;justify-content:flex-end">
        <button class="btn btn-ghost btn-sm" onclick="openEditEventModal('${e.id}')" style="padding:.25rem"><i data-lucide="edit" style="width:1.1rem;height:1.1rem"></i></button>
        <button class="btn btn-ghost btn-sm" onclick="deleteEvent('${e.id}')" style="color:var(--text-red);padding:.25rem"><i data-lucide="trash-2" style="width:1.1rem;height:1.1rem"></i></button>
      </td>
    </tr>
  `).join('');

  setTimeout(() => lucide.createIcons(), 10);
}

window.openAddEventModal = function() {
  document.getElementById('adminEventModalTitle').innerHTML = '<i data-lucide="plus"></i> Yeni Etkinlik / Duyuru';
  document.getElementById('eventEditId').value = '';
  document.getElementById('eventFieldTitle').value = '';
  document.getElementById('eventFieldDesc').value = '';
  document.getElementById('eventFieldDate').value = '';
  document.getElementById('eventFieldLocation').value = '';
  document.getElementById('eventFieldImage').value = '';
  ASDFL.openModal('adminEventModal');
  setTimeout(() => lucide.createIcons(), 10);
};

window.openEditEventModal = function(id) {
  const event = allEvents.find(e => e.id == id);
  if (!event) return;

  document.getElementById('adminEventModalTitle').innerHTML = '<i data-lucide="edit"></i> Etkinliği Düzenle';
  document.getElementById('eventEditId').value = event.id;
  document.getElementById('eventFieldType').value = event.type;
  document.getElementById('eventFieldTitle').value = event.title;
  document.getElementById('eventFieldDesc').value = event.desc;
  document.getElementById('eventFieldDate').value = event.date;
  document.getElementById('eventFieldLocation').value = event.location || '';
  document.getElementById('eventFieldImage').value = event.image_url || '';

  ASDFL.openModal('adminEventModal');
  setTimeout(() => lucide.createIcons(), 10);
};

window.saveEventFromModal = async function() {
  const id = document.getElementById('eventEditId').value;
  const type = document.getElementById('eventFieldType').value;
  const title = document.getElementById('eventFieldTitle').value;
  const desc = document.getElementById('eventFieldDesc').value;
  const date = document.getElementById('eventFieldDate').value;
  const location = document.getElementById('eventFieldLocation').value;
  const imageUrl = document.getElementById('eventFieldImage').value;

  if (!title || !date) {
    ASDFL.toast('Başlık ve Tarih alanları zorunludur.', 'warning');
    return;
  }

  const eventData = { type, title, desc, date, location, image_url: imageUrl };

  if (ASDFL.supabase) {
    if (id) {
      // Edit
      const { error } = await ASDFL.supabase.from('events').update(eventData).eq('id', id);
      if (error) ASDFL.toast('Güncellenemedi: ' + error.message, 'error');
      else ASDFL.toast('Etkinlik güncellendi!', 'success');
    } else {
      // Add
      const { error } = await ASDFL.supabase.from('events').insert(eventData);
      if (error) ASDFL.toast('Eklenemedi: ' + error.message, 'error');
      else ASDFL.toast('Yeni etkinlik/duyuru yayınlandı!', 'success');
    }
    loadAdminData().then(() => {
      ASDFL.closeModal('adminEventModal');
      renderAllPanels();
    });
  } else {
    // Local fallback
    if (id) {
      allEvents = allEvents.map(e => e.id == id ? { ...e, ...eventData } : e);
      ASDFL.toast('Etkinlik güncellendi! (Local)', 'success');
    } else {
      allEvents.push({ id: Math.random().toString(), ...eventData });
      ASDFL.toast('Yeni etkinlik yayınlandı! (Local)', 'success');
    }
    safeSetItem('asdfl_events', JSON.stringify(allEvents));
    ASDFL.closeModal('adminEventModal');
    renderAllPanels();
  }
};

window.deleteEvent = async function(id) {
  if (!confirm('Bu etkinlik veya duyuruyu kalıcı olarak silmek istediğinize emin misiniz?')) return;

  if (ASDFL.supabase) {
    const { error } = await ASDFL.supabase.from('events').delete().eq('id', id);
    if (error) ASDFL.toast('Silinemedi: ' + error.message, 'error');
    else {
      ASDFL.toast('Etkinlik/Duyuru kaldırıldı.', 'success');
      loadAdminData().then(() => renderAllPanels());
    }
  } else {
    allEvents = allEvents.filter(e => e.id != id);
    safeSetItem('asdfl_events', JSON.stringify(allEvents));
    ASDFL.toast('Etkinlik silindi! (Local)', 'success');
    renderAllPanels();
  }
};


// ---------------- SCHOLARSHIPS TAB MANAGEMENT ----------------

let currentBursSubTab = 'programs';
let bursAppSearchQuery = '';
let bursAppProgramFilter = 'ALL';
let bursAppGpaFilter = 'ALL';

let bursRecSearchQuery = '';
let bursRecProgramFilter = 'ALL';
let bursRecGpaFilter = 'ALL';

window.switchBursSubTab = function(subTabName) {
  currentBursSubTab = subTabName;
  document.querySelectorAll('.burs-subtab-content').forEach(el => el.style.display = 'none');
  const targetSubTab = document.getElementById(`burs-subtab-${subTabName}`);
  if (targetSubTab) targetSubTab.style.display = 'block';

  document.querySelectorAll('[id^="btn-burs-"]').forEach(btn => btn.classList.remove('active'));
  const targetBtn = document.getElementById(`btn-burs-${subTabName}`);
  if (targetBtn) targetBtn.classList.add('active');

  renderScholarshipsTable();
};

function updateBursProgramFilters() {
  const appFilterEl = document.getElementById('bursAppProgramFilter');
  const recFilterEl = document.getElementById('bursRecProgramFilter');
  if (!appFilterEl && !recFilterEl) return;

  const currentAppVal = appFilterEl ? appFilterEl.value : 'ALL';
  const currentRecVal = recFilterEl ? recFilterEl.value : 'ALL';

  const optionsHTML = `
    <option value="ALL">Tüm Programlar</option>
    ${allScholarships.map(s => `<option value="${s.title}">${s.title}</option>`).join('')}
  `;

  if (appFilterEl) {
    appFilterEl.innerHTML = optionsHTML;
    appFilterEl.value = currentAppVal;
  }
  if (recFilterEl) {
    recFilterEl.innerHTML = optionsHTML;
    recFilterEl.value = currentRecVal;
  }
}

window.handleBursAppFilterChange = function() {
  bursAppSearchQuery = document.getElementById('bursAppSearchInput')?.value || '';
  bursAppProgramFilter = document.getElementById('bursAppProgramFilter')?.value || 'ALL';
  bursAppGpaFilter = document.getElementById('bursAppGpaFilter')?.value || 'ALL';
  renderScholarshipsTable();
};

window.handleBursRecFilterChange = function() {
  bursRecSearchQuery = document.getElementById('bursRecSearchInput')?.value || '';
  bursRecProgramFilter = document.getElementById('bursRecProgramFilter')?.value || 'ALL';
  bursRecGpaFilter = document.getElementById('bursRecGpaFilter')?.value || 'ALL';
  renderScholarshipsTable();
};

function renderScholarshipsTable() {
  const tbody = document.getElementById('adminScholarshipsTableBody');
  const countEl = document.getElementById('scholarshipsCount');
  if (!tbody) return;

  // Dynamically populate program dropdown filters
  updateBursProgramFilters();

  // 1. Calculate and update stats counters
  const pendingApps = allApplications.filter(a => a.type === 'Burs' && a.status === 'Pending');
  const approvedApps = allApplications.filter(a => a.type === 'Burs' && a.status === 'Approved');

  let totalFund = 0;
  approvedApps.forEach(a => {
    // Find matching program to get quantity
    const prog = allScholarships.find(s => s.title === a.title);
    const amountStr = prog ? prog.amount : (a.details?.amount || '0');
    // Extract numbers to sum
    const cleaned = amountStr.replace(/[^0-9]/g, '');
    const val = parseInt(cleaned) || 0;
    totalFund += val;
  });

  const statPrograms = document.getElementById('statBursProgramsCount');
  if (statPrograms) statPrograms.textContent = allScholarships.length;

  const statPending = document.getElementById('statBursPendingCount');
  if (statPending) statPending.textContent = pendingApps.length;

  const statRecipients = document.getElementById('statBursRecipientsCount');
  if (statRecipients) statRecipients.textContent = approvedApps.length;

  const statTotal = document.getElementById('statBursTotalFunded');
  if (statTotal) statTotal.textContent = totalFund.toLocaleString('tr-TR') + ' ₺';

  const pendingBadge = document.getElementById('bursPendingBadge');
  if (pendingBadge) {
    if (pendingApps.length > 0) {
      pendingBadge.textContent = pendingApps.length;
      pendingBadge.style.display = 'inline-block';
    } else {
      pendingBadge.style.display = 'none';
    }
  }

  // Filter lists based on state query values
  const filteredPending = pendingApps.filter(a => {
    const studentName = a.profiles?.name || a.details?.name || '';
    const studentEmail = a.profiles?.email || a.details?.email || '';
    const matchSearch = !bursAppSearchQuery || 
      studentName.toLowerCase().includes(bursAppSearchQuery.toLowerCase()) ||
      studentEmail.toLowerCase().includes(bursAppSearchQuery.toLowerCase()) ||
      a.title.toLowerCase().includes(bursAppSearchQuery.toLowerCase());
      
    const matchProgram = bursAppProgramFilter === 'ALL' || a.title === bursAppProgramFilter;
    
    let matchGpa = true;
    if (bursAppGpaFilter !== 'ALL') {
      const gpaVal = parseFloat(a.details?.gpa) || 0;
      matchGpa = gpaVal >= parseFloat(bursAppGpaFilter);
    }
    
    return matchSearch && matchProgram && matchGpa;
  });

  const filteredRecipients = approvedApps.filter(a => {
    const studentName = a.profiles?.name || a.details?.name || '';
    const studentEmail = a.profiles?.email || a.details?.email || '';
    const matchSearch = !bursRecSearchQuery || 
      studentName.toLowerCase().includes(bursRecSearchQuery.toLowerCase()) ||
      studentEmail.toLowerCase().includes(bursRecSearchQuery.toLowerCase()) ||
      a.title.toLowerCase().includes(bursRecSearchQuery.toLowerCase());
      
    const matchProgram = bursRecProgramFilter === 'ALL' || a.title === bursRecProgramFilter;
    
    let matchGpa = true;
    if (bursRecGpaFilter !== 'ALL') {
      const gpaVal = parseFloat(a.details?.gpa) || 0;
      matchGpa = gpaVal >= parseFloat(bursRecGpaFilter);
    }
    
    return matchSearch && matchProgram && matchGpa;
  });

  // 2. Render active sub-tab
  if (currentBursSubTab === 'programs') {
    if (countEl) countEl.textContent = `${allScholarships.length} burs programı`;

    if (allScholarships.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">Henüz burs programı eklenmemiş.</td></tr>';
      return;
    }

    tbody.innerHTML = allScholarships.map(b => `
      <tr>
        <td><span class="badge badge-gold">${b.sponsor}</span></td>
        <td><strong style="color:var(--text-primary)">${b.title}</strong></td>
        <td><strong>${b.amount}</strong></td>
        <td>${ASDFL.formatDate(b.deadline)}</td>
        <td><span class="badge ${b.active ? 'badge-teal' : 'badge-red'}">${b.active ? 'Açık' : 'Kapalı'}</span></td>
        <td style="text-align:right;">
          <div style="display:flex;gap:.35rem;justify-content:flex-end">
            <button class="btn btn-ghost btn-sm" onclick="openEditScholarshipModal('${b.id}')" style="padding:.25rem"><i data-lucide="edit" style="width:1.1rem;height:1.1rem"></i></button>
            <button class="btn btn-ghost btn-sm" onclick="deleteScholarship('${b.id}')" style="color:var(--text-red);padding:.25rem"><i data-lucide="trash-2" style="width:1.1rem;height:1.1rem"></i></button>
          </div>
        </td>
      </tr>
    `).join('');
  } 
  
  else if (currentBursSubTab === 'applications') {
    const appsTbody = document.getElementById('bursApplicationsTableBody');
    if (!appsTbody) return;

    if (filteredPending.length === 0) {
      appsTbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:2rem;">Kriterlere uygun burs başvurusu bulunmamaktadır.</td></tr>';
      return;
    }

    appsTbody.innerHTML = filteredPending.map(a => {
      const studentName = a.profiles?.name || a.details?.name || 'Öğrenci';
      const studentGPA = a.details?.gpa || 'Belirtilmemiş';
      const studentGrade = a.details?.grade || 'Belirtilmemiş';
      const studentEmail = a.profiles?.email || a.details?.email || '-';
      const dateFormatted = ASDFL.formatDate(a.created_at);

      return `
        <tr>
          <td>
            <div style="display:flex;align-items:center;gap:0.5rem">
              ${ASDFL.getAvatarHTML({ initials: ASDFL.getInitials(studentName), name: studentName, avatar_url: a.profiles?.avatar_url }, 'avatar avatar-sm')}
              <div>
                <strong style="color:var(--text-primary);display:block">${studentName}</strong>
                <span style="font-size:0.75rem;color:var(--text-muted);">${studentEmail}</span>
              </div>
            </div>
          </td>
          <td><strong style="color:var(--text-primary)">${a.title}</strong></td>
          <td><span class="badge badge-gold" style="font-weight:600">${studentGPA}</span></td>
          <td><span style="font-size:0.85rem">${studentGrade}</span></td>
          <td><span style="font-size:0.85rem">${dateFormatted}</span></td>
          <td><span class="badge badge-gold">Bekliyor</span></td>
          <td style="text-align:right;">
            <div style="display:flex;gap:.35rem;justify-content:flex-end">
              <button class="btn btn-ghost btn-sm" onclick="openBursApplicationDetails('${a.id}')" title="Detayları İncele" style="padding:0.25rem;"><i data-lucide="eye" style="width:1.1rem;height:1.1rem;color:var(--gold-500)"></i></button>
              <button class="btn btn-primary btn-sm" onclick="updateApplicationStatus('${a.id}', 'Approved')" style="padding:0.25rem 0.5rem;font-size:0.75rem;"><i data-lucide="check" style="width:1rem;height:1rem;display:inline-block;vertical-align:middle;margin-right:2px"></i> Onayla</button>
              <button class="btn btn-secondary btn-sm" onclick="updateApplicationStatus('${a.id}', 'Rejected')" style="color:var(--text-red);border-color:rgba(235,94,85,0.3);padding:0.25rem 0.5rem;font-size:0.75rem;"><i data-lucide="x" style="width:1rem;height:1rem;display:inline-block;vertical-align:middle;margin-right:2px"></i> Reddet</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } 
  
  else if (currentBursSubTab === 'recipients') {
    const recsTbody = document.getElementById('bursRecipientsTableBody');
    if (!recsTbody) return;

    if (filteredRecipients.length === 0) {
      recsTbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:2rem;">Kriterlere uygun aktif bursiyer bulunmamaktadır.</td></tr>';
      return;
    }

    recsTbody.innerHTML = filteredRecipients.map(a => {
      const studentName = a.profiles?.name || a.details?.name || 'Öğrenci';
      const studentEmail = a.profiles?.email || a.details?.email || '-';
      const studentPhone = a.profiles?.phone || '-';
      const dateFormatted = ASDFL.formatDate(a.created_at);

      // Find matching scholarship program for details
      const prog = allScholarships.find(s => s.title === a.title);
      const sponsor = prog ? prog.sponsor : 'Sponsor';
      const amount = prog ? prog.amount : 'Miktar';

      return `
        <tr>
          <td>
            <div style="display:flex;align-items:center;gap:0.5rem">
              <div class="avatar avatar-sm">${ASDFL.getInitials(studentName)}</div>
              <div>
                <strong style="color:var(--text-primary);display:block">${studentName}</strong>
                <span style="font-size:0.75rem;color:var(--text-muted);">${a.details?.gpa ? `Not Ort: ${a.details.gpa}` : ''}</span>
              </div>
            </div>
          </td>
          <td><strong style="color:var(--text-primary)">${a.title}</strong></td>
          <td>
            <span class="badge badge-gold" style="display:inline-block;margin-bottom:0.15rem">${sponsor}</span>
            <span style="display:block;font-size:0.8rem;color:var(--text-secondary);font-weight:600">${amount}</span>
          </td>
          <td>
            <div style="font-size:0.85rem;color:var(--text-secondary)">${studentEmail}</div>
            <div style="font-size:0.75rem;color:var(--text-muted)">${studentPhone}</div>
          </td>
          <td><span style="font-size:0.85rem">${dateFormatted}</span></td>
          <td style="text-align:right;">
            <div style="display:flex;gap:.35rem;justify-content:flex-end;align-items:center">
              <button class="btn btn-ghost btn-sm" onclick="openBursApplicationDetails('${a.id}')" title="Detayları İncele" style="padding:0.25rem;"><i data-lucide="eye" style="width:1.1rem;height:1.1rem;color:var(--gold-500)"></i></button>
              <button class="btn btn-secondary btn-sm" onclick="stopScholarship('${a.id}')" style="color:var(--text-red);border-color:rgba(235,94,85,0.3);padding:0.25rem 0.5rem;font-size:0.75rem;"><i data-lucide="slash" style="width:1rem;height:1rem;display:inline-block;vertical-align:middle;margin-right:2px"></i> Bursu Durdur</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  setTimeout(() => lucide.createIcons(), 10);
}

window.stopScholarship = async function(appId) {
  if (confirm('Seçilen öğrencinin bursunu durdurmak (başvuruyu iptal etmek) istediğinize emin misiniz?')) {
    await updateApplicationStatus(appId, 'Rejected');
  }
};

window.openBursApplicationDetails = function(appId) {
  const app = allApplications.find(a => a.id == appId);
  if (!app) {
    ASDFL.toast('Başvuru bulunamadı.', 'error');
    return;
  }

  const studentName = app.profiles?.name || app.details?.name || 'Öğrenci';
  const studentEmail = app.profiles?.email || app.details?.email || '-';
  const studentPhone = app.profiles?.phone || '-';
  const studentGPA = app.details?.gpa || 'Belirtilmemiş';
  const studentGrade = app.details?.grade || 'Belirtilmemiş';
  const studentBio = app.details?.bio || 'Kendini tanıtım açıklaması yazılmamış.';
  const dateFormatted = ASDFL.formatDate(app.created_at);

  const prog = allScholarships.find(s => s.title === app.title);
  const sponsor = prog ? prog.sponsor : 'Belirtilmemiş';
  const amount = prog ? prog.amount : 'Belirtilmemiş';

  let statusBadge = '';
  let actionButtonsHTML = '';

  if (app.status === 'Pending') {
    statusBadge = '<span class="badge badge-gold" style="font-size:0.85rem;padding:0.3rem 0.6rem">İncelemede / Bekliyor</span>';
    actionButtonsHTML = `
      <button class="btn btn-secondary" style="color:var(--text-red);border-color:rgba(235,94,85,0.3);flex:1" onclick="updateApplicationStatusAndReload('${app.id}', 'Rejected')"><i data-lucide="x" style="width:1.1em;height:1.1em;display:inline-block;vertical-align:middle;margin-right:4px"></i> Başvuruyu Reddet</button>
      <button class="btn btn-primary" style="flex:1" onclick="updateApplicationStatusAndReload('${app.id}', 'Approved')"><i data-lucide="check" style="width:1.1em;height:1.1em;display:inline-block;vertical-align:middle;margin-right:4px"></i> Başvuruyu Onayla</button>
    `;
  } else if (app.status === 'Approved') {
    statusBadge = '<span class="badge badge-teal" style="font-size:0.85rem;padding:0.3rem 0.6rem">Aktif Burs Alıyor</span>';
    actionButtonsHTML = `
      <button class="btn btn-secondary" style="color:var(--gold-500);border-color:rgba(244,168,54,0.3);flex:1" onclick="updateApplicationStatusAndReload('${app.id}', 'Pending')"><i data-lucide="refresh-cw" style="width:1.1em;height:1.1em;display:inline-block;vertical-align:middle;margin-right:4px"></i> Beklemeye Al</button>
      <button class="btn btn-secondary" style="color:var(--text-red);border-color:rgba(235,94,85,0.3);flex:1" onclick="updateApplicationStatusAndReload('${app.id}', 'Rejected')"><i data-lucide="slash" style="width:1.1em;height:1.1em;display:inline-block;vertical-align:middle;margin-right:4px"></i> Bursu Durdur</button>
    `;
  } else if (app.status === 'Rejected') {
    statusBadge = '<span class="badge badge-red" style="font-size:0.85rem;padding:0.3rem 0.6rem">Reddedildi</span>';
    actionButtonsHTML = `
      <button class="btn btn-secondary" style="color:var(--gold-500);border-color:rgba(244,168,54,0.3);flex:1" onclick="updateApplicationStatusAndReload('${app.id}', 'Pending')"><i data-lucide="refresh-cw" style="width:1.1em;height:1.1em;display:inline-block;vertical-align:middle;margin-right:4px"></i> Yeniden Değerlendir</button>
      <button class="btn btn-primary" style="flex:1" onclick="updateApplicationStatusAndReload('${app.id}', 'Approved')"><i data-lucide="check" style="width:1.1em;height:1.1em;display:inline-block;vertical-align:middle;margin-right:4px"></i> Bursu Onayla</button>
    `;
  }

  const contentDiv = document.getElementById('bursDetailModalContent');
  if (!contentDiv) return;

  contentDiv.innerHTML = `
    <!-- Student Header -->
    <div style="display:flex; align-items:center; gap:1rem; padding-bottom:1.25rem; border-bottom:1px solid var(--glass-border); margin-bottom:1.25rem;">
      <div class="avatar" style="width:60px; height:60px; font-size:1.4rem;">${ASDFL.getInitials(studentName)}</div>
      <div>
        <h4 style="font-size:1.25rem; color:var(--text-primary); margin:0 0 0.25rem 0; font-family:'Outfit',sans-serif; font-weight:600;">${studentName}</h4>
        <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
          <span style="font-size:0.85rem; color:var(--text-muted);">${studentEmail}</span>
          <span style="color:var(--glass-border)">•</span>
          <span style="font-size:0.85rem; color:var(--text-muted);">${studentPhone}</span>
        </div>
      </div>
    </div>

    <!-- Application Details Grid -->
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1.25rem;">
      <div class="card" style="padding:0.75rem 1rem; background:rgba(255,255,255,0.02); border:1px solid var(--glass-border)">
        <span style="font-size:0.7rem; color:var(--text-muted); font-weight:600; text-transform:uppercase; display:block; margin-bottom:0.25rem">Eğitim Bilgileri</span>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem">
          <span style="font-size:0.85rem; color:var(--text-secondary)">Sınıf:</span>
          <strong style="font-size:0.85rem; color:var(--text-primary)">${studentGrade}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center">
          <span style="font-size:0.85rem; color:var(--text-secondary)">Not Ortalaması (GPA):</span>
          <span class="badge badge-gold" style="font-weight:600">${studentGPA}</span>
        </div>
      </div>

      <div class="card" style="padding:0.75rem 1rem; background:rgba(255,255,255,0.02); border:1px solid var(--glass-border)">
        <span style="font-size:0.7rem; color:var(--text-muted); font-weight:600; text-transform:uppercase; display:block; margin-bottom:0.25rem">Başvuru Tarihi & Durumu</span>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem">
          <span style="font-size:0.85rem; color:var(--text-secondary)">Tarih:</span>
          <strong style="font-size:0.85rem; color:var(--text-primary)">${dateFormatted}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center">
          <span style="font-size:0.85rem; color:var(--text-secondary)">Durum:</span>
          <div>${statusBadge}</div>
        </div>
      </div>
    </div>

    <!-- Scholarship Info -->
    <div class="card" style="padding:0.75rem 1rem; background:rgba(244,168,54,0.03); border:1px solid rgba(244,168,54,0.15); border-radius:var(--radius-md); margin-bottom:1.25rem">
      <span style="font-size:0.7rem; color:var(--gold-500); font-weight:600; text-transform:uppercase; display:block; margin-bottom:0.25rem">Tercih Edilen Burs Programı</span>
      <h5 style="margin:0 0 0.25rem 0; font-size:1rem; color:var(--text-primary);">${app.title}</h5>
      <div style="display:flex; justify-content:space-between; font-size:0.85rem;">
        <span style="color:var(--text-muted)">Sponsor: <strong style="color:var(--text-secondary)">${sponsor}</strong></span>
        <span style="color:var(--gold-500); font-weight:600;">Destek Miktarı: ${amount}</span>
      </div>
    </div>

    <!-- Statement of Need / Description -->
    <div style="margin-bottom:1.5rem">
      <span style="font-size:0.7rem; color:var(--text-muted); font-weight:600; text-transform:uppercase; display:block; margin-bottom:0.5rem">Başvuru Gerekçesi / Açıklama</span>
      <div style="padding:1rem; background:rgba(255,255,255,0.01); border-radius:var(--radius-md); border:1px solid var(--glass-border); position:relative; overflow:hidden">
        <i data-lucide="quote" style="position:absolute; right:10px; bottom:10px; width:40px; height:40px; color:rgba(255,255,255,0.02); pointer-events:none;"></i>
        <p style="margin:0; font-size:0.9rem; line-height:1.5; color:var(--text-secondary); white-space:pre-wrap; font-style:italic;">"${studentBio}"</p>
      </div>
    </div>

    <!-- Modal Actions -->
    <div style="display:flex; gap:0.5rem; margin-top:1.5rem; padding-top:1rem; border-top:1px solid var(--glass-border);">
      ${actionButtonsHTML}
    </div>
  `;

  ASDFL.openModal('adminBursApplicationDetailsModal');
  setTimeout(() => lucide.createIcons(), 10);
};

window.updateApplicationStatusAndReload = async function(appId, newStatus) {
  ASDFL.closeModal('adminBursApplicationDetailsModal');
  await updateApplicationStatus(appId, newStatus);
};

window.exportBursToCSV = function(type) {
  let filename = '';
  let csvContent = '\uFEFF';

  if (type === 'applications') {
    filename = 'burs_basvurular.csv';
    csvContent += 'Basvuran Adi,E-posta,Not Ortalamasi (GPA),Sinif,Burs Programi,Basvuru Tarihi,Durum,Gerekce\n';
    
    const pendingApps = allApplications.filter(a => a.type === 'Burs' && a.status === 'Pending');
    const filtered = pendingApps.filter(a => {
      const studentName = a.profiles?.name || a.details?.name || '';
      const studentEmail = a.profiles?.email || a.details?.email || '';
      const matchSearch = !bursAppSearchQuery || 
        studentName.toLowerCase().includes(bursAppSearchQuery.toLowerCase()) ||
        studentEmail.toLowerCase().includes(bursAppSearchQuery.toLowerCase()) ||
        a.title.toLowerCase().includes(bursAppSearchQuery.toLowerCase());
      const matchProgram = bursAppProgramFilter === 'ALL' || a.title === bursAppProgramFilter;
      let matchGpa = true;
      if (bursAppGpaFilter !== 'ALL') {
        const gpaVal = parseFloat(a.details?.gpa) || 0;
        matchGpa = gpaVal >= parseFloat(bursAppGpaFilter);
      }
      return matchSearch && matchProgram && matchGpa;
    });

    filtered.forEach(a => {
      const name = (a.profiles?.name || a.details?.name || 'Ogrenci').replace(/"/g, '""');
      const email = (a.profiles?.email || a.details?.email || '-').replace(/"/g, '""');
      const gpa = a.details?.gpa || 'Belirtilmemis';
      const grade = a.details?.grade || 'Belirtilmemis';
      const program = a.title.replace(/"/g, '""');
      const date = ASDFL.formatDate(a.created_at);
      const status = 'Bekliyor';
      const bio = (a.details?.bio || '').replace(/"/g, '""').replace(/\n/g, ' ');

      csvContent += `"${name}","${email}","${gpa}","${grade}","${program}","${date}","${status}","${bio}"\n`;
    });
  } else if (type === 'recipients') {
    filename = 'burs_bursiyerler.csv';
    csvContent += 'Bursiyer Adi,E-posta,Telefon,Not Ortalamasi (GPA),Sinif,Burs Programi,Sponsor,Aylik Destek,Baslangic Tarihi\n';

    const approvedApps = allApplications.filter(a => a.type === 'Burs' && a.status === 'Approved');
    const filtered = approvedApps.filter(a => {
      const studentName = a.profiles?.name || a.details?.name || '';
      const studentEmail = a.profiles?.email || a.details?.email || '';
      const matchSearch = !bursRecSearchQuery || 
        studentName.toLowerCase().includes(bursRecSearchQuery.toLowerCase()) ||
        studentEmail.toLowerCase().includes(bursRecSearchQuery.toLowerCase()) ||
        a.title.toLowerCase().includes(bursRecSearchQuery.toLowerCase());
      const matchProgram = bursRecProgramFilter === 'ALL' || a.title === bursRecProgramFilter;
      let matchGpa = true;
      if (bursRecGpaFilter !== 'ALL') {
        const gpaVal = parseFloat(a.details?.gpa) || 0;
        matchGpa = gpaVal >= parseFloat(bursRecGpaFilter);
      }
      return matchSearch && matchProgram && matchGpa;
    });

    filtered.forEach(a => {
      const name = (a.profiles?.name || a.details?.name || 'Ogrenci').replace(/"/g, '""');
      const email = (a.profiles?.email || a.details?.email || '-').replace(/"/g, '""');
      const phone = (a.profiles?.phone || '-').replace(/"/g, '""');
      const gpa = a.details?.gpa || 'Belirtilmemis';
      const grade = a.details?.grade || 'Belirtilmemis';
      const program = a.title.replace(/"/g, '""');

      const prog = allScholarships.find(s => s.title === a.title);
      const sponsor = (prog ? prog.sponsor : 'Sponsor').replace(/"/g, '""');
      const amount = (prog ? prog.amount : 'Miktar').replace(/"/g, '""');
      const date = ASDFL.formatDate(a.created_at);

      csvContent += `"${name}","${email}","${phone}","${gpa}","${grade}","${program}","${sponsor}","${amount}","${date}"\n`;
    });
  }

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  ASDFL.toast('Liste dışa aktarıldı!', 'success');
};

window.openAddScholarshipModal = function() {
  document.getElementById('adminScholarshipModalTitle').innerHTML = '<i data-lucide="plus"></i> Yeni Burs Programı';
  document.getElementById('bursEditId').value = '';
  document.getElementById('bursFieldSponsor').value = '';
  document.getElementById('bursFieldTitle').value = '';
  document.getElementById('bursFieldDesc').value = '';
  document.getElementById('bursFieldAmount').value = '';
  document.getElementById('bursFieldDeadline').value = '';
  document.getElementById('bursFieldActive').checked = true;
  ASDFL.openModal('adminScholarshipModal');
  setTimeout(() => lucide.createIcons(), 10);
};

window.openEditScholarshipModal = function(id) {
  const burs = allScholarships.find(b => b.id == id);
  if (!burs) return;

  document.getElementById('adminScholarshipModalTitle').innerHTML = '<i data-lucide="edit"></i> Burs Programını Düzenle';
  document.getElementById('bursEditId').value = burs.id;
  document.getElementById('bursFieldSponsor').value = burs.sponsor;
  document.getElementById('bursFieldTitle').value = burs.title;
  document.getElementById('bursFieldDesc').value = burs.description || '';
  document.getElementById('bursFieldAmount').value = burs.amount;
  document.getElementById('bursFieldDeadline').value = burs.deadline;
  document.getElementById('bursFieldActive').checked = burs.active;

  ASDFL.openModal('adminScholarshipModal');
  setTimeout(() => lucide.createIcons(), 10);
};

window.saveScholarshipFromModal = async function() {
  const id = document.getElementById('bursEditId').value;
  const sponsor = document.getElementById('bursFieldSponsor').value;
  const title = document.getElementById('bursFieldTitle').value;
  const desc = document.getElementById('bursFieldDesc').value;
  const amount = document.getElementById('bursFieldAmount').value;
  const deadline = document.getElementById('bursFieldDeadline').value;
  const active = document.getElementById('bursFieldActive').checked;

  if (!sponsor || !title || !amount || !deadline) {
    ASDFL.toast('Lütfen tüm zorunlu alanları doldurun.', 'warning');
    return;
  }

  const bursData = { sponsor, title, description: desc, amount, deadline, active };

  if (ASDFL.supabase) {
    if (id) {
      const { error } = await ASDFL.supabase.from('scholarships').update(bursData).eq('id', id);
      if (error) ASDFL.toast('Güncellenemedi: ' + error.message, 'error');
      else ASDFL.toast('Burs programı güncellendi!', 'success');
    } else {
      const { error } = await ASDFL.supabase.from('scholarships').insert(bursData);
      if (error) ASDFL.toast('Eklenemedi: ' + error.message, 'error');
      else ASDFL.toast('Yeni burs programı yayında!', 'success');
    }
    loadAdminData().then(() => {
      ASDFL.closeModal('adminScholarshipModal');
      renderAllPanels();
    });
  } else {
    // Local fallback
    if (id) {
      allScholarships = allScholarships.map(b => b.id == id ? { ...b, ...bursData } : b);
      ASDFL.toast('Burs programı güncellendi! (Local)', 'success');
    } else {
      allScholarships.push({ id: Math.random().toString(), ...bursData });
      ASDFL.toast('Yeni burs programı yayında! (Local)', 'success');
    }
    safeSetItem('asdfl_scholarships', JSON.stringify(allScholarships));
    ASDFL.closeModal('adminScholarshipModal');
    renderAllPanels();
  }
};

window.deleteScholarship = async function(id) {
  if (!confirm('Bu burs programını kalıcı olarak silmek istediğinize emin misiniz?')) return;

  if (ASDFL.supabase) {
    const { error } = await ASDFL.supabase.from('scholarships').delete().eq('id', id);
    if (error) ASDFL.toast('Silinemedi: ' + error.message, 'error');
    else {
      ASDFL.toast('Burs programı başarıyla silindi.', 'success');
      loadAdminData().then(() => renderAllPanels());
    }
  } else {
    allScholarships = allScholarships.filter(b => b.id != id);
    safeSetItem('asdfl_scholarships', JSON.stringify(allScholarships));
    ASDFL.toast('Burs programı silindi! (Local)', 'success');
    renderAllPanels();
  }
};


// ---------------- APPLICATIONS TAB MANAGEMENT ----------------

window.filterApplicationsList = function(type, btn) {
  currentAppFilter = type;
  document.querySelectorAll('#tab-applications .btn-ghost').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderApplicationsList();
};

window.filterApplicationsListByStatus = function() {
  currentAppStatusFilter = document.getElementById('appStatusFilter').value;
  renderApplicationsList();
};

function renderApplicationsList() {
  const container = document.getElementById('adminApplicationsList');
  if (!container) return;

  const filtered = allApplications.filter(a => {
    const matchType = currentAppFilter === 'ALL' || a.type === currentAppFilter;
    const matchStatus = currentAppStatusFilter === 'ALL' || a.status === currentAppStatusFilter;
    return matchType && matchStatus;
  });

  if (filtered.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--text-muted);border:1px dashed var(--glass-border);border-radius:var(--radius-lg)">Arama kriterine uygun başvuru bulunamadı.</div>';
    return;
  }

  const typeLabels = { Burs: 'Burs Başvurusu', MentorlukTalebi: 'Mentörlük Talebi', MentorlukKaydi: 'Mentörlük Kaydı' };
  const typeBadges = { Burs: 'badge-blue', MentorlukTalebi: 'badge-gold', MentorlukKaydi: 'badge-teal' };

  container.innerHTML = filtered.map(a => {
    const dateStr = ASDFL.formatDate(a.created_at);
    
    // Render dynamic details fields
    let detailsHTML = '';
    if (a.type === 'Burs') {
      detailsHTML = `
        <div class="app-detail-row">
          <div class="app-detail-item"><strong>Sınıf</strong><span>${a.details?.grade || 'Belirtilmemiş'}</span></div>
          <div class="app-detail-item"><strong>GPA (Not Ort.)</strong><span>${a.details?.gpa || 'Belirtilmemiş'}</span></div>
          <div class="app-detail-item"><strong>E-posta</strong><span>${a.details?.email || 'Belirtilmemiş'}</span></div>
        </div>
        ${a.details?.bio ? `<p style="margin-top:.75rem;padding:.75rem;background:rgba(255,255,255,0.01);border-radius:var(--radius-sm);border:1px solid var(--glass-border)"><i data-lucide="quote" style="width:12px;height:12px;display:inline;margin-right:4px"></i> ${a.details.bio}</p>` : ''}
      `;
    } else if (a.type === 'MentorlukTalebi') {
      detailsHTML = `
        <div class="app-detail-row">
          <div class="app-detail-item"><strong>Sınıf</strong><span>${a.details?.grade || 'Belirtilmemiş'}</span></div>
          <div class="app-detail-item"><strong>Uzmanlık / Branş</strong><span>${a.title || 'Belirtilmemiş'}</span></div>
        </div>
        ${a.details?.description ? `<p style="margin-top:.75rem;padding:.75rem;background:rgba(255,255,255,0.01);border-radius:var(--radius-sm);border:1px solid var(--glass-border)"><i data-lucide="quote" style="width:12px;height:12px;display:inline;margin-right:4px"></i> ${a.details.description}</p>` : ''}
      `;
    } else if (a.type === 'MentorlukKaydi') {
      detailsHTML = `
        <div class="app-detail-row">
          <div class="app-detail-item"><strong>Mezuniyet Yılı</strong><span>${a.details?.gradYear || 'Belirtilmemiş'}</span></div>
          <div class="app-detail-item"><strong>Meslek</strong><span>${a.details?.job || 'Belirtilmemiş'}</span></div>
          <div class="app-detail-item"><strong>Uzmanlık Alanı</strong><span>${a.title || 'Belirtilmemiş'}</span></div>
          <div class="app-detail-item"><strong>Haftalık Süre</strong><span>${a.details?.hours || 'Belirtilmemiş'}</span></div>
        </div>
      `;
    }

    const actionButtons = a.status === 'Pending' ? `
      <div class="app-actions">
        <button class="btn btn-secondary btn-sm" style="color:var(--text-red);border-color:rgba(235,94,85,0.3)" onclick="updateApplicationStatus('${a.id}', 'Rejected')"><i data-lucide="x" style="width:1em;height:1em"></i> Reddet</button>
        <button class="btn btn-primary btn-sm" onclick="updateApplicationStatus('${a.id}', 'Approved')"><i data-lucide="check" style="width:1em;height:1em"></i> Onayla</button>
      </div>
    ` : `
      <div class="app-actions">
        <span style="font-size:.85rem;color:var(--text-muted);display:flex;align-items:center;gap:.25rem">
          <i data-lucide="${a.status === 'Approved' ? 'check-circle' : 'x-circle'}" style="width:1.1rem;height:1.1rem;color:${a.status === 'Approved' ? 'var(--teal-500)' : 'var(--text-red)'}"></i>
          İşlem Yapıldı (${a.status === 'Approved' ? 'Onaylandı' : 'Reddedildi'})
        </span>
      </div>
    `;

    return `
      <div class="app-card">
        <div class="app-card-header">
          <div>
            <span class="badge ${typeBadges[a.type]}">${typeLabels[a.type]}</span>
            <h4 class="app-card-title" style="margin-top:.5rem">${a.profiles?.name || 'Bilinmeyen Üye'}</h4>
            <div class="app-card-meta">
              <span>📅 Başvuru: ${dateStr}</span>
              ${a.profiles?.grad_year ? `<span>🎓 ${a.profiles.grad_year} Mezunu</span>` : ''}
              ${a.profiles?.phone ? `<span>📞 Tel: ${a.profiles.phone}</span>` : ''}
            </div>
          </div>
          <span class="badge ${a.status === 'Pending' ? 'badge-gold' : a.status === 'Approved' ? 'badge-teal' : 'badge-red'}">${a.status === 'Pending' ? 'İncelemede' : a.status === 'Approved' ? 'Onaylandı' : 'Reddedildi'}</span>
        </div>
        <div class="app-card-body">
          ${detailsHTML}
        </div>
        ${actionButtons}
      </div>
    `;
  }).join('');

  setTimeout(() => lucide.createIcons(), 10);
}

window.updateApplicationStatus = async function(appId, newStatus) {
  if (ASDFL.supabase) {
    const { error } = await ASDFL.supabase.from('applications').update({ status: newStatus }).eq('id', appId);
    if (error) {
      ASDFL.toast('Durum güncellenemedi: ' + error.message, 'error');
    } else {
      ASDFL.toast(newStatus === 'Approved' ? 'Başvuru onaylandı!' : 'Başvuru reddedildi.', 'success');
      
      // If a Mentorship registration request is approved, let's automatically toggle their profile mentor status to TRUE!
      const app = allApplications.find(a => a.id == appId);
      if (app && app.type === 'MentorlukKaydi' && newStatus === 'Approved') {
        await ASDFL.supabase.from('profiles').update({ mentor: true }).eq('id', app.user_id);
      }

      loadAdminData().then(() => renderAllPanels());
    }
  } else {
    // Local fallback
    allApplications = allApplications.map(a => a.id == appId ? { ...a, status: newStatus } : a);
    safeSetItem('asdfl_applications', JSON.stringify(allApplications));
    
    // Automatically turn user to mentor locally if registration approved
    const app = allApplications.find(a => a.id == appId);
    if (app && app.type === 'MentorlukKaydi' && newStatus === 'Approved') {
      allMembers = allMembers.map(m => m.id === app.user_id ? { ...m, mentor: true } : m);
      safeSetItem('asdfl_alumni', JSON.stringify(allMembers));
    }

    ASDFL.toast('Başvuru durumu güncellendi! (Local)', 'success');
    renderAllPanels();
  }
};

// ---------------- LOGO ANNOUNCEMENTS TAB MANAGEMENT ----------------

function renderAnnouncementsPanel() {
  const container = document.getElementById('adminAnnouncementsContainer');
  if (!container) return;

  if (allAnnouncements.length === 0) {
    container.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:3rem; color:var(--text-muted);">Duyuru kartları yüklenemedi.</div>';
    return;
  }

  container.innerHTML = allAnnouncements.map(a => {
    return `
      <div class="card" style="padding: 1.5rem; display: flex; flex-direction: column; gap: 1.25rem; background: var(--glass-bg); border: 1px solid var(--glass-border);">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid var(--glass-border); padding-bottom: 0.75rem;">
          <h3 style="font-size:1.1rem;font-family:'Outfit',sans-serif;font-weight:600;margin:0;color:var(--gold-400)">Duyuru Kartı #${a.id}</h3>
          <span style="font-size:0.75rem; color:var(--text-muted)">Ana Sayfa Konumu: Kart ${a.id}</span>
        </div>

        <!-- Canlı Glassmorphic Kart Önizlemesi -->
        <div style="padding: 1rem; background: rgba(0,0,0,0.2); border-radius: var(--radius-md); display: flex; justify-content: center; align-items: center; min-height: 100px;">
          <div class="floating-card" style="position: static; transform: none; animation: none; backdrop-filter: blur(10px); background: rgba(19, 34, 54, 0.9); border: 1px solid rgba(244, 168, 54, 0.2); box-shadow: var(--shadow-lg); display: flex; align-items: center; gap: 0.75rem; padding: 0.85rem 1.2rem; border-radius: var(--radius-lg); color: var(--text-primary); font-size: 0.85rem; font-weight: 500;">
            <div class="fc-icon" style="font-size: 1.4rem; display: flex; align-items: center; justify-content: center; color: var(--gold-400);" id="previewIconBox-${a.id}">
              <i data-lucide="${a.icon}" style="width:1.2rem;height:1.2rem"></i>
            </div>
            <div>
              <strong id="previewTitle-${a.id}" style="color: var(--text-primary); font-size: 0.85rem; font-weight: 600; display: block;">${a.title}</strong>
              <small id="previewSub-${a.id}" style="color: var(--text-muted); font-size: 0.75rem; display: block; margin-top: 1px;">${a.subtitle}</small>
            </div>
          </div>
        </div>

        <!-- Form Düzenleme -->
        <div class="form-group" style="margin:0">
          <label class="form-label">Başlık</label>
          <input type="text" class="form-input" id="announceTitle-${a.id}" value="${a.title}" oninput="updateAnnouncementPreview(${a.id})">
        </div>

        <div class="form-group" style="margin:0">
          <label class="form-label">Detay / Alt Başlık</label>
          <input type="text" class="form-input" id="announceSub-${a.id}" value="${a.subtitle}" oninput="updateAnnouncementPreview(${a.id})">
        </div>

        <div class="form-group" style="margin:0">
          <label class="form-label">Lucide İkon Adı</label>
          <div style="display:flex; gap:0.5rem">
            <input type="text" class="form-input" id="announceIcon-${a.id}" value="${a.icon}" oninput="updateAnnouncementPreview(${a.id})" placeholder="Örn: graduation-cap, award, calendar, bell">
          </div>
          <small style="color:var(--text-muted); font-size:0.75rem; display:block; margin-top:0.25rem">Lucide sitesindeki ikon isimlerini (küçük harflerle ve aralarda tire ile) girin.</small>
        </div>

        <button class="btn btn-primary btn-sm" style="margin-top:0.5rem; width:100%" id="btnSaveAnnounce-${a.id}" onclick="saveAnnouncementFromAdmin(${a.id})">
          <i data-lucide="save" style="width:1em;height:1em"></i> Kartı Kaydet
        </button>
      </div>
    `;
  }).join('');

  setTimeout(() => lucide.createIcons(), 10);
}

// Canlı Önizleme Güncelleme
window.updateAnnouncementPreview = function(id) {
  const title = document.getElementById(`announceTitle-${id}`).value;
  const subtitle = document.getElementById(`announceSub-${id}`).value;
  const icon = document.getElementById(`announceIcon-${id}`).value;

  const previewTitle = document.getElementById(`previewTitle-${id}`);
  const previewSub = document.getElementById(`previewSub-${id}`);
  const previewIconBox = document.getElementById(`previewIconBox-${id}`);

  if (previewTitle) previewTitle.textContent = title;
  if (previewSub) previewSub.textContent = subtitle;
  if (previewIconBox && icon) {
    previewIconBox.innerHTML = `<i data-lucide="${icon}" style="width:1.2rem;height:1.2rem"></i>`;
    lucide.createIcons();
  }
};

window.saveAnnouncementFromAdmin = async function(id) {
  const title = document.getElementById(`announceTitle-${id}`).value.trim();
  const subtitle = document.getElementById(`announceSub-${id}`).value.trim();
  const icon = document.getElementById(`announceIcon-${id}`).value.trim();

  if (!title || !subtitle || !icon) {
    ASDFL.toast('Lütfen tüm alanları doldurun.', 'warning');
    return;
  }

  const btn = document.getElementById(`btnSaveAnnounce-${id}`);
  let oldHTML = '';
  if (btn) {
    oldHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;display:inline-block;margin-right:6px"></span> Kaydediliyor...';
  }

  const success = await ASDFL.updateLogoAnnouncement(id, title, subtitle, icon);

  if (btn) {
    btn.disabled = false;
    btn.innerHTML = oldHTML;
  }

  if (success) {
    // Reload local data
    await loadAdminData();
    renderAnnouncementsPanel();
  }
};
