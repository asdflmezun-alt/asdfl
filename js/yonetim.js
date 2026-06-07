// ASDFL ADMIN PANEL LOGIC

let allMembers = [];
let allEvents = [];
let allScholarships = [];
let allApplications = [];

let currentTab = 'dashboard';
let currentAppFilter = 'ALL';
let currentAppStatusFilter = 'Pending';

document.addEventListener('DOMContentLoaded', async () => {
  await ASDFL.waitForAuth();

  // 1. Strict Security Gating
  if (!ASDFL.currentUser || ASDFL.currentUser.role !== 'Admin') {
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

  // Setup tab state
  window.switchAdminTab = function(tabName, btn) {
    currentTab = tabName;
    document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    document.querySelectorAll('.admin-panel-tab').forEach(t => t.style.display = 'none');
    document.getElementById(`tab-${tabName}`).style.display = 'block';
    
    renderAllPanels();
  };
});

// Load all site components
async function loadAdminData() {
  if (ASDFL.supabase) {
    try {
      const [membersRes, eventsRes, scholarshipsRes, appsRes] = await Promise.all([
        ASDFL.supabase.from('profiles').select('*').order('name'),
        ASDFL.supabase.from('events').select('*').order('date', { ascending: false }),
        ASDFL.supabase.from('scholarships').select('*').order('created_at', { ascending: false }),
        ASDFL.supabase.from('applications').select('*, profiles(name, role, grad_year, email, phone)').order('created_at', { ascending: false })
      ]);

      allMembers = membersRes.data || [];
      allEvents = eventsRes.data || [];
      allScholarships = scholarshipsRes.data || [];
      allApplications = appsRes.data || [];
    } catch (err) {
      console.error('Error loading admin data:', err);
      ASDFL.toast('Supabase verileri yüklenirken hata oluştu.', 'error');
      loadOfflineFallbackData();
    }
  } else {
    loadOfflineFallbackData();
  }
}

// Fallback when Supabase is offline
function loadOfflineFallbackData() {
  // Members mock
  allMembers = JSON.parse(localStorage.getItem('asdfl_alumni') || '[]');
  if (allMembers.length === 0) {
    allMembers = [
      { id: '1', name: 'Alika Yıldız', email: 'alika@example.com', phone: '0555 123 45 67', role: 'Admin', grad_year: 2012, mentor: true, initials: 'AY' },
      { id: '2', name: 'Burak Yılmaz', email: 'burak@example.com', phone: '0532 987 65 43', role: 'Mezun', grad_year: 2008, mentor: false, initials: 'BY' },
      { id: '3', name: 'Ceren Demir', email: 'ceren@example.com', phone: '0544 555 66 77', role: 'Öğrenci', grad_year: 2026, mentor: false, initials: 'CD' }
    ];
    localStorage.setItem('asdfl_alumni', JSON.stringify(allMembers));
  }

  // Events mock
  allEvents = JSON.parse(localStorage.getItem('asdfl_events') || '[]');
  if (allEvents.length === 0) {
    allEvents = [
      { id: '1', title: 'ASDFL Geleneksel Pilav Günü', desc: 'Tüm mezunlarımızı bekliyoruz.', date: '2026-06-15', location: 'Okul Bahçesi', type: 'etkinlik' },
      { id: '2', title: '2026-2027 Burs Başvuruları Başladı', desc: 'Burs başvuruları aktif.', date: '2026-05-15', location: 'Online', type: 'duyuru' }
    ];
    localStorage.setItem('asdfl_events', JSON.stringify(allEvents));
  }

  // Scholarships mock
  allScholarships = JSON.parse(localStorage.getItem('asdfl_scholarships') || '[]');
  if (allScholarships.length === 0) {
    allScholarships = [
      { id: '1', sponsor: 'İstanbul ASDFL Mezunları', title: 'Mühendislik Başarı Bursu', amount: '2.000 ₺ / Ay', deadline: '2026-09-01', active: true },
      { id: '2', sponsor: 'Tıp Mezunları Platformu', title: 'Sağlık Bilimleri Bursu', amount: '2.500 ₺ / Ay', deadline: '2026-09-15', active: true }
    ];
    localStorage.setItem('asdfl_scholarships', JSON.stringify(allScholarships));
  }

  // Applications mock
  allApplications = JSON.parse(localStorage.getItem('asdfl_applications') || '[]');
  if (allApplications.length === 0) {
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
    localStorage.setItem('asdfl_applications', JSON.stringify(allApplications));
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
  }

  setTimeout(() => lucide.createIcons(), 10);
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
            <div class="avatar" style="width:36px;height:36px;font-size:.85rem">${ASDFL.getInitials(m.name)}</div>
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
          <div class="avatar" style="width:34px;height:34px;font-size:.8rem">${ASDFL.getInitials(m.name)}</div>
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
    localStorage.setItem('asdfl_alumni', JSON.stringify(allMembers));
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
    localStorage.setItem('asdfl_alumni', JSON.stringify(allMembers));
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
    const { error } = await ASDFL.supabase.from('profiles').delete().eq('id', memberId);
    if (error) {
      ASDFL.toast('Üye silinemedi: ' + error.message, 'error');
    } else {
      ASDFL.toast('Üye portal kayıtlarından silindi.', 'success');
      loadAdminData().then(() => renderAllPanels());
    }
  } else {
    // Local fallback
    allMembers = allMembers.filter(m => m.id !== memberId);
    localStorage.setItem('asdfl_alumni', JSON.stringify(allMembers));
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
    localStorage.setItem('asdfl_events', JSON.stringify(allEvents));
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
    localStorage.setItem('asdfl_events', JSON.stringify(allEvents));
    ASDFL.toast('Etkinlik silindi! (Local)', 'success');
    renderAllPanels();
  }
};


// ---------------- SCHOLARSHIPS TAB MANAGEMENT ----------------

function renderScholarshipsTable() {
  const tbody = document.getElementById('adminScholarshipsTableBody');
  const countEl = document.getElementById('scholarshipsCount');
  if (!tbody) return;

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
      <td style="text-align:right;display:flex;gap:.5rem;justify-content:flex-end">
        <button class="btn btn-ghost btn-sm" onclick="openEditScholarshipModal('${b.id}')" style="padding:.25rem"><i data-lucide="edit" style="width:1.1rem;height:1.1rem"></i></button>
        <button class="btn btn-ghost btn-sm" onclick="deleteScholarship('${b.id}')" style="color:var(--text-red);padding:.25rem"><i data-lucide="trash-2" style="width:1.1rem;height:1.1rem"></i></button>
      </td>
    </tr>
  `).join('');

  setTimeout(() => lucide.createIcons(), 10);
}

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
    localStorage.setItem('asdfl_scholarships', JSON.stringify(allScholarships));
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
    localStorage.setItem('asdfl_scholarships', JSON.stringify(allScholarships));
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
      <div class="app-card reveal">
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
    localStorage.setItem('asdfl_applications', JSON.stringify(allApplications));
    
    // Automatically turn user to mentor locally if registration approved
    const app = allApplications.find(a => a.id == appId);
    if (app && app.type === 'MentorlukKaydi' && newStatus === 'Approved') {
      allMembers = allMembers.map(m => m.id === app.user_id ? { ...m, mentor: true } : m);
      localStorage.setItem('asdfl_alumni', JSON.stringify(allMembers));
    }

    ASDFL.toast('Başvuru durumu güncellendi! (Local)', 'success');
    renderAllPanels();
  }
};
