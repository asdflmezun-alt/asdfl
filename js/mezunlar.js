// MEZUNLAR PAGE LOGIC
let allAlumni = [];
let myRequests = [];

document.addEventListener('DOMContentLoaded', async () => {
  await ASDFL.waitForAuth();

  const isLoggedIn = !!ASDFL.currentUser;

  if (!isLoggedIn) {
    const loginPrompt = document.getElementById('loginPrompt');
    if (loginPrompt) loginPrompt.style.display = 'block';
    
    const tabsWrapper = document.getElementById('mezunTabsWrapper');
    if (tabsWrapper) tabsWrapper.style.display = 'none';
    
    const tabRehber = document.getElementById('tab-rehber');
    if (tabRehber) tabRehber.style.display = 'none';
    
    const tabYillar = document.getElementById('tab-yillar');
    if (tabYillar) tabYillar.style.display = 'none';
    
    const tabMentorlar = document.getElementById('tab-mentorlar');
    if (tabMentorlar) tabMentorlar.style.display = 'none';
    
    setTimeout(() => lucide.createIcons(), 10);
    return;
  }

  if (ASDFL.supabase) {
    const [alumniData, requestsData] = await Promise.all([
      ASDFL.fetchAlumni(),
      ASDFL.supabase
        .from('contact_requests')
        .select('*')
        .or(`sender_id.eq.${ASDFL.currentUser.id},receiver_id.eq.${ASDFL.currentUser.id}`)
    ]);
    allAlumni = alumniData;
    myRequests = requestsData.data || [];
  } else {
    allAlumni = await ASDFL.fetchAlumni();
    myRequests = [];
  }

  function getContactHTML(alumnus) {
    if (!ASDFL.currentUser) return '';
    
    const isMe = alumnus.id === ASDFL.currentUser.id;
    const hasPhoneShared = !!alumnus.share_phone;
    const hasEmailShared = !!alumnus.share_email;
    
    const approvedRequest = myRequests.find(r => 
      r.sender_id === ASDFL.currentUser.id && 
      r.receiver_id === alumnus.id && 
      r.status === 'Approved'
    );
    const isApproved = !!approvedRequest;

    const pendingRequest = myRequests.find(r => 
      r.sender_id === ASDFL.currentUser.id && 
      r.receiver_id === alumnus.id && 
      r.status === 'Pending'
    );
    const isPending = !!pendingRequest;

    let phoneHTML = '';
    let emailHTML = '';

    if (isMe || hasPhoneShared || isApproved) {
      phoneHTML = `
        <div style="font-size:.82rem; color:var(--text-secondary); margin-top:.4rem; display:flex; align-items:center; gap:.4rem;">
          <i data-lucide="phone" style="width:1em;height:1em;color:var(--gold-500)"></i>
          <span>${alumnus.phone || 'Telefon belirtilmemiş'}</span>
        </div>
      `;
    } else if (isPending) {
      phoneHTML = `
        <div style="font-size:.82rem; color:var(--gold-500); margin-top:.4rem; display:flex; align-items:center; gap:.4rem; opacity:.85;">
          <i data-lucide="clock" style="width:1em;height:1em"></i>
          <span>Erişim Talebi Beklemede</span>
        </div>
      `;
    } else {
      phoneHTML = `
        <div style="margin-top:.5rem;">
          <button class="btn btn-secondary btn-sm" onclick="sendContactRequest('${alumnus.id}')" style="font-size:.75rem; padding:.25rem .75rem; width:100%; display:flex; align-items:center; justify-content:center; gap:.4rem;">
            <i data-lucide="lock" style="width:.9em;height:.9em"></i> İletişim Bilgilerini Talep Et
          </button>
        </div>
      `;
    }

    if (isMe || hasEmailShared || isApproved) {
      emailHTML = `
        <div style="font-size:.82rem; color:var(--text-secondary); margin-top:.4rem; display:flex; align-items:center; gap:.4rem;">
          <i data-lucide="mail" style="width:1em;height:1em;color:var(--gold-500)"></i>
          <span>${alumnus.email || 'E-posta belirtilmemiş'}</span>
        </div>
      `;
    }

    return `
      <div style="border-top: 1px solid var(--glass-border); padding-top: .75rem; margin-top: .75rem; text-align: left;">
        ${emailHTML}
        ${phoneHTML}
      </div>
    `;
  }

  window.sendContactRequest = async function(receiverId) {
    if (!ASDFL.supabase || !ASDFL.currentUser) return;

    const { error } = await ASDFL.supabase
      .from('contact_requests')
      .insert({
        sender_id: ASDFL.currentUser.id,
        receiver_id: receiverId,
        status: 'Pending'
      });

    if (error) {
      ASDFL.toast('Talep gönderilirken hata oluştu: ' + error.message, 'error');
    } else {
      ASDFL.toast('İletişim erişim talebi başarıyla gönderildi!', 'success');
      const requestsData = await ASDFL.supabase
        .from('contact_requests')
        .select('*')
        .or(`sender_id.eq.${ASDFL.currentUser.id},receiver_id.eq.${ASDFL.currentUser.id}`);
      myRequests = requestsData.data || [];
      filterAlumni();
    }
  };

  // Populate filters
  function populateFilters() {
    const years = [...new Set(allAlumni.map(a => a.grad_year).filter(Boolean))].sort((a,b) => b-a);
    const cities = [...new Set(allAlumni.map(a => a.city).filter(Boolean))].sort();
    const yf = document.getElementById('yearFilter');
    const cf = document.getElementById('cityFilter');
    if(yf) years.forEach(y => { const o=document.createElement('option'); o.value=y; o.textContent=y+' Mezunu'; yf.appendChild(o); });
    if(cf) cities.forEach(c => { const o=document.createElement('option'); o.value=c; o.textContent=c; cf.appendChild(o); });
  }

  window.filterAlumni = function() {
    const search = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const year = document.getElementById('yearFilter')?.value || 'all';
    const city = document.getElementById('cityFilter')?.value || 'all';
    const mentorOnly = document.getElementById('mentorOnly')?.checked || false;
    let filtered = allAlumni.filter(a => {
      const matchSearch = !search || (a.name && a.name.toLowerCase().includes(search)) || (a.job && a.job.toLowerCase().includes(search));
      const matchYear = year === 'all' || a.grad_year == year;
      const matchCity = city === 'all' || a.city === city;
      const matchMentor = !mentorOnly || a.mentor;
      return matchSearch && matchYear && matchCity && matchMentor;
    });
    renderAlumniGrid(filtered);
  };

  function renderAlumniGrid(list) {
    const grid = document.getElementById('alumniGrid');
    const count = document.getElementById('alumniCount');
    if(!grid) return;
    if(count) count.textContent = `${list.length} mezun listeleniyor`;
    if(list.length === 0) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text-muted)">
        <div style="font-size:3rem;margin-bottom:1rem"><i data-lucide="search" style="width:1em;height:1em"></i></div>
        <p>Arama kriterlerinize uygun mezun bulunamadı.</p>
      </div>`;
      return;
    }
    grid.innerHTML = list.map(a => `
      <div class="card alumni-card-full lift reveal">
        <div class="ac-header">
          <div class="avatar avatar-lg">${a.initials}</div>
          <div class="ac-info">
            <strong>${a.name}</strong>
            <span>${a.grad_year || 'Bilinmiyor'} Mezunu</span>
          </div>
        </div>
        ${a.job ? `<div class="ac-job"><i data-lucide="briefcase" style="width:1em;height:1em;display:inline-block;vertical-align:middle;margin-top:-2px"></i> ${a.job}</div>` : ''}
        ${a.city ? `<div class="ac-job"><i data-lucide="map-pin" style="width:1em;height:1em;display:inline-block;vertical-align:middle;margin-top:-2px"></i> ${a.city}</div>` : ''}
        ${a.bio ? `<div style="font-size:.82rem;color:var(--text-muted);line-height:1.5">${a.bio}</div>` : ''}
        
        ${getContactHTML(a)}
        
        <div class="ac-tags">
          ${a.mentor ? '<span class="badge badge-teal"><i data-lucide="sparkles" style="width:1em;height:1em"></i> Mentör</span>' : ''}
          ${a.grad_year ? `<span class="badge badge-blue">${a.grad_year}</span>` : ''}
        </div>
        <div class="ac-actions">
          <button class="btn btn-ghost btn-sm" onclick="ASDFL.toast('Profil görüntüleme yakında!','info')">Profili Gör</button>
          ${a.mentor ? `<button class="btn btn-secondary btn-sm" onclick="ASDFL.toast('Mentörlük talebi gönderildi!','success')">Mentör Ol</button>` : ''}
        </div>
      </div>`).join('');
    ASDFL.initReveal();
    setTimeout(() => lucide.createIcons(), 10);
  }

  function renderYillar() {
    const grid = document.getElementById('yillarGrid');
    if(!grid) return;
    const allYears = [];
    for(let y = 2025; y >= 1992; y--) allYears.push(y);
    grid.innerHTML = allYears.map(y => {
      const count = allAlumni.filter(a => a.grad_year == y).length;
      return `
        <div class="card yil-card reveal" onclick="openYilModal(${y})">
          <div>
            <div class="yil-number">${y}</div>
            <div class="yil-info">
              <strong>${y} Mezunları</strong>
              <span>${count > 0 ? count+' kayıtlı mezun' : 'Henüz kayıt yok'}</span>
            </div>
          </div>
          <div class="yil-arrow"><i data-lucide="chevron-right" style="width:1.2rem;height:1.2rem"></i></div>
        </div>`;
    }).join('');
    ASDFL.initReveal();
    setTimeout(() => lucide.createIcons(), 10);
  }

  function renderMentors() {
    const grid = document.getElementById('mentorGrid');
    if(!grid) return;
    const mentors = allAlumni.filter(a => a.mentor);
    grid.innerHTML = mentors.map(a => `
      <div class="card mentor-card lift reveal">
        <div class="mc-avatar">
          <div class="avatar avatar-xl">${a.initials}</div>
          <div class="mc-badge"><i data-lucide="star" style="width:1em;height:1em"></i></div>
        </div>
        <h4>${a.name}</h4>
        <span class="mc-year">${a.grad_year || 'Bilinmiyor'} Mezunu</span>
        ${a.job ? `<div class="mc-job"><i data-lucide="briefcase" style="width:1em;height:1em;display:inline-block;vertical-align:middle;margin-top:-2px"></i> ${a.job}</div>` : ''}
        ${a.city ? `<div class="mc-city"><i data-lucide="map-pin" style="width:1em;height:1em;display:inline-block;vertical-align:middle;margin-top:-2px"></i> ${a.city}</div>` : ''}
        ${a.bio ? `<div style="font-size:.78rem;color:var(--text-muted);margin-top:.75rem;line-height:1.5">${a.bio}</div>` : ''}
        <button class="btn btn-primary btn-sm" style="margin-top:1rem;width:100%" onclick="ASDFL.toast('Mentörlük talebi gönderildi!','success')">Bağlantı Kur</button>
      </div>`).join('');
    ASDFL.initReveal();
    setTimeout(() => lucide.createIcons(), 10);
  }

  window.switchTab = function(tab, btn) {
    document.querySelectorAll('.mezun-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-rehber').style.display = tab === 'rehber' ? '' : 'none';
    document.getElementById('tab-yillar').style.display = tab === 'yillar' ? '' : 'none';
    document.getElementById('tab-mentorlar').style.display = tab === 'mentorlar' ? '' : 'none';
  };

  window.openYilModal = function(year) {
    const grads = allAlumni.filter(a => a.grad_year == year);
    if(grads.length === 0) {
      ASDFL.toast(`${year} yılı için henüz mezun kaydı yok.`, 'info');
      return;
    }
    
    document.getElementById('classModalTitle').textContent = `${year} Mezunları`;
    
    const sections = {};
    grads.forEach(g => {
      const sec = g.class_section || 'Diğer';
      if(!sections[sec]) sections[sec] = [];
      sections[sec].push(g);
    });
    
    const sectionKeys = Object.keys(sections).sort((a,b) => {
      if(a === 'Diğer') return 1;
      if(b === 'Diğer') return -1;
      return a.localeCompare(b);
    });
    
    const tabsContainer = document.getElementById('classTabs');
    tabsContainer.innerHTML = sectionKeys.map((sec, idx) => `
      <button class="mezun-tab ${idx === 0 ? 'active' : ''}" onclick="switchClassTab('${sec}', this, ${year})">
        ${sec === 'Diğer' ? 'Şube Belirtmeyenler' : sec + ' Şubesi'} (${sections[sec].length})
      </button>
    `).join('');
    
    window.currentClassSections = sections;
    renderClassGrid(sectionKeys[0]);
    
    ASDFL.openModal('classModal');
  };

  window.switchClassTab = function(sec, btn, year) {
    document.querySelectorAll('#classTabs .mezun-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderClassGrid(sec);
  };

  function renderClassGrid(sec) {
    const grid = document.getElementById('classGrid');
    const students = window.currentClassSections[sec] || [];
    
    if(students.length === 0) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--text-muted)">Kayıt bulunamadı.</div>';
      return;
    }
    
    grid.innerHTML = students.map(a => `
      <div class="card p-card" style="margin-bottom:1rem">
        <div class="p-header">
          <div class="avatar">${a.initials}</div>
          <div class="p-info">
            <strong>${a.name}</strong>
            <span>${a.grad_year} Mezunu ${a.class_section ? '- ' + a.class_section + ' Şubesi' : ''}</span>
          </div>
        </div>
        <div class="p-body">
          ${a.job ? `<div class="p-detail"><i data-lucide="briefcase" style="width:1em;height:1em"></i> ${a.job}</div>` : ''}
          ${a.city ? `<div class="p-detail"><i data-lucide="map-pin" style="width:1em;height:1em"></i> ${a.city}</div>` : ''}
          
          ${getContactHTML(a)}
        </div>
      </div>
    `).join('');
    
    setTimeout(() => lucide.createIcons(), 10);
  }

  populateFilters();
  filterAlumni();
  renderYillar();
  renderMentors();
});
